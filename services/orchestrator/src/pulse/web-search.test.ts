import { describe, expect, it } from "vitest";
import type { OrchestratorConfig } from "../config.js";
import type { PulseCandidate } from "./market-pulse.js";
import {
  buildPulseWebSearchQueries,
  collectPulseWebSearchEvidence,
  resolvePulseWebSearchTimeoutMs,
  searchExa,
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

  it("searchExa sends the recommended request and maps results incl. publishedDate", async () => {
    const savedKey = process.env.EXA_API_KEY;
    process.env.EXA_API_KEY = "exa-test-key";
    try {
      let seen: { url: string; init: RequestInit } | null = null;
      const fakeFetch = (async (url: string, init: RequestInit) => {
        seen = { url, init };
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                title: "Iran deal reached",
                url: "https://www.reuters.com/world/iran-deal/",
                publishedDate: "2026-06-04T10:00:00.000Z",
                highlights: ["Negotiators reached   a deal", "signing expected Friday"]
              },
              { title: "no url, dropped", highlights: ["x"] }
            ]
          })
        };
      }) as unknown as typeof fetch;

      const results = await searchExa("iran deal", { signal: new AbortController().signal }, fakeFetch);

      const body = JSON.parse(String(seen!.init.body));
      expect(seen!.url).toBe("https://api.exa.ai/search");
      expect((seen!.init.headers as Record<string, string>)["x-api-key"]).toBe("exa-test-key");
      expect(body).toEqual({ query: "iran deal", type: "auto", numResults: 4, contents: { highlights: true } });
      expect(results).toEqual([
        {
          title: "Iran deal reached",
          url: "https://www.reuters.com/world/iran-deal/",
          sourceHost: "reuters.com",
          snippet: "Negotiators reached a deal … signing expected Friday",
          rank: 1,
          publishedDate: "2026-06-04T10:00:00.000Z"
        }
      ]);
    } finally {
      if (savedKey === undefined) delete process.env.EXA_API_KEY;
      else process.env.EXA_API_KEY = savedKey;
    }
  });

  it("searchExa surfaces API errors instead of returning empty results", async () => {
    const savedKey = process.env.EXA_API_KEY;
    process.env.EXA_API_KEY = "exa-test-key";
    try {
      const failing = (async () => ({ ok: false, status: 429, text: async () => "rate limited" })) as unknown as typeof fetch;
      await expect(searchExa("q", { signal: new AbortController().signal }, failing)).rejects.toThrow(
        /exa search 429: rate limited/
      );
    } finally {
      if (savedKey === undefined) delete process.env.EXA_API_KEY;
      else process.env.EXA_API_KEY = savedKey;
    }
  });

  it("reports a loud failed summary when EXA_API_KEY is missing (no keyless fallback)", async () => {
    const savedKey = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;
    try {
      const summary = await collectPulseWebSearchEvidence({
        candidates: [createCandidate()],
        config: createConfig(),
        now: () => new Date("2026-06-05T00:00:00.000Z")
      });
      expect(summary.status).toBe("failed");
      expect(summary.failureReason).toContain("EXA_API_KEY is not set");
      expect(summary.candidates).toEqual([]);
    } finally {
      if (savedKey === undefined) delete process.env.EXA_API_KEY;
      else process.env.EXA_API_KEY = savedKey;
    }
  });

  it("collects injected search results without touching the network", async () => {
    const summary = await collectPulseWebSearchEvidence({
      candidates: [createCandidate()],
      config: createConfig(),
      search: async (query) => [createResult(`https://example.com/${encodeURIComponent(query)}`)],
      now: () => new Date("2026-06-05T00:00:00.000Z")
    });

    expect(summary.status).toBe("completed");
    expect(summary.enabled).toBe(true);
    expect(summary.searchedAtUtc).toBe("2026-06-05T00:00:00.000Z");
    expect(summary.candidates).toHaveLength(1);
    expect(summary.candidates[0]?.queries.length).toBeGreaterThan(1);
    expect(summary.candidates[0]?.queries[0]?.results[0]?.sourceHost).toBe("example.com");
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
