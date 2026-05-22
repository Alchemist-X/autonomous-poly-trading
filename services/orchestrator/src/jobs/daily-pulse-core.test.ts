import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type {
  OverviewResponse,
  PublicPosition,
  TradeDecisionSet
} from "@autopoly/contracts";
import type { OrchestratorConfig } from "../config.js";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { AgentRuntime } from "../runtime/agent-runtime.js";
import { runDailyPulseCore } from "./daily-pulse-core.js";

function createConfig(tempDir: string): OrchestratorConfig {
  return {
    repoRoot: tempDir,
    port: 4001,
    redisUrl: "redis://localhost:6379",
    envFilePath: ".env.test",
    internalToken: "token",
    agentPollCron: "0 */3 * * *",
    syncIntervalSeconds: 30,
    backtestCron: "10 0 * * *",
    resolutionBaseIntervalMinutes: 60,
    resolutionUrgentIntervalMinutes: 15,
    drawdownStopPct: 0.2,
    positionStopLossPct: 0.3,
    maxTotalExposurePct: 0.5,
    maxEventExposurePct: 0.3,
    maxPositions: 10,
    maxTradePct: 0.1,
    minTradeUsd: 1,
    initialBankrollUsd: 20,
    runtimeProvider: "codex",
    decisionStrategy: "pulse-direct",
    artifactStorageRoot: tempDir,
    providerTimeoutSeconds: 0,
    pulseFetchTimeoutSeconds: 300,
    pulseTimeoutMode: "default",
    pulseAiPrescreen: false,
    pulse: {
      sourceRepo: "all-polymarket-skill",
      sourceRepoDir: tempDir,
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
        command: "codex",
        model: "gpt-5",
        skillRootDir: tempDir,
        skillLocale: "zh",
        skills: ""
      },
      openclaw: {
        command: "openclaw",
        model: "openclaw",
        skillRootDir: tempDir,
        skillLocale: "zh",
        skills: ""
      }
    }
  };
}

function createOverview(): OverviewResponse {
  return {
    status: "running",
    cash_balance_usd: 20,
    total_equity_usd: 20,
    high_water_mark_usd: 20,
    drawdown_pct: 0,
    open_positions: 0,
    last_run_at: null,
    latest_risk_event: null,
    equity_curve: []
  };
}

function createPulse(): PulseSnapshot {
  return {
    id: "pulse-1",
    generatedAtUtc: "2026-03-17T00:00:00.000Z",
    title: "Pulse",
    relativeMarkdownPath: "reports/pulse/demo.md",
    absoluteMarkdownPath: "/tmp/reports/pulse/demo.md",
    relativeJsonPath: "reports/pulse/demo.json",
    absoluteJsonPath: "/tmp/reports/pulse/demo.json",
    markdown: "# Pulse",
    totalFetched: 10,
    totalFiltered: 5,
    selectedCandidates: 2,
    minLiquidityUsd: 5000,
    fetchConfig: {
      pagesPerDimension: 5,
      eventsPerPage: 50,
      minFetchedMarkets: 5000,
      dimensions: ["volume24hr", "liquidity", "startDate", "competitive"]
    },
    categoryStats: { fetched: [], filtered: [] },
    tagStats: { fetched: [], filtered: [] },
    candidates: [],
    riskFlags: [],
    tradeable: true
  };
}

function createRuntime(): AgentRuntime {
  return {
    name: "fake-runtime",
    async run() {
      const decisionSet: TradeDecisionSet = {
        run_id: "11111111-1111-4111-8111-111111111111",
        runtime: "fake-runtime",
        generated_at_utc: "2026-03-17T00:00:00.000Z",
        bankroll_usd: 20,
        mode: "full",
        decisions: [
          {
            action: "open",
            event_slug: "demo-event",
            market_slug: "demo-market",
            token_id: "token-1",
            side: "BUY",
            notional_usd: 2,
            order_type: "FOK",
            ai_prob: 0.61,
            market_prob: 0.55,
            edge: 0.06,
            confidence: "medium",
            thesis_md: "Positive edge.",
            sources: [
              {
                title: "Pulse",
                url: "https://example.com/pulse",
                retrieved_at_utc: "2026-03-17T00:00:00.000Z"
              }
            ],
            stop_loss_pct: 0.3,
            resolution_track_required: true
          }
        ],
        artifacts: [
          {
            kind: "pulse-report",
            title: "Pulse",
            path: "reports/pulse/demo.md",
            published_at_utc: "2026-03-17T00:00:00.000Z"
          }
        ]
      };

      return {
        decisionSet,
        promptSummary: "Prompt summary",
        reasoningMd: "Reasoning summary",
        logsMd: "{}"
      };
    }
  };
}

describe("daily pulse core", () => {
  it("appends portfolio report artifacts to runtime output", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-daily-pulse-core-"));
    try {
      const result = await runDailyPulseCore({
        config: createConfig(tempDir),
        runtime: createRuntime(),
        runId: "11111111-1111-4111-8111-111111111111",
        mode: "full",
        overview: createOverview(),
        positions: [] as PublicPosition[],
        pulse: createPulse()
      });

      expect(result.decisionSet.artifacts.map((artifact) => artifact.kind)).toEqual([
        "pulse-report",
        "review-report",
        "monitor-report",
        "rebalance-report"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
