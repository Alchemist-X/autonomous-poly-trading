// Paper-trading simulation logic (fill prices, position math). This is
// executable business logic, not a wire contract — kept in the contracts
// package for now because paper + live share the decision shape. Split out of
// index.ts (Stage 2, 2026-07-03); re-exported verbatim from index.ts.
import type { PublicPosition } from "./public-api.js";
import type { TradeDecision } from "./trade-decision.js";

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundPositionMetric(value: number): number {
  return Number(value.toFixed(6));
}

function calculatePaperPositionPnlPct(avgCost: number, currentPrice: number): number {
  if (avgCost <= 0) {
    return 0;
  }
  return roundPositionMetric((currentPrice - avgCost) / avgCost);
}

export function inferPaperSellAmount(
  position: PublicPosition | null | undefined,
  decision: Pick<TradeDecision, "action" | "notional_usd">
): number {
  if (!position) {
    return 0;
  }

  if (decision.action === "close") {
    return position.size;
  }

  if (decision.action === "reduce" && position.current_value_usd > 0) {
    return Math.min(position.size, position.size * (decision.notional_usd / position.current_value_usd));
  }

  return 0;
}

export interface PaperTradeResult {
  status: "filled" | "rejected";
  avgPrice: number;
  filledNotionalUsd: number;
  nextPosition: PublicPosition | null;
  rejectionReason?: string;
}

export function getPaperFillPrice(side: "BUY" | "SELL"): number {
  return side === "BUY" ? 0.52 : 0.48;
}

export function buildPaperOrderResult(input: { side: "BUY" | "SELL"; amount: number }) {
  const avgPrice = getPaperFillPrice(input.side);
  return {
    ok: true,
    avgPrice,
    filledNotionalUsd:
      input.side === "BUY"
        ? roundCurrency(input.amount)
        : roundCurrency(input.amount * avgPrice),
    rawResponse: {
      mock: true,
      paper: true
    }
  };
}

export function applyPaperTradeDecision(input: {
  position: PublicPosition | null | undefined;
  decision: TradeDecision;
  avgPrice: number;
  timestampUtc: string;
}): PaperTradeResult {
  const currentPosition = input.position ?? null;
  const executionAmount =
    input.decision.side === "BUY"
      ? input.decision.notional_usd
      : inferPaperSellAmount(currentPosition, input.decision);

  if (!(executionAmount > 0) || !(input.avgPrice > 0)) {
    return {
      status: "rejected",
      avgPrice: input.avgPrice,
      filledNotionalUsd: 0,
      nextPosition: currentPosition,
      rejectionReason: currentPosition ? "decision has no executable size" : "no open position is available"
    };
  }

  const previousSize = currentPosition?.size ?? 0;
  const sizeDelta = input.decision.side === "BUY" ? executionAmount / input.avgPrice : -executionAmount;
  const nextSize = Math.max(0, previousSize + sizeDelta);
  const nextAvgCost =
    input.decision.side === "BUY"
      ? currentPosition
        ? (previousSize * currentPosition.avg_cost + executionAmount) / Math.max(nextSize, Number.EPSILON)
        : input.avgPrice
      : currentPosition?.avg_cost ?? input.avgPrice;
  const currentPrice = roundPositionMetric(input.avgPrice);
  const currentValueUsd = roundCurrency(nextSize * currentPrice);

  return {
    status: "filled",
    avgPrice: currentPrice,
    filledNotionalUsd:
      input.decision.side === "BUY"
        ? roundCurrency(executionAmount)
        : roundCurrency(executionAmount * currentPrice),
    nextPosition: nextSize <= 0
      ? null
      : {
          id: currentPosition?.id ?? input.decision.token_id,
          event_slug: currentPosition?.event_slug ?? input.decision.event_slug,
          market_slug: currentPosition?.market_slug ?? input.decision.market_slug,
          token_id: input.decision.token_id,
          side: currentPosition?.side ?? input.decision.side,
          outcome_label: currentPosition?.outcome_label ?? (input.decision.side === "BUY" ? "Yes" : "No"),
          size: roundPositionMetric(nextSize),
          avg_cost: roundPositionMetric(nextAvgCost),
          current_price: currentPrice,
          current_value_usd: currentValueUsd,
          unrealized_pnl_pct: calculatePaperPositionPnlPct(nextAvgCost, currentPrice),
          stop_loss_pct: input.decision.stop_loss_pct,
          opened_at: currentPosition?.opened_at ?? input.timestampUtc,
          updated_at: input.timestampUtc
        }
  };
}
