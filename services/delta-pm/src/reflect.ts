// Phase 0 daily reflection — the calibration dataset IS the product of the
// shadow phase (PRD §13). Two jobs:
//   1. trackSignals(): for every signal ≥24h old without a follow-up, compute
//      the realized 24h excess move after t0 — INCLUDING archived signals,
//      which is the confusion matrix's "wrongly killed" column.
//   2. buildReflection(): aggregate signals/theses/ledger/book into
//      reports/<date>-reflection.{json,md} — M1 direction hit rates by
//      priced-in status, Δt stats, contamination rate, engine usage,
//      decision funnel, book digest.
// Aggregation cores are pure so tests inject synthetic records.

import path from "node:path";
import { readdirSync } from "node:fs";
import type { NewsSignal, Portfolio } from "@autopoly/delta-pm-contracts";
import { candlesInterval, computeExcessMove } from "./m0.js";
import { appendLedger, paths, readJson, readLedger, writeJsonAtomic } from "./store.js";

export interface StoredSignal extends NewsSignal {
  title?: string;
  followUp24h?: {
    realizedExcessPct: number | null;
    directionHit: boolean | null; // null when expectedDirection is mixed or data missing
    computedAtUtc: string;
  };
}

export function listSignalFiles(): string[] {
  try {
    return readdirSync(paths.signalsDir())
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(paths.signalsDir(), f));
  } catch {
    return [];
  }
}

// --- follow-up tracking ----------------------------------------------------

export async function trackSignals(nowMs = Date.now()): Promise<number> {
  let updated = 0;
  for (const file of listSignalFiles()) {
    const signal = readJson<StoredSignal>(file);
    if (!signal || signal.followUp24h) continue;
    const t0Ms = Date.parse(signal.firstSeenUtc ?? signal.createdAtUtc);
    if (!Number.isFinite(t0Ms) || nowMs - t0Ms < 24 * 3600_000) continue;
    const ticker = signal.materiality.tickers[0];
    // Signals with no universe ticker can't be tracked — mark them so the
    // tracker doesn't rescan forever.
    if (!ticker) {
      signal.followUp24h = { realizedExcessPct: null, directionHit: null, computedAtUtc: new Date(nowMs).toISOString() };
      writeJsonAtomic(file, signal);
      updated++;
      continue;
    }
    try {
      // 15m candles reach ~52 days back — enough granularity for a 24h window.
      const coin = `xyz:${ticker}`;
      const [asset, bench] = await Promise.all([
        candlesInterval(coin, "15m", t0Ms - 3600_000, t0Ms + 25 * 3600_000),
        candlesInterval("xyz:XYZ100", "15m", t0Ms - 3600_000, t0Ms + 25 * 3600_000)
      ]);
      const beta = signal.pricedIn?.betaUsed ?? 1;
      const excess = asset.length
        ? computeExcessMove(asset, signal.pricedIn?.benchmarkUsed === "none" ? null : bench, beta, t0Ms, t0Ms + 24 * 3600_000)
        : null;
      const dirSign = signal.expectedDirection === "bearish" ? -1 : signal.expectedDirection === "bullish" ? 1 : 0;
      signal.followUp24h = {
        realizedExcessPct: excess === null ? null : excess * 100,
        directionHit: excess === null || dirSign === 0 ? null : excess * dirSign > 0,
        computedAtUtc: new Date(nowMs).toISOString()
      };
      writeJsonAtomic(file, signal);
      updated++;
    } catch {
      // transient market-data failure — retry on the next tracking pass
    }
  }
  return updated;
}

// --- aggregation (pure) ----------------------------------------------------

export interface ReflectionInput {
  signals: StoredSignal[];
  ledger: Array<Record<string, unknown>>;
  portfolio: Portfolio;
  equityUsd: number;
}

export interface Reflection {
  date: string;
  generatedAtUtc: string;
  funnel: {
    newsSeen: number;
    signals: number;
    archivedNoTicker: number;
    archivedNotMaterial: number;
    archivedStale: number;
    archivedPricedIn: number;
    theses: number;
    decisionsOpen: number;
    decisionsNoTrade: number;
  };
  pricedInDistribution: Record<string, number>;
  deltaT: { n: number; medianMinutes: number | null };
  m1Calibration: {
    // 24h direction hit rate for signals M1 sent forward (none/partial/leaked)
    forwarded: { n: number; hits: number; hitRate: number | null };
    // "wrongly killed" column: archived-as-full/reverse that then moved ≥1% with the news
    archivedFullReverse: { n: number; movedWithNews: number };
  };
  contamination: { theses: number; hard: number; soft: number; rate: number | null };
  engines: Record<string, number>;
  noTradeReasons: Array<{ reason: string; count: number }>;
  book: { equityUsd: number; realizedPnlUsd: number; positions: number; halted: boolean };
}

export function buildReflection(input: ReflectionInput, nowUtc = new Date().toISOString()): Reflection {
  const { signals, ledger } = input;
  const count = (type: string) => ledger.filter((e) => e.type === type).length;

  const archived = signals.filter((s) => !s.materiality.tradeable || !s.materiality.tickers.length || (s.pricedIn && !["none", "partial", "leaked"].includes(s.pricedIn.status)));
  const forwarded = signals.filter((s) => s.materiality.tradeable && s.materiality.tickers.length && s.pricedIn && ["none", "partial", "leaked"].includes(s.pricedIn.status));

  const pricedInDistribution: Record<string, number> = {};
  for (const s of signals) {
    const k = s.pricedIn?.status ?? "not_evaluated";
    pricedInDistribution[k] = (pricedInDistribution[k] ?? 0) + 1;
  }

  const deltas = signals.map((s) => s.pricedIn?.deltaTMinutes).filter((d): d is number => typeof d === "number").sort((a, b) => a - b);
  const median = deltas.length ? deltas[Math.floor(deltas.length / 2)] : null;

  const fwdTracked = forwarded.filter((s) => s.followUp24h?.directionHit !== null && s.followUp24h?.directionHit !== undefined);
  const fwdHits = fwdTracked.filter((s) => s.followUp24h!.directionHit).length;

  const killedFullReverse = signals.filter((s) => s.pricedIn && ["full", "reverse"].includes(s.pricedIn.status) && s.followUp24h?.realizedExcessPct !== null && s.followUp24h?.realizedExcessPct !== undefined);
  const movedWithNews = killedFullReverse.filter((s) => {
    const dirSign = s.expectedDirection === "bearish" ? -1 : 1;
    return (s.followUp24h!.realizedExcessPct as number) * dirSign >= 1;
  }).length;

  const thesisEvents = ledger.filter((e) => e.type === "thesis_created");
  const hard = thesisEvents.filter((e) => e.contamination === "hard").length;
  const soft = thesisEvents.filter((e) => e.contamination === "soft").length;

  const engines: Record<string, number> = {};
  for (const e of ledger) {
    if (typeof e.engine === "string") engines[e.engine] = (engines[e.engine] ?? 0) + 1;
  }

  const noTradeCounts = new Map<string, number>();
  for (const e of ledger) {
    if (e.type !== "decision") continue;
    const d = e.decision as { action?: string; reason?: string } | undefined;
    if (d?.action === "no_trade" && d.reason) {
      const key = d.reason.split(":")[0].slice(0, 60);
      noTradeCounts.set(key, (noTradeCounts.get(key) ?? 0) + 1);
    }
  }

  const decisions = ledger.filter((e) => e.type === "decision" && (e.decision as { action?: string } | undefined)?.action);
  const opens = decisions.filter((e) => (e.decision as { action: string }).action === "open").length;

  return {
    date: nowUtc.slice(0, 10),
    generatedAtUtc: nowUtc,
    funnel: {
      newsSeen: count("news_seen"),
      signals: signals.length,
      archivedNoTicker: signals.filter((s) => !s.materiality.tickers.length).length,
      archivedNotMaterial: signals.filter((s) => s.materiality.tickers.length > 0 && !s.materiality.tradeable).length,
      archivedStale: ledger.filter((e) => e.type === "signal_archived" && String(e.why ?? "").startsWith("stale")).length,
      archivedPricedIn: signals.filter((s) => s.pricedIn && ["full", "reverse", "awaiting_market"].includes(s.pricedIn.status)).length,
      theses: thesisEvents.length,
      decisionsOpen: opens,
      decisionsNoTrade: decisions.length - opens
    },
    pricedInDistribution,
    deltaT: { n: deltas.length, medianMinutes: median },
    m1Calibration: {
      forwarded: { n: fwdTracked.length, hits: fwdHits, hitRate: fwdTracked.length ? fwdHits / fwdTracked.length : null },
      archivedFullReverse: { n: killedFullReverse.length, movedWithNews }
    },
    contamination: { theses: thesisEvents.length, hard, soft, rate: thesisEvents.length ? (hard + soft) / thesisEvents.length : null },
    engines,
    noTradeReasons: [...noTradeCounts.entries()].map(([reason, c]) => ({ reason, count: c })).sort((a, b) => b.count - a.count),
    book: { equityUsd: input.equityUsd, realizedPnlUsd: input.portfolio.realizedPnlUsd, positions: input.portfolio.positions.length, halted: input.portfolio.halted }
  };
}

export function renderReflectionMd(r: Reflection): string {
  const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(0)}%`);
  return `# Delta PM 每日反思 — ${r.date}

> 影子模式 · 生成于 ${r.generatedAtUtc} · 本报告是 Phase 0 校准数据集的日切片

## 漏斗

新闻 ${r.funnel.newsSeen} → 信号 ${r.funnel.signals}(无池内标的 ${r.funnel.archivedNoTicker} / 不重要 ${r.funnel.archivedNotMaterial} / 旧闻重复 ${r.funnel.archivedStale} / 已定价类归档 ${r.funnel.archivedPricedIn})→ thesis ${r.funnel.theses} → 开仓 ${r.funnel.decisionsOpen} / 不开 ${r.funnel.decisionsNoTrade}

## 已定价分布

${Object.entries(r.pricedInDistribution).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Δt(t_eval − t0):n=${r.deltaT.n},中位 ${r.deltaT.medianMinutes === null ? "—" : r.deltaT.medianMinutes.toFixed(0) + " 分钟"}

## M1 校准(24h 超额方向)

- 放行信号(none/partial/leaked):n=${r.m1Calibration.forwarded.n},方向命中 ${r.m1Calibration.forwarded.hits},命中率 ${pct(r.m1Calibration.forwarded.hitRate)}(样本不足时勿下结论)
- 错杀检查(判 full/reverse 后 24h 仍顺新闻方向走 ≥1%):${r.m1Calibration.archivedFullReverse.movedWithNews}/${r.m1Calibration.archivedFullReverse.n}

## M2 盲测污染率

thesis ${r.contamination.theses} 份:hard ${r.contamination.hard} / soft ${r.contamination.soft} / 污染率 ${pct(r.contamination.rate)}

## 引擎使用

${Object.entries(r.engines).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- (无记录)"}

## 不开仓原因 Top

${r.noTradeReasons.slice(0, 6).map((x) => `- ${x.count}× ${x.reason}`).join("\n") || "- (无)"}

## 账本

equity $${r.book.equityUsd.toFixed(2)} · 已实现 $${r.book.realizedPnlUsd.toFixed(2)} · 在持 ${r.book.positions} · ${r.book.halted ? "⛔ 已停机" : "运行中"}
`;
}

// --- entry point (called by the scheduler after the daily review) ----------

export async function runReflection(equityUsd: number, portfolio: Portfolio): Promise<string> {
  const tracked = await trackSignals();
  const signals = listSignalFiles()
    .map((f) => readJson<StoredSignal>(f))
    .filter((s): s is StoredSignal => Boolean(s));
  const reflection = buildReflection({ signals, ledger: readLedger(), portfolio, equityUsd });
  const base = path.join(paths.reportsDir(), `${reflection.date}-reflection`);
  writeJsonAtomic(`${base}.json`, reflection);
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(paths.reportsDir(), { recursive: true });
  writeFileSync(`${base}.md`, renderReflectionMd(reflection), "utf8");
  appendLedger({ type: "reflection_written", tracked, report: `${base}.md` });
  return `${base}.md`;
}
