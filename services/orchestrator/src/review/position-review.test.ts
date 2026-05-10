import { describe, expect, it } from "vitest";
import type { RuntimeExecutionContext } from "../runtime/agent-runtime.js";
import type { PositionResearchSnapshot, PulseEntryPlan } from "../runtime/decision-metadata.js";
import { reviewCurrentPositions } from "./position-review.js";

function createContext(): RuntimeExecutionContext {
  return {
    runId: "11111111-1111-4111-8111-111111111111",
    mode: "full",
    overview: {
      status: "running",
      cash_balance_usd: 18,
      total_equity_usd: 20,
      high_water_mark_usd: 20,
      drawdown_pct: 0,
      open_positions: 1,
      last_run_at: null,
      latest_risk_event: null,
      equity_curve: []
    },
    positions: [
      {
        id: "position-1",
        event_slug: "demo-event",
        market_slug: "demo-market",
        token_id: "token-no",
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
      }
    ],
    pulse: {
      id: "pulse-1",
      generatedAtUtc: "2026-03-17T00:00:00.000Z",
      title: "Pulse",
      relativeMarkdownPath: "reports/pulse/demo.md",
      absoluteMarkdownPath: "/tmp/reports/pulse/demo.md",
      relativeJsonPath: "reports/pulse/demo.json",
      absoluteJsonPath: "/tmp/reports/pulse/demo.json",
      markdown: "# Pulse",
      totalFetched: 10,
      totalFiltered: 5,
      selectedCandidates: 2,
      minLiquidityUsd: 5000,
      fetchConfig: {
        pagesPerDimension: 5,
        eventsPerPage: 50,
        minFetchedMarkets: 5000,
        dimensions: ["volume24hr", "liquidity", "startDate", "competitive"]
      },
      categoryStats: { fetched: [], filtered: [] },
      tagStats: { fetched: [], filtered: [] },
      candidates: [],
      riskFlags: [],
      tradeable: true
    }
  };
}

function createNearStopLossContext(): RuntimeExecutionContext {
  const context = createContext();
  return {
    ...context,
    positions: [
      {
        ...context.positions[0]!,
        current_value_usd: 12,
        current_price: 0.31,
        unrealized_pnl_pct: -0.22
      }
    ]
  };
}

function createEntryPlan(input: {
  tokenId: string;
  outcomeLabel: string;
  aiProb: number;
  marketProb: number;
  confidence?: "low" | "medium" | "medium-high" | "high";
}): PulseEntryPlan {
  return {
    eventSlug: "demo-event",
    marketSlug: "demo-market",
    tokenId: input.tokenId,
    outcomeLabel: input.outcomeLabel,
    side: "BUY",
    suggestedPct: 0.1,
    fullKellyPct: 0.4,
    quarterKellyPct: 0.1,
    reportedSuggestedPct: 0.1,
    liquidityCapUsd: null,
    aiProb: input.aiProb,
    marketProb: input.marketProb,
    monthlyReturn: 0.007,
    daysToResolution: 90,
    resolutionSource: "market" as const,
    entryFeePct: 0,
    roundTripFeePct: 0,
    netEdge: input.aiProb - input.marketProb,
    categorySlug: null,
    confidence: input.confidence ?? "medium",
    thesisMd: "Pulse thesis",
    sources: [
      {
        title: "Pulse",
        url: "https://example.com/pulse",
        retrieved_at_utc: "2026-03-17T00:00:00.000Z"
      }
    ],
    decision: {
      action: "open",
      event_slug: "demo-event",
      market_slug: "demo-market",
      token_id: input.tokenId,
      side: "BUY",
      notional_usd: 2,
      order_type: "FOK",
      ai_prob: input.aiProb,
      market_prob: input.marketProb,
      edge: input.aiProb - input.marketProb,
      confidence: input.confidence ?? "medium",
      thesis_md: "Pulse thesis",
      sources: [
        {
          title: "Pulse",
          url: "https://example.com/pulse",
          retrieved_at_utc: "2026-03-17T00:00:00.000Z"
        }
      ],
      full_kelly_pct: 0.4,
      quarter_kelly_pct: 0.1,
      reported_suggested_pct: 0.1,
      liquidity_cap_usd: null,
      stop_loss_pct: 0.3,
      resolution_track_required: true
    }
  };
}

function createPositionResearch(overrides: Partial<PositionResearchSnapshot> = {}): PositionResearchSnapshot {
  return {
    positionId: "position-1",
    eventSlug: "demo-event",
    marketSlug: "demo-market",
    tokenId: "token-no",
    outcomeLabel: "No",
    fetchedAtUtc: "2026-03-17T01:00:00.000Z",
    marketProb: 0.44,
    orderbook: {
      bestBid: 0.44,
      bestAsk: 0.45,
      minOrderSize: 5
    },
    rules: {
      description: "Resolution rule snapshot",
      resolutionSource: "Official source",
      endDate: "2026-06-30T00:00:00.000Z"
    },
    marketStatus: {
      active: true,
      closed: false,
      archived: false
    },
    freshEvidence: [
      "Dedicated position research refreshed demo-market / No.",
      "Resolution rule snapshot: Resolution rule snapshot"
    ],
    adverseSignals: [],
    unresolvedData: [],
    sources: [
      {
        title: "Polymarket event",
        url: "https://polymarket.com/event/demo-event",
        retrieved_at_utc: "2026-03-17T01:00:00.000Z"
      }
    ],
    ...overrides
  };
}

describe("position review", () => {
  it("holds when pulse still supports the current outcome", () => {
    const [result] = reviewCurrentPositions({
      context: createContext(),
      entryPlans: [createEntryPlan({ tokenId: "token-no", outcomeLabel: "No", aiProb: 0.62, marketProb: 0.55 })]
    });

    expect(result?.action).toBe("hold");
    expect(result?.stillHasEdge).toBe(true);
    expect(result?.evidenceRefreshStatus).toBe("fresh-supporting");
    expect(result?.freshEvidence.some((line) => line.includes("Pulse refreshed"))).toBe(true);
    expect(result?.humanReviewFlag).toBe(false);
    expect(result?.basis).toBe("pulse-supports-current");
  });

  it("keeps the position but flags human review when pulse support only leaves a weak edge", () => {
    const [result] = reviewCurrentPositions({
      context: createContext(),
      entryPlans: [createEntryPlan({ tokenId: "token-no", outcomeLabel: "No", aiProb: 0.57, marketProb: 0.55 })]
    });

    expect(result?.action).toBe("hold");
    expect(result?.humanReviewFlag).toBe(true);
    expect(result?.adverseSignals.some((line) => line.includes("Residual edge is weak"))).toBe(true);
    expect(result?.basis).toBe("pulse-supports-current-weak-edge");
    expect(result?.reviewConclusion).toContain("flag it for human review");
  });

  it("reduces when pulse still references the held side but the refreshed edge turns slightly negative", () => {
    const [result] = reviewCurrentPositions({
      context: createNearStopLossContext(),
      entryPlans: [createEntryPlan({ tokenId: "token-no", outcomeLabel: "No", aiProb: 0.52, marketProb: 0.55 })]
    });

    expect(result?.action).toBe("reduce");
    expect(result?.stillHasEdge).toBe(false);
    expect(result?.evidenceRefreshStatus).toBe("fresh-supporting");
    expect(result?.decision.side).toBe("SELL");
    expect(result?.decision.notional_usd).toBe(6);
    expect(result?.decision.position_value_usd).toBe(12);
    expect(result?.decision.execution_unit).toBe("shares");
    expect(result?.decision.execution_amount).toBe(2);
    expect(result?.basis).toBe("pulse-supports-current-negative-edge");
  });

  it("closes when pulse favors the opposite outcome", () => {
    const [result] = reviewCurrentPositions({
      context: createContext(),
      entryPlans: [createEntryPlan({ tokenId: "token-yes", outcomeLabel: "Yes", aiProb: 0.64, marketProb: 0.52 })]
    });

    expect(result?.action).toBe("close");
    expect(result?.stillHasEdge).toBe(false);
    expect(result?.evidenceRefreshStatus).toBe("fresh-opposing");
    expect(result?.adverseSignals.some((line) => line.includes("contradicted"))).toBe(true);
    expect(result?.decision.side).toBe("SELL");
    expect(result?.decision.position_value_usd).toBe(1.76);
    expect(result?.decision.execution_unit).toBe("shares");
    expect(result?.decision.execution_amount).toBe(4);
  });

  it("keeps the position but flags human review when there is no fresh pulse coverage", () => {
    const [result] = reviewCurrentPositions({
      context: createContext(),
      entryPlans: []
    });

    expect(result?.action).toBe("hold");
    expect(result?.stillHasEdge).toBe(false);
    expect(result?.edgeAssessment).toBe("no");
    expect(result?.humanReviewFlag).toBe(true);
    expect(result?.evidenceRefreshStatus).toBe("not-refreshed");
    expect(result?.freshEvidence).toContain("No fresh Pulse research covered this held token in the current run.");
    expect(result?.stopOrReduceTriggers.length).toBeGreaterThan(0);
    expect(result?.basis).toBe("no-fresh-signal");
    expect(result?.reviewConclusion).toContain("Stale hold");
  });

  it("uses dedicated position research instead of stale hold when pulse does not cover the position", () => {
    const context = {
      ...createContext(),
      positionResearch: [createPositionResearch()]
    };
    const [result] = reviewCurrentPositions({
      context,
      entryPlans: []
    });

    expect(result?.action).toBe("hold");
    expect(result?.evidenceRefreshStatus).toBe("fresh-position-research");
    expect(result?.basis).toBe("position-research-refreshed");
    expect(result?.freshEvidence).toContain("Dedicated position research refreshed demo-market / No.");
    expect(result?.freshEvidence).not.toContain("No fresh Pulse research covered this held token in the current run.");
    expect(result?.decision.sources.some((source) => source.title === "Polymarket event")).toBe(true);
  });

  it("reduces near-stop-loss positions when there is no fresh pulse coverage", () => {
    const [result] = reviewCurrentPositions({
      context: createNearStopLossContext(),
      entryPlans: []
    });

    expect(result?.action).toBe("reduce");
    expect(result?.basis).toBe("near-stop-loss-without-fresh-signal");
    expect(result?.humanReviewFlag).toBe(true);
    expect(result?.adverseSignals.some((line) => line.includes("near stop-loss"))).toBe(true);
    expect(result?.decision.notional_usd).toBe(6);
    expect(result?.decision.position_value_usd).toBe(12);
    expect(result?.decision.execution_unit).toBe("shares");
    expect(result?.decision.execution_amount).toBe(2);
  });

  it("keeps near-stop-loss action but marks evidence fresh when dedicated position research exists", () => {
    const context = {
      ...createNearStopLossContext(),
      positionResearch: [createPositionResearch()]
    };
    const [result] = reviewCurrentPositions({
      context,
      entryPlans: []
    });

    expect(result?.action).toBe("reduce");
    expect(result?.evidenceRefreshStatus).toBe("fresh-position-research");
    expect(result?.basis).toBe("position-research-adverse");
    expect(result?.freshEvidence).toContain("Dedicated position research refreshed demo-market / No.");
  });
});
