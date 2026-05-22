import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildArtifactRelativePath } from "../lib/artifacts.js";
import { evaluatePulseRiskFlags, resolvePulseFetchTimeoutMs } from "./market-pulse.js";
import type { OrchestratorConfig } from "../config.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const baseConfig: OrchestratorConfig = {
  repoRoot: REPO_ROOT,
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
  decisionStrategy: "provider-runtime",
  artifactStorageRoot: "runtime-artifacts",
  providerTimeoutSeconds: 90,
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
    reportTimeoutSeconds: 420,
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
      command: "openclaw --prompt-file {{prompt_file}} --output-file {{output_file}}",
      model: "",
      skillRootDir: "vendor/repos/all-polymarket-skill",
      skillLocale: "zh",
      skills: "polymarket-market-pulse"
    }
  }
};

describe("market pulse risk guards", () => {
  it("flags snapshots with too few candidates", () => {
    const flags = evaluatePulseRiskFlags({
      generatedAtUtc: new Date().toISOString(),
      candidates: [
        {
          question: "Demo",
          eventSlug: "demo-event",
          marketSlug: "demo-market",
          url: "https://polymarket.com/event/demo",
          liquidityUsd: 10000,
          volume24hUsd: 20000,
          outcomes: ["Yes", "No"],
          outcomePrices: [0.4, 0.6],
          clobTokenIds: ["1", "2"],
          endDate: "2026-03-31T00:00:00.000Z",
          bestBid: 0.39,
          bestAsk: 0.41,
          spread: 0.02,
          categorySlug: null,
          categoryLabel: null,
          categorySource: null,
          tags: []
        }
      ]
    }, baseConfig);

    expect(flags.some((flag) => flag.includes("below minimum threshold"))).toBe(true);
  });

  it("builds namespaced pulse artifact paths", () => {
    const relativePath = buildArtifactRelativePath({
      kind: "pulse-report",
      publishedAtUtc: "2026-03-14T00:51:14.480Z",
      runtime: "codex",
      mode: "full",
      runId: "11111111-1111-1111-1111-111111111111",
      extension: "md"
    });

    expect(relativePath).toBe(
      "reports/pulse/2026/03/14/pulse-20260314T005114Z-codex-full-11111111-1111-1111-1111-111111111111.md"
    );
  });

  it("disables pulse fetch timeout in unbounded mode", () => {
    expect(resolvePulseFetchTimeoutMs({
      ...baseConfig,
      pulseTimeoutMode: "unbounded"
    })).toBeNull();
  });

  it("flags snapshots whose fetched universe is below the configured target", () => {
    const flags = evaluatePulseRiskFlags({
      generatedAtUtc: new Date().toISOString(),
      totalFetched: 100,
      candidates: []
    }, baseConfig);

    expect(flags.some((flag) => flag.includes("below target"))).toBe(true);
  });
});
