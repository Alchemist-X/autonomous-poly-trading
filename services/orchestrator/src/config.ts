import "dotenv/config";

import { loadEnvFile } from "./lib/env-file.js";

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export interface OrchestratorConfig {
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
  maxPositions: number;
  maxTradePct: number;
  initialBankrollUsd: number;
  claudeCodeCommand: string;
  claudeWorkspaceDir: string;
}

export function loadConfig(): OrchestratorConfig {
  const envFilePath = loadEnvFile();
  return {
    port: readNumber("PORT", 4001),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    envFilePath,
    internalToken: process.env.ORCHESTRATOR_INTERNAL_TOKEN ?? "replace-me",
    agentPollCron: process.env.AGENT_POLL_CRON ?? "0 */4 * * *",
    syncIntervalSeconds: readNumber("SYNC_INTERVAL_SECONDS", 30),
    backtestCron: process.env.BACKTEST_CRON ?? "10 0 * * *",
    resolutionBaseIntervalMinutes: readNumber("RESOLUTION_BASE_INTERVAL_MINUTES", 60),
    resolutionUrgentIntervalMinutes: readNumber("RESOLUTION_URGENT_INTERVAL_MINUTES", 15),
    drawdownStopPct: readNumber("DRAWDOWN_STOP_PCT", 0.2),
    positionStopLossPct: readNumber("POSITION_STOP_LOSS_PCT", 0.3),
    maxTotalExposurePct: readNumber("MAX_TOTAL_EXPOSURE_PCT", 0.5),
    maxPositions: readNumber("MAX_POSITIONS", 10),
    maxTradePct: readNumber("MAX_TRADE_PCT", 0.05),
    initialBankrollUsd: readNumber("INITIAL_BANKROLL_USD", 10000),
    claudeCodeCommand: process.env.CLAUDE_CODE_COMMAND ?? "",
    claudeWorkspaceDir: process.env.CLAUDE_WORKSPACE_DIR ?? "/workspace/vendor/repos"
  };
}
