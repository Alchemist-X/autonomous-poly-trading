// Per-run progress registry — the console's "what is the system doing right
// now" feed. In-memory ring + durable runs/<id>.json after every stage
// transition so a console joining mid-run (or after a restart) still sees
// truth.

import path from "node:path";
import type { RunStage, RunStatus } from "@autopoly/delta-pm-contracts";
import { paths, writeJsonAtomic } from "./store.js";

const STAGES: RunStage[] = ["ingest", "gate1", "gate2", "analysis", "decision", "done"];
// Rough share of wall-clock each stage takes (progress-bar estimate only).
const STAGE_PCT: Record<RunStage, number> = { ingest: 5, gate1: 20, gate2: 35, analysis: 85, decision: 95, done: 100 };

const active = new Map<string, RunStatus>();
const recent: RunStatus[] = [];
const RECENT_CAP = 30;

export function startRun(newsId: string, title: string): RunStatus {
  const run: RunStatus = {
    runId: `run-${Date.now().toString(36)}-${Math.abs(hash(newsId)) % 1000}`,
    newsId,
    title,
    tickers: [],
    stage: "ingest",
    stagePct: STAGE_PCT.ingest,
    outcome: null,
    startedAtUtc: new Date().toISOString(),
    updatedAtUtc: new Date().toISOString(),
    stages: STAGES.map((stage) => ({ stage, status: stage === "ingest" ? "running" : "pending" }))
  };
  active.set(run.runId, run);
  persist(run);
  return run;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function advance(run: RunStatus, stage: RunStage, note?: string): void {
  const idx = STAGES.indexOf(stage);
  run.stages = run.stages.map((s) => {
    const sIdx = STAGES.indexOf(s.stage);
    if (sIdx < idx) return { ...s, status: s.status === "pending" ? "skipped" : "done" };
    if (sIdx === idx) return { ...s, status: stage === "done" ? "done" : "running", note };
    return s;
  });
  run.stage = stage;
  run.stagePct = STAGE_PCT[stage];
  run.updatedAtUtc = new Date().toISOString();
  persist(run);
}

export function finishRun(run: RunStatus, outcome: string): void {
  run.outcome = outcome;
  advance(run, "done", outcome);
  active.delete(run.runId);
  recent.unshift(run);
  if (recent.length > RECENT_CAP) recent.pop();
}

export function setTickers(run: RunStatus, tickers: string[]): void {
  run.tickers = tickers;
  run.updatedAtUtc = new Date().toISOString();
  persist(run);
}

function persist(run: RunStatus): void {
  writeJsonAtomic(path.join(paths.runsDir(), `${run.runId}.json`), run);
}

export function activeRuns(): RunStatus[] {
  return [...active.values()].sort((a, b) => b.startedAtUtc.localeCompare(a.startedAtUtc));
}

export function recentRuns(): RunStatus[] {
  return recent.slice(0, 10);
}
