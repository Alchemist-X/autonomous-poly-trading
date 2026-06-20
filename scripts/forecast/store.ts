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
  lines.push(
    `- **Current P(YES)**: **${pct(state.currentProb)}**  (80% band ${pct(
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
