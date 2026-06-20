// Per-event state persistence + a human-readable, fully-traceable report.
//
// Each forecast lives in runtime-artifacts/forecasts/<eventId>/:
//   state.json  — the machine state (resumable; the loop persists after every round)
//   report.md   — the audit log a human reads: per round, per source, prob from->to
//
// We persist after every round so a crash mid-loop resumes from the last
// committed state (the persist-after-each-transition discipline from rough-loop).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { ForecastState } from "./types";

export function forecastsRoot(): string {
  const root = process.env.ARTIFACT_STORAGE_ROOT
    ? path.join(process.env.ARTIFACT_STORAGE_ROOT, "forecasts")
    : path.join(process.cwd(), "runtime-artifacts", "forecasts");
  return root;
}

export function makeEventId(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .slice(0, 48);
  const hash = createHash("sha1").update(question).digest("hex").slice(0, 8);
  return `${slug || "event"}-${hash}`;
}

export function eventDir(eventId: string): string {
  return path.join(forecastsRoot(), eventId);
}

export function loadState(eventId: string): ForecastState | null {
  const file = path.join(eventDir(eventId), "state.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ForecastState;
  } catch {
    return null;
  }
}

export function saveState(state: ForecastState): string {
  const dir = eventDir(state.eventId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "state.json");
  writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
  return file;
}

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;
const signed = (pp: number): string => `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;

export function renderReport(state: ForecastState): string {
  const lines: string[] = [];
  lines.push(`# Forecast: ${state.eventText}`);
  lines.push("");
  lines.push(`- **Event ID**: \`${state.eventId}\``);
  if (state.resolutionCriteria) lines.push(`- **Resolution criteria**: ${state.resolutionCriteria}`);
  if (state.deadline) lines.push(`- **Deadline**: ${state.deadline}`);
  lines.push(`- **Rounds run**: ${state.round}`);
  lines.push(`- **Status**: ${state.status}`);
  lines.push(
    `- **Current P(YES)**: **${pct(state.currentProb)}**  (80% band ${pct(
      state.credibleInterval[0]
    )} – ${pct(state.credibleInterval[1])})`
  );
  lines.push(`- **Sources counted**: ${state.evidenceLedger.length}`);
  lines.push(`- **Last updated**: ${state.updatedAtUtc}`);
  lines.push("");

  lines.push("## Probability trajectory");
  lines.push("");
  lines.push("| Round | Prior | → Posterior | New sources | Confidence |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of state.roundHistory) {
    lines.push(
      `| ${r.round} | ${pct(r.priorProb)} | ${pct(r.postProb)} | ${r.newSourceCount}${
        r.duplicateCount ? ` (+${r.duplicateCount} dup skipped)` : ""
      } | ${r.confidence} |`
    );
  }
  lines.push("");

  for (const r of state.roundHistory) {
    lines.push(`## Round ${r.round} — ${pct(r.priorProb)} → ${pct(r.postProb)}`);
    lines.push("");
    if (r.reasoning) {
      lines.push(`> ${r.reasoning.replace(/\n+/g, " ")}`);
      lines.push("");
    }
    if (r.searchQueries.length) {
      lines.push(`*Searches:* ${r.searchQueries.map((q) => `\`${q}\``).join(", ")}`);
      lines.push("");
    }
    if (r.perSourceUpdates.length === 0) {
      lines.push("_No new evidence this round._");
      lines.push("");
    } else {
      lines.push("| Source | Moved | From → To | Verified |");
      lines.push("| --- | --- | --- | --- |");
      for (const u of r.perSourceUpdates) {
        const label = u.title ? `[${u.title}](${u.url})` : u.url;
        lines.push(
          `| ${label} | ${signed(u.deltaPp)} | ${pct(u.from)} → ${pct(u.to)} | ${
            u.verified ? "✓ in search trace" : "⚠ not in trace"
          } |`
        );
      }
      lines.push("");
      for (const u of r.perSourceUpdates) {
        if (u.explanation) lines.push(`- **${signed(u.deltaPp)}** — ${u.explanation}  \n  ${u.url}`);
      }
      lines.push("");
    }
  }

  lines.push("## Cumulative evidence ledger");
  lines.push("");
  lines.push("| # | Source | Stance | Δ | Round |");
  lines.push("| --- | --- | --- | --- | --- |");
  state.evidenceLedger.forEach((e, i) => {
    const label = e.title ? `[${e.title}](${e.url})` : e.url;
    lines.push(`| ${i + 1} | ${label} | ${e.stance} | ${signed(e.deltaPp)} | ${e.firstSeenRound} |`);
  });
  lines.push("");
  lines.push(
    "_Probabilities are produced by an AI agent's web research, threaded through a Bayesian log-odds update. Not betting advice._"
  );
  return lines.join("\n");
}

export function writeReport(state: ForecastState): string {
  const dir = eventDir(state.eventId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "report.md");
  writeFileSync(file, renderReport(state), "utf8");
  return file;
}
