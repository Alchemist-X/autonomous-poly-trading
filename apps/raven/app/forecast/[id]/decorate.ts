// Report-side decoration of the dossier view-model: global evidence indices
// (01…NN in reading order across iterations), arrows/labels and anchor hrefs.
// Semantics ported verbatim from the design handoff's Report renderVals().

import type { Entry } from "../../../lib/i18n";
import { SIDE_LABEL_TEMPLATES } from "../../../lib/i18n/verdict";
import { arrowFor, cap, diamondsFor, dirFor } from "../../../lib/vm/format";
import type { DossierVM, EvidenceVM, IterationVM, NetDir, Side } from "../../../lib/vm/types";

// "Support" is relative to the forecast's lean: on a NO-leaning run (the demo)
// supporting evidence pushes NO; on a YES-leaning run it pushes YES. Returns a
// locale Entry (both languages baked) so components render it with t().
export function sideLabelFor(side: Side, leanYes: boolean): Entry {
  if (side === "neutral") return SIDE_LABEL_TEMPLATES.neutral;
  const dir = side === "support" ? (leanYes ? "YES" : "NO") : leanYes ? "NO" : "YES";
  const tpl = SIDE_LABEL_TEMPLATES[side];
  return { en: tpl.en.replaceAll("{dir}", dir), zh: tpl.zh.replaceAll("{dir}", dir) };
}

export interface DecoratedEvidence extends EvidenceVM {
  idx: string; // "01"…"NN" — global book index
  arrow: string;
  dir: NetDir;
  deltaAbs: string; // "12%"
  valDiamonds: string;
  valueLabel: string; // "High" | "Med" | "Low" — localized via tierWord()
  credLabel: string; // "High" | "Med" | "Low" — localized via tierWord()
  sideLabel: Entry; // rendered with t() at the component layer
  href: string; // "#ev-01"
}

export interface DecoratedIteration extends Omit<IterationVM, "evidence"> {
  evidence: DecoratedEvidence[];
}

export interface DecoratedCore extends DecoratedEvidence {
  rank: string; // English rank key — localized via rankEntry() + t() in the view
}

export interface DecoratedDossier {
  iterations: DecoratedIteration[];
  all: DecoratedEvidence[];
  byIdx: Map<string, DecoratedEvidence>;
  core: DecoratedCore[];
  counter: DecoratedEvidence | null;
}

export function decorateDossier(dossier: DossierVM): DecoratedDossier {
  const leanYes = (dossier.currentProb ?? 0) >= 0.5;
  let k = 0;
  const all: DecoratedEvidence[] = [];
  const iterations = dossier.iterations.map((it) => ({
    ...it,
    evidence: it.evidence.map((e) => {
      k += 1;
      const idx = String(k).padStart(2, "0");
      const decorated: DecoratedEvidence = {
        ...e,
        idx,
        arrow: arrowFor(e.d),
        dir: dirFor(e.d),
        deltaAbs: `${Math.abs(e.d)}%`,
        valDiamonds: diamondsFor(e.value),
        valueLabel: cap(e.value),
        credLabel: cap(e.cred),
        sideLabel: sideLabelFor(e.side, leanYes),
        href: `#ev-${idx}`
      };
      all.push(decorated);
      return decorated;
    })
  }));
  const byId = new Map(all.map((e) => [e.id, e] as const));
  const byIdx = new Map(all.map((e) => [e.idx, e] as const));
  const core = dossier.core.flatMap((c) => {
    const e = byId.get(c.id);
    return e ? [{ ...e, rank: c.rank }] : [];
  });
  const counter = dossier.topCounter ? (byId.get(dossier.topCounter.id) ?? null) : null;
  return { iterations, all, byIdx, core, counter };
}

export const netArrowFor = (dir: NetDir): string => (dir === "down" ? "▼" : dir === "up" ? "▲" : "—");

// Whole-percent number from a 0..1 probability, falling back to a "38%" label.
export function percentOf(prob: number | null, label: string | null | undefined): number | null {
  if (prob != null && Number.isFinite(prob)) return prob * 100;
  if (!label) return null;
  const m = /(\d+(?:\.\d+)?)/.exec(label);
  return m ? Number(m[1]) : null;
}

export const roundUpTen = (x: number): number => Math.ceil(x / 10) * 10;
