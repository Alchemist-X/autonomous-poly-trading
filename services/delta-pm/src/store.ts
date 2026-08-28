// On-disk state under the shared artifacts volume (PRD §10):
//   <artifacts>/delta-pm/portfolio.json      — paper book (atomic writes)
//   <artifacts>/delta-pm/ledger.jsonl        — append-only event journal
//   <artifacts>/delta-pm/news/<sanitized-id>.json — NewsItem source-of-truth archive (原文存档)
//   <artifacts>/delta-pm/signals/<id>.json   — NewsSignal archive
//   <artifacts>/delta-pm/theses/<id>.json    — TradeThesis archive
//   <artifacts>/delta-pm/runs/<id>.json      — per-run progress state (console)
//   <artifacts>/delta-pm/market/...          — self-built candle archive
//   <artifacts>/delta-pm/feed-state.json     — poller dedupe state (seen ids, etag)
// Same root-resolution rules as forecast-engine/paper-agent so VM containers
// and local dev agree on paths.

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { newsItemSchema, type NewsItem } from "@autopoly/delta-pm-contracts";

export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function pmRoot(): string {
  return process.env.ARTIFACT_STORAGE_ROOT
    ? path.join(process.env.ARTIFACT_STORAGE_ROOT, "delta-pm")
    : path.join(repoRoot(), "runtime-artifacts", "delta-pm");
}

export const paths = {
  portfolio: () => path.join(pmRoot(), "portfolio.json"),
  ledger: () => path.join(pmRoot(), "ledger.jsonl"),
  feedState: () => path.join(pmRoot(), "feed-state.json"),
  newsDir: () => path.join(pmRoot(), "news"),
  signalsDir: () => path.join(pmRoot(), "signals"),
  thesesDir: () => path.join(pmRoot(), "theses"),
  runsDir: () => path.join(pmRoot(), "runs"),
  reportsDir: () => path.join(pmRoot(), "reports"),
  marketDir: () => path.join(pmRoot(), "market")
};

// --- news source-of-truth archive ------------------------------------------
// One canonical record per news id. Feed ids contain `/` and `:` (Atom tag
// URIs), so filenames are the sanitized id tail (PR #121 convention — the
// audit endpoint indexes by the id INSIDE the JSON, not the filename); the
// id-equality guard below turns any tail collision into a miss, never a
// wrong record.

function newsFile(newsId: string): string {
  return path.join(paths.newsDir(), `${newsId.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120)}.json`);
}

export function loadNewsItem(newsId: string): NewsItem | null {
  const raw = readJson<unknown>(newsFile(newsId));
  if (!raw) return null;
  const parsed = newsItemSchema.safeParse(raw);
  return parsed.success && parsed.data.id === newsId ? parsed.data : null;
}

// The same article can arrive under two ids: the Atom entry id from the feed
// (`tag:...`) and `sitemap:<url>` from the gap backfill. Identity therefore
// also resolves by URL — the FIRST record to claim a URL owns it, so a second
// arrival is a re-ingest of the original (t0 preserved), not a second signal.
// The index is per-root and rebuilt lazily so tests can swap artifact roots.
interface UrlClaim {
  id: string;
  fetchedAtUtc: string;
}

let urlIndexDir: string | null = null;
let urlIndex: Map<string, UrlClaim> | null = null;

export function normalizeNewsUrl(url: string): string {
  return url.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
}

function newsUrlIndex(): Map<string, UrlClaim> {
  const dir = paths.newsDir();
  if (urlIndex && urlIndexDir === dir) return urlIndex;
  const index = new Map<string, UrlClaim>();
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const parsed = newsItemSchema.safeParse(readJson<unknown>(path.join(dir, file)));
      if (!parsed.success) continue;
      claimUrl(index, parsed.data);
    }
  }
  urlIndex = index;
  urlIndexDir = dir;
  return index;
}

// Earliest arrival owns the URL — the same rule the merge uses for identity,
// applied identically whether the index is rebuilt from disk or updated live.
function claimUrl(index: Map<string, UrlClaim>, item: NewsItem): void {
  if (!item.url) return;
  const key = normalizeNewsUrl(item.url);
  const incumbent = index.get(key);
  if (incumbent && incumbent.fetchedAtUtc <= item.fetchedAtUtc) return;
  index.set(key, { id: item.id, fetchedAtUtc: item.fetchedAtUtc });
}

function rememberNewsUrl(item: NewsItem): void {
  claimUrl(newsUrlIndex(), item);
}

// Canonical news id that already owns this URL, or null when the URL is new.
export function findNewsIdByUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return newsUrlIndex().get(normalizeNewsUrl(url))?.id ?? null;
}

export interface NewsUpsertResult {
  item: NewsItem; // the merged record actually persisted
  existed: boolean; // a record for this id was already on disk (=> this is a re-ingest)
  fullTextAttached: boolean; // this upsert added full text the record didn't have
}

// Merge rule: the FIRST record for an id is the source of truth for identity
// and timing (title/url/publishedUtc/prefix/...); later ingests may only fill
// gaps (fullText, updatedUtc, a url the original lacked). publishedUtc = t0 is
// never overwritten — that is the whole point of the archive.
export function upsertNewsItem(incoming: NewsItem): NewsUpsertResult {
  const existing = loadNewsItem(incoming.id);
  if (!existing) {
    writeJsonAtomic(newsFile(incoming.id), incoming);
    rememberNewsUrl(incoming);
    return { item: incoming, existed: false, fullTextAttached: Boolean(incoming.fullText) };
  }
  const merged: NewsItem = {
    ...existing,
    fullText: incoming.fullText ?? existing.fullText,
    url: existing.url ?? incoming.url,
    author: existing.author ?? incoming.author,
    teaser: existing.teaser || incoming.teaser,
    updatedUtc: incoming.updatedUtc ?? existing.updatedUtc
  };
  writeJsonAtomic(newsFile(incoming.id), merged);
  rememberNewsUrl(merged);
  return { item: merged, existed: true, fullTextAttached: Boolean(incoming.fullText && !existing.fullText) };
}

export function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Atomic write (tmp + rename) so a crash never leaves a torn file.
export function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, file);
}

// Cross-process advisory lock (O_EXCL + stale reclaim) guarding the book.
function lockPath(): string {
  return path.join(pmRoot(), "book.lock");
}

export function acquireBookLock(staleMs = 30 * 60_000): boolean {
  mkdirSync(pmRoot(), { recursive: true });
  const file = lockPath();
  try {
    const fd = openSync(file, "wx");
    writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as { at?: string };
      if (raw.at && Date.now() - Date.parse(raw.at) > staleMs) {
        rmSync(file, { force: true });
        return acquireBookLock(staleMs);
      }
    } catch {
      // unreadable lock — leave it; caller backs off
    }
    return false;
  }
}

export function releaseBookLock(): void {
  rmSync(lockPath(), { force: true });
}

export function appendLedger(event: Record<string, unknown>): void {
  mkdirSync(path.dirname(paths.ledger()), { recursive: true });
  appendFileSync(paths.ledger(), JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n", "utf8");
}

export function readLedger(): Array<Record<string, unknown>> {
  const file = paths.ledger();
  if (!existsSync(file)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // tolerate a torn tail line
    }
  }
  return out;
}

export function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}
