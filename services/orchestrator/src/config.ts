import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./lib/env-file.js";

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

function readEnum<T extends readonly string[]>(
  name: string,
  fallback: T[number],
  allowed: T
): T[number] {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return allowed.includes(raw) ? raw : fallback;
}

export const agentRuntimeProviders = ["codex", "openclaw"] as const;
export type AgentRuntimeProvider = (typeof agentRuntimeProviders)[number];

export const agentDecisionStrategies = ["provider-runtime", "pulse-direct"] as const;
export type AgentDecisionStrategy = (typeof agentDecisionStrategies)[number];

export const skillLocales = ["en", "zh"] as const;
export type SkillLocale = (typeof skillLocales)[number];

export const pulseSourceRepos = ["all-polymarket-skill", "polymarket-market-pulse"] as const;
export type PulseSourceRepo = (typeof pulseSourceRepos)[number];

export interface SkillProviderConfig {
  command: string;
  model: string;
  skillRootDir: string;
  skillLocale: SkillLocale;
  skills: string;
}

export interface PulseConfig {
  sourceRepo: PulseSourceRepo;
  sourceRepoDir: string;
  pages: number;
  eventsPerPage: number;
  minLiquidityUsd: number;
  maxCandidates: number;
  reportCandidates: number;
  reportCommentLimit: number;
  reportTimeoutSeconds: number;
  minTradeableCandidates: number;
  maxAgeMinutes: number;
  maxMarkdownChars: number;
}

export interface OrchestratorConfig {
  repoRoot: string;
  port: number;
  redisUrl: string;
  envFilePath: string | null;
  internalToken: string;
  agentPollCron: string;
  syncIntervalSeconds: number;
  backtestCron: string;
  resolutionBaseIntervalMinutes: number;
  resolutionUrgentIntervalMinutes: number;
  drawdownStopPct: number;
  positionStopLossPct: number;
  maxTotalExposurePct: number;
  maxEventExposurePct: number;
  maxPositions: number;
  maxTradePct: number;
  minTradeUsd: number;
  initialBankrollUsd: number;
  runtimeProvider: AgentRuntimeProvider;
  decisionStrategy: AgentDecisionStrategy;
  artifactStorageRoot: string;
  providerTimeoutSeconds: number;
  pulseFetchTimeoutSeconds: number;
  pulse: PulseConfig;
  codex: SkillProviderConfig;
  openclaw: SkillProviderConfig;
}

function readSkillProviderConfig(input: {
  prefix: "CODEX" | "OPENCLAW";
  defaultSkillRootDir: string;
  defaultSkillLocale: SkillLocale;
  defaultSkills: string;
}): SkillProviderConfig {
  return {
    command: readString(`${input.prefix}_COMMAND`, ""),
    model: readString(`${input.prefix}_MODEL`, ""),
    skillRootDir: path.resolve(readString(`${input.prefix}_SKILL_ROOT_DIR`, input.defaultSkillRootDir)),
    skillLocale: readEnum(`${input.prefix}_SKILL_LOCALE`, input.defaultSkillLocale, skillLocales),
    skills: readString(`${input.prefix}_SKILLS`, input.defaultSkills)
  };
}

export function loadConfig(): OrchestratorConfig {
  const envFilePath = loadEnvFile();
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const defaultSkillRootDir = path.resolve(repoRoot, "vendor/repos/all-polymarket-skill");
  const pulseSourceRepo = readEnum("PULSE_SOURCE_REPO", "all-polymarket-skill", pulseSourceRepos);
  const defaultPulseSourceRepoDir = pulseSourceRepo === "polymarket-market-pulse"
    ? path.resolve(repoRoot, "vendor/repos/polymarket-market-pulse")
    : defaultSkillRootDir;
  const defaultSkills = [
    "polymarket-market-pulse",
    "portfolio-review-polymarket",
    "poly-position-monitor",
    "poly-resolution-tracking",
    "api-trade-polymarket"
  ].join(",");

  return {
    repoRoot,
    port: readNumber("PORT", 4001),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    envFilePath,
    internalToken: process.env.ORCHESTRATOR_INTERNAL_TOKEN ?? "replace-me",
    agentPollCron: process.env.AGENT_POLL_CRON ?? "0 */3 * * *",
    syncIntervalSeconds: readNumber("SYNC_INTERVAL_SECONDS", 30),
    backtestCron: process.env.BACKTEST_CRON ?? "10 0 * * *",
    resolutionBaseIntervalMinutes: readNumber("RESOLUTION_BASE_INTERVAL_MINUTES", 60),
    resolutionUrgentIntervalMinutes: readNumber("RESOLUTION_URGENT_INTERVAL_MINUTES", 15),
    drawdownStopPct: readNumber("DRAWDOWN_STOP_PCT", 0.2),
    positionStopLossPct: readNumber("POSITION_STOP_LOSS_PCT", 0.3),
    maxTotalExposurePct: readNumber("MAX_TOTAL_EXPOSURE_PCT", 0.5),
    maxEventExposurePct: readNumber("MAX_EVENT_EXPOSURE_PCT", 0.3),
    maxPositions: readNumber("MAX_POSITIONS", 10),
    maxTradePct: readNumber("MAX_TRADE_PCT", 0.05),
    minTradeUsd: readNumber("MIN_TRADE_USD", 10),
    initialBankrollUsd: readNumber("INITIAL_BANKROLL_USD", 10000),
    runtimeProvider: readEnum("AGENT_RUNTIME_PROVIDER", "codex", agentRuntimeProviders),
    decisionStrategy: readEnum("AGENT_DECISION_STRATEGY", "provider-runtime", agentDecisionStrategies),
    artifactStorageRoot: path.resolve(readString("ARTIFACT_STORAGE_ROOT", path.join(repoRoot, "runtime-artifacts"))),
    providerTimeoutSeconds: readNumber("PROVIDER_TIMEOUT_SECONDS", 0),
    pulseFetchTimeoutSeconds: readNumber("PULSE_FETCH_TIMEOUT_SECONDS", 60),
    pulse: {
      sourceRepo: pulseSourceRepo,
      sourceRepoDir: path.resolve(readString("PULSE_SOURCE_REPO_DIR", defaultPulseSourceRepoDir)),
      pages: readNumber("PULSE_PAGES", 1),
      eventsPerPage: readNumber("PULSE_EVENTS_PER_PAGE", 20),
      minLiquidityUsd: readNumber("PULSE_MIN_LIQUIDITY_USD", 5000),
      maxCandidates: readNumber("PULSE_MAX_CANDIDATES", 12),
      reportCandidates: readNumber("PULSE_REPORT_CANDIDATES", 4),
      reportCommentLimit: readNumber("PULSE_REPORT_COMMENT_LIMIT", 20),
      reportTimeoutSeconds: readNumber("PULSE_REPORT_TIMEOUT_SECONDS", 0),
      minTradeableCandidates: readNumber("PULSE_MIN_TRADEABLE_CANDIDATES", 5),
      maxAgeMinutes: readNumber("PULSE_MAX_AGE_MINUTES", 30),
      maxMarkdownChars: readNumber("PULSE_MAX_MARKDOWN_CHARS", 24000)
    },
    codex: readSkillProviderConfig({
      prefix: "CODEX",
      defaultSkillRootDir,
      defaultSkillLocale: "zh",
      defaultSkills
    }),
    openclaw: readSkillProviderConfig({
      prefix: "OPENCLAW",
      defaultSkillRootDir,
      defaultSkillLocale: "zh",
      defaultSkills
    })
  };
}
