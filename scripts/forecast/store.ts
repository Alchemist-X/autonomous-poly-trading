// Per-event state persistence + a human-readable, fully-traceable report.
//
// Each forecast lives in runtime-artifacts/forecasts/<eventId>/:
//   state.json  — the machine state (resumable; the loop persists after every round)
//   report.md   — the audit log a human reads: per round, per source, prob from->to
//
// We persist after every round so a crash mid-loop resumes from the last
// committed state (the persist-after-each-transition discipline from rough-loop).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { AnalystNote, AnalystState, ForecastState } from "./types";

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

// Atomic write: write to <file>.tmp then rename, so a crash (or a concurrent
// reader — the app polls state.json) can never observe a truncated JSON.
function writeFileAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, file);
}

export function saveState(state: ForecastState): string {
  const dir = eventDir(state.eventId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "state.json");
  writeFileAtomic(file, JSON.stringify(state, null, 2));
  return file;
}

// ---- Analyst-in-the-loop state (analyst.json, written by the app / a human). ----

export function analystPath(eventId: string): string {
  return path.join(eventDir(eventId), "analyst.json");
}

const ANALYST_STANCES = new Set(["yes", "no", "question"]);
const ANALYST_MARKS = new Set(["keep", "doubt"]);

// The analyst file is an external input, so it is normalized defensively:
// missing/corrupt file => empty state; malformed notes and unknown marks are
// dropped rather than crashing a round.
export function loadAnalyst(eventId: string): AnalystState {
  const empty: AnalystState = { notes: [], marks: {} };
  const file = analystPath(eventId);
  if (!existsSync(file)) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const notes: AnalystNote[] = (Array.isArray(o.notes) ? o.notes : [])
    .map((n) => n as Record<string, unknown>)
    .filter(
      (n) =>
        typeof n.id === "string" &&
        n.id.trim() &&
        typeof n.text === "string" &&
        n.text.trim() &&
        ANALYST_STANCES.has(n.stance as string)
    )
    .map((n) => ({
      id: n.id as string,
      text: n.text as string,
      stance: n.stance as AnalystNote["stance"],
      targetId: typeof n.targetId === "string" && n.targetId ? n.targetId : null,
      createdAtUtc: typeof n.createdAtUtc === "string" ? n.createdAtUtc : "",
      consumedRound:
        typeof n.consumedRound === "number" && Number.isFinite(n.consumedRound) ? n.consumedRound : null,
    }));
  const marks: AnalystState["marks"] = {};
  if (o.marks && typeof o.marks === "object" && !Array.isArray(o.marks)) {
    for (const [k, v] of Object.entries(o.marks as Record<string, unknown>)) {
      if (ANALYST_MARKS.has(v as string)) marks[k] = v as AnalystState["marks"][string];
    }
  }
  const doubtsHandled: Record<string, number> = {};
  if (o.doubtsHandled && typeof o.doubtsHandled === "object" && !Array.isArray(o.doubtsHandled)) {
    for (const [k, v] of Object.entries(o.doubtsHandled as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) doubtsHandled[k] = v;
    }
  }
  return { notes, marks, doubtsHandled };
}

export function saveAnalyst(eventId: string, a: AnalystState): void {
  mkdirSync(eventDir(eventId), { recursive: true });
  writeFileAtomic(analystPath(eventId), JSON.stringify(a, null, 2));
}

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;
const signed = (pp: number): string => `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;

export function renderReport(state: ForecastState): string {
  const lines: string[] = [];
  lines.push(`# Forecast: ${state.framing.normalizedQuestion}`);
  lines.push("");
  lines.push(`- **Event ID**: \`${state.eventId}\``);
  lines.push(`- **Your prompt**: ${state.eventText}`);
  lines.push(`- **Resolution criteria**: ${state.framing.resolutionCriteria}`);
  if (state.framing.resolutionDate) lines.push(`- **Resolution date**: ${state.framing.resolutionDate}`);
  if (state.framing.settlementSource) lines.push(`- **Settlement source**: ${state.framing.settlementSource}`);
  if (state.framing.assumptions) lines.push(`- **Framing assumptions**: ${state.framing.assumptions}`);
  lines.push(
    `- **Base-rate prior**: ${pct(state.framing.priorProbability)}${
      state.framing.priorRationale ? ` — ${state.framing.priorRationale}` : ""
    }`
  );
  if (state.framing.framingCaveats)
    lines.push(`- **Framing caveats** (audit): ${state.framing.framingCaveats}`);
  lines.push(`- **Framing confidence**: ${state.framing.framingConfidence}`);
  lines.push(`- **Rounds run**: ${state.round}`);
  lines.push(`- **Status**: ${state.status}`);
  // Internal heuristic band — kept in the audit trail, never labeled a
  // confidence interval (user decision 2026-07-02: no CI claims anywhere).
  lines.push(
    `- **Current P(YES)**: **${pct(state.currentProb)}**  (internal band ${pct(
      state.credibleInterval[0]
    )} – ${pct(state.credibleInterval[1])})`
  );
  lines.push(`- **Sources counted**: ${state.evidenceLedger.length}`);
  lines.push(`- **Last updated**: ${state.updatedAtUtc}`);
  lines.push("");

  if (state.summary) {
    const s = state.summary;
    lines.push("## Summary");
    lines.push("");
    lines.push(s.verdict);
    lines.push("");
    if (s.keyFactorsYes.length) {
      lines.push("**Strongest factors for YES:**");
      for (const f of s.keyFactorsYes) lines.push(`- ${f}`);
      lines.push("");
    }
    if (s.keyFactorsNo.length) {
      lines.push("**Strongest factors for NO:**");
      for (const f of s.keyFactorsNo) lines.push(`- ${f}`);
      lines.push("");
    }
    if (s.mainUncertainties) {
      lines.push(`**Main uncertainties:** ${s.mainUncertainties}`);
      lines.push("");
    }
    if (s.calibrationNote) {
      lines.push(`**Calibration note:** ${s.calibrationNote}`);
      lines.push("");
    }
  }

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
    if (r.unverifiedPp > 0.1) {
      lines.push(
        `> ⚠ ${r.unverifiedPp.toFixed(1)}pp of this round's movement came from soft-clamped UNVERIFIED sources (not found in the agent's tool trace).`
      );
      lines.push("");
    }
    if (r.confirmationRatio != null) {
      const oneSided = r.confirmationRatio > 0.85;
      lines.push(
        `*Confirmation ratio:* ${(r.confirmationRatio * 100).toFixed(0)}% of evidence weight reinforced the prior lean${
          oneSided ? " ⚠ one-sided (possible confirmation bias)" : ""
        }`
      );
      lines.push("");
    }
    if (r.perSourceUpdates.length === 0) {
      lines.push("_No new evidence this round._");
      lines.push("");
    } else {
      const evidence = r.perSourceUpdates.filter((u) => u.kind === "evidence");
      const clusters = new Set(evidence.map((u) => u.clusterId)).size;
      lines.push(
        `*${evidence.length} new source(s) in ${clusters} independent cluster(s)` +
          (r.reflectionCount ? `, ${r.reflectionCount} reflection(s) on prior sources` : "") +
          ".*"
      );
      lines.push("");
      lines.push("| Source | Kind | Moved | From → To | Verified | Cluster |");
      lines.push("| --- | --- | --- | --- | --- | --- |");
      for (const u of r.perSourceUpdates) {
        const label = u.title ? `[${u.title}](${u.url})` : u.url;
        const kind = u.kind === "reflection" ? "↻ reflection" : "evidence";
        const cluster =
          u.kind === "reflection" ? "—" : u.clusterFactor < 1 ? `↓×${u.clusterFactor} correlated` : "independent";
        lines.push(
          `| ${label} | ${kind} | ${signed(u.deltaPp)} | ${pct(u.from)} → ${pct(u.to)} | ${
            u.verified ? "✓ in search trace" : "⚠ not in trace"
          } | ${cluster} |`
        );
      }
      lines.push("");
      if (r.whyChanged) {
        const w = r.whyChanged;
        const dom = w.dominantTitle ? `[${w.dominantTitle}](${w.dominantUrl})` : w.dominantUrl;
        lines.push(
          `**Why it changed:** net ${signed(w.netPp)} this round — ${signed(w.upPp)} from supporting sources, ${signed(
            w.downPp
          )} against. Biggest mover: ${dom} (${signed(w.dominantPp)}${w.dominantKind === "reflection" ? ", reflection" : ""}).`
        );
        lines.push("");
      }
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
    lines.push(
      `| ${i + 1} | ${label} | ${e.stance}${e.kind === "reflection" ? " ↻" : ""} | ${signed(e.deltaPp)} | ${e.firstSeenRound} |`
    );
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
