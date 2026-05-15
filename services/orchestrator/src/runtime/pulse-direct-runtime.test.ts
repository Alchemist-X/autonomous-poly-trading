import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OrchestratorConfig } from "../config.js";
import type { RuntimeExecutionContext } from "./agent-runtime.js";
import { PulseDirectRuntime } from "./pulse-direct-runtime.js";

function createConfig(artifactStorageRoot: string): OrchestratorConfig {
  return {
    repoRoot: process.cwd(),
    port: 4001,
    redisUrl: "redis://localhost:6379",
    envFilePath: null,
    internalToken: "replace-me",
    agentPollCron: "0 */4 * * *",
    syncIntervalSeconds: 30,
    backtestCron: "10 0 * * *",
    resolutionBaseIntervalMinutes: 60,
    resolutionUrgentIntervalMinutes: 15,
    drawdownStopPct: 0.2,
    positionStopLossPct: 0.3,
    maxTotalExposurePct: 0.5,
    maxEventExposurePct: 0.3,
    maxPositions: 10,
    maxTradePct: 0.05,
    minTradeUsd: 10,
    initialBankrollUsd: 10000,
    runtimeProvider: "codex",
    decisionStrategy: "pulse-direct",
    artifactStorageRoot,
    providerTimeoutSeconds: 0,
    pulseFetchTimeoutSeconds: 300,
    pulseTimeoutMode: "default",
    pulseAiPrescreen: false,
    pulse: {
      sourceRepo: "all-polymarket-skill",
      sourceRepoDir: "vendor/repos/all-polymarket-skill",
      pages: 5,
      eventsPerPage: 50,
      minFetchedMarkets: 5000,
      minLiquidityUsd: 5000,
      maxCandidates: 12,
      reportCandidates: 4,
      reportCommentLimit: 20,
      reportTimeoutSeconds: 0,
      directRenderTimeoutSeconds: 1200,
      minTradeableCandidates: 5,
      entryMaxPlans: 4,
      entryFixedNotionalUsd: null,
      maxAgeMinutes: 30,
      maxMarkdownChars: 24000
    },
    providers: {
      codex: {
        command: "",
        model: "",
        skillRootDir: "vendor/repos/all-polymarket-skill",
        skillLocale: "zh",
        skills: "polymarket-market-pulse,portfolio-review-polymarket"
      },
      openclaw: {
        command: "",
        model: "",
        skillRootDir: "vendor/repos/all-polymarket-skill",
        skillLocale: "zh",
        skills: "polymarket-market-pulse"
      }
    }
  };
}

function createContext(reviewPositionsOnly: boolean): RuntimeExecutionContext {
  const markdown = [
    "## Demo market question",
    "",
    "**Link:** https://example.com/demo-market",
    "",
    "| Direction | Buy No |",
    "| Confidence | medium |",
    "",
    "| Outcome | Market | AI |",
    "| --- | --- | --- |",
    "| Yes | 42% | 35% |",
    "| No | 58% | 65% |",
    "",
    "### Reasoning",
    "No still has positive edge."
  ].join("\n");

  return {
    runId: "11111111-1111-4111-8111-111111111111",
    mode: "full",
    overview: {
      status: "running",
      cash_balance_usd: 20,
      total_equity_usd: 30,
      high_water_mark_usd: 30,
      drawdown_pct: 0,
      open_positions: 1,
      last_run_at: null,
      latest_risk_event: null,
      equity_curve: []
    },
    positions: [
      {
        id: "position-1",
        event_slug: "demo-event",
        market_slug: "demo-market",
        token_id: "token-no",
        side: "BUY",
        outcome_label: "No",
        size: 10,
        avg_cost: 0.5,
        current_price: 0.58,
        current_value_usd: 5.8,
        unrealized_pnl_pct: 0.16,
        stop_loss_pct: 0.3,
        opened_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z"
      }
    ],
    pulse: {
      id: "pulse-1",
      generatedAtUtc: "2026-03-17T00:00:00.000Z",
      title: "Position Review Pulse",
      relativeMarkdownPath: "reports/pulse/demo.md",
      absoluteMarkdownPath: "/tmp/reports/pulse/demo.md",
      relativeJsonPath: "reports/pulse/demo.json",
      absoluteJsonPath: "/tmp/reports/pulse/demo.json",
      markdown,
      totalFetched: 1,
      totalFiltered: 1,
      selectedCandidates: 1,
      minLiquidityUsd: 0,
      fetchConfig: {
        pagesPerDimension: 0,
        eventsPerPage: 1,
        minFetchedMarkets: 1,
        dimensions: ["existing-positions"]
      },
      categoryStats: { fetched: [], filtered: [] },
      tagStats: { fetched: [], filtered: [] },
      candidates: [
        {
          question: "Demo market question",
          eventSlug: "demo-event",
          marketSlug: "demo-market",
          url: "https://example.com/demo-market",
          liquidityUsd: 1000,
          volume24hUsd: 100,
          outcomes: ["Yes", "No"],
          outcomePrices: [0.42, 0.58],
          clobTokenIds: ["token-yes", "token-no"],
          endDate: "2026-12-31T00:00:00.000Z",
          bestBid: 0.57,
          bestAsk: 0.59,
          spread: 0.02,
          categorySlug: null,
          categoryLabel: null,
          categorySource: null,
          tags: []
        }
      ],
      riskFlags: [],
      tradeable: true
    },
    reviewPositionsOnly
  };
}

describe("PulseDirectRuntime position-only review", () => {
  it("uses parsed Pulse edge for the held token without emitting an add-on open", async () => {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "pulse-direct-runtime-"));
    try {
      const runtime = new PulseDirectRuntime(createConfig(artifactRoot));
      const result = await runtime.run(createContext(true));

      expect(result.positionReviews?.[0]?.edgeValue).toBeCloseTo(0.07);
      expect(result.positionReviews?.[0]?.basis).toBe("pulse-supports-current");
      expect(result.entryPlans).toEqual([]);
      expect(result.decisionSet.decisions).toHaveLength(1);
      expect(result.decisionSet.decisions[0]?.action).toBe("hold");
      expect(result.decisionSet.decisions[0]?.edge).toBeCloseTo(0.07);
    } finally {
      await rm(artifactRoot, { recursive: true, force: true });
    }
  });
});
