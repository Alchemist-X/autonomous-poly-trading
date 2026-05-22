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

function readFirstString(names: string[], fallback = ""): string {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) {
      continue;
    }
    const value = raw.trim();
    if (value) {
      return value;
    }
  }
  return fallback;
}

/**
 * Polymarket builder attribution config.
 *
 * `code` and `address` are the load-bearing fields for on-trade attribution:
 * the V2 SDK consumes `builderCode` (bytes32) via `ClobClient.builderConfig`
 * and stamps it onto every signed order. The receive `address` is informational
 * (where the rebate is paid out) and is not passed to the SDK directly.
 *
 * `apiKey` / `apiSecret` / `apiPassphrase` are HMAC creds returned by
 * `createBuilderApiKey()`. The V2 ClobClient does not accept them on
 * construction — they are stored here for off-band reporter tooling that
 * calls `getBuilderTrades()`. Required-together with code/address so a
 * partial env never silently degrades attribution.
 */
export interface BuilderAttribution {
  address: string;
  code: string;
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
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
  walletProvider?: "private-key" | "onchainos";
  onchainosBin?: string;
  onchainosTimeoutMs?: number;
  defaultOrderType: "FOK";
  drawdownStopPct: number;
  positionStopLossPct: number;
  initialBankrollUsd: number;
  builderAttribution: BuilderAttribution | null;
}

const BUILDER_CODE_REGEX = /^0x[0-9a-f]{64}$/;
const BUILDER_ADDRESS_REGEX = /^0x[0-9a-f]{40}$/;

function loadBuilderAttribution(): BuilderAttribution | null {
  const fields = {
    address: process.env.POLYMARKET_BUILDER_ADDRESS?.trim() ?? "",
    code: process.env.POLYMARKET_BUILDER_CODE?.trim() ?? "",
    apiKey: process.env.POLYMARKET_BUILDER_API_KEY?.trim() ?? "",
    apiSecret: process.env.POLYMARKET_BUILDER_API_SECRET?.trim() ?? "",
    apiPassphrase: process.env.POLYMARKET_BUILDER_API_PASSPHRASE?.trim() ?? ""
  };

  const present = Object.entries(fields).filter(([, value]) => value.length > 0);
  if (present.length === 0) {
    return null;
  }
  if (present.length < 5) {
    const missing = Object.entries(fields)
      .filter(([, value]) => value.length === 0)
      .map(([key]) => `POLYMARKET_BUILDER_${key === "apiKey" ? "API_KEY" : key === "apiSecret" ? "API_SECRET" : key === "apiPassphrase" ? "API_PASSPHRASE" : key.toUpperCase()}`);
    throw new Error(
      `Polymarket builder attribution is partially configured. Missing: ${missing.join(", ")}. ` +
      `Set all 5 POLYMARKET_BUILDER_* vars or none.`
    );
  }

  // Normalize hex casing for stable comparison; keep validation strict on lowercase.
  const code = fields.code.toLowerCase();
  const address = fields.address.toLowerCase();
  if (!BUILDER_CODE_REGEX.test(code)) {
    throw new Error(
      `POLYMARKET_BUILDER_CODE must be a 32-byte hex string (0x-prefixed, 64 hex chars). Got: ${fields.code}`
    );
  }
  if (!BUILDER_ADDRESS_REGEX.test(address)) {
    throw new Error(
      `POLYMARKET_BUILDER_ADDRESS must be a 20-byte hex address (0x-prefixed, 40 hex chars). Got: ${fields.address}`
    );
  }

  return {
    address,
    code,
    apiKey: fields.apiKey,
    apiSecret: fields.apiSecret,
    apiPassphrase: fields.apiPassphrase
  };
}

export function loadConfig(): ExecutorConfig {
  const envFilePath = loadEnvFile();
  const rawWalletProvider = process.env.WALLET_PROVIDER?.trim().toLowerCase();
  const walletProvider = rawWalletProvider === "onchainos" || rawWalletProvider === "okx-agentic"
    ? "onchainos"
    : "private-key";

  return {
    port: readNumber("PORT", 4002),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    envFilePath,
    privateKey: readFirstString(["PRIVATE_KEY"]),
    funderAddress: readFirstString(["FUNDER_ADDRESS", "ADDRESS", "WALLET_ADDRESS", "EVM_ADDRESS"]),
    signatureType: readNumber("SIGNATURE_TYPE", walletProvider === "onchainos" ? 0 : 1),
    polymarketHost: process.env.POLYMARKET_HOST ?? "https://clob.polymarket.com",
    chainId: readNumber("CHAIN_ID", 137),
    walletProvider,
    onchainosBin: process.env.ONCHAINOS_BIN?.trim() || undefined,
    onchainosTimeoutMs: readNumber("ONCHAINOS_TIMEOUT_MS", 30000),
    defaultOrderType: "FOK",
    drawdownStopPct: readNumber("DRAWDOWN_STOP_PCT", 0.2),
    positionStopLossPct: readNumber("POSITION_STOP_LOSS_PCT", 0.3),
    initialBankrollUsd: readNumber("INITIAL_BANKROLL_USD", 10000),
    builderAttribution: loadBuilderAttribution()
  };
}
