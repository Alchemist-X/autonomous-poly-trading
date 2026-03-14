import { describe, expect, it } from "vitest";
import { buildArtifactRelativePath } from "../lib/artifacts.js";
import { evaluatePulseRiskFlags } from "./market-pulse.js";
import type { OrchestratorConfig } from "../config.js";

const baseConfig: OrchestratorConfig = {
  repoRoot: "/Users/Aincrad/dev-proj/autonomous-poly-trading",
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
  maxPositions: 10,
  maxTradePct: 0.05,
  initialBankrollUsd: 10000,
  runtimeProvider: "codex",
  artifactStorageRoot: "runtime-artifacts",
  providerTimeoutSeconds: 90,
  pulseFetchTimeoutSeconds: 60,
  pulse: {
    sourceRepo: "all-polymarket-skill",
    sourceRepoDir: "vendor/repos/all-polymarket-skill",
    pages: 1,
    eventsPerPage: 20,
    minLiquidityUsd: 5000,
    maxCandidates: 12,
    minTradeableCandidates: 5,
    maxAgeMinutes: 30,
    maxMarkdownChars: 24000
  },
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
          spread: 0.02
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
});
