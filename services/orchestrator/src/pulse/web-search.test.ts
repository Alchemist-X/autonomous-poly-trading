import { describe, expect, it } from "vitest";
import type { OrchestratorConfig } from "../config.js";
import type { PulseCandidate } from "./market-pulse.js";
import {
  buildPulseWebSearchQueries,
  collectPulseWebSearchEvidence,
  parseDuckDuckGoHtml,
  resolvePulseWebSearchTimeoutMs,
  selectPagesToFetch,
  type PulseWebSearchQueryEvidence,
  type PulseWebSearchResult
} from "./web-search.js";

function createCandidate(overrides: Partial<PulseCandidate> = {}): PulseCandidate {
  return {
    question: "US-Iran nuclear deal by June 30?",
    eventSlug: "us-iran-nuclear-deal-by-june-30",
    marketSlug: "us-iran-nuclear-deal-by-june-30",
    url: "https://polymarket.com/event/us-iran-nuclear-deal-by-june-30",
    liquidityUsd: 10000,
    volume24hUsd: 1000,
    outcomes: ["Yes", "No"],
    outcomePrices: [0.33, 0.67],
    clobTokenIds: ["yes-token", "no-token"],
    endDate: "2026-06-30T00:00:00Z",
    bestBid: 0.32,
    bestAsk: 0.34,
    spread: 0.02,
    categorySlug: "geopolitics",
    categoryLabel: "Geopolitics",
    tags: [
      { slug: "iran", label: "Iran" },
      { slug: "nuclear", label: "Nuclear" }
    ],
    ...overrides
  };
}

function createConfig(overrides: { enabled?: boolean; timeoutSeconds?: number } = {}): Pick<OrchestratorConfig, "pulse"> {
  return {
    pulse: {
      webSearchEnabled: overrides.enabled ?? true,
      webSearchTimeoutSeconds: overrides.timeoutSeconds ?? 120
    }
  } as Pick<OrchestratorConfig, "pulse">;
}

function createResult(url: string): PulseWebSearchResult {
  return {
    title: "Result title",
    url,
    sourceHost: new URL(url).hostname,
    snippet: "A concise search result snippet.",
    rank: 1
  };
}

describe("Pulse web-search", () => {
  it("builds targeted official and news queries for a market", () => {
    const queries = buildPulseWebSearchQueries(createCandidate());

    expect(queries[0]).toBe("\"US-Iran nuclear deal by June 30?\"");
    expect(queries.some((query) => query.includes("official announcement statement"))).toBe(true);
    expect(queries.some((query) => query.includes("Reuters AP latest"))).toBe(true);
    expect(queries.some((query) => query.includes("site:state.gov"))).toBe(true);
  });

  it("anchors the news query to the current month for recency", () => {
    const queries = buildPulseWebSearchQueries(createCandidate(), new Date("2026-06-05T00:00:00Z"));
    expect(queries.some((query) => query.includes("Reuters AP latest") && query.includes("June 2026"))).toBe(true);
  });

  it("uses bookmaker-odds authority queries for sports markets", () => {
    const queries = buildPulseWebSearchQueries(
      createCandidate({ categorySlug: "soccer", categoryLabel: "Soccer", question: "Will South Africa win on 2026-06-11?" })
    );
    expect(queries.some((query) => query.includes("bookmaker odds"))).toBe(true);
    expect(queries.some((query) => query.includes("site:state.gov"))).toBe(false);
  });

  it("uses data-source authority queries for crypto/finance markets", () => {
    const queries = buildPulseWebSearchQueries(createCandidate({ categorySlug: "crypto", categoryLabel: "Crypto" }));
    expect(queries.some((query) => query.includes("site:coingecko.com"))).toBe(true);
  });

  it("parses DuckDuckGo HTML results and unwraps uddg redirects", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fstory%3Fx%3D1&amp;rut=abc">Example &amp; Story</a>
        <a class="result__snippet">This is <b>the</b> snippet.</a>
      </div>
    `;

    const results = parseDuckDuckGoHtml(html);

    expect(results).toEqual([
      {
        title: "Example & Story",
        url: "https://example.com/story?x=1",
        sourceHost: "example.com",
        snippet: "This is the snippet.",
        rank: 1
      }
    ]);
  });

  it("selectPagesToFetch round-robins across queries, dedupes, and skips non-evidence hosts", () => {
    const queries: PulseWebSearchQueryEvidence[] = [
      {
        query: "q1",
        status: "completed",
        results: [createResult("https://a.com/1"), createResult("https://a.com/2")]
      },
      {
        query: "q2",
        status: "completed",
        results: [createResult("https://polymarket.com/event/x"), createResult("https://b.com/1")]
      },
      { query: "q3", status: "completed", results: [createResult("https://a.com/1")] } // duplicate URL
    ];
    const picks = selectPagesToFetch(queries, 3);
    // rank-0 pass: a.com/1 picked, polymarket skipped, a.com/1 dupe skipped; rank-1 pass: a.com/2, b.com/1
    expect(picks.map((p) => p.url)).toEqual(["https://a.com/1", "https://a.com/2", "https://b.com/1"]);
  });

  it("collects injected search results and page excerpts without touching the network", async () => {
    const summary = await collectPulseWebSearchEvidence({
      candidates: [createCandidate()],
      config: createConfig(),
      search: async (query) => [createResult(`https://example.com/${encodeURIComponent(query)}`)],
      fetchPage: async (url) => `Readable article text from ${url} with a dated fact (2026-06-04).`,
      now: () => new Date("2026-06-05T00:00:00.000Z")
    });

    expect(summary.status).toBe("completed");
    expect(summary.enabled).toBe(true);
    expect(summary.searchedAtUtc).toBe("2026-06-05T00:00:00.000Z");
    expect(summary.candidates).toHaveLength(1);
    expect(summary.candidates[0]?.queries.length).toBeGreaterThan(1);
    expect(summary.candidates[0]?.queries[0]?.results[0]?.sourceHost).toBe("example.com");
    const pages = summary.candidates[0]?.pages ?? [];
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]?.status).toBe("fetched");
    expect(pages[0]?.excerpt).toContain("Readable article text");
  });

  it("records page-fetch failures per URL without failing the whole summary", async () => {
    const summary = await collectPulseWebSearchEvidence({
      candidates: [createCandidate()],
      config: createConfig(),
      search: async () => [createResult("https://broken.com/article")],
      fetchPage: async () => {
        throw new Error("HTTP 500");
      }
    });

    expect(summary.status).toBe("completed");
    const pages = summary.candidates[0]?.pages ?? [];
    expect(pages.some((page) => page.status === "failed" && page.error?.includes("HTTP 500"))).toBe(true);
  });

  it("returns timed_out instead of throwing when the search budget expires", async () => {
    const summary = await collectPulseWebSearchEvidence({
      candidates: [createCandidate()],
      config: createConfig({ timeoutSeconds: 0.001 }),
      search: async (_query, { signal }) => await new Promise<PulseWebSearchResult[]>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    });

    expect(summary.status).toBe("timed_out");
    expect(summary.failureReason).toContain("Timed out");
  });

  it("uses the configured timeout in milliseconds", () => {
    expect(resolvePulseWebSearchTimeoutMs(createConfig({ timeoutSeconds: 120 }))).toBe(120_000);
  });
});
