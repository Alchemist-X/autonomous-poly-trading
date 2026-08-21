// M3 — PM decision policy. Pure functions only (no I/O): run-cycle feeds
// snapshots in, PMDecisions come out, so every decision is replayable from
// the ledger. PRD §7, §9.
//
// USER-DECIDED anchors (2026-08-22): hard stop at −20% adverse move per
// position; portfolio halt at −25% total loss from initial capital. Both are
// enforced here and (the stop) mirrored venue-side in later phases.

import type { PMDecision, Portfolio, Position, TradeThesis, UniverseEntry } from "@autopoly/delta-pm-contracts";
import { config } from "./config.js";

export interface MarketView {
  markPx: number;
  atr20d: number | null; // absolute price units
  dailyVolPct: number; // e.g. 0.02
  maxDailyMovePct: number; // e.g. 0.08
  swingLowPx: number | null; // most recent RTH swing low below mark (longs)
  swingHighPx: number | null; // mirror for shorts
  fundingHourly: number | null; // signed, longs pay positive
  realizedExcessSinceT0Pct: number; // signed, +
  baselinePx: number; // px at t0
  benchmarkBaselinePx: number | null;
  beta: number | null;
}

export interface EntryContext {
  thesis: TradeThesis;
  entry: UniverseEntry;
  view: MarketView;
  portfolio: Portfolio;
  equityUsd: number;
  dayPnlPct: number; // today's realized+unrealized vs equity at day start
  clusterGrossUsd: Map<string, number>; // tag → gross notional
  marksByTicker: Map<string, number>;
  nowUtc: string;
}

function decisionBase(ctx: EntryContext, action: PMDecision["action"], reason: string): PMDecision {
  return {
    id: `pmd-${ctx.thesis.id}-${Date.now().toString(36)}`,
    thesisId: ctx.thesis.id,
    ticker: ctx.thesis.ticker,
    action,
    direction: null,
    refPx: ctx.view.markPx,
    sizeUsd: 0,
    leverage: null,
    stop: null,
    targetPctExcess: null,
    horizonUtc: null,
    intendedRiskPct: null,
    realizedRiskPct: null,
    bindingConstraint: null,
    residualEdgePct: null,
    reason,
    createdAtUtc: ctx.nowUtc
  };
}

export function grossNotional(portfolio: Portfolio, marks: Map<string, number>): number {
  return portfolio.positions.reduce((s, p) => s + p.qty * (marks.get(p.ticker) ?? p.entryPx), 0);
}

export function netNotional(portfolio: Portfolio, marks: Map<string, number>): number {
  return portfolio.positions.reduce((s, p) => {
    const n = p.qty * (marks.get(p.ticker) ?? p.entryPx);
    return s + (p.direction === "long" ? n : -n);
  }, 0);
}

export function equityOf(portfolio: Portfolio, marks: Map<string, number>): number {
  let unrealized = 0;
  for (const p of portfolio.positions) {
    const mark = marks.get(p.ticker) ?? p.entryPx;
    const sign = p.direction === "long" ? 1 : -1;
    unrealized += sign * (mark - p.entryPx) * p.qty;
  }
  return portfolio.initialCapitalUsd + portfolio.realizedPnlUsd + unrealized;
}

// --- entry -----------------------------------------------------------------

export function decideEntry(ctx: EntryContext): PMDecision {
  const { thesis, entry, view, portfolio, equityUsd } = ctx;
  const dirSign = thesis.direction === "long" ? 1 : -1;

  // Ordered vetoes — cheapest and most absolute first.
  if (portfolio.halted) return decisionBase(ctx, "no_trade", `portfolio halted: ${portfolio.haltedReason ?? "unknown"}`);
  if (thesis.contamination === "hard") return decisionBase(ctx, "no_trade", "thesis hard-contaminated by price reaction — analyst must re-run blind");
  if (ctx.dayPnlPct <= -config.dailyLossStopPct) return decisionBase(ctx, "no_trade", `daily loss stop: day PnL ${(ctx.dayPnlPct * 100).toFixed(1)}% ≤ −${config.dailyLossStopPct * 100}%`);

  const existing = portfolio.positions.find((p) => p.ticker === thesis.ticker);
  if (existing) {
    if (existing.direction !== thesis.direction) {
      return decisionBase(ctx, "no_trade", "conflicting direction vs open position — one net position per ticker; flip requires explicit review, not auto-entry");
    }
    return decisionBase(ctx, "no_trade", "position already open in this direction (adds not enabled in V1)");
  }

  const lastStop = portfolio.lastStopOutUtc[`${thesis.ticker}:${thesis.direction}`];
  if (lastStop && Date.parse(ctx.nowUtc) - Date.parse(lastStop) < config.cooldownHours * 3600_000) {
    return decisionBase(ctx, "no_trade", `cooldown: stopped out same ticker+direction ${lastStop}, ${config.cooldownHours}h lockout`);
  }

  // Earnings-calendar guard: never hold a fresh event trade into the name's
  // own scheduled earnings (unless the thesis IS that event — V1 has no flag,
  // so the guard is absolute; ops maintains nextEarningsUtc).
  const horizonUtc = new Date(Date.parse(ctx.nowUtc) + thesis.horizonHours * 3600_000).toISOString();
  if (entry.nextEarningsUtc && entry.nextEarningsUtc > ctx.nowUtc && entry.nextEarningsUtc < horizonUtc) {
    return decisionBase(ctx, "no_trade", `scheduled earnings ${entry.nextEarningsUtc} inside horizon — event-gap risk exceeds the risk budget`);
  }

  // Residual edge on the CONSERVATIVE end of the fair-impact interval.
  const conservativePct = thesis.direction === "long" ? thesis.fairImpactPct.min : thesis.fairImpactPct.max;
  const realizedPct = view.realizedExcessSinceT0Pct;
  const residualPct = conservativePct - realizedPct; // signed, same frame
  const residualSigned = residualPct * dirSign; // >0 = edge remains in our direction

  // Adverse-drift guard: market moving against the thesis inflates the naive
  // residual — that is disagreement, not opportunity.
  if (realizedPct * dirSign < -config.adverseDriftVolFraction * view.dailyVolPct * 100) {
    return decisionBase(ctx, "no_trade", `adverse drift: market moved ${realizedPct.toFixed(2)}% against the thesis since t0 — reclassify, don't chase`);
  }

  const holdDays = thesis.horizonHours / 24;
  // Signed funding: longs pay when hourly funding > 0, shorts receive.
  // A credit is NOT allowed to lower the entry bar below the fee floor.
  const hourlyFunding = view.fundingHourly ?? 0.00000625;
  const fundingCostPct = Math.max(0, hourlyFunding * dirSign * thesis.horizonHours * 100);
  const slippagePct = config.slippageBudgetPctByTier[entry.liquidityTier] * 100;
  const roundTripPct = 2 * config.takerFeeRate * 100 + 2 * slippagePct + fundingCostPct;
  const threshold = Math.max(config.entryCostMultiple * roundTripPct, config.entryVolFraction * view.dailyVolPct * 100 * Math.min(1, holdDays));

  if (residualSigned < threshold) {
    return decisionBase(
      ctx,
      "no_trade",
      `residual edge ${residualSigned.toFixed(2)}% below threshold ${threshold.toFixed(2)}% (conservative ${conservativePct}%, realized ${realizedPct.toFixed(2)}%)`
    );
  }

  // --- stop menu (deterministic, replayable) ---
  const mark = view.markPx;
  const atr = view.atr20d ?? mark * view.dailyVolPct * 1.2;
  let stopPx =
    thesis.direction === "long"
      ? Math.max(mark - 1.5 * atr, view.swingLowPx ?? 0)
      : Math.min(mark + 1.5 * atr, view.swingHighPx ?? Infinity);
  const hardFloorPx = mark * (1 - dirSign * config.hardStopAdversePct);
  // Stop can never be looser than the user's −20% hard floor.
  stopPx = thesis.direction === "long" ? Math.max(stopPx, hardFloorPx) : Math.min(stopPx, hardFloorPx);
  const stopDistPct = Math.abs(mark - stopPx) / mark;
  if (stopDistPct < 0.003) return decisionBase(ctx, "no_trade", "stop distance under 0.3% — structure too tight to size sanely");

  // --- sizing: fixed risk, then guard clipping (downward only) ---
  const riskBudget = thesis.confidence === "high" ? config.riskBudgetHighConfPct : config.riskBudgetPct;
  const intendedNotional = (equityUsd * riskBudget) / stopDistPct;
  let notional = intendedNotional;
  let binding: string | null = null;
  const clip = (cap: number, label: string) => {
    if (notional > cap) {
      notional = cap;
      binding = label;
    }
  };

  clip(equityUsd * config.tierCapPct[entry.liquidityTier], `tier${entry.liquidityTier}_cap`);
  const gross = grossNotional(portfolio, ctx.marksByTicker);
  clip(Math.max(0, equityUsd * config.grossCapPct - gross), "gross_cap");
  const net = netNotional(portfolio, ctx.marksByTicker);
  const netHeadroom = thesis.direction === "long" ? equityUsd * config.netCapPct - net : equityUsd * config.netCapPct + net;
  clip(Math.max(0, netHeadroom), "net_cap");
  for (const tag of entry.tags) {
    const clusterGross = ctx.clusterGrossUsd.get(tag) ?? 0;
    clip(Math.max(0, equityUsd * config.clusterCapPct - clusterGross), `cluster_cap:${tag}`);
  }

  const leverage = Math.min(config.maxLeverage, 1 / (2 * view.maxDailyMovePct), entry.maxLeverageOnVenue);
  if (entry.marginMode === "isolated") {
    const isolatedMarginUsed = portfolio.positions
      .filter((p) => p.leverage > 0)
      .reduce((s, p) => s + (p.qty * (ctx.marksByTicker.get(p.ticker) ?? p.entryPx)) / p.leverage, 0);
    const marginHeadroom = Math.max(0, equityUsd * config.isolatedMarginCapPct - isolatedMarginUsed);
    clip(marginHeadroom * leverage, "isolated_margin_cap");
  }

  if (notional < config.minTradeUsd) {
    return decisionBase(ctx, "no_trade", `clipped notional $${notional.toFixed(0)} below min trade $${config.minTradeUsd} (binding: ${binding ?? "risk_budget"})`);
  }

  const realizedRiskPct = (notional * stopDistPct) / equityUsd;
  return {
    ...decisionBase(ctx, "open", ""),
    action: "open",
    direction: thesis.direction,
    sizeUsd: Math.floor(notional),
    leverage,
    stop: {
      initialPx: round(stopPx),
      hardFloorPx: round(hardFloorPx),
      rule: "max(entry ∓ 1.5×ATR20d, recent RTH swing) bounded by −20% user hard floor; trail chandelier(2.5×ATR) arms at 50% of target",
      atr20d: round(atr),
      trailArmed: false
    },
    targetPctExcess: {
      lo: conservativePct,
      hi: thesis.fairImpactPct.point
    },
    horizonUtc,
    intendedRiskPct: riskBudget,
    realizedRiskPct,
    bindingConstraint: binding,
    residualEdgePct: residualSigned,
    reason:
      `open ${thesis.direction} ${thesis.ticker}: residual ${residualSigned.toFixed(2)}% ≥ threshold ${threshold.toFixed(2)}%; ` +
      `risk ${(realizedRiskPct * 100).toFixed(2)}% (intended ${(riskBudget * 100).toFixed(1)}%${binding ? `, clipped by ${binding}` : ""})`
  };
}

function round(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

// --- review (valuation / time tracks; technical handled by fast tick) ------

export interface ReviewContext {
  position: Position;
  markPx: number;
  realizedExcessSinceT0Pct: number; // via M0, position's stored β/baseline
  nowUtc: string;
}

export type ReviewAction =
  | { action: "hold"; reason: string }
  | { action: "close"; track: "valuation" | "time" | "technical" | "hard_floor"; reason: string }
  | { action: "extend"; horizonUtc: string; reason: string };

export function reviewPosition(ctx: ReviewContext): ReviewAction {
  const { position: p, markPx, nowUtc } = ctx;
  const dirSign = p.direction === "long" ? 1 : -1;
  const realized = ctx.realizedExcessSinceT0Pct * dirSign; // + = with us

  // Hard floor (user rule) — checked here too, though the fast tick owns it.
  const adverse = (dirSign * (p.entryPx - markPx)) / p.entryPx;
  if (adverse >= config.hardStopAdversePct) {
    return { action: "close", track: "hard_floor", reason: `adverse move ${(adverse * 100).toFixed(1)}% ≥ ${config.hardStopAdversePct * 100}% user hard stop` };
  }
  if (dirSign > 0 ? markPx <= p.stopPx : markPx >= p.stopPx) {
    return { action: "close", track: "technical", reason: `mark ${markPx} through stop ${p.stopPx}` };
  }

  const target = p.targetPctExcess;
  if (target) {
    const lo = Math.abs(target.lo);
    const point = Math.abs(target.hi);
    if (realized >= lo) {
      return { action: "close", track: "valuation", reason: `realized excess ${realized.toFixed(2)}% reached conservative target ${lo.toFixed(2)}% — take it, don't chase the top` };
    }
    const residual = point - realized;
    if (residual <= 0) {
      return { action: "close", track: "valuation", reason: `residual edge ${residual.toFixed(2)}% ≤ 0 — negative net edge → sell (house rule)` };
    }
  }

  if (nowUtc >= p.horizonUtc) {
    const residual = target ? Math.abs(target.hi) - realized : 0;
    if (residual <= 0 || p.extendedOnce) {
      return { action: "close", track: "time", reason: p.extendedOnce ? "horizon expired after one extension" : "horizon expired with no residual edge" };
    }
    return {
      action: "extend",
      horizonUtc: new Date(Date.parse(p.horizonUtc) + (Date.parse(p.horizonUtc) - Date.parse(p.entryUtc))).toISOString(),
      reason: `horizon expired but residual ${residual.toFixed(2)}% remains — one extension granted`
    };
  }

  return { action: "hold", reason: `holding: realized ${realized.toFixed(2)}% vs target ${target ? Math.abs(target.lo).toFixed(2) : "?"}%` };
}

// Trailing-stop update (chandelier), long side raises only / short side lowers only.
export function updateTrailingStop(p: Position, markPx: number, atr20d: number, realizedExcessPct: number): Position {
  const dirSign = p.direction === "long" ? 1 : -1;
  const target = p.targetPctExcess ? Math.abs(p.targetPctExcess.hi) : null;
  let next = { ...p };
  if (!p.trailArmed && target && realizedExcessPct * dirSign >= 0.5 * target) next.trailArmed = true;
  if (p.direction === "long") {
    const highest = Math.max(p.highestClosePx ?? p.entryPx, markPx);
    next.highestClosePx = highest;
    if (next.trailArmed) next.stopPx = Math.max(p.stopPx, round(highest - 2.5 * atr20d));
  } else {
    const lowest = Math.min(p.highestClosePx ?? p.entryPx, markPx);
    next.highestClosePx = lowest;
    if (next.trailArmed) next.stopPx = Math.min(p.stopPx, round(lowest + 2.5 * atr20d));
  }
  return next;
}

// --- portfolio halt (user rule: −25% total loss from initial capital) ------

export function checkHalt(portfolio: Portfolio, marks: Map<string, number>): { halted: boolean; reason: string | null } {
  const equity = equityOf(portfolio, marks);
  if (equity <= portfolio.initialCapitalUsd * (1 - config.portfolioHaltLossPct)) {
    return {
      halted: true,
      reason: `equity $${equity.toFixed(0)} ≤ ${(1 - config.portfolioHaltLossPct) * 100}% of initial $${portfolio.initialCapitalUsd} — user −${config.portfolioHaltLossPct * 100}% portfolio halt; new risk frozen, exits stay live; user unlock required`
    };
  }
  return { halted: false, reason: null };
}
