// The paper book: cash + open positions + resting exit limit orders.
// Persisted atomically to portfolio.json; every mutation returns a new object
// (no in-place state) and the caller persists + ledgers it.

import { loadPaperConfig } from "./config";
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
  conditionId: string;
  question: string;
  category: string;
  negRisk: boolean;
  outcomeIndex: number;
  outcomeLabel: string;
  tokenId: string;
  shares: number;
  avgEntryPrice: number;
  entryFeeUsd: number;
  openedAtUtc: string;
  // Last evaluation snapshot (for the ledger/UI; decisions always re-derive).
  lastEval?: {
    ts: string;
    agentProb: number; // P(this outcome)
    mark: number | null;
    netEdgePp: number | null;
    decision: string;
    forecastId: string;
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
  if (existing) return existing;
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
// sold slice, shrink or drop the position.
export function applySell(
  p: Portfolio,
  id: string,
  shares: number,
  avgPrice: number,
  feeUsd: number
): Portfolio {
  const pos = findPosition(p, id);
  if (!pos || shares <= 0) return p;
  const sold = Math.min(shares, pos.shares);
  const proceeds = sold * avgPrice - feeUsd;
  const costBasis = sold * pos.avgEntryPrice;
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

// Settlement at resolution: winners redeem at $1 (no fee), losers at $0.
export function applyResolution(p: Portfolio, id: string, won: boolean): Portfolio {
  const pos = findPosition(p, id);
  if (!pos) return p;
  const proceeds = won ? pos.shares : 0;
  const costBasis = pos.shares * pos.avgEntryPrice;
  return {
    ...p,
    cashUsd: p.cashUsd + proceeds,
    realizedPnlUsd: p.realizedPnlUsd + (proceeds - costBasis),
    positions: p.positions.filter((x) => x.id !== id),
    restingLimits: p.restingLimits.filter((l) => l.positionId !== id)
  };
}
