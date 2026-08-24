// EN-mode localization of already-decorated snapshot / case objects.
//
// zh mode returns the input object untouched (identity — the Chinese page must
// stay pixel-identical). EN mode maps the decorated strings back through
// labels.ts: market titles return to the exact raw English the VM sent (the
// reverse table is built from the same map), enum-ish labels get English
// equivalents, and anything unknown passes through unchanged. Numbers, dates
// and currency formatting are never touched here.

import type { PaperCase, PaperCases } from "./cases";
import type { Lang } from "./i18n";
import { enExitReason, enExitStyle, enQuestion, enTimelineLabel, tradeNoteEn } from "./labels";
import type { PaperSnapshot } from "./snapshot";

// The VM labels the synthetic first/last equity points in Chinese.
const EQUITY_DATE_EN: Record<string, string> = { 起点: "start", 现在: "now" };

// Horizon buckets arrive labeled in Chinese ("≤1 天" … "30 天以上").
function enHorizonLabel(label: string): string {
  if (label === "30 天以上") return ">30d";
  return label.replace(/\s*天$/, "d");
}

export function localizeSnapshot(snapshot: PaperSnapshot, lang: Lang): PaperSnapshot {
  if (lang === "zh") return snapshot;
  return {
    ...snapshot,
    equityCurve: snapshot.equityCurve.map((p) => ({ ...p, date: EQUITY_DATE_EN[p.date] ?? p.date })),
    closedTrades: snapshot.closedTrades.map((t) => ({
      ...t,
      question: enQuestion(t.question),
      note: tradeNoteEn(t.slug, t.closedUtc)
    })),
    openPositions: snapshot.openPositions.map((p) => ({ ...p, question: enQuestion(p.question) })),
    exitAlpha: {
      ...snapshot.exitAlpha,
      rows: snapshot.exitAlpha.rows.map((r) => ({
        ...r,
        question: enQuestion(r.question),
        exitStyle: enExitStyle(r.exitStyle),
        reason: enExitReason(r.reason)
      }))
    },
    brier: {
      ...snapshot.brier,
      rows: snapshot.brier.rows.map((r) => ({ ...r, question: enQuestion(r.question) })),
      horizon: snapshot.brier.horizon
        ? {
            ...snapshot.brier.horizon,
            buckets: snapshot.brier.horizon.buckets.map((b) => ({ ...b, label: enHorizonLabel(b.label) }))
          }
        : null,
      clusters: snapshot.brier.clusters
        ? {
            ...snapshot.brier.clusters,
            rows: snapshot.brier.clusters.rows.map((c) => ({ ...c, label: enQuestion(c.label) }))
          }
        : null,
      pending: snapshot.brier.pending.map((r) => ({ ...r, question: enQuestion(r.question) }))
    },
    decisionQuality: snapshot.decisionQuality
      ? {
          ...snapshot.decisionQuality,
          episodes: snapshot.decisionQuality.episodes.map((e) => ({ ...e, question: enQuestion(e.question) }))
        }
      : null
  };
}

function localizeCase(c: PaperCase): PaperCase {
  // Dossier text (reasoning, verdict, factors) is already English — the
  // evaluator writes in English; only the harness labels need mapping.
  return {
    ...c,
    question: enQuestion(c.question),
    timeline: c.timeline.map((t) => ({ ...t, label: enTimelineLabel(t.label) }))
  };
}

export function localizeCases(cases: PaperCases | null | undefined, lang: Lang): PaperCases | null {
  if (!cases) return null;
  if (lang === "zh") return cases;
  return {
    ...cases,
    winners: cases.winners.map(localizeCase),
    losers: cases.losers.map(localizeCase)
  };
}
