import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { NewsItem } from "@autopoly/delta-pm-contracts";
import {
  acquireBookLock,
  appendLedger,
  findNewsIdByUrl,
  loadNewsItem,
  paths,
  readJson,
  readLedger,
  releaseBookLock,
  upsertNewsItem,
  writeJsonAtomic
} from "./store.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "delta-pm-store-"));
  process.env.ARTIFACT_STORAGE_ROOT = dir;
});

afterEach(() => {
  delete process.env.ARTIFACT_STORAGE_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("writeJsonAtomic/readJson round-trip", () => {
    const file = path.join(dir, "delta-pm", "x.json");
    writeJsonAtomic(file, { a: 1 });
    expect(readJson<{ a: number }>(file)).toEqual({ a: 1 });
  });

  it("readJson returns null for missing or corrupt files", () => {
    const file = path.join(dir, "nope.json");
    expect(readJson(file)).toBeNull();
    writeJsonAtomic(file, { ok: true });
    appendFileSync(file, "garbage");
    expect(readJson(file)).toBeNull();
  });

  it("ledger appends with timestamps and tolerates a torn tail line", () => {
    appendLedger({ type: "service_start" });
    appendLedger({ type: "news_seen", newsId: "n1" });
    appendFileSync(paths.ledger(), '{"type":"torn'); // simulated crash mid-write
    const events = readLedger();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("service_start");
    expect(typeof events[0].ts).toBe("string");
  });

  it("book lock is exclusive and releasable", () => {
    expect(acquireBookLock()).toBe(true);
    expect(acquireBookLock()).toBe(false); // held
    releaseBookLock();
    expect(acquireBookLock()).toBe(true);
    releaseBookLock();
  });
});

describe("news source-of-truth archive", () => {
  function item(over: Partial<NewsItem> = {}): NewsItem {
    return {
      id: "tag:www.theinformation.com,2005:Article/17689", // real ids carry / and :
      source: "the-information",
      kind: "article",
      title: "Nvidia Nears $6 Billion Cloud Deal",
      teaser: "teaser text",
      fullText: null,
      url: "https://www.theinformation.com/articles/x",
      author: "Reporter",
      publishedUtc: "2026-08-23T08:00:00.000Z",
      updatedUtc: null,
      prefix: "exclusive",
      fetchedAtUtc: "2026-08-23T08:05:00.000Z",
      ...over
    };
  }

  it("round-trips ids with slashes and colons", () => {
    upsertNewsItem(item());
    expect(loadNewsItem(item().id)?.title).toBe("Nvidia Nears $6 Billion Cloud Deal");
    expect(loadNewsItem("tag:other/1")).toBeNull();
  });

  it("first record owns identity+timing; re-ingest only fills gaps", () => {
    upsertNewsItem(item());
    const res = upsertNewsItem(
      item({
        title: "[补全原文] tag:...", // garbage from a paste must not win
        publishedUtc: "2026-08-23T12:00:00.000Z", // paste time must not win
        url: null,
        teaser: "",
        fullText: "the pasted full article"
      })
    );
    expect(res.existed).toBe(true);
    expect(res.fullTextAttached).toBe(true);
    expect(res.item.title).toBe("Nvidia Nears $6 Billion Cloud Deal");
    expect(res.item.publishedUtc).toBe("2026-08-23T08:00:00.000Z");
    expect(res.item.url).toBe("https://www.theinformation.com/articles/x");
    expect(res.item.teaser).toBe("teaser text");
    expect(res.item.fullText).toBe("the pasted full article");
    expect(loadNewsItem(item().id)?.fullText).toBe("the pasted full article");
  });

  it("a re-ingest without full text never erases previously attached full text", () => {
    upsertNewsItem(item({ fullText: "attached earlier" }));
    const res = upsertNewsItem(item({ fullText: null }));
    expect(res.fullTextAttached).toBe(false);
    expect(res.item.fullText).toBe("attached earlier");
  });

  it("resolves identity by URL so a second id for the same story finds the original", () => {
    upsertNewsItem(item());
    expect(findNewsIdByUrl("https://www.theinformation.com/articles/x")).toBe(item().id);
    expect(findNewsIdByUrl("https://www.theinformation.com/articles/x/?utm_campaign=rss")).toBe(item().id);
    expect(findNewsIdByUrl("https://www.theinformation.com/articles/never-seen")).toBeNull();
    expect(findNewsIdByUrl(null)).toBeNull();
  });

  it("the earliest arrival owns a URL when two ids already claim it", () => {
    upsertNewsItem(item({ id: "sitemap:https://www.theinformation.com/articles/x", fetchedAtUtc: "2026-08-25T06:39:00.000Z" }));
    upsertNewsItem(item({ fetchedAtUtc: "2026-08-23T08:05:00.000Z" }));
    expect(findNewsIdByUrl("https://www.theinformation.com/articles/x")).toBe(item().id);
  });
});
