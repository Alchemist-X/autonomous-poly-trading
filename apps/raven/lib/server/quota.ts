// Daily engine-spawn quota for the web app, persisted under
// <artifacts>/quota/<service>-<day>.json so restarts don't reset the count.
// Logic mirrors services/forecast-api/src/quota.ts (each surface keeps its own
// counter file; day boundary = UTC; only actual spawns consume quota).

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { forecastsRoot } from "./repo";

export class QuotaExceededError extends Error {
  constructor(limit: number) {
    super(`daily free quota reached (${limit} runs/day) — enter an invite code to continue`);
    this.name = "QuotaExceededError";
  }
}

export function dailyQuotaLimit(): number {
  // A set-but-blank line (`FORECAST_DAILY_QUOTA=` in .env) means "unset",
  // never 0 — must parse identically to services/forecast-api/src/config.ts.
  const raw = process.env.FORECAST_DAILY_QUOTA?.trim();
  if (!raw) return 20;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

// Constant-time-ish comparison (XOR fold after length check), matching the
// proxy gate — an invite code is a shared secret, however small.
export function inviteCodeOk(presented: string | undefined | null): boolean {
  const expected = process.env.FORECAST_INVITE_CODE || "raven-labs";
  const given = presented?.trim() ?? "";
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function quotaDir(): string {
  return path.join(path.dirname(forecastsRoot()), "quota");
}

export const dayKey = (): string => new Date().toISOString().slice(0, 10);

function quotaFile(service: string, key: string): string {
  return path.join(quotaDir(), `${service}-${key}.json`);
}

export function quotaUsed(service: string, key: string = dayKey()): number {
  try {
    const raw = JSON.parse(readFileSync(quotaFile(service, key), "utf8")) as { count?: number };
    return typeof raw.count === "number" && raw.count >= 0 ? Math.floor(raw.count) : 0;
  } catch {
    return 0;
  }
}

// True = a unit was consumed (spawn allowed); false = quota exhausted.
export function tryConsumeQuota(service: string, limit: number, key: string = dayKey()): boolean {
  const used = quotaUsed(service, key);
  if (used >= limit) return false;
  mkdirSync(quotaDir(), { recursive: true });
  writeFileSync(quotaFile(service, key), JSON.stringify({ count: used + 1 }), "utf8");
  pruneOldDays(service, key);
  return true;
}

function pruneOldDays(service: string, todayKey: string): void {
  try {
    const keep = `${service}-${todayKey}.json`;
    for (const f of readdirSync(quotaDir())) {
      if (f.startsWith(`${service}-`) && f.endsWith(".json") && f !== keep) {
        rmSync(path.join(quotaDir(), f), { force: true });
      }
    }
  } catch {
    // best-effort cleanup only
  }
}
