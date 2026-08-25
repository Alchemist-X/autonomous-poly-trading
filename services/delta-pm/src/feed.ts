// The Information Atom-feed poller (trigger path; PRD §5).
//
// Contract with the source (measured 2026-08-22):
// - Public feed, no auth; CDN caches 60s; supports ETag/Last-Modified — we
//   always send conditional headers and treat 304 as a no-op.
// - Event time is <published> ONLY. <updated> drifts (in-place edits + batch
//   template touches) and must never re-trigger a signal.
// - Dedupe key is the stable entry <id>.
// - Feed window is ~20 entries (~1.5–2.5 days); sitemap-news.xml (rolling
//   48h) backfills after poller gaps.
// - Compliance: the feed and e-mail are the only automated seams. This module
//   never fetches article pages.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NewsItem } from "@autopoly/delta-pm-contracts";
import { config } from "./config.js";
import { findNewsIdByUrl, paths, readJson, writeJsonAtomic } from "./store.js";

const execFileAsync = promisify(execFile);

// The Information's CDN blocks Node's TLS fingerprint outright (measured
// 2026-08-22: node fetch/https/http2 all 403 regardless of headers, while
// curl passes with ANY user agent). So feed/sitemap fetches shell out to the
// system curl binary. Deployment note: the VM image (node:20-slim) must have
// curl installed — see deploy/raven/Dockerfile.
interface CurlResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export async function curlFetch(url: string, extraHeaders: Record<string, string> = {}): Promise<CurlResult> {
  const args = ["-sS", "--max-time", "20", "-D", "-", "-A", "DeltaPM-FeedReader/0.1 (conditional GET; contact: repo operator)"];
  for (const [k, v] of Object.entries(extraHeaders)) args.push("-H", `${k}: ${v}`);
  args.push(url);
  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 8 * 1024 * 1024 });
  // stdout = one-or-more header blocks (redirects) followed by the body.
  let rest = stdout;
  let status = 0;
  const headers: Record<string, string> = {};
  while (rest.startsWith("HTTP/")) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const block = rest.slice(0, headerEnd);
    rest = rest.slice(headerEnd + 4);
    const lines = block.split("\r\n");
    status = Number(lines[0].split(" ")[1] ?? 0);
    for (const line of lines.slice(1)) {
      const idx = line.indexOf(":");
      if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }
  return { status, headers, body: rest };
}

interface FeedState {
  etag: string | null;
  lastModified: string | null;
  seenIds: string[]; // most-recent-first, capped
  lastPollUtc: string | null;
  lastNewItemUtc: string | null;
  lastError: string | null;
}

const SEEN_CAP = 2000;

export function loadFeedState(): FeedState {
  return (
    readJson<FeedState>(paths.feedState()) ?? {
      etag: null,
      lastModified: null,
      seenIds: [],
      lastPollUtc: null,
      lastNewItemUtc: null,
      lastError: null
    }
  );
}

function saveFeedState(state: FeedState): void {
  writeJsonAtomic(paths.feedState(), state);
}

// --- tiny XML helpers (Atom is regular enough; no XML dependency by repo norm)

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "g");
  return xml.match(re) ?? [];
}

function text(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function attr(block: string, tag: string, name: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titlePrefix(title: string): NewsItem["prefix"] {
  const t = title.toLowerCase();
  if (t.startsWith("exclusive")) return "exclusive";
  if (/\breportedly\b/.test(t)) return "reportedly";
  return "none";
}

function kindFromUrl(url: string | null): NewsItem["kind"] {
  if (url && url.includes("/briefings/")) return "briefing";
  return "article";
}

export function parseAtom(xml: string, fetchedAtUtc: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const entry of blocks(xml, "entry")) {
    const id = text(entry, "id");
    const published = text(entry, "published");
    const title = text(entry, "title");
    if (!id || !published || !title) continue;
    const url = attr(entry, "link", "href");
    const contentHtml = text(entry, "content") ?? "";
    out.push({
      id,
      source: "the-information",
      kind: kindFromUrl(url),
      title,
      teaser: stripHtml(contentHtml).slice(0, 4000),
      fullText: null,
      url,
      author: text(entry, "name"),
      publishedUtc: new Date(published).toISOString(),
      updatedUtc: text(entry, "updated") ? new Date(text(entry, "updated") as string).toISOString() : null,
      prefix: titlePrefix(title),
      fetchedAtUtc
    });
  }
  return out;
}

export interface PollResult {
  newItems: NewsItem[];
  notModified: boolean;
}

// One conditional-GET poll. Returns only items whose entry id was never seen.
export async function pollFeed(): Promise<PollResult> {
  const state = loadFeedState();
  const headers: Record<string, string> = { accept: "application/atom+xml, application/xml" };
  if (state.etag) headers["if-none-match"] = state.etag;
  if (state.lastModified) headers["if-modified-since"] = state.lastModified;

  const nowIso = new Date().toISOString();
  try {
    const res = await curlFetch(config.feedUrl, headers);
    state.lastPollUtc = nowIso;
    if (res.status === 304) {
      state.lastError = null;
      saveFeedState(state);
      return { newItems: [], notModified: true };
    }
    if (res.status !== 200) throw new Error(`GET feed → ${res.status}`);
    state.etag = res.headers["etag"] ?? null;
    state.lastModified = res.headers["last-modified"] ?? null;
    const xml = res.body;
    const items = parseAtom(xml, nowIso);
    const seen = new Set(state.seenIds);
    const fresh = items.filter((i) => !seen.has(i.id));
    if (fresh.length) {
      state.seenIds = [...fresh.map((i) => i.id), ...state.seenIds].slice(0, SEEN_CAP);
      state.lastNewItemUtc = nowIso;
    }
    state.lastError = null;
    saveFeedState(state);
    return { newItems: fresh, notModified: false };
  } catch (error) {
    state.lastPollUtc = nowIso;
    state.lastError = error instanceof Error ? error.message : String(error);
    saveFeedState(state);
    throw error;
  }
}

// Gap backfill: sitemap-news.xml carries a rolling ~48h of URLs with
// publication_date + title (no teaser). Items recovered here carry an empty
// teaser and are flagged via kind detection only — still enough for gate 1
// to decide whether a (delayed) analysis is worth it.
export function parseSitemap(xml: string, fetchedAtUtc: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const u of blocks(xml, "url")) {
    const loc = text(u, "loc");
    const pub = text(u, "news:publication_date") ?? text(u, "publication_date");
    const title = text(u, "news:title") ?? text(u, "title");
    if (!loc || !pub || !title) continue;
    out.push({
      id: `sitemap:${loc}`,
      source: "the-information",
      kind: kindFromUrl(loc),
      title,
      teaser: "",
      fullText: null,
      url: loc,
      author: null,
      publishedUtc: new Date(pub).toISOString(),
      updatedUtc: null,
      prefix: titlePrefix(title),
      fetchedAtUtc
    });
  }
  return out;
}

// Items the sitemap re-offers must be filtered by URL, not just by id: the feed
// knows a story as `tag:www.theinformation.com,2005:Briefing/17919` while the
// sitemap knows the same story as `sitemap:<url>`, so an id-only check let every
// restart re-ingest the whole 48h window (measured on the VM 2026-08-25: 16
// duplicate re-analyses in one restart, each paying gate 1 + coverage search).
export function selectSitemapBackfill(items: NewsItem[], seenIds: string[]): NewsItem[] {
  const seen = new Set(seenIds);
  return items.filter((i) => !seen.has(i.id) && !findNewsIdByUrl(i.url));
}

export async function backfillFromSitemap(): Promise<NewsItem[]> {
  const res = await curlFetch(config.sitemapNewsUrl, { accept: "application/xml" });
  if (res.status !== 200) throw new Error(`GET sitemap-news → ${res.status}`);
  const state = loadFeedState();
  const nowIso = new Date().toISOString();
  const out = selectSitemapBackfill(parseSitemap(res.body, nowIso), state.seenIds);
  if (out.length) {
    state.seenIds = [...out.map((i) => i.id), ...state.seenIds].slice(0, SEEN_CAP);
    saveFeedState(state);
  }
  return out;
}
