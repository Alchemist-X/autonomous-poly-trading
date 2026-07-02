// View-model builders for Screen 02 · Research. Pure functions only — they
// turn the dossier/job payload (or the frozen demo snapshot) into the block
// list, reading line, queue rows and axis numbers the components render.

import type { JobInfo } from "../../lib/client/use-forecast";
import type { AnalystNote, AnalystStance } from "../../lib/server/analyst";
import { arrowFor, cap, diamondsFor, dirFor, domainOf } from "../../lib/vm/format";
import type { DossierVM, EvidenceVM, IterationVM, NetDir } from "../../lib/vm/types";

// The API also ships the job's original question (used while framing), which
// the JobInfo client type does not declare — read it through this extension.
export type JobX = JobInfo & { question?: string };

export interface EvidenceRowVM extends EvidenceVM {
  idx: string; // 2-digit running index across the displayed feed
  arrow: string;
  dir: NetDir;
  deltaAbs: string;
  valDiamonds: string;
  valueLabel: string;
  credLabel: string;
}

export interface ReadingVM {
  domain: string | null; // bold "Reading <domain>" when known
  text: string; // tail after the domain, or the whole line when domain is null
}

export interface BlockVM {
  n: string;
  reasoningId: string; // mark id for the reasoning paragraph ("r1", "r2", …)
  status: string;
  move: string;
  moveDir: NetDir;
  note: string;
  evidence: EvidenceRowVM[];
  reading: ReadingVM | null;
}

export function decorateEvidence(e: EvidenceVM, index0: number): EvidenceRowVM {
  return {
    ...e,
    idx: String(index0 + 1).padStart(2, "0"),
    arrow: arrowFor(e.d),
    dir: dirFor(e.d),
    deltaAbs: `${Math.abs(e.d)}%`,
    valDiamonds: diamondsFor(e.value),
    valueLabel: cap(e.value),
    credLabel: cap(e.cred)
  };
}

// --- frozen demo snapshot (mid-run moment from the design handoff) ---

export const DEMO_NOW = {
  bold: "disconfirmation search",
  rest: " — deliberately hunting evidence against the current lean."
};

export const DEMO_IT2_NOTE =
  "Disconfirmation pass: the strongest YES pillar — the “not content complete” flag — traces to January 2026 and looks superseded; a track-record insider sees no red flags. Now hunting for anything that cuts the other way.";

export const DEMO_READING: ReadingVM = {
  domain: "rockstarintel.com",
  text: ' — checking whether "content complete" reports supersede the January flag…'
};

export function buildDemoBlocks(demo: DossierVM): BlockVM[] {
  const it1 = demo.iterations[0];
  const it2 = demo.iterations[1];
  if (!it1 || !it2) return [];
  return [
    {
      n: "01",
      reasoningId: "r1",
      status: "complete · 38% → 30%",
      move: "▼ 8%",
      moveDir: "down",
      note: it1.note,
      evidence: it1.evidence.map((e, i) => decorateEvidence(e, i)),
      reading: null
    },
    {
      n: "02",
      reasoningId: "r2",
      status: "running · 30% → 18% so far",
      move: "▼ 12% so far",
      moveDir: "down",
      note: DEMO_IT2_NOTE,
      evidence: it2.evidence.slice(0, 2).map((e, i) => decorateEvidence(e, i + 5)),
      reading: DEMO_READING
    }
  ];
}

// --- live runs ---

export function buildLiveBlocks(iterations: IterationVM[], running: boolean, reading: ReadingVM | null): BlockVM[] {
  let k = 0;
  return iterations.map((it, i) => {
    const isRunning = running && i === iterations.length - 1;
    const netArrow = it.netDir === "down" ? "▼" : it.netDir === "up" ? "▲" : "—";
    const round = Number.parseInt(it.n, 10);
    const evidence = it.evidence.map((e) => decorateEvidence(e, k++));
    return {
      n: it.n,
      reasoningId: `r${Number.isFinite(round) && round > 0 ? round : i + 1}`,
      status: isRunning ? `running · ${it.from} → ${it.to} so far` : `complete · ${it.from} → ${it.to}`,
      move: isRunning ? `${netArrow} ${it.net} so far` : `${netArrow} ${it.net}`,
      moveDir: it.netDir,
      note: it.note,
      evidence,
      reading: isRunning ? reading : null
    };
  });
}

// Derive the "Reading <domain> — …" status from the engine's last log line;
// fall back to a per-provider generic when the line carries no URL.
export function readingFromJob(job: Pick<JobX, "log" | "provider"> | null): ReadingVM {
  const lastLine = job?.log[job.log.length - 1] ?? "";
  const urlMatch = lastLine.match(/https?:\/\/[^\s"'<>)\]]+/);
  if (urlMatch) return { domain: domainOf(urlMatch[0]), text: " — weighing what it changes…" };
  return { domain: null, text: job?.provider === "deepseek" ? "weighing evidence…" : "searching for new evidence…" };
}

export function nextRoundFor(shownIterations: number, maxRounds: number): number {
  return Math.min(shownIterations + 1, Math.max(1, maxRounds));
}

// Axis scale: at least 0–40%, widened in 10-point steps so both dots fit.
export function axisScaleFor(priorPct: number, nowPct: number): number {
  return Math.max(40, Math.ceil(Math.max(priorPct, nowPct) / 10) * 10);
}

// --- analyst queue rows ---

export interface QueuedVM {
  id: string;
  text: string;
  stanceLabel: string;
  dotColor: string;
  targetLabel: string;
  tagText: string;
  tagColor: string;
  removable: boolean;
}

// Dot colors are lean-relative (green = pushes toward the current lean,
// red = pushes against it), matching the evidence side encoding. On the
// NO-leaning demo, "Pushes NO" is green — same as the design.
function stanceMeta(stance: AnalystStance, leanYes: boolean): { label: string; dot: string } {
  if (stance === "question") return { label: "Open question", dot: "var(--val)" };
  const label = stance === "yes" ? "Pushes YES" : "Pushes NO";
  const towardLean = (stance === "yes") === leanYes;
  return { label, dot: towardLean ? "var(--pos)" : "var(--neg)" };
}

export function buildQueued(
  notes: readonly AnalystNote[],
  blocks: readonly BlockVM[],
  allIterations: readonly IterationVM[],
  nextRound: number,
  complete: boolean,
  leanYes: boolean
): QueuedVM[] {
  const shown = blocks.flatMap((b) => b.evidence);
  const targetLabelFor = (targetId: string | null): string => {
    if (!targetId) return "General";
    const row = shown.find((e) => e.id === targetId);
    if (row) return `on evidence ${row.idx}`;
    const anywhere = allIterations.flatMap((it) => it.evidence).find((e) => e.id === targetId);
    return anywhere ? anywhere.dom : targetId;
  };
  return [...notes]
    .sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : a.createdAtUtc > b.createdAtUtc ? -1 : 0))
    .map((n) => {
      const meta = stanceMeta(n.stance, leanYes);
      const folded = n.consumedRound !== null && n.consumedRound !== undefined;
      return {
        id: n.id,
        text: n.text,
        stanceLabel: meta.label,
        dotColor: meta.dot,
        targetLabel: targetLabelFor(n.targetId),
        tagText: folded
          ? `FOLDED INTO IT ${String(n.consumedRound).padStart(2, "0")}`
          : complete
            ? "SAVED"
            : `QUEUED · IT ${nextRound}`,
        tagColor: folded || complete ? "var(--verified)" : "var(--accent)",
        removable: !folded
      };
    });
}
