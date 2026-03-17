import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OrchestratorConfig } from "../config.js";
import type { RuntimeExecutionContext } from "./agent-runtime.js";
import { resumeRuntimeExecutionFromOutputFile } from "./provider-runtime.js";

function createConfig(repoRoot: string, artifactStorageRoot: string): OrchestratorConfig {
  return {
    repoRoot,
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
      sourceRepoDir: path.join(repoRoot, "vendor", "repos", "all-polymarket-skill"),
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
      skillRootDir: path.join(repoRoot, "vendor", "repos", "all-polymarket-skill"),
      skillLocale: "zh",
      skills: "polymarket-market-pulse,portfolio-review-polymarket,poly-position-monitor,poly-resolution-tracking,api-trade-polymarket"
    },
    openclaw: {
      command: "",
      model: "",
      skillRootDir: path.join(repoRoot, "vendor", "repos", "all-polymarket-skill"),
      skillLocale: "zh",
      skills: "polymarket-market-pulse"
    }
  };
}

describe("provider runtime", () => {
  it("normalizes local source paths into file urls during replay", async () => {
    const repoRoot = "/Users/Aincrad/dev-proj/autonomous-poly-trading";
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "provider-runtime-test-"));
    try {
      const outputPath = path.join(tempDir, "provider-output.json");
      await writeFile(outputPath, JSON.stringify({
        run_id: "11111111-1111-4111-8111-111111111111",
        runtime: "codex-skill-runtime",
        generated_at_utc: "2026-03-16T00:00:00.000Z",
        bankroll_usd: 10000,
        mode: "full",
        decisions: [
          {
            action: "skip",
            event_slug: "demo-event",
            market_slug: "demo-market",
            token_id: "demo-token",
            side: "BUY",
            notional_usd: 1,
            order_type: "FOK",
            ai_prob: 0.6,
            market_prob: 0.5,
            edge: 0.1,
            confidence: "low",
            thesis_md: "demo thesis",
            sources: [
              {
                title: "Risk controls",
                url: path.join(repoRoot, "risk-controls.md"),
                retrieved_at_utc: "2026-03-16T00:00:00.000Z"
              }
            ],
            stop_loss_pct: 0.3,
            resolution_track_required: true
          }
        ],
        artifacts: []
      }), "utf8");

      const context: RuntimeExecutionContext = {
        runId: "11111111-1111-4111-8111-111111111111",
        mode: "full",
        overview: {
          status: "running",
          cash_balance_usd: 10000,
          total_equity_usd: 10000,
          high_water_mark_usd: 10000,
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
          title: "Pulse demo",
          relativeMarkdownPath: "reports/pulse/demo.md",
          absoluteMarkdownPath: path.join(tempDir, "pulse.md"),
          relativeJsonPath: "reports/pulse/demo.json",
          absoluteJsonPath: path.join(tempDir, "pulse.json"),
          markdown: "# pulse",
          totalFetched: 1,
          totalFiltered: 1,
          selectedCandidates: 1,
          minLiquidityUsd: 5000,
          candidates: [],
          riskFlags: [],
          tradeable: true
        }
      };

      const result = await resumeRuntimeExecutionFromOutputFile({
        config: createConfig(repoRoot, tempDir),
        provider: "codex",
        context,
        outputPath
      });

      expect(result.decisionSet.decisions[0]?.sources[0]?.url.startsWith("file://")).toBe(true);
      const runtimeLogFiles = await readFile(path.join(tempDir, result.decisionSet.artifacts[1]!.path), "utf8");
      expect(runtimeLogFiles).toContain("\"runtime\":\"codex-skill-runtime\"");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects empty decisions when pulse candidates exist", async () => {
    const repoRoot = "/Users/Aincrad/dev-proj/autonomous-poly-trading";
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "provider-runtime-empty-test-"));
    try {
      const outputPath = path.join(tempDir, "provider-output.json");
      await writeFile(outputPath, JSON.stringify({
        run_id: "11111111-1111-4111-8111-111111111111",
        runtime: "codex-skill-runtime",
        generated_at_utc: "2026-03-16T00:00:00.000Z",
        bankroll_usd: 10000,
        mode: "full",
        decisions: [],
        artifacts: []
      }), "utf8");

      const context: RuntimeExecutionContext = {
        runId: "11111111-1111-4111-8111-111111111111",
        mode: "full",
        overview: {
          status: "running",
          cash_balance_usd: 10000,
          total_equity_usd: 10000,
          high_water_mark_usd: 10000,
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
          title: "Pulse demo",
          relativeMarkdownPath: "reports/pulse/demo.md",
          absoluteMarkdownPath: path.join(tempDir, "pulse.md"),
          relativeJsonPath: "reports/pulse/demo.json",
          absoluteJsonPath: path.join(tempDir, "pulse.json"),
          markdown: "# pulse",
          totalFetched: 1,
          totalFiltered: 1,
          selectedCandidates: 1,
          minLiquidityUsd: 5000,
          candidates: [
            {
              question: "Demo",
              eventSlug: "demo-event",
              marketSlug: "demo-market",
              url: "https://example.com/demo",
              liquidityUsd: 10000,
              volume24hUsd: 1000,
              outcomes: ["Yes", "No"],
              outcomePrices: [0.4, 0.6],
              clobTokenIds: ["demo-token-yes", "demo-token-no"],
              endDate: "2026-03-31T00:00:00.000Z",
              bestBid: 0.39,
              bestAsk: 0.41,
              spread: 0.02
            }
          ],
          riskFlags: [],
          tradeable: true
        }
      };

      await expect(() =>
        resumeRuntimeExecutionFromOutputFile({
          config: createConfig(repoRoot, tempDir),
          provider: "codex",
          context,
          outputPath
        })
      ).rejects.toThrow("决策输出不能为空");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
