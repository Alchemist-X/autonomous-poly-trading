// On-disk state for the paper book, under the shared artifacts volume:
//   <artifacts>/paper-agent/portfolio.json   — cash + open positions (atomic writes)
//   <artifacts>/paper-agent/ledger.jsonl     — append-only event journal
//   <artifacts>/paper-agent/reports/         — reflection reports
// Same root-resolution rules as the forecast engine so the VM containers and
// local dev agree on paths.

import { appendFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function paperRoot(): string {
  return process.env.ARTIFACT_STORAGE_ROOT
    ? path.join(process.env.ARTIFACT_STORAGE_ROOT, "paper-agent")
    : path.join(repoRoot(), "runtime-artifacts", "paper-agent");
}

export function portfolioPath(): string {
  return path.join(paperRoot(), "portfolio.json");
}

export function ledgerPath(): string {
  return path.join(paperRoot(), "ledger.jsonl");
}

export function reportsDir(): string {
  return path.join(paperRoot(), "reports");
}

export function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Atomic write (tmp + rename) so a crash never leaves a torn portfolio.
export function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, file);
}

// Cross-process advisory lock so a manually-run `paper cycle`/`tick` can never
// race the always-on scheduler (both mutate portfolio.json with load-modify-
// save). The lock is a file created with O_EXCL; a lock older than staleMs is
// treated as abandoned (a crashed run) and reclaimed.
function lockPath(): string {
  return path.join(paperRoot(), "book.lock");
}

export function acquireBookLock(staleMs = 30 * 60_000): boolean {
  mkdirSync(paperRoot(), { recursive: true });
  const file = lockPath();
  try {
    const fd = openSync(file, "wx"); // fails if it already exists
    writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch {
    // Held — reclaim only if stale.
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as { at?: string };
      if (raw.at && Date.now() - Date.parse(raw.at) > staleMs) {
        rmSync(file, { force: true });
        return acquireBookLock(staleMs);
      }
    } catch {
      // unreadable lock — leave it; caller backs off
    }
    return false;
  }
}

export function releaseBookLock(): void {
  rmSync(lockPath(), { force: true });
}

export function appendLedger(event: Record<string, unknown>): void {
  mkdirSync(path.dirname(ledgerPath()), { recursive: true });
  appendFileSync(ledgerPath(), JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n", "utf8");
}

export function readLedger(): Array<Record<string, unknown>> {
  if (!existsSync(ledgerPath())) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const line of readFileSync(ledgerPath(), "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // tolerate a torn tail line
    }
  }
  return out;
}
