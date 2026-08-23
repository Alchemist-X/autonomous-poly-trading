// On-disk state under the shared artifacts volume (PRD §10):
//   <artifacts>/delta-pm/portfolio.json      — paper book (atomic writes)
//   <artifacts>/delta-pm/ledger.jsonl        — append-only event journal
//   <artifacts>/delta-pm/news/<id>.json      — raw NewsItem archive (原文存档)
//   <artifacts>/delta-pm/signals/<id>.json   — NewsSignal archive
//   <artifacts>/delta-pm/theses/<id>.json    — TradeThesis archive
//   <artifacts>/delta-pm/runs/<id>.json      — per-run progress state (console)
//   <artifacts>/delta-pm/market/...          — self-built candle archive
//   <artifacts>/delta-pm/feed-state.json     — poller dedupe state (seen ids, etag)
// Same root-resolution rules as forecast-engine/paper-agent so VM containers
// and local dev agree on paths.

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
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

export function pmRoot(): string {
  return process.env.ARTIFACT_STORAGE_ROOT
    ? path.join(process.env.ARTIFACT_STORAGE_ROOT, "delta-pm")
    : path.join(repoRoot(), "runtime-artifacts", "delta-pm");
}

export const paths = {
  portfolio: () => path.join(pmRoot(), "portfolio.json"),
  ledger: () => path.join(pmRoot(), "ledger.jsonl"),
  feedState: () => path.join(pmRoot(), "feed-state.json"),
  newsDir: () => path.join(pmRoot(), "news"),
  signalsDir: () => path.join(pmRoot(), "signals"),
  thesesDir: () => path.join(pmRoot(), "theses"),
  runsDir: () => path.join(pmRoot(), "runs"),
  reportsDir: () => path.join(pmRoot(), "reports"),
  marketDir: () => path.join(pmRoot(), "market")
};

export function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Atomic write (tmp + rename) so a crash never leaves a torn file.
export function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, file);
}

// Cross-process advisory lock (O_EXCL + stale reclaim) guarding the book.
function lockPath(): string {
  return path.join(pmRoot(), "book.lock");
}

export function acquireBookLock(staleMs = 30 * 60_000): boolean {
  mkdirSync(pmRoot(), { recursive: true });
  const file = lockPath();
  try {
    const fd = openSync(file, "wx");
    writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch {
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
  mkdirSync(path.dirname(paths.ledger()), { recursive: true });
  appendFileSync(paths.ledger(), JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n", "utf8");
}

export function readLedger(): Array<Record<string, unknown>> {
  const file = paths.ledger();
  if (!existsSync(file)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // tolerate a torn tail line
    }
  }
  return out;
}

export function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}
