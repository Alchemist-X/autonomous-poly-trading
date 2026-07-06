// Daily engine-spawn quota, persisted under <artifacts>/quota/<service>-<day>.json
// so container restarts don't reset the count. Only actual spawns consume quota
// (polling/result reads are free). Day boundary = UTC. Each service owns its
// own counter file and node is single-threaded per process, so there are no
// concurrent writers on one file.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { forecastsRoot } from "./repo";

export class QuotaExceededError extends Error {
  constructor(limit: number) {
    super(`daily free quota reached (${limit} runs/day) — include the invite code to continue`);
    this.name = "QuotaExceededError";
  }
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

// Yesterday's counters are dead weight — drop them opportunistically.
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
