import type { ClosedTrade, EquityPoint, OpenPosition, PaperSnapshot } from "./snapshot";

export interface TradeStats {
  closedCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  avgWinUsd: number;
  avgLossUsd: number;
  /** Gross profits / gross losses on closed round trips. */
  profitFactor: number;
  realizedPnlUsd: number;
}

export interface EquityStats {
  currentUsd: number;
  returnPct: number;
  peakUsd: number;
  peakDate: string;
  /** Max peak-to-trough decline over the curve, as a negative percentage. */
  maxDrawdownPct: number;
}

export interface OpenBookStats {
  positionCount: number;
  costUsd: number;
  unrealizedUsd: number;
  green: number;
  flat: number;
  red: number;
  cashSharePct: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function deriveTradeStats(trades: readonly ClosedTrade[]): TradeStats {
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd < 0);
  const grossWin = wins.reduce((sum, t) => sum + t.pnlUsd, 0);
  const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnlUsd), 0);
  return {
    closedCount: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: trades.length === 0 ? 0 : round2((wins.length / trades.length) * 100),
    avgWinUsd: wins.length === 0 ? 0 : round2(grossWin / wins.length),
    avgLossUsd: losses.length === 0 ? 0 : round2(grossLoss / losses.length),
    profitFactor: grossLoss === 0 ? Infinity : round2(grossWin / grossLoss),
    realizedPnlUsd: round2(grossWin - grossLoss)
  };
}

export function deriveEquityStats(curve: readonly EquityPoint[], bankrollUsd: number): EquityStats {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) {
    throw new Error("deriveEquityStats requires a non-empty equity curve");
  }
  const peak = curve.reduce((best, p) => (p.equityUsd > best.equityUsd ? p : best), first);
  const maxDrawdownPct = curve.reduce(
    (state, p) => {
      const runningPeak = Math.max(state.runningPeak, p.equityUsd);
      const drawdown = ((p.equityUsd - runningPeak) / runningPeak) * 100;
      return { runningPeak, worst: Math.min(state.worst, drawdown) };
    },
    { runningPeak: -Infinity, worst: 0 }
  ).worst;
  return {
    currentUsd: last.equityUsd,
    returnPct: round2(((last.equityUsd - bankrollUsd) / bankrollUsd) * 100),
    peakUsd: peak.equityUsd,
    peakDate: peak.date,
    maxDrawdownPct: round2(maxDrawdownPct)
  };
}

export function deriveOpenBookStats(
  positions: readonly OpenPosition[],
  cashUsd: number
): OpenBookStats {
  const costUsd = positions.reduce((sum, p) => sum + p.shares * p.entryPrice, 0);
  const unrealizedUsd = positions.reduce((sum, p) => sum + p.unrealizedUsd, 0);
  const bookValueUsd = cashUsd + costUsd + unrealizedUsd;
  return {
    positionCount: positions.length,
    costUsd: round2(costUsd),
    unrealizedUsd: round2(unrealizedUsd),
    green: positions.filter((p) => p.unrealizedUsd > 0).length,
    flat: positions.filter((p) => p.unrealizedUsd === 0).length,
    red: positions.filter((p) => p.unrealizedUsd < 0).length,
    cashSharePct: round2((cashUsd / bookValueUsd) * 100)
  };
}

export interface ReportStats {
  trade: TradeStats;
  equity: EquityStats;
  openBook: OpenBookStats;
}

export function deriveReportStats(snapshot: PaperSnapshot): ReportStats {
  return {
    trade: deriveTradeStats(snapshot.closedTrades),
    equity: deriveEquityStats(snapshot.equityCurve, snapshot.bankrollUsd),
    openBook: deriveOpenBookStats(snapshot.openPositions, snapshot.cashUsd)
  };
}
