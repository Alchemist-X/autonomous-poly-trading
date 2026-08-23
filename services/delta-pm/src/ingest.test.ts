import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { NewsItem } from "@autopoly/delta-pm-contracts";
import { resolvePasteRerun } from "./ingest.js";
import { appendLedger, paths, upsertNewsItem, writeJsonAtomic } from "./store.js";

const NOW = "2026-08-23T12:00:00.000Z";
const FEED_ID = "tag:www.theinformation.com,2005:Article/17689";

function original(over: Partial<NewsItem> = {}): NewsItem {
  return {
    id: FEED_ID,
    source: "the-information",
    kind: "article",
    title: "Nvidia Nears $6 Billion Cloud Deal",
    teaser: "The chipmaker is close to a deal.",
    fullText: null,
    url: "https://www.theinformation.com/articles/nvidia-deal",
    author: "Reporter",
    publishedUtc: "2026-08-23T08:00:00.000Z",
    updatedUtc: null,
    prefix: "exclusive",
    fetchedAtUtc: "2026-08-23T08:05:00.000Z",
    ...over
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "delta-pm-ingest-"));
  process.env.ARTIFACT_STORAGE_ROOT = dir;
});

afterEach(() => {
  delete process.env.ARTIFACT_STORAGE_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

describe("resolvePasteRerun — the three 2026-08-23 paste-path bugs", () => {
  it("bug 1: t0 stays the ORIGINAL published time, never the paste time", () => {
    upsertNewsItem(original());
    const res = resolvePasteRerun({ newsId: FEED_ID, fullText: "full article body" }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.publishedUtc).toBe("2026-08-23T08:00:00.000Z"); // not NOW
    expect(res.item.fetchedAtUtc).toBe(NOW);
  });

  it("bug 2: the rerun keeps the ORIGINAL news id (no fresh suffixed id)", () => {
    upsertNewsItem(original());
    const res = resolvePasteRerun({ newsId: FEED_ID, fullText: "body" }, NOW);
    expect(res.ok && res.item.id).toBe(FEED_ID);
  });

  it("bug 3: title/url/prefix come back from the source of truth", () => {
    upsertNewsItem(original());
    const res = resolvePasteRerun({ newsId: FEED_ID, fullText: "body" }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.title).toBe("Nvidia Nears $6 Billion Cloud Deal");
    expect(res.item.url).toBe("https://www.theinformation.com/articles/nvidia-deal");
    expect(res.item.prefix).toBe("exclusive");
    expect(res.item.fullText).toBe("body");
  });

  it("stored record beats caller-supplied fields (source of truth wins)", () => {
    upsertNewsItem(original());
    const res = resolvePasteRerun(
      { newsId: FEED_ID, fullText: "body", title: "operator typo", publishedAtUtc: NOW },
      NOW
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.title).toBe("Nvidia Nears $6 Billion Cloud Deal");
    expect(res.item.publishedUtc).toBe("2026-08-23T08:00:00.000Z");
    expect(res.resolvedFrom).toBe("news_store");
  });

  it("dereferences a signal id to its news id (console signalId fallback)", () => {
    upsertNewsItem(original());
    writeJsonAtomic(path.join(paths.signalsDir(), "sig-abc-x.json"), { id: "sig-abc-x", newsId: FEED_ID, fingerprint: "fp" });
    const res = resolvePasteRerun({ newsId: "sig-abc-x", fullText: "body" }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.id).toBe(FEED_ID);
    expect(res.item.publishedUtc).toBe("2026-08-23T08:00:00.000Z");
  });

  it("falls back to the ledger news_seen record for pre-archive deployments", () => {
    appendLedger({
      type: "news_seen",
      newsId: FEED_ID,
      title: "Nvidia Nears $6 Billion Cloud Deal",
      publishedUtc: "2026-08-23T08:00:00.000Z",
      kind: "article",
      prefix: "exclusive"
    });
    const res = resolvePasteRerun({ newsId: FEED_ID, fullText: "body" }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resolvedFrom).toBe("ledger");
    expect(res.item.publishedUtc).toBe("2026-08-23T08:00:00.000Z");
    expect(res.item.title).toBe("Nvidia Nears $6 Billion Cloud Deal");
    expect(res.item.prefix).toBe("exclusive");
  });

  it("refuses (never guesses t0=now) when the original is unresolvable", () => {
    const res = resolvePasteRerun({ newsId: "tag:unknown/1", fullText: "body" }, NOW);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("refusing to guess t0");
  });

  it("accepts caller title+publishedAtUtc as the last resort", () => {
    const res = resolvePasteRerun(
      { newsId: "tag:unknown/2", fullText: "body", title: "Manual Title", publishedAtUtc: "2026-08-23T07:00:00Z" },
      NOW
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resolvedFrom).toBe("caller_fields");
    expect(res.item.publishedUtc).toBe("2026-08-23T07:00:00.000Z");
    expect(res.item.id).toBe("tag:unknown/2");
  });

  it("caps pasted full text at 50k chars", () => {
    upsertNewsItem(original());
    const res = resolvePasteRerun({ newsId: FEED_ID, fullText: "x".repeat(60_000) }, NOW);
    expect(res.ok && res.item.fullText?.length).toBe(50_000);
  });
});
