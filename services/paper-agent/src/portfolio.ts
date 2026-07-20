// The paper book: cash + open positions + resting exit limit orders.
// Persisted atomically to portfolio.json; every mutation returns a new object
// (no in-place state) and the caller persists + ledgers it.
//
// Accounting invariants (adversarial review 2026-07-03):
// - Entry fees are part of the cost basis (entryFeePerShare survives partial
//   sells), so realizedPnl reconciles with cash: cash − bankroll = realized
//   for a fully-closed book.
// - Voided markets refund at $0.50/share.

import { loadPaperConfig } from "./config";
import { DEFAULT_FEES, type MarketFeeParams } from "./fees";
import { portfolioPath, readJson, writeJsonAtomic } from "./store";

export interface RestingLimit {
  id: string;
  positionId: string;
  shares: number;
  limitPrice: number;
  placedAtUtc: string;
  expiresAtUtc: string;
  reason: string;
}

export interface PaperPosition {
  id: string; // slug:outcomeIndex
  slug: string;
  eventSlug: string; // Gamma parent event — for single-event exposure caps
  conditionId: string;
  question: string;
  outcomeIndex: number;
  outcomeLabel: string;
  tokenId: string;
  shares: number;
  avgEntryPrice: number;
  entryFeePerShare: number;
  openedAtUtc: string;
  // Live fee/tick params captured at entry, refreshed best-effort at exits.
  fees: MarketFeeParams;
  lastEval?: {
    ts: string;
    agentProb: number;
    mark: number | null;
    netEdgePp: number | null;
    decision: string;
    forecastId: string;
    // Engine caveats (review 2026-07-06): agentProb sits at the engine's
    // 0.01/0.99 bound / the run used prediction-market prices despite the ban.
    saturatedAt?: "floor" | "ceil" | null;
    contaminated?: boolean;
    // A negative_edge exit was vetoed because the clamp bound the held side —
    // the position is riding to resolution (policy.applySaturatedHold).
    saturatedHold?: boolean;
  };
}

export interface Portfolio {
  createdAtUtc: string;
  bankrollUsd: number;
  cashUsd: number;
  positions: PaperPosition[];
  restingLimits: RestingLimit[];
  realizedPnlUsd: number;
  totalFeesUsd: number;
}

export function loadPortfolio(): Portfolio {
  const existing = readJson<Portfolio>(portfolioPath());
  if (existing) {
    return {
      ...existing,
      // Back-compat for books created before fee params lived on positions.
      positions: existing.positions.map((p) => ({
        ...p,
        fees: p.fees ?? DEFAULT_FEES,
        entryFeePerShare: p.entryFeePerShare ?? 0,
        eventSlug: p.eventSlug ?? p.slug
      }))
    };
  }
  const bankroll = loadPaperConfig().bankrollUsd;
  return {
    createdAtUtc: new Date().toISOString(),
    bankrollUsd: bankroll,
    cashUsd: bankroll,
    positions: [],
    restingLimits: [],
    realizedPnlUsd: 0,
    totalFeesUsd: 0
  };
}

export function savePortfolio(p: Portfolio): void {
  writeJsonAtomic(portfolioPath(), p);
}

export function positionId(slug: string, outcomeIndex: number): string {
  return `${slug}:${outcomeIndex}`;
}

export function findPosition(p: Portfolio, id: string): PaperPosition | null {
  return p.positions.find((pos) => pos.id === id) ?? null;
}

// Apply a (partial) sell fill: cash in proceeds minus fee, realize PnL on the
// sold slice (entry fee included in the basis), shrink or drop the position.
export function applySell(p: Portfolio, id: string, shares: number, avgPrice: number, feeUsd: number): Portfolio {
  const pos = findPosition(p, id);
  if (!pos || shares <= 0) return p;
  const sold = Math.min(shares, pos.shares);
  const proceeds = sold * avgPrice - feeUsd;
  const costBasis = sold * (pos.avgEntryPrice + pos.entryFeePerShare);
  const remaining = pos.shares - sold;
  return {
    ...p,
    cashUsd: p.cashUsd + proceeds,
    realizedPnlUsd: p.realizedPnlUsd + (proceeds - costBasis),
    totalFeesUsd: p.totalFeesUsd + feeUsd,
    positions:
      remaining > 0.0001
        ? p.positions.map((x) => (x.id === id ? { ...x, shares: remaining } : x))
        : p.positions.filter((x) => x.id !== id),
    restingLimits: remaining > 0.0001 ? p.restingLimits : p.restingLimits.filter((l) => l.positionId !== id)
  };
}

export function applyBuy(p: Portfolio, position: PaperPosition, notionalUsd: number, feeUsd: number): Portfolio {
  return {
    ...p,
    cashUsd: p.cashUsd - notionalUsd - feeUsd,
    totalFeesUsd: p.totalFeesUsd + feeUsd,
    positions: [...p.positions, position]
  };
}

export type SettlementKind = "won" | "lost" | "voided";

// Settlement: winners redeem at $1, losers at $0, voided markets at $0.50.
export function applySettlement(p: Portfolio, id: string, kind: SettlementKind): Portfolio {
  const pos = findPosition(p, id);
  if (!pos) return p;
  const perShare = kind === "won" ? 1 : kind === "voided" ? 0.5 : 0;
  const proceeds = pos.shares * perShare;
  const costBasis = pos.shares * (pos.avgEntryPrice + pos.entryFeePerShare);
  return {
    ...p,
    cashUsd: p.cashUsd + proceeds,
    realizedPnlUsd: p.realizedPnlUsd + (proceeds - costBasis),
    positions: p.positions.filter((x) => x.id !== id),
    restingLimits: p.restingLimits.filter((l) => l.positionId !== id)
  };
}
