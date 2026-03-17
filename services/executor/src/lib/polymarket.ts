import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ClobClient } from "@polymarket/clob-client";
import type { ExecutorConfig } from "../config.js";
import {
  type BookSnapshot,
  type GammaRecord,
  type RemotePosition,
  computeAvgCost as computeAvgCostSdk,
  executeMarketOrder as executeMarketOrderSdk,
  fetchActiveMarkets as fetchActiveMarketsSdk,
  fetchEventBySlug as fetchEventBySlugSdk,
  fetchMarketBySlug as fetchMarketBySlugSdk,
  fetchRemotePositions as fetchRemotePositionsSdk,
  getClobClient as getClobClientSdk,
  getCollateralBalanceAllowance as getCollateralBalanceAllowanceSdk,
  readBook as readBookSdk
} from "./polymarket-sdk.js";

type PolyCliAction =
  | "read-book"
  | "fetch-remote-positions"
  | "compute-avg-cost"
  | "get-collateral-balance-allowance"
  | "fetch-event-by-slug"
  | "fetch-market-by-slug"
  | "fetch-active-markets"
  | "execute-market-order";

interface PolyCliPayload {
  action: PolyCliAction;
  config: ExecutorConfig;
  input?: unknown;
}

interface PolyCliEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const defaultPolyCliPath = path.join(repoRoot, "scripts", "poly-cli.ts");

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isPolyCliEnabled() {
  return process.env.POLY_CLI_ENABLED !== "false";
}

function isPolyCliStrict() {
  return process.env.POLY_CLI_STRICT === "true";
}

function resolvePolyCliCommand() {
  const raw = process.env.POLY_CLI_COMMAND?.trim();
  if (!raw) {
    return ["pnpm", "exec", "tsx", defaultPolyCliPath];
  }
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (!tokens.some((token) => token.includes("poly-cli.ts"))) {
    tokens.push(defaultPolyCliPath);
  }
  return tokens;
}

async function runPolyCli<T>(payload: PolyCliPayload): Promise<T> {
  const [command, ...commandArgs] = resolvePolyCliCommand();
  if (!command) {
    throw new Error("POLY_CLI_COMMAND resolved to an empty command.");
  }

  return await new Promise<T>((resolve, reject) => {
    const child = spawn(command, [...commandArgs, "--json"], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const output = stdout.trim();
      if (code !== 0) {
        reject(new Error(`poly-cli exited with code ${code}: ${(stderr || output).trim()}`));
        return;
      }

      let envelope: PolyCliEnvelope<T>;
      try {
        envelope = JSON.parse(output) as PolyCliEnvelope<T>;
      } catch (error) {
        reject(new Error(`poly-cli returned non-JSON output: ${output || getErrorMessage(error)}`));
        return;
      }

      if (!envelope.ok) {
        reject(new Error(envelope.error ?? "poly-cli returned ok=false without error message."));
        return;
      }

      resolve(envelope.data as T);
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function withPolyCliReadFallback<T>(payload: PolyCliPayload, fallback: () => Promise<T>) {
  if (!isPolyCliEnabled()) {
    return await fallback();
  }
  try {
    return await runPolyCli<T>(payload);
  } catch (error) {
    if (isPolyCliStrict()) {
      throw new Error(`poly-cli read failed in strict mode: ${getErrorMessage(error)}`);
    }
    return await fallback();
  }
}

export type { BookSnapshot, RemotePosition };
export type { GammaRecord };

export async function getClobClient(config: ExecutorConfig): Promise<ClobClient | null> {
  return await getClobClientSdk(config);
}

export async function getCollateralBalanceAllowance(config: ExecutorConfig): Promise<Record<string, unknown> | null> {
  const payload: PolyCliPayload = {
    action: "get-collateral-balance-allowance",
    config
  };

  if (!isPolyCliEnabled()) {
    try {
      return await getCollateralBalanceAllowanceSdk(config);
    } catch (error) {
      if (isPolyCliStrict()) {
        throw new Error(`collateral check failed in strict mode: ${getErrorMessage(error)}`);
      }
      return null;
    }
  }

  try {
    return await runPolyCli<Record<string, unknown> | null>(payload);
  } catch (error) {
    if (isPolyCliStrict()) {
      throw new Error(`poly-cli collateral check failed in strict mode: ${getErrorMessage(error)}`);
    }
    try {
      return await getCollateralBalanceAllowanceSdk(config);
    } catch {
      return null;
    }
  }
}

export async function executeMarketOrder(
  config: ExecutorConfig,
  signal: { tokenId: string; side: "BUY" | "SELL"; amount: number }
) {
  if (!isPolyCliEnabled()) {
    return await executeMarketOrderSdk(config, signal);
  }

  try {
    return await runPolyCli<Awaited<ReturnType<typeof executeMarketOrderSdk>>>({
      action: "execute-market-order",
      config,
      input: signal
    });
  } catch (error) {
    if (isPolyCliStrict()) {
      throw new Error(`poly-cli market order failed in strict mode: ${getErrorMessage(error)}`);
    }
    throw new Error(`poly-cli market order failed: ${getErrorMessage(error)}`);
  }
}

export async function readBook(config: ExecutorConfig, tokenId: string): Promise<BookSnapshot | null> {
  return await withPolyCliReadFallback<BookSnapshot | null>(
    {
      action: "read-book",
      config,
      input: { tokenId }
    },
    async () => await readBookSdk(config, tokenId)
  );
}

export async function fetchRemotePositions(config: ExecutorConfig): Promise<RemotePosition[]> {
  return await withPolyCliReadFallback<RemotePosition[]>(
    {
      action: "fetch-remote-positions",
      config
    },
    async () => await fetchRemotePositionsSdk(config)
  );
}

export async function computeAvgCost(config: ExecutorConfig, tokenId: string): Promise<number | null> {
  return await withPolyCliReadFallback<number | null>(
    {
      action: "compute-avg-cost",
      config,
      input: { tokenId }
    },
    async () => await computeAvgCostSdk(config, tokenId)
  );
}

export async function fetchEventBySlug(config: ExecutorConfig, slug: string): Promise<GammaRecord> {
  return await withPolyCliReadFallback<GammaRecord>(
    {
      action: "fetch-event-by-slug",
      config,
      input: { slug }
    },
    async () => await fetchEventBySlugSdk(config, slug)
  );
}

export async function fetchMarketBySlug(config: ExecutorConfig, slug: string): Promise<GammaRecord[]> {
  return await withPolyCliReadFallback<GammaRecord[]>(
    {
      action: "fetch-market-by-slug",
      config,
      input: { slug }
    },
    async () => await fetchMarketBySlugSdk(config, slug)
  );
}

export async function fetchActiveMarkets(config: ExecutorConfig, limit = 100): Promise<GammaRecord[]> {
  return await withPolyCliReadFallback<GammaRecord[]>(
    {
      action: "fetch-active-markets",
      config,
      input: { limit }
    },
    async () => await fetchActiveMarketsSdk(config, limit)
  );
}
