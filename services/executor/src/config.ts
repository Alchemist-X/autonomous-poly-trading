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

export interface ExecutorConfig {
  port: number;
  redisUrl: string;
  envFilePath: string | null;
  privateKey: string;
  funderAddress: string;
  signatureType: number;
  polymarketHost: string;
  chainId: number;
  defaultOrderType: "FOK";
  drawdownStopPct: number;
  positionStopLossPct: number;
  initialBankrollUsd: number;
}

export function loadConfig(): ExecutorConfig {
  const envFilePath = loadEnvFile();
  return {
    port: readNumber("PORT", 4002),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    envFilePath,
    privateKey: process.env.PRIVATE_KEY ?? "",
    funderAddress: process.env.FUNDER_ADDRESS ?? "",
    signatureType: readNumber("SIGNATURE_TYPE", 1),
    polymarketHost: process.env.POLYMARKET_HOST ?? "https://clob.polymarket.com",
    chainId: readNumber("CHAIN_ID", 137),
    defaultOrderType: "FOK",
    drawdownStopPct: readNumber("DRAWDOWN_STOP_PCT", 0.2),
    positionStopLossPct: readNumber("POSITION_STOP_LOSS_PCT", 0.3),
    initialBankrollUsd: readNumber("INITIAL_BANKROLL_USD", 10000)
  };
}
