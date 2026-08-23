// Paste-rerun resolution (the console's 补全原文 seam), pure logic so the
// three 2026-08-23 paste-path bugs stay covered by tests:
//   1. t0 must stay the ORIGINAL published time — pasting never resets the
//      clock (a reset made gate 2 read "price hasn't reacted" on news that
//      had already moved);
//   2. the rerun keeps the ORIGINAL news id — a fresh suffixed id made the
//      staleness check archive the paste as "duplicate" of its own signal;
//   3. title/url/teaser come back from the source-of-truth archive — gate 1
//      judges mostly on the title, and "[补全原文] tag:..." is not a title.
// Resolution order: news store (source of truth) → signal file reference →
// ledger news_seen scan (pre-archive deployments) → caller-supplied fields.
// Nothing resolvable and no caller fields → explicit refusal, never t0=now.

import path from "node:path";
import { newsItemSchema, type NewsItem } from "@autopoly/delta-pm-contracts";
import { loadNewsItem, paths, readJson, readLedger } from "./store.js";

const FULL_TEXT_CAP = 50_000;

export interface PasteRequest {
  newsId: string; // news id, or a signal id (console falls back to signalId)
  fullText: string;
  title?: string | null;
  url?: string | null;
  publishedAtUtc?: string | null;
}

export type PasteResolution =
  | { ok: true; item: NewsItem; resolvedFrom: "news_store" | "ledger" | "caller_fields" }
  | { ok: false; error: string };

function isoOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

interface LedgerNewsSeen {
  type?: string;
  newsId?: string;
  title?: string;
  publishedUtc?: string;
  kind?: string;
  prefix?: string;
}

function fromLedger(newsId: string): LedgerNewsSeen | null {
  // Latest news_seen wins (a later feed pass may have carried a fuller title).
  let found: LedgerNewsSeen | null = null;
  for (const ev of readLedger()) {
    const e = ev as LedgerNewsSeen;
    if (e.type === "news_seen" && e.newsId === newsId && e.title && isoOrNull(e.publishedUtc)) found = e;
  }
  return found;
}

export function resolvePasteRerun(req: PasteRequest, nowIso: string): PasteResolution {
  // The id may be a signal id — dereference it to the underlying news id.
  let newsId = req.newsId;
  if (!loadNewsItem(newsId)) {
    const sig = readJson<{ newsId?: string }>(path.join(paths.signalsDir(), `${req.newsId}.json`));
    if (sig && typeof sig.newsId === "string" && sig.newsId) newsId = sig.newsId;
  }

  const fullText = req.fullText.slice(0, FULL_TEXT_CAP);
  const stored = loadNewsItem(newsId);
  if (stored) {
    // Source of truth wins over caller fields for identity and timing.
    return { ok: true, resolvedFrom: "news_store", item: { ...stored, fullText, fetchedAtUtc: nowIso } };
  }

  const seen = fromLedger(newsId);
  if (seen) {
    const candidate = {
      id: newsId,
      source: "the-information",
      kind: seen.kind ?? "article",
      title: seen.title!,
      teaser: "",
      fullText,
      url: req.url ?? null,
      author: null,
      publishedUtc: isoOrNull(seen.publishedUtc)!,
      updatedUtc: null,
      prefix: seen.prefix ?? "none",
      fetchedAtUtc: nowIso
    };
    const parsed = newsItemSchema.safeParse(candidate);
    if (parsed.success) return { ok: true, resolvedFrom: "ledger", item: parsed.data };
  }

  const callerPublished = isoOrNull(req.publishedAtUtc);
  if (req.title && callerPublished) {
    const parsed = newsItemSchema.safeParse({
      id: newsId,
      source: "the-information",
      kind: "manual",
      title: req.title,
      teaser: "",
      fullText,
      url: req.url ?? null,
      author: null,
      publishedUtc: callerPublished,
      updatedUtc: null,
      prefix: "none",
      fetchedAtUtc: nowIso
    });
    if (parsed.success) return { ok: true, resolvedFrom: "caller_fields", item: parsed.data };
    return { ok: false, error: `caller fields failed schema: ${parsed.error.issues[0]?.message}` };
  }

  return {
    ok: false,
    error:
      `original news ${newsId} not found in the news archive or ledger; ` +
      `refusing to guess t0 — supply title and publishedAtUtc to force the rerun`
  };
}
