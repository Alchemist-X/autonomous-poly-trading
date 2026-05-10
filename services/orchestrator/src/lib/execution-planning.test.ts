import { describe, expect, it, vi } from "vitest";
import type { OverviewResponse, PublicPosition, TradeDecision } from "@autopoly/contracts";
import { buildExecutionPlan } from "./execution-planning.js";

function createOverview(): OverviewResponse {
  return {
    status: "running",
    cash_balance_usd: 1000,
    total_equity_usd: 1000,
    high_water_mark_usd: 1000,
    drawdown_pct: 0,
    open_positions: 0,
    last_run_at: null,
    latest_risk_event: null,
    equity_curve: []
  };
}

function createOpenDecision(notionalUsd: number): TradeDecision {
  return {
    action: "open",
    event_slug: "demo-event",
    market_slug: "demo-market",
    token_id: "token-open",
    outcome_label: "No",
    side: "BUY",
    notional_usd: notionalUsd,
    order_type: "FOK",
    ai_prob: 0.63,
    market_prob: 0.56,
    edge: 0.07,
    confidence: "medium",
    thesis_md: "Open because edge is positive.",
    sources: [
      {
        title: "Pulse",
        url: "https://example.com/open",
        retrieved_at_utc: "2026-03-17T00:00:00.000Z"
      }
    ],
    liquidity_cap_usd: 120,
    stop_loss_pct: 0.3,
    resolution_track_required: true
  };
}

function createReducePosition(): PublicPosition {
  return {
    id: "position-1",
    event_slug: "demo-event",
    market_slug: "demo-market",
    token_id: "token-held",
    side: "BUY",
    outcome_label: "No",
    size: 4,
    avg_cost: 0.4,
    current_price: 0.44,
    current_value_usd: 1.76,
    unrealized_pnl_pct: 0.1,
    stop_loss_pct: 0.3,
    opened_at: "2026-03-17T00:00:00.000Z",
    updated_at: "2026-03-17T00:00:00.000Z"
  };
}

describe("execution planning", () => {
  it("applies the same open sizing caps used by pulse-live", async () => {
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(200)],
      positions: [],
      overview: createOverview(),
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 0.05,
        maxTotalExposurePct: 0.5,
        maxEventExposurePct: 0.3,
        maxPositions: 10
      },
      minTradeUsd: 10,
      readBook: async () => ({
        bestAsk: 0.43,
        bestBid: 0.42,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.notionalUsd).toBe(50);
    expect(result.skipped).toHaveLength(0);
  });

  it("blocks opens that fail the exchange minimum with the same reason string", async () => {
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(3)],
      positions: [],
      overview: createOverview(),
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 1,
        maxTotalExposurePct: 1,
        maxEventExposurePct: 1,
        maxPositions: 10
      },
      minTradeUsd: 0.01,
      readBook: async () => ({
        bestAsk: 0.9,
        bestBid: 0.89,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_exchange_min");
  });

  it("prefetches each unique token orderbook once per planning run", async () => {
    const readBook = vi.fn(async () => ({
      bestAsk: 0.43,
      bestBid: 0.42,
      minOrderSize: 5
    }));
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(50), createOpenDecision(40)],
      positions: [],
      overview: createOverview(),
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 1,
        maxTotalExposurePct: 1,
        maxEventExposurePct: 1,
        maxPositions: 10
      },
      minTradeUsd: 10,
      readBook
    });

    expect(result.plans).toHaveLength(2);
    expect(readBook).toHaveBeenCalledTimes(1);
    expect(readBook).toHaveBeenCalledWith("token-open");
  });

  it("blocks open decisions whose token belongs to a different pulse market", async () => {
    const decision = createOpenDecision(50);
    decision.market_slug = "wrong-market";
    const result = await buildExecutionPlan({
      decisions: [decision],
      positions: [],
      overview: createOverview(),
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 1,
        maxTotalExposurePct: 1,
        maxEventExposurePct: 1,
        maxPositions: 10
      },
      minTradeUsd: 10,
      pulseCandidates: [
        {
          question: "Demo market question",
          eventSlug: "demo-event",
          marketSlug: "demo-market",
          outcomes: ["Yes", "No"],
          outcomePrices: [0.44, 0.56],
          clobTokenIds: ["token-yes", "token-open"]
        }
      ],
      readBook: async () => ({
        bestAsk: 0.56,
        bestBid: 0.55,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_market_binding");
    expect(result.skipped[0]?.reason).toContain("marketSlug mismatch");
  });

  it("blocks open decisions whose report price differs from the executable token price beyond tolerance", async () => {
    const decision = createOpenDecision(50);
    decision.market_prob = 0.9395;
    const result = await buildExecutionPlan({
      decisions: [decision],
      positions: [],
      overview: createOverview(),
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 1,
        maxTotalExposurePct: 1,
        maxEventExposurePct: 1,
        maxPositions: 10
      },
      minTradeUsd: 10,
      pulseCandidates: [
        {
          question: "Will Crude Oil (CL) hit (HIGH) $115 by end of June?",
          eventSlug: "demo-event",
          marketSlug: "demo-market",
          outcomes: ["Yes", "No"],
          outcomePrices: [0.5435, 0.4565],
          clobTokenIds: ["token-yes", "token-open"]
        }
      ],
      readBook: async () => ({
        bestAsk: 0.457,
        bestBid: 0.456,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_market_binding");
    expect(result.skipped[0]?.reason).toContain("decision market_prob");
  });

  it("provides specific max_positions reason when blocked at capacity", async () => {
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(50)],
      positions: [],
      overview: {
        ...createOverview(),
        open_positions: 10
      },
      config: {
        decisionStrategy: "provider-runtime",
        maxTradePct: 0.5,
        maxTotalExposurePct: 0.5,
        maxEventExposurePct: 0.3,
        maxPositions: 10
      },
      minTradeUsd: 10,
      readBook: async () => ({
        bestAsk: 0.43,
        bestBid: 0.42,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_risk_cap:max_positions");
    expect(result.skipped[0]?.reason).toContain("10/10 positions");
  });

  it("provides specific total_exposure reason when headroom is exhausted", async () => {
    const positions = [
      {
        id: "pos-1",
        event_slug: "other-event",
        market_slug: "other-market",
        token_id: "token-other",
        side: "BUY" as const,
        outcome_label: "Yes",
        size: 100,
        avg_cost: 0.5,
        current_price: 0.5,
        current_value_usd: 500,
        unrealized_pnl_pct: 0,
        stop_loss_pct: 0.3,
        opened_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z"
      }
    ];
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(200)],
      positions,
      overview: {
        ...createOverview(),
        open_positions: 1
      },
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 0.5,
        maxTotalExposurePct: 0.5,
        maxEventExposurePct: 0.3,
        maxPositions: 10
      },
      minTradeUsd: 10,
      readBook: async () => ({
        bestAsk: 0.43,
        bestBid: 0.42,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_risk_cap:total_exposure");
    expect(result.skipped[0]?.reason).toContain("headroom");
  });

  it("provides specific event_exposure reason when event cap is hit", async () => {
    const positions = [
      {
        id: "pos-1",
        event_slug: "demo-event",
        market_slug: "demo-market-2",
        token_id: "token-other",
        side: "BUY" as const,
        outcome_label: "Yes",
        size: 100,
        avg_cost: 0.5,
        current_price: 0.5,
        current_value_usd: 300,
        unrealized_pnl_pct: 0,
        stop_loss_pct: 0.3,
        opened_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z"
      }
    ];
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(200)],
      positions,
      overview: {
        ...createOverview(),
        open_positions: 1
      },
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 0.5,
        maxTotalExposurePct: 1,
        maxEventExposurePct: 0.3,
        maxPositions: 10
      },
      minTradeUsd: 10,
      readBook: async () => ({
        bestAsk: 0.43,
        bestBid: 0.42,
        minOrderSize: 5
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_risk_cap:event_exposure");
    expect(result.skipped[0]?.reason).toContain("$300.00");
  });

  it("provides specific risk_cap reason when exchange minimum is also in play", async () => {
    const result = await buildExecutionPlan({
      decisions: [createOpenDecision(200)],
      positions: [],
      overview: createOverview(),
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 0.005,
        maxTotalExposurePct: 0.5,
        maxEventExposurePct: 0.3,
        maxPositions: 10
      },
      minTradeUsd: 0.01,
      readBook: async () => ({
        bestAsk: 0.9,
        bestBid: 0.89,
        minOrderSize: 10
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_risk_cap:max_trade_pct");
    expect(result.skipped[0]?.reason).toContain("Polymarket order would fail");
  });

  it("blocks sells below the exchange minimum share size", async () => {
    const position = createReducePosition();
    const result = await buildExecutionPlan({
      decisions: [
        {
          action: "reduce",
          event_slug: position.event_slug,
          market_slug: position.market_slug,
          token_id: position.token_id,
          side: "SELL",
          notional_usd: 0.44,
          order_type: "FOK",
          ai_prob: 0.52,
          market_prob: 0.55,
          edge: -0.03,
          confidence: "medium",
          thesis_md: "Trim the position.",
          sources: [
            {
              title: "Pulse",
              url: "https://example.com/reduce",
              retrieved_at_utc: "2026-03-17T00:00:00.000Z"
            }
          ],
          stop_loss_pct: 0.3,
          resolution_track_required: true
        }
      ],
      positions: [position],
      overview: {
        ...createOverview(),
        total_equity_usd: 20,
        cash_balance_usd: 18.24,
        open_positions: 1
      },
      config: {
        decisionStrategy: "pulse-direct",
        maxTradePct: 0.05,
        maxTotalExposurePct: 0.5,
        maxEventExposurePct: 0.3,
        maxPositions: 10
      },
      minTradeUsd: 0.01,
      readBook: async () => ({
        bestAsk: 0.45,
        bestBid: 0.44,
        minOrderSize: 2
      })
    });

    expect(result.plans).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("blocked_by_exchange_min");
  });
});
