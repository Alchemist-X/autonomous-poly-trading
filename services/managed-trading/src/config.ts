// Managed-trading service runtime configuration.
//
// Reads env vars at process start; throws fast on partial / malformed
// builder credentials so we never silently degrade to "no attribution"
// on a real-money path. Mirrors the validation pattern used in
// `services/executor/src/config.ts` (kept separate to avoid cross-service
// coupling — if the schema diverges later, only one side needs to move).

import "dotenv/config";

export type ManagedTradingMode = "paper" | "live";

export interface BuilderAttribution {
  readonly address: string;
  readonly code: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly apiPassphrase: string;
}

export interface ManagedTradingConfig {
  readonly mode: ManagedTradingMode;
  readonly polymarketHost: string;
  readonly polygonRpcUrl: string | undefined;
  readonly chainId: number;
  // Server-side Privy session signer key. Optional in paper mode (the
  // adapter never reaches the signing path). REQUIRED in live mode —
  // adapter construction throws if missing.
  readonly privySessionSignerPrivateKey: string | undefined;
  readonly builderAttribution: BuilderAttribution | null;
}

const BUILDER_CODE_REGEX = /^0x[0-9a-f]{64}$/;
const BUILDER_ADDRESS_REGEX = /^0x[0-9a-f]{40}$/;

const DEFAULT_POLYMARKET_HOST = "https://clob.polymarket.com";
const DEFAULT_CHAIN_ID = 137;

function readMode(raw: string | undefined): ManagedTradingMode {
  const value = raw?.trim().toLowerCase();
  if (value === "live") {
    return "live";
  }
  return "paper";
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

// Load + validate the 5 builder env vars. All-or-nothing: a partial set
// is a config error, not a soft-degrade. Returns null if all 5 are
// absent (acceptable for paper-mode dev / unit tests).
export function loadBuilderAttribution(): BuilderAttribution | null {
  const fields = {
    address: process.env.POLYMARKET_BUILDER_ADDRESS?.trim() ?? "",
    code: process.env.POLYMARKET_BUILDER_CODE?.trim() ?? "",
    apiKey: process.env.POLYMARKET_BUILDER_API_KEY?.trim() ?? "",
    apiSecret: process.env.POLYMARKET_BUILDER_API_SECRET?.trim() ?? "",
    apiPassphrase: process.env.POLYMARKET_BUILDER_API_PASSPHRASE?.trim() ?? ""
  };

  const present = Object.values(fields).filter((v) => v.length > 0);
  if (present.length === 0) {
    return null;
  }
  if (present.length < 5) {
    const labelMap: Record<keyof typeof fields, string> = {
      address: "POLYMARKET_BUILDER_ADDRESS",
      code: "POLYMARKET_BUILDER_CODE",
      apiKey: "POLYMARKET_BUILDER_API_KEY",
      apiSecret: "POLYMARKET_BUILDER_API_SECRET",
      apiPassphrase: "POLYMARKET_BUILDER_API_PASSPHRASE"
    };
    const missing = (Object.keys(fields) as Array<keyof typeof fields>)
      .filter((k) => fields[k].length === 0)
      .map((k) => labelMap[k]);
    throw new Error(
      `Polymarket builder attribution is partially configured. Missing: ${missing.join(", ")}. ` +
        `Set all 5 POLYMARKET_BUILDER_* vars or none.`
    );
  }

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

export function loadConfig(): ManagedTradingConfig {
  const mode = readMode(process.env.MANAGED_TRADING_MODE);
  const builderAttribution = loadBuilderAttribution();
  const privyKey = process.env.PRIVY_SESSION_SIGNER_PRIVATE_KEY?.trim();

  // In live mode, both the builder credentials and session signer key
  // must be present at config load time — surface the failure now, not
  // on the first signed order.
  if (mode === "live") {
    if (!builderAttribution) {
      throw new Error(
        "MANAGED_TRADING_MODE=live requires all 5 POLYMARKET_BUILDER_* env vars."
      );
    }
    if (!privyKey) {
      throw new Error(
        "MANAGED_TRADING_MODE=live requires PRIVY_SESSION_SIGNER_PRIVATE_KEY."
      );
    }
  }

  return {
    mode,
    polymarketHost: process.env.POLYMARKET_HOST?.trim() || DEFAULT_POLYMARKET_HOST,
    polygonRpcUrl: process.env.POLYGON_RPC_URL?.trim() || undefined,
    chainId: readNumber(process.env.CHAIN_ID, DEFAULT_CHAIN_ID),
    privySessionSignerPrivateKey: privyKey || undefined,
    builderAttribution
  };
}
