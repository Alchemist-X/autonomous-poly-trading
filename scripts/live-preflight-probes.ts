import Redis from "ioredis";
import { sql } from "drizzle-orm";
import { getDb } from "@autopoly/db";
import { getErrorMessage } from "@autopoly/terminal-ui";
import type { ExecutorConfig } from "../services/executor/src/config.ts";
import {
  getCollateralBalanceAllowance,
  resolvePolymarketFunderAddress
} from "../services/executor/src/lib/polymarket.ts";

export interface OnchainBalanceProbe {
  balanceUsd: number | null;
  errorMessage: string | null;
}

export interface CollateralProbe {
  balanceUsd: number | null;
  source: "reported" | "onchain" | "fallback";
  reportedBalanceUsd: number | null;
  onchainBalanceUsd: number | null;
  errorMessage: string | null;
}

function parseHexToUsd(value: unknown): number | null {
  if (typeof value !== "string" || !value.startsWith("0x")) {
    return null;
  }
  try {
    return Number(BigInt(value)) / 1e6;
  } catch {
    return null;
  }
}

export async function probeDbHealth() {
  const db = getDb();
  await db.execute(sql`select 1`);
  return true;
}

export async function probeRedisHealth(redisUrl: string) {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true
  });
  try {
    await redis.connect();
    return (await redis.ping()) === "PONG";
  } finally {
    redis.disconnect();
  }
}

export async function probeOnchainUsdcBalanceUsd(address: string): Promise<OnchainBalanceProbe> {
  if (!address) {
    return {
      balanceUsd: null,
      errorMessage: "missing funder address"
    };
  }
  const rpcUrl = process.env.POLYGON_RPC_URL?.trim() || "https://polygon-bor-rpc.publicnode.com";
  // Post-V2 (2026-04-28) Polymarket collateral is pUSD (0xC011a7E1...), not USDC.e.
  const usdcContract =
    process.env.POLYGON_PUSD_CONTRACT?.trim()
    || process.env.POLYGON_USDC_CONTRACT?.trim()
    || "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
  const normalized = address.toLowerCase().replace(/^0x/, "");
  if (normalized.length !== 40) {
    return {
      balanceUsd: null,
      errorMessage: "invalid funder address length"
    };
  }
  const data = `0x70a08231${normalized.padStart(64, "0")}`;
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: usdcContract, data }, "latest"]
      })
    });
    if (!response.ok) {
      throw new Error(`rpc status ${response.status}`);
    }
    const payload = await response.json() as { result?: unknown; error?: { message?: string } };
    if (payload.error) {
      throw new Error(payload.error.message ?? "rpc returned error");
    }
    const parsed = parseHexToUsd(payload.result);
    if (parsed == null) {
      throw new Error("rpc payload missing hex result");
    }
    return {
      balanceUsd: parsed,
      errorMessage: null
    };
  } catch (error) {
    return {
      balanceUsd: null,
      errorMessage: getErrorMessage(error)
    };
  }
}

export async function probeCollateralBalanceUsd(config: ExecutorConfig): Promise<CollateralProbe> {
  let reportedBalanceUsd: number | null = null;
  let reportedError: string | null = null;
  const funderAddress = await resolvePolymarketFunderAddress(config).catch(() => config.funderAddress);

  try {
    const initialBalance = await getCollateralBalanceAllowance(config);
    if (!initialBalance) {
      throw new Error("No live Polymarket client available.");
    }
    const parsed = Number((initialBalance as any)?.balance ?? Number.NaN);
    if (!Number.isFinite(parsed)) {
      throw new Error("Collateral payload did not contain numeric balance.");
    }
    reportedBalanceUsd = parsed / 1e6;
  } catch (error) {
    reportedError = getErrorMessage(error);
  }

  const onchainProbe = await probeOnchainUsdcBalanceUsd(funderAddress);
  if ((reportedBalanceUsd ?? 0) > 0) {
    return {
      balanceUsd: reportedBalanceUsd,
      source: "reported",
      reportedBalanceUsd,
      onchainBalanceUsd: onchainProbe.balanceUsd,
      errorMessage: reportedError ?? onchainProbe.errorMessage
    };
  }
  if ((onchainProbe.balanceUsd ?? 0) > 0) {
    return {
      balanceUsd: onchainProbe.balanceUsd,
      source: "onchain",
      reportedBalanceUsd,
      onchainBalanceUsd: onchainProbe.balanceUsd,
      errorMessage: reportedError
    };
  }
  if (reportedBalanceUsd != null) {
    return {
      balanceUsd: reportedBalanceUsd,
      source: "reported",
      reportedBalanceUsd,
      onchainBalanceUsd: onchainProbe.balanceUsd,
      errorMessage: [reportedError, onchainProbe.errorMessage].filter(Boolean).join(" | ") || null
    };
  }
  return {
    balanceUsd: null,
    source: "fallback",
    reportedBalanceUsd: null,
    onchainBalanceUsd: onchainProbe.balanceUsd,
    errorMessage: [reportedError, onchainProbe.errorMessage].filter(Boolean).join(" | ") || null
  };
}
