import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OrchestratorConfig } from "../config.js";
import { loadTrialRecommendCheckpoint, saveTrialRecommendCheckpoint } from "./trial-recommend-checkpoint.js";

function createConfig(artifactStorageRoot: string): OrchestratorConfig {
  return {
    repoRoot: "/Users/Aincrad/dev-proj/autonomous-poly-trading",
    port: 4001,
    redisUrl: "redis://localhost:6379",
    envFilePath: null,
    internalToken: "replace-me",
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
    maxTradePct: 0.05,
    minTradeUsd: 10,
    initialBankrollUsd: 10000,
    runtimeProvider: "codex",
    decisionStrategy: "provider-runtime",
    artifactStorageRoot,
    providerTimeoutSeconds: 0,
    pulseFetchTimeoutSeconds: 60,
    pulse: {
      sourceRepo: "all-polymarket-skill",
      sourceRepoDir: "vendor/repos/all-polymarket-skill",
      pages: 1,
      eventsPerPage: 20,
      minLiquidityUsd: 5000,
      maxCandidates: 12,
      reportCandidates: 4,
      reportCommentLimit: 20,
      reportTimeoutSeconds: 0,
      minTradeableCandidates: 5,
      maxAgeMinutes: 30,
      maxMarkdownChars: 24000
    },
    codex: {
      command: "",
      model: "",
      skillRootDir: "vendor/repos/all-polymarket-skill",
      skillLocale: "zh",
      skills: "polymarket-market-pulse"
    },
    openclaw: {
      command: "",
      model: "",
      skillRootDir: "vendor/repos/all-polymarket-skill",
      skillLocale: "zh",
      skills: "polymarket-market-pulse"
    }
  };
}

describe("trial recommend checkpoint", () => {
  it("saves and loads the latest checkpoint", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "trial-recommend-checkpoint-"));
    try {
      const config = createConfig(root);
      await saveTrialRecommendCheckpoint(config, {
        runId: "run-1",
        stage: "pulse_ready",
        mode: "full",
        provider: "codex",
        executionMode: "paper",
        localStateFile: "runtime-artifacts/local/paper-state.json",
        overview: {
          status: "running",
          cash_balance_usd: 1,
          total_equity_usd: 2,
          high_water_mark_usd: 2,
          drawdown_pct: 0,
          open_positions: 0,
          last_run_at: null,
          latest_risk_event: null,
          equity_curve: []
        },
        positions: [],
        pulse: {
          id: "pulse-1",
          generatedAtUtc: "2026-03-16T00:00:00.000Z",
          title: "Pulse",
          relativeMarkdownPath: "reports/pulse/demo.md",
          absoluteMarkdownPath: "/tmp/demo.md",
          relativeJsonPath: "reports/pulse/demo.json",
          absoluteJsonPath: "/tmp/demo.json",
          markdown: "# pulse",
          totalFetched: 1,
          totalFiltered: 1,
          selectedCandidates: 1,
          minLiquidityUsd: 5000,
          candidates: [],
          riskFlags: [],
          tradeable: true
        },
        providerTempDir: null,
        providerOutputPath: null,
        providerPromptPath: null,
        providerSchemaPath: null
      });

      const checkpoint = await loadTrialRecommendCheckpoint({
        config,
        latest: true
      });

      expect(checkpoint?.runId).toBe("run-1");
      expect(checkpoint?.stage).toBe("pulse_ready");
      expect(checkpoint?.pulse.title).toBe("Pulse");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
