// Pipeline orchestration — the PRD §4 two-layer concurrency model:
//   layer 1: M1/M2 analysis — stateless, runs in parallel (cap N), never
//            touches the book;
//   layer 2: M3 decision + paper execution — strictly serialized through a
//            two-lane writer (fast lane = stop scans / reconciliation,
//            slow lane = entries), snapshot re-read INSIDE the writer.
// Shadow mode: "execution" = recording a paper fill at the current mark plus
// the tier slippage budget. No real order can exist here.

import path from "node:path";
import { readdirSync } from "node:fs";
import {
  newsItemSchema,
  portfolioSchema,
  type NewsItem,
  type Portfolio,
  type Position,
  type PriorCoverage,
  type TradeThesis,
  type UniverseEntry
} from "@autopoly/delta-pm-contracts";
import { runM2 } from "./analyzer.js";
import { config } from "./config.js";
import { checkPriorCoverage, effectiveT0Ms } from "./coverage.js";
import { buildSignal, classifyPricedIn, findStaleDuplicate, fingerprintOf, matchUniverse, runGate1, type RecentSignalDigest } from "./gate.js";
import type { Candle } from "./hyperliquid.js";
import { candles1m, candlesDaily, computeAtr, computeBeta, computeDailyVolPct, computeExcessMove, computeMaxDailyMovePct } from "./m0.js";
import { marketState } from "./market.js";
import { checkHalt, decideEntry, equityOf, reviewPosition, updateTrailingStop, type MarketView } from "./policy.js";
import { advance, finishRun, setTickers, startRun } from "./progress.js";
import { push } from "./notify.js";
import { appendLedger, paths, readJson, upsertNewsItem, writeJsonAtomic } from "./store.js";
import { fetchCandles } from "./hyperliquid.js";

// --- two-lane writer -------------------------------------------------------

type Job = { run: () => Promise<void>; fast: boolean };
const queue: Job[] = [];
let pumping = false;

export function enqueueWriter(fast: boolean, run: () => Promise<void>): void {
  if (fast) {
    const idx = queue.findIndex((j) => !j.fast);
    queue.splice(idx < 0 ? queue.length : idx, 0, { run, fast });
  } else {
    queue.push({ run, fast });
  }
  void pump();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      await job.run();
    } catch (error) {
      appendLedger({ type: "error", where: job.fast ? "writer_fast" : "writer_slow", message: error instanceof Error ? error.message : String(error) });
    }
  }
  pumping = false;
}

// --- analysis semaphore ----------------------------------------------------

let analysisSlots = 0;
const analysisWaiters: Array<() => void> = [];

async function withAnalysisSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (analysisSlots >= config.analysisConcurrency) {
    await new Promise<void>((resolve) => analysisWaiters.push(resolve));
  }
  analysisSlots++;
  try {
    return await fn();
  } finally {
    analysisSlots--;
    analysisWaiters.shift()?.();
  }
}

// --- portfolio persistence -------------------------------------------------

export function loadPortfolio(): Portfolio {
  const raw = readJson<unknown>(paths.portfolio());
  if (raw) {
    const parsed = portfolioSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  const fresh: Portfolio = {
    mode: "shadow",
    initialCapitalUsd: config.initialCapitalUsd,
    realizedPnlUsd: 0,
    positions: [],
    halted: false,
    haltedReason: null,
    lastStopOutUtc: {},
    updatedAtUtc: new Date().toISOString()
  };
  writeJsonAtomic(paths.portfolio(), fresh);
  return fresh;
}

function savePortfolio(p: Portfolio): void {
  p.updatedAtUtc = new Date().toISOString();
  writeJsonAtomic(paths.portfolio(), p);
}

export function currentMarks(universe: UniverseEntry[]): Map<string, number> {
  const marks = new Map<string, number>();
  for (const u of universe) {
    const mark = marketState.ctxs.get(u.hlSymbol)?.markPx;
    if (mark) marks.set(u.ticker, mark);
  }
  return marks;
}

// --- market view assembly (per ticker, cached β) ---------------------------

interface TickerCacheEntry {
  atMs: number;
  beta: ReturnType<typeof computeBeta> | null;
  atr20d: number | null;
  dailyVolPct: number;
  maxDailyMovePct: number;
  daily: Candle[];
}

const tickerCache = new Map<string, TickerCacheEntry>();
const CACHE_TTL_MS = 12 * 3600_000;

async function tickerStats(entry: UniverseEntry): Promise<TickerCacheEntry> {
  const cached = tickerCache.get(entry.ticker);
  if (cached && Date.now() - cached.atMs < CACHE_TTL_MS) return cached;
  const now = Date.now();
  const daily = await candlesDaily(entry.hlSymbol);
  let beta: ReturnType<typeof computeBeta> | null = null;
  if (entry.benchmark) {
    const from1h = now - 200 * 86_400_000;
    const [asset1h, bench1h] = await Promise.all([
      fetchCandles(entry.hlSymbol, "1h", from1h, now),
      fetchCandles(`${entry.hlSymbol.split(":")[0]}:${entry.benchmark}`, "1h", from1h, now)
    ]);
    beta = computeBeta(asset1h, bench1h);
  }
  const stats: TickerCacheEntry = {
    atMs: now,
    beta,
    atr20d: computeAtr(daily),
    dailyVolPct: computeDailyVolPct(daily) ?? 0.02,
    maxDailyMovePct: computeMaxDailyMovePct(daily),
    daily
  };
  tickerCache.set(entry.ticker, stats);
  return stats;
}

function swingLevels(daily: Candle[], mark: number): { swingLowPx: number | null; swingHighPx: number | null } {
  // Most recent local extreme within the last 10 weekday bars beyond the mark.
  const recent = daily.slice(-10);
  const lows = recent.map((c) => c.l).filter((l) => l < mark);
  const highs = recent.map((c) => c.h).filter((h) => h > mark);
  return { swingLowPx: lows.length ? Math.max(...lows) : null, swingHighPx: highs.length ? Math.min(...highs) : null };
}

// --- the news pipeline -----------------------------------------------------

export interface PipelineDeps {
  universe: UniverseEntry[];
}

export async function processNews(rawItem: unknown, deps: PipelineDeps): Promise<void> {
  const parsed = newsItemSchema.safeParse(rawItem);
  if (!parsed.success) {
    appendLedger({ type: "error", where: "ingest", message: `news item failed schema: ${parsed.error.issues[0]?.message}` });
    return;
  }
  // 原文存档 + source of truth: every received original is persisted to
  // news/ (the audit page renders it); the FIRST record for an id owns
  // identity and timing, so a re-ingest (console 补全原文 paste) only fills
  // gaps and becomes a RERUN of the original signal, driven by the merged
  // record.
  const upsert = upsertNewsItem(parsed.data);
  const item: NewsItem = upsert.item;
  appendLedger({
    type: "news_seen",
    newsId: item.id,
    title: item.title,
    publishedUtc: item.publishedUtc,
    kind: item.kind,
    prefix: item.prefix,
    rerun: upsert.existed,
    hasFullText: Boolean(item.fullText)
  });
  const run = startRun(item.id, item.title);

  await withAnalysisSlot(async () => {
    try {
      // --- gate 1 (universe-matched items get a prior-coverage search first) ---
      advance(run, "gate1");
      let coverage: PriorCoverage | null = null;
      if (matchUniverse(item, deps.universe).length) {
        advance(run, "gate1", "跨源检索既有报道中(≤15s)");
        coverage = await checkPriorCoverage(item);
        appendLedger({
          type: "coverage_check",
          newsId: item.id,
          searched: coverage.searched,
          priorHitCount: coverage.priorHitCount,
          earliestPriorUtc: coverage.earliestPriorUtc,
          skippedReason: coverage.skippedReason,
          error: coverage.error
        });
      }
      const g1 = await runGate1(item, deps.universe, coverage);
      const gate1 = g1.value!;
      setTickers(run, gate1.tickers);
      const fingerprint = fingerprintOf(gate1);

      if (!gate1.tradeable || !gate1.tickers.length) {
        const signal = buildSignal(item, gate1, fingerprint, null, null, coverage);
        writeJsonAtomic(path.join(paths.signalsDir(), `${signal.id}.json`), { ...signal, title: item.title });
        appendLedger({ type: "signal_archived", signalId: signal.id, newsId: item.id, why: gate1.reason, engine: g1.engine });
        finishRun(run, `归档:未过重要性闸门(${gate1.reason.slice(0, 80)})`);
        return;
      }

      // Staleness: same fingerprint or high text similarity in recent signals
      // from OTHER news ids (same-id = rerun, allowed through by design).
      const recentSignals = loadRecentSignals(40);
      const stale = findStaleDuplicate(recentSignals, fingerprint, item);
      if (stale) {
        const signal = buildSignal(item, gate1, fingerprint, null, null, coverage);
        writeJsonAtomic(path.join(paths.signalsDir(), `${signal.id}.json`), { ...signal, title: item.title });
        appendLedger({
          type: "signal_archived",
          signalId: signal.id,
          newsId: item.id,
          why: `stale: duplicate of ${stale.basis === "fingerprint" ? "fingerprint" : "similar text"} ${stale.dup.signalId}`
        });
        finishRun(run, "归档:旧闻/重复(指纹或文本相似)");
        return;
      }

      // --- gate 2 (per ticker; primary = first) ---
      advance(run, "gate2");
      const primary = deps.universe.find((u) => u.ticker === gate1.tickers[0])!;
      const stats = await tickerStats(primary);
      // t0 = published, or the earliest verified prior appearance when the
      // coverage search found one (safe direction: counts more of the move).
      const t0Ms = effectiveT0Ms(item, coverage);
      const pricedIn = await classifyPricedIn({
        entry: primary,
        benchmark1h: null,
        beta: stats.beta,
        dailyVolPct: stats.dailyVolPct,
        t0Ms,
        nowMs: Date.now(),
        expectedDirection: gate1.expectedDirection,
        coarseImpactBand: gate1.coarseImpactBand,
        eventType: gate1.eventType
      });
      const signal = buildSignal(item, gate1, fingerprint, pricedIn, primary.consensusBaseline?.asOfUtc ?? null, coverage);
      writeJsonAtomic(path.join(paths.signalsDir(), `${signal.id}.json`), { ...signal, title: item.title });
      appendLedger({
        type: "signal_created",
        signalId: signal.id,
        newsId: item.id,
        tickers: gate1.tickers,
        pricedIn: pricedIn.status,
        deltaTMinutes: pricedIn.deltaTMinutes,
        t0Utc: new Date(t0Ms).toISOString(),
        engine: g1.engine
      });

      if (!["none", "partial", "leaked"].includes(pricedIn.status)) {
        finishRun(run, `归档:已定价判定 ${pricedIn.status}(${pricedIn.note.slice(0, 60)})`);
        return;
      }

      void push("signal", `信号过检:${gate1.tickers.join("/")} ${item.title.slice(0, 60)}`, [
        `重要性 ${gate1.score}/100 · ${gate1.eventType} · 方向 ${gate1.expectedDirection}`,
        `定价检查: ${pricedIn.status}(已实现 ${pricedIn.realizedExcessPct?.toFixed(2) ?? "?"}%,Δt ${pricedIn.deltaTMinutes.toFixed(0)} 分钟)`,
        `进入深度分析…`
      ]);

      // --- M2 ---
      advance(run, "analysis", `${primary.ticker} 影响分析中(${signal.materiality.eventType})`);
      const m2 = await runM2(item, signal, primary, primary.ticker);
      writeJsonAtomic(path.join(paths.thesesDir(), `${m2.thesis.id}.json`), m2.thesis);
      appendLedger({
        type: "thesis_created",
        thesisId: m2.thesis.id,
        signalId: signal.id,
        ticker: m2.thesis.ticker,
        direction: m2.thesis.direction,
        fairImpactPct: m2.thesis.fairImpactPct,
        contamination: m2.thesis.contamination,
        engine: m2.provider.engine,
        fallbackReason: m2.provider.fallbackReason,
        scrubbedSentences: m2.scrubbedSentences
      });

      // --- M3 + paper execution (writer lane) ---
      advance(run, "decision");
      await new Promise<void>((resolve) => {
        enqueueWriter(false, async () => {
          try {
            const outcome = await decideAndExecute(m2.thesis, signal.id, primary, stats, t0Ms, deps);
            finishRun(run, outcome);
          } finally {
            resolve();
          }
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendLedger({ type: "error", where: "pipeline", newsId: item.id, message });
      finishRun(run, `失败:${message.slice(0, 120)}`);
    }
  });
}

function loadRecentSignals(limit: number): RecentSignalDigest[] {
  let files: string[] = [];
  try {
    files = readdirSync(paths.signalsDir())
      .filter((f) => f.endsWith(".json"))
      .sort()
      .slice(-limit);
  } catch {
    return [];
  }
  const out: RecentSignalDigest[] = [];
  for (const f of files) {
    const s = readJson<Record<string, unknown>>(path.join(paths.signalsDir(), f));
    if (s) out.push({ signalId: String(s.id), fingerprint: String(s.fingerprint), newsId: String(s.newsId), title: s.title ? String(s.title) : undefined });
  }
  return out;
}

async function decideAndExecute(
  thesis: TradeThesis,
  signalId: string,
  entry: UniverseEntry,
  stats: TickerCacheEntry,
  t0Ms: number,
  deps: PipelineDeps
): Promise<string> {
  // Snapshot re-read INSIDE the writer — the book may have changed while we analyzed.
  const portfolio = loadPortfolio();
  const marks = currentMarks(deps.universe);
  const mark = marks.get(thesis.ticker);
  if (!mark) return `无法执行:${thesis.ticker} 无实时 mark`;

  // Fresh realized-excess at decision time (edge decay is real).
  const nowMs = Date.now();
  const asset1m = await candles1m(entry.hlSymbol, t0Ms - 30 * 60_000, nowMs);
  const bench1m = entry.benchmark ? await candles1m(`${entry.hlSymbol.split(":")[0]}:${entry.benchmark}`, t0Ms - 30 * 60_000, nowMs) : null;
  const beta = entry.benchmark === null ? 0 : stats.beta?.beta ?? 1;
  const realized = asset1m.length ? computeExcessMove(asset1m, bench1m, beta, t0Ms, nowMs) : null;

  const baselinePx = asset1m.length ? asset1m[0].c : mark;
  const { swingLowPx, swingHighPx } = swingLevels(stats.daily, mark);
  const view: MarketView = {
    markPx: mark,
    atr20d: stats.atr20d,
    dailyVolPct: stats.dailyVolPct,
    maxDailyMovePct: stats.maxDailyMovePct,
    swingLowPx,
    swingHighPx,
    fundingHourly: marketState.ctxs.get(entry.hlSymbol)?.funding ?? null,
    realizedExcessSinceT0Pct: (realized ?? 0) * 100,
    baselinePx,
    benchmarkBaselinePx: bench1m?.length ? bench1m[0].c : null,
    beta: entry.benchmark === null ? null : beta
  };

  const equity = equityOf(portfolio, marks);
  const clusterGross = new Map<string, number>();
  for (const p of portfolio.positions) {
    const u = deps.universe.find((x) => x.ticker === p.ticker);
    const notional = p.qty * (marks.get(p.ticker) ?? p.entryPx);
    for (const tag of u?.tags ?? []) clusterGross.set(tag, (clusterGross.get(tag) ?? 0) + notional);
  }

  const decision = decideEntry({
    thesis,
    entry,
    view,
    portfolio,
    equityUsd: equity,
    dayPnlPct: dayPnlPct(portfolio, marks),
    clusterGrossUsd: clusterGross,
    marksByTicker: marks,
    nowUtc: new Date().toISOString()
  });
  appendLedger({ type: "decision", decision });

  if (decision.action !== "open" || !decision.stop || !decision.direction) {
    void push("decision", `不开仓:${thesis.ticker}`, [
      `${thesis.direction} · fairImpact ${thesis.fairImpactPct.min}%/${thesis.fairImpactPct.point}%/${thesis.fairImpactPct.max}%`,
      decision.reason.slice(0, 160)
    ]);
    return `不开仓:${decision.reason.slice(0, 140)}`;
  }

  // Paper fill: mark + tier slippage in the adverse direction.
  const slip = config.slippageBudgetPctByTier[entry.liquidityTier];
  const fillPx = decision.direction === "long" ? mark * (1 + slip) : mark * (1 - slip);
  const position: Position = {
    ticker: thesis.ticker,
    hlSymbol: entry.hlSymbol,
    direction: decision.direction,
    qty: decision.sizeUsd / fillPx,
    entryPx: fillPx,
    entryUtc: new Date().toISOString(),
    notionalUsdAtEntry: decision.sizeUsd,
    leverage: decision.leverage ?? 1,
    stopPx: decision.stop.initialPx,
    hardFloorPx: decision.stop.hardFloorPx,
    targetPctExcess: decision.targetPctExcess,
    horizonUtc: decision.horizonUtc ?? new Date(Date.now() + thesis.horizonHours * 3600_000).toISOString(),
    extendedOnce: false,
    thesisId: thesis.id,
    decisionId: decision.id,
    signalT0Utc: new Date(t0Ms).toISOString(),
    baselinePx,
    benchmarkBaselinePx: view.benchmarkBaselinePx,
    beta: view.beta,
    trailArmed: false,
    highestClosePx: null
  };
  portfolio.positions.push(position);
  savePortfolio(portfolio);
  appendLedger({ type: "paper_open", ticker: position.ticker, direction: position.direction, qty: position.qty, fillPx, sizeUsd: decision.sizeUsd, decisionId: decision.id, signalId });
  void push("decision", `纸面开仓:${position.direction} ${position.ticker} $${decision.sizeUsd}`, [
    `成交 ${fillPx.toFixed(2)} · 止损 ${position.stopPx} · 硬地板 ${position.hardFloorPx}(−20%)`,
    `持有至 ${position.horizonUtc.slice(0, 16)}Z`,
    decision.reason.slice(0, 140)
  ]);
  return `开仓(纸面):${position.direction} ${position.ticker} $${decision.sizeUsd}(理由:${decision.reason.slice(0, 100)})`;
}

function dayPnlPct(portfolio: Portfolio, marks: Map<string, number>): number {
  // Shadow-mode approximation: unrealized swing today ≈ total PnL vs initial,
  // refined in Phase 1 with a day-start equity snapshot.
  const equity = equityOf(portfolio, marks);
  const ref = portfolio.initialCapitalUsd + portfolio.realizedPnlUsd;
  return ref > 0 ? (equity - ref) / ref : 0;
}

// --- fast tick: stop scan + trailing + halt (fast writer lane) -------------

export function scheduleFastTick(deps: PipelineDeps): void {
  enqueueWriter(true, async () => {
    const portfolio = loadPortfolio();
    if (!portfolio.positions.length) return;
    const marks = currentMarks(deps.universe);

    const halt = checkHalt(portfolio, marks);
    if (halt.halted && !portfolio.halted) {
      portfolio.halted = true;
      portfolio.haltedReason = halt.reason;
      appendLedger({ type: "halt", reason: halt.reason });
      void push("book_event", "⛔ 组合停机(−25% 用户红线)", [halt.reason ?? ""]);
    }

    const keep: Position[] = [];
    for (const p of portfolio.positions) {
      const mark = marks.get(p.ticker);
      if (!mark) {
        keep.push(p);
        continue;
      }
      const stats = tickerCache.get(p.ticker);
      const dirSign = p.direction === "long" ? 1 : -1;
      const adversePct = (dirSign * (p.entryPx - mark)) / p.entryPx;
      const throughStop = dirSign > 0 ? mark <= p.stopPx : mark >= p.stopPx;

      if (adversePct >= config.hardStopAdversePct || throughStop) {
        const pnl = dirSign * (mark - p.entryPx) * p.qty;
        portfolio.realizedPnlUsd += pnl;
        portfolio.lastStopOutUtc[`${p.ticker}:${p.direction}`] = new Date().toISOString();
        const stopType = adversePct >= config.hardStopAdversePct ? "hard_floor_stop" : "stop_loss";
        appendLedger({ type: stopType, ticker: p.ticker, direction: p.direction, exitPx: mark, pnlUsd: pnl, adversePct, stopPx: p.stopPx });
        void push("book_event", `${stopType === "hard_floor_stop" ? "硬地板止损(−20% 用户红线)" : "技术止损"}:${p.ticker}`, [
          `${p.direction} 出场 ${mark.toFixed(2)} · 盈亏 $${pnl.toFixed(2)}`
        ]);
        continue; // closed
      }
      // Trailing update needs excess-frame progress; approximate with raw when β cached stats are missing.
      const rawMovePct = (dirSign * (mark - p.baselinePx)) / p.baselinePx * 100;
      keep.push(stats?.atr20d ? updateTrailingStop(p, mark, stats.atr20d, rawMovePct) : p);
    }
    portfolio.positions = keep;
    savePortfolio(portfolio);
  });
}

// --- daily review (valuation/time tracks; slow lane) -----------------------

export function scheduleDailyReview(deps: PipelineDeps): void {
  enqueueWriter(false, async () => {
    const portfolio = loadPortfolio();
    if (!portfolio.positions.length) return;
    const marks = currentMarks(deps.universe);
    const keep: Position[] = [];
    for (const p of portfolio.positions) {
      const mark = marks.get(p.ticker);
      const entryU = deps.universe.find((u) => u.ticker === p.ticker);
      if (!mark || !entryU) {
        keep.push(p);
        continue;
      }
      const t0Ms = Date.parse(p.signalT0Utc);
      const nowMs = Date.now();
      const asset1m = await candles1m(p.hlSymbol, nowMs - 2 * 3600_000, nowMs);
      const dirRaw = ((mark - p.baselinePx) / p.baselinePx) * 100;
      let realizedExcess = dirRaw;
      if (entryU.benchmark && p.benchmarkBaselinePx && p.beta !== null) {
        const benchMark = marketState.ctxs.get(`${p.hlSymbol.split(":")[0]}:${entryU.benchmark}`)?.markPx;
        if (benchMark) realizedExcess = dirRaw - p.beta * (((benchMark - p.benchmarkBaselinePx) / p.benchmarkBaselinePx) * 100);
      }
      void asset1m;
      void t0Ms;

      const review = reviewPosition({ position: p, markPx: mark, realizedExcessSinceT0Pct: realizedExcess, nowUtc: new Date().toISOString() });
      if (review.action === "close") {
        const dirSign = p.direction === "long" ? 1 : -1;
        const pnl = dirSign * (mark - p.entryPx) * p.qty;
        portfolio.realizedPnlUsd += pnl;
        if (review.track === "technical" || review.track === "hard_floor") {
          portfolio.lastStopOutUtc[`${p.ticker}:${p.direction}`] = new Date().toISOString();
        }
        appendLedger({ type: "paper_close", ticker: p.ticker, direction: p.direction, exitPx: mark, pnlUsd: pnl, track: review.track, reason: review.reason });
      } else if (review.action === "extend") {
        keep.push({ ...p, horizonUtc: review.horizonUtc, extendedOnce: true });
        appendLedger({ type: "decision", note: "horizon_extended", ticker: p.ticker, newHorizonUtc: review.horizonUtc, reason: review.reason });
      } else {
        keep.push(p);
      }
    }
    portfolio.positions = keep;
    savePortfolio(portfolio);
  });
}
