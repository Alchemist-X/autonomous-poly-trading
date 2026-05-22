import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { OrchestratorConfig } from "../config.js";
import { resolvePulseRenderTimeoutMs } from "./full-pulse.js";

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
  decisionStrategy: "pulse-direct",
  artifactStorageRoot: "runtime-artifacts",
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
      command: "openclaw --prompt-file {{prompt_file}} --output-file {{output_file}}",
      model: "",
      skillRootDir: "vendor/repos/all-polymarket-skill",
      skillLocale: "zh",
      skills: "polymarket-market-pulse"
    }
  }
};

describe("pulse render timeout", () => {
  it("uses the configured pulse-direct render timeout when no explicit report timeout is set", () => {
    expect(resolvePulseRenderTimeoutMs({
      ...baseConfig,
      pulse: {
        ...baseConfig.pulse,
        directRenderTimeoutSeconds: 720
      }
    })).toBe(720_000);
  });

  it("disables the pulse-direct render timeout in unbounded mode", () => {
    expect(resolvePulseRenderTimeoutMs({
      ...baseConfig,
      pulseTimeoutMode: "unbounded"
    })).toBe(0);
  });
});
