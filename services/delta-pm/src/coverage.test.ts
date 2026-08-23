import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NewsItem } from "@autopoly/delta-pm-contracts";
import type { SearchHit } from "../../../packages/forecast-engine/src/web-search";
import { checkPriorCoverage, effectiveT0Ms } from "./coverage.js";

const PUBLISHED = "2026-08-23T08:00:00.000Z";

function item(over: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "n1",
    source: "the-information",
    kind: "article",
    title: "Nvidia Nears $6 Billion Cloud Deal With OpenAI",
    teaser: "",
    fullText: null,
    url: null,
    author: null,
    publishedUtc: PUBLISHED,
    updatedUtc: null,
    prefix: "none",
    fetchedAtUtc: PUBLISHED,
    ...over
  };
}

function hit(over: Partial<SearchHit> = {}): SearchHit {
  return {
    title: "Nvidia nears $6 billion cloud deal with OpenAI",
    url: "https://www.reuters.com/tech/nvidia-openai-deal",
    snippet: "…",
    publishedDate: "2026-08-23T05:00:00.000Z",
    ...over
  };
}

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ["EXA_API_KEY", "TAVILY_API_KEY", "FORECAST_WEB_SEARCH"]) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("checkPriorCoverage", () => {
  it("records a visible skip (not an empty success) when no search key exists", async () => {
    const res = await checkPriorCoverage(item(), async () => [hit()]);
    expect(res.searched).toBe(false);
    expect(res.skippedReason).toContain("EXA_API_KEY");
    expect(res.priorHitCount).toBe(0);
  });

  it("counts a same-story hit published >30min earlier as prior coverage", async () => {
    process.env.EXA_API_KEY = "test";
    const res = await checkPriorCoverage(item(), async () => [hit()]);
    expect(res.searched).toBe(true);
    expect(res.priorHitCount).toBe(1);
    expect(res.earliestPriorUtc).toBe("2026-08-23T05:00:00.000Z");
  });

  it("ignores our own domain, undated hits, near-simultaneous hits, and unrelated titles", async () => {
    process.env.EXA_API_KEY = "test";
    const res = await checkPriorCoverage(item(), async () => [
      hit({ url: "https://www.theinformation.com/articles/self" }), // self
      hit({ publishedDate: undefined }), // undated
      hit({ publishedDate: "2026-08-23T07:45:00.000Z" }), // within 30min slack
      hit({ title: "Apple unveils new iPhone lineup in India event", publishedDate: "2026-08-23T01:00:00.000Z" }) // different story
    ]);
    expect(res.searched).toBe(true);
    expect(res.priorHitCount).toBe(0);
    expect(res.earliestPriorUtc).toBeNull();
    expect(res.hits.length).toBe(3); // self-domain filtered from the recorded list too
  });

  it("picks the EARLIEST prior hit across outlets", async () => {
    process.env.EXA_API_KEY = "test";
    const res = await checkPriorCoverage(item(), async () => [
      hit({ publishedDate: "2026-08-23T06:00:00.000Z", url: "https://www.bloomberg.com/a" }),
      hit({ publishedDate: "2026-08-23T03:30:00.000Z", url: "https://www.reuters.com/b" })
    ]);
    expect(res.priorHitCount).toBe(2);
    expect(res.earliestPriorUtc).toBe("2026-08-23T03:30:00.000Z");
  });

  it("records search failures verbatim and never throws", async () => {
    process.env.EXA_API_KEY = "test";
    const res = await checkPriorCoverage(item(), async () => {
      throw new Error("exa search 500: upstream down");
    });
    expect(res.searched).toBe(false);
    expect(res.error).toContain("exa search 500");
  });
});

describe("effectiveT0Ms", () => {
  it("uses published time when there is no prior coverage", async () => {
    expect(effectiveT0Ms(item(), null)).toBe(Date.parse(PUBLISHED));
  });

  it("shifts t0 to the earliest verified prior appearance (the safe direction)", async () => {
    process.env.EXA_API_KEY = "test";
    const coverage = await checkPriorCoverage(item(), async () => [hit({ publishedDate: "2026-08-23T05:00:00.000Z" })]);
    expect(effectiveT0Ms(item(), coverage)).toBe(Date.parse("2026-08-23T05:00:00.000Z"));
  });

  it("never shifts t0 LATER than published", () => {
    const coverage = {
      searched: true,
      skippedReason: null,
      error: null,
      query: "q",
      priorHitCount: 1,
      earliestPriorUtc: "2026-08-23T09:00:00.000Z", // bogus later timestamp
      hits: []
    };
    expect(effectiveT0Ms(item(), coverage)).toBe(Date.parse(PUBLISHED));
  });
});
