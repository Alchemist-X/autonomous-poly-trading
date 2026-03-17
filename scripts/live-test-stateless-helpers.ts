import type { OverviewResponse, PublicPosition } from "@autopoly/contracts";

export const STATELESS_MAX_BUY_TOKENS = 1;
export const STATELESS_MIN_TRADE_USD = 0.01;

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

export function capBuyNotionalToTokenLimit(input: {
  requestedNotionalUsd: number;
  bestAsk: number | null;
  marketProb?: number;
  maxTokens: number;
}) {
  const referencePrice = input.bestAsk && input.bestAsk > 0
    ? input.bestAsk
    : input.marketProb && input.marketProb > 0
      ? input.marketProb
      : 0;
  if (!(referencePrice > 0) || !(input.maxTokens > 0)) {
    return input.requestedNotionalUsd;
  }
  return Math.min(input.requestedNotionalUsd, referencePrice * input.maxTokens);
}

export function buildStatelessOverview(input: {
  collateralBalanceUsd: number;
  positions: PublicPosition[];
  bankrollCapUsd: number;
}): OverviewResponse {
  const openExposureUsd = input.positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  const actualTotalEquityUsd = roundCurrency(input.collateralBalanceUsd + openExposureUsd);
  const effectiveBankrollUsd = roundCurrency(
    Math.min(
      input.bankrollCapUsd,
      actualTotalEquityUsd > 0 ? actualTotalEquityUsd : input.bankrollCapUsd
    )
  );

  return {
    status: "running",
    cash_balance_usd: roundCurrency(input.collateralBalanceUsd),
    total_equity_usd: effectiveBankrollUsd,
    high_water_mark_usd: effectiveBankrollUsd,
    drawdown_pct: 0,
    open_positions: input.positions.length,
    last_run_at: null,
    latest_risk_event: null,
    equity_curve: [
      {
        timestamp: new Date().toISOString(),
        total_equity_usd: effectiveBankrollUsd,
        drawdown_pct: 0
      }
    ]
  };
}

export function calculatePositionValueUsd(size: number, currentPrice: number) {
  return roundCurrency(size * currentPrice);
}

export function calculatePositionPnlPct(avgCost: number, currentPrice: number) {
  if (!(avgCost > 0)) {
    return 0;
  }
  return roundMetric((currentPrice - avgCost) / avgCost);
}
