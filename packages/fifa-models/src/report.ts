/**
 * Render forecaster output into the archive: a machine-readable JSON of all nine
 * views per fixture, plus bilingual forecasting-engine reports (decision-first,
 * jargon-free, evidence as plain-language driver cards).
 *
 * These are written to a dedicated archive root (NOT the live web reports tree), so
 * each forecaster's per-fixture call is preserved for later Brier/LogLoss scoring as
 * the knockouts resolve. The headline verdict is the multi-calibrated 8-in-1 view.
 */

import type { OneXTwo } from "@autopoly/sports-model";
import type { Driver, ModelPrediction } from "./types.js";
import { MULTICAL_ID } from "./registry.js";

export interface ForecasterEntry {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly prediction: ModelPrediction;
}

export interface FixtureForecasts {
  readonly fixtureId: string;
  readonly teamA: string;
  readonly teamB: string;
  readonly kickoffUtc: string;
  readonly entries: readonly ForecasterEntry[];
}

const pct = (x: number): number => Math.round(x * 1000) / 10;

const confidenceTier = (p: OneXTwo): { cn: string; en: string } => {
  const top = Math.max(p.home, p.draw, p.away);
  if (top >= 0.6) return { cn: "高", en: "high" };
  if (top >= 0.45) return { cn: "中", en: "medium" };
  return { cn: "低", en: "low" };
};

const verdict = (
  p: OneXTwo,
  teamA: string,
  teamB: string,
): { cn: string; en: string; topPct: number } => {
  if (p.draw >= p.home && p.draw >= p.away) {
    return { cn: `两队势均力敌，平局是单一最可能结果`, en: `evenly matched — a draw is the single likeliest result`, topPct: pct(p.draw) };
  }
  const aWin = p.home >= p.away;
  const who = aWin ? teamA : teamB;
  const top = aWin ? p.home : p.away;
  const strength = top >= 0.6 ? { cn: "明显看好", en: "clearly favour" } : top >= 0.45 ? "" : "";
  void strength;
  return { cn: `看好 ${who}`, en: `${who} favoured`, topPct: pct(top) };
};

/** Structured, language-neutral JSON archive of all forecasters for one fixture. */
export const renderForecastsJson = (ff: FixtureForecasts): unknown => ({
  fixtureId: ff.fixtureId,
  teamA: ff.teamA,
  teamB: ff.teamB,
  kickoffUtc: ff.kickoffUtc,
  headlineForecaster: MULTICAL_ID,
  marketBlind: true,
  forecasters: ff.entries.map((e) => ({
    id: e.id,
    name: e.name,
    family: e.family,
    probs: e.prediction.probs,
    outcomes: [
      { key: "a", label: ff.teamA, p: e.prediction.probs.home },
      { key: "draw", label: "Draw", p: e.prediction.probs.draw },
      { key: "b", label: ff.teamB, p: e.prediction.probs.away },
    ],
    headline: e.prediction.rationale.headline,
    drivers: e.prediction.rationale.drivers,
    methodNote: e.prediction.rationale.methodNote,
  })),
});

const headlineEntry = (ff: FixtureForecasts): ForecasterEntry => {
  const mc = ff.entries.find((e) => e.id === MULTICAL_ID);
  return mc ?? ff.entries[0]!;
};

/** Compact disagreement note: how many forecasters lean each way. */
const disagreement = (ff: FixtureForecasts): { cn: string; en: string } => {
  let a = 0;
  let b = 0;
  let d = 0;
  for (const e of ff.entries) {
    const p = e.prediction.probs;
    if (p.home >= p.away && p.home >= p.draw) a += 1;
    else if (p.away > p.home && p.away >= p.draw) b += 1;
    else d += 1;
  }
  const n = ff.entries.length;
  return {
    cn: `${n} 个预测者中：${a} 个看好 ${ff.teamA}、${b} 个看好 ${ff.teamB}、${d} 个看平。`,
    en: `Of ${n} forecasters: ${a} lean ${ff.teamA}, ${b} lean ${ff.teamB}, ${d} lean draw.`,
  };
};

const driverLines = (drivers: readonly Driver[]): string =>
  drivers
    .map((d) => {
      const sign = d.contributionPp > 0 ? "+" : "";
      return `- **${d.label}** (${sign}${d.contributionPp}pp): ${d.detail}`;
    })
    .join("\n");

const table = (ff: FixtureForecasts, headerA: string, headerB: string, leanWord: (e: ForecasterEntry) => string): string => {
  const rows = ff.entries
    .map((e) => {
      const p = e.prediction.probs;
      return `| ${e.name} | ${pct(p.home)}% | ${pct(p.draw)}% | ${pct(p.away)}% | ${leanWord(e)} |`;
    })
    .join("\n");
  return `| Forecaster | ${headerA} | Draw | ${headerB} | Lean |\n|---|---|---|---|---|\n${rows}`;
};

const leanCn = (ff: FixtureForecasts) => (e: ForecasterEntry): string => {
  const p = e.prediction.probs;
  if (p.draw >= p.home && p.draw >= p.away) return "平";
  return p.home >= p.away ? ff.teamA : ff.teamB;
};

/** Chinese forecasting-engine report for one fixture. */
export const renderReportCn = (ff: FixtureForecasts): string => {
  const h = headlineEntry(ff);
  const v = verdict(h.prediction.probs, ff.teamA, ff.teamB);
  const tier = confidenceTier(h.prediction.probs);
  const p = h.prediction.probs;
  return [
    `# ${ff.teamA} vs ${ff.teamB} — 32 强预测（FIFA 八模型）`,
    ``,
    `**头条判断（多校准 8 合 1）：** ${v.cn}，约 ${v.topPct}% — ${ff.teamA} ${pct(p.home)}% / 平 ${pct(p.draw)}% / ${ff.teamB} ${pct(p.away)}%（信心：${tier.cn}）`,
    ``,
    `## 九个预测者对比`,
    ``,
    table(ff, `${ff.teamA} 胜`, `${ff.teamB} 胜`, leanCn(ff)),
    ``,
    `## 分歧`,
    ``,
    disagreement(ff).cn,
    ``,
    `## 头条依据（forecasting engine）`,
    ``,
    driverLines(h.prediction.rationale.drivers),
    ``,
    `_方法：${h.prediction.rationale.methodNote}_`,
    ``,
    `_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_`,
    ``,
  ].join("\n");
};

/** English forecasting-engine report for one fixture. */
export const renderReportEn = (ff: FixtureForecasts): string => {
  const h = headlineEntry(ff);
  const v = verdict(h.prediction.probs, ff.teamA, ff.teamB);
  const tier = confidenceTier(h.prediction.probs);
  const p = h.prediction.probs;
  return [
    `# ${ff.teamA} vs ${ff.teamB} — Round-of-32 forecast (FIFA eight-model engine)`,
    ``,
    `**Headline call (multi-calibrated 8-in-1):** ${v.en}, ~${v.topPct}% — ${ff.teamA} ${pct(p.home)}% / Draw ${pct(p.draw)}% / ${ff.teamB} ${pct(p.away)}% (confidence: ${tier.en})`,
    ``,
    `## All nine forecasters`,
    ``,
    table(ff, `${ff.teamA} win`, `${ff.teamB} win`, (e) => leanCn(ff)(e)),
    ``,
    `## Disagreement`,
    ``,
    disagreement(ff).en,
    ``,
    `## Why (forecasting engine)`,
    ``,
    driverLines(h.prediction.rationale.drivers),
    ``,
    `_Method: ${h.prediction.rationale.methodNote}_`,
    ``,
    `_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._`,
    ``,
  ].join("\n");
};
