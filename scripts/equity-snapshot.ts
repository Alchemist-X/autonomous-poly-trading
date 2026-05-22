import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { OverviewResponse } from "@autopoly/contracts";
import { ensureDirectory } from "./live-run-common.ts";

export interface EquitySnapshot {
  readonly timestamp: string;
  readonly total_equity_usd: number;
  readonly cash_usd: number;
  readonly positions_value_usd: number;
  readonly open_positions: number;
}

export interface EquitySnapshotAppendPolicy {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Resolve the path to the canonical equity-history.json file.
 * This file lives in apps/web/public/ so that Next.js/Vercel serves it as a static asset.
 */
function resolveEquityHistoryPath(): string {
  // __dirname equivalent: this file is in scripts/, web public is in apps/web/public/
  const repoRoot = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "..");
  return path.join(repoRoot, "apps", "web", "public", "equity-history.json");
}

/**
 * Read the existing equity history from disk.
 * Returns an empty array if the file does not exist or cannot be parsed.
 */
async function readEquityHistory(historyPath: string): Promise<readonly EquitySnapshot[]> {
  if (!existsSync(historyPath)) {
    return [];
  }
  try {
    const raw = await readFile(historyPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as EquitySnapshot[];
  } catch {
    return [];
  }
}

function parseBooleanOverride(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

export function resolveEquitySnapshotAppendPolicy(input: {
  readonly envFilePath: string | null | undefined;
  readonly override?: string | undefined;
}): EquitySnapshotAppendPolicy {
  const override = parseBooleanOverride(input.override ?? process.env.PUBLIC_EQUITY_HISTORY_ENABLED);
  if (override === true) {
    return {
      allowed: true,
      reason: "PUBLIC_EQUITY_HISTORY_ENABLED explicitly enables the public equity history append."
    };
  }
  if (override === false) {
    return {
      allowed: false,
      reason: "PUBLIC_EQUITY_HISTORY_ENABLED explicitly disables the public equity history append."
    };
  }

  const envFileName = input.envFilePath ? path.basename(input.envFilePath) : "";
  if (envFileName === ".env.pizza") {
    return {
      allowed: true,
      reason: "The active env file is .env.pizza, so this run owns the public Pizza equity history."
    };
  }

  return {
    allowed: false,
    reason: input.envFilePath
      ? `The active env file is ${envFileName}; only .env.pizza updates the public Pizza equity history by default.`
      : "No active env file was resolved; only .env.pizza updates the public Pizza equity history by default."
  };
}

/**
 * Append an equity snapshot after a pulse:live run.
 *
 * This writes to apps/web/public/equity-history.json so Vercel serves it as a static file.
 * The caller should commit + push this file to deploy the updated history.
 */
export async function appendEquitySnapshot(input: {
  readonly overview: OverviewResponse;
  readonly envFilePath?: string | null;
}): Promise<{
  readonly historyPath: string;
  readonly snapshotCount: number;
  readonly appended: boolean;
  readonly reason: string;
}> {
  const historyPath = resolveEquityHistoryPath();
  const existing = await readEquityHistory(historyPath);
  const policy = resolveEquitySnapshotAppendPolicy({
    envFilePath: input.envFilePath
  });

  if (!policy.allowed) {
    return {
      historyPath,
      snapshotCount: existing.length,
      appended: false,
      reason: policy.reason
    };
  }

  const snapshot: EquitySnapshot = {
    timestamp: new Date().toISOString(),
    total_equity_usd: Number(input.overview.total_equity_usd.toFixed(2)),
    cash_usd: Number(input.overview.cash_balance_usd.toFixed(2)),
    positions_value_usd: Number(
      (input.overview.total_equity_usd - input.overview.cash_balance_usd).toFixed(2)
    ),
    open_positions: input.overview.open_positions
  };

  const updated = [...existing, snapshot];
  await ensureDirectory(path.dirname(historyPath));
  await writeFile(historyPath, JSON.stringify(updated, null, 2), "utf8");

  return {
    historyPath,
    snapshotCount: updated.length,
    appended: true,
    reason: policy.reason
  };
}
