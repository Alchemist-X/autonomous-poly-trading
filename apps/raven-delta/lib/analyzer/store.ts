// Run archive — every analysis lands on disk (traceability rule §7).
// Layout: <repo>/runtime-artifacts/raven-delta/runs/YYYY/MM/DD/<ts>-<id>.json

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { DeltaRun } from "./schema";

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function runsRoot(): string {
  return path.join(findRepoRoot(process.cwd()), "runtime-artifacts", "raven-delta", "runs");
}

export function saveRun(run: DeltaRun): string {
  const day = run.generatedAtUtc.slice(0, 10); // YYYY-MM-DD
  const dir = path.join(runsRoot(), day.slice(0, 4), day.slice(5, 7), day.slice(8, 10));
  mkdirSync(dir, { recursive: true });
  const stamp = run.generatedAtUtc.replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}-${run.id}.json`);
  // 0600: a run can carry engineFallbackReason (child-process stderr) — keep the
  // durable archive owner-only, matching the temp mcp-config posture.
  writeFileSync(file, JSON.stringify(run, null, 2), { mode: 0o600 });
  return file;
}

interface RunIndexEntry {
  id: string;
  file: string;
  generatedAtUtc: string;
  headline: string;
  engine: string;
  worthAttention: boolean;
  impactedCount: number;
}

function walkRunFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRunFiles(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  }
}

export function listRuns(limit = 20): RunIndexEntry[] {
  const files: string[] = [];
  walkRunFiles(runsRoot(), files);
  return files
    .sort()
    .reverse()
    .slice(0, Math.min(limit, 100))
    .flatMap((file) => {
      try {
        const run = JSON.parse(readFileSync(file, "utf8")) as DeltaRun;
        return [
          {
            id: run.id,
            file,
            generatedAtUtc: run.generatedAtUtc,
            headline: run.news.headline,
            engine: run.engine,
            worthAttention: run.analysis.attention.worthAttention,
            impactedCount: run.analysis.impactedStocks.length
          }
        ];
      } catch {
        return [];
      }
    });
}

export function getRun(id: string): DeltaRun | null {
  const safeId = id.replace(/[^a-z0-9_]/gi, "");
  if (!safeId) return null;
  const files: string[] = [];
  walkRunFiles(runsRoot(), files);
  const match = files.find((file) => file.includes(`-${safeId}.json`));
  if (!match) return null;
  try {
    return JSON.parse(readFileSync(match, "utf8")) as DeltaRun;
  } catch {
    return null;
  }
}
