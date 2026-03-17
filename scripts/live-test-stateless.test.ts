import { describe, expect, it } from "vitest";
import {
  STATELESS_MIN_TRADE_USD,
  buildStatelessOverview,
  calculatePositionPnlPct,
  calculatePositionValueUsd,
  capBuyNotionalToTokenLimit
} from "./live-test-stateless-helpers.ts";

describe("stateless live test helpers", () => {
  it("caps buy notional to a single token using best ask", () => {
    expect(capBuyNotionalToTokenLimit({
      requestedNotionalUsd: 20,
      bestAsk: 0.43,
      maxTokens: 1
    })).toBeCloseTo(0.43);
  });

  it("falls back to market probability when the order book is unavailable", () => {
    expect(capBuyNotionalToTokenLimit({
      requestedNotionalUsd: 20,
      bestAsk: null,
      marketProb: 0.61,
      maxTokens: 1
    })).toBeCloseTo(0.61);
  });

  it("builds a capped overview from collateral and open exposure", () => {
    const overview = buildStatelessOverview({
      collateralBalanceUsd: 18,
      bankrollCapUsd: 20,
      positions: [
        {
          id: "position-1",
          event_slug: "demo-event",
          market_slug: "demo-market",
          token_id: "token-1",
          side: "BUY",
          outcome_label: "Yes",
          size: 1,
          avg_cost: 0.4,
          current_price: 0.6,
          current_value_usd: 0.6,
          unrealized_pnl_pct: 0.5,
          stop_loss_pct: 0.3,
          opened_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z"
        }
      ]
    });

    expect(overview.cash_balance_usd).toBe(18);
    expect(overview.total_equity_usd).toBe(18.6);
    expect(overview.open_positions).toBe(1);
  });

  it("keeps the stateless minimum trade low enough for one-token orders", () => {
    expect(STATELESS_MIN_TRADE_USD).toBeLessThan(1);
  });

  it("computes position value and pnl from market price", () => {
    expect(calculatePositionValueUsd(2, 0.37)).toBeCloseTo(0.74);
    expect(calculatePositionPnlPct(0.4, 0.5)).toBeCloseTo(0.25);
  });
});
