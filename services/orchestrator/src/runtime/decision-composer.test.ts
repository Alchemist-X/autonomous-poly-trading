import { describe, expect, it } from "vitest";
import type { PositionReviewResult, PulseEntryPlan } from "./decision-metadata.js";
import { composePulseDirectDecisions } from "./decision-composer.js";

function createReview(): PositionReviewResult {
  return {
    position: {
      id: "position-1",
      event_slug: "demo-event",
      market_slug: "demo-market",
      token_id: "token-no",
      side: "BUY",
      outcome_label: "No",
      size: 4,
      avg_cost: 0.4,
      current_price: 0.42,
      current_value_usd: 1.68,
      unrealized_pnl_pct: 0.05,
      stop_loss_pct: 0.3,
      opened_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z"
    },
    action: "hold",
    stillHasEdge: true,
    edgeAssessment: "yes",
    edgeValue: 0.02,
    pulseCoverage: "supporting",
    evidenceRefreshStatus: "fresh-supporting",
    freshEvidence: [
      "Pulse refreshed the held No outcome."
    ],
    adverseSignals: [],
    stopOrReduceTriggers: [
      "Reduce if refreshed edge turns negative."
    ],
    pnlSnapshot: {
      currentValueUsd: 1.68,
      avgCost: 0.4,
      currentPrice: 0.42,
      unrealizedPnlPct: 0.05,
      stopLossPct: 0.3
    },
    humanReviewFlag: false,
    confidence: "medium",
    reason: "Pulse still supports it.",
    reviewConclusion: "Keep the position because edge is still positive.",
    suggestedExitPct: 0,
    basis: "pulse-supports-current",
    decision: {
      action: "hold",
      event_slug: "demo-event",
      market_slug: "demo-market",
      token_id: "token-no",
      side: "BUY",
      notional_usd: 1.68,
      order_type: "FOK",
      ai_prob: 0.6,
      market_prob: 0.58,
      edge: 0.02,
      confidence: "medium",
      thesis_md: "Keep holding.",
      sources: [
        {
          title: "Position",
          url: "runtime-context://positions/position-1",
          retrieved_at_utc: "2026-03-17T00:00:00.000Z"
        }
      ],
      stop_loss_pct: 0.3,
      resolution_track_required: true
    }
  };
}

function createEntry(tokenId: string): PulseEntryPlan {
  return {
    eventSlug: "demo-event",
    marketSlug: "demo-market",
    tokenId,
    outcomeLabel: tokenId === "token-no" ? "No" : "Yes",
    side: "BUY",
    suggestedPct: 0.1,
    fullKellyPct: 0.4,
    quarterKellyPct: 0.1,
    reportedSuggestedPct: 0.1,
    liquidityCapUsd: null,
    aiProb: 0.62,
    marketProb: 0.55,
    monthlyReturn: 0.007,
    daysToResolution: 90,
    resolutionSource: "market" as const,
    entryFeePct: 0,
    roundTripFeePct: 0,
    netEdge: 0.07,
    categorySlug: null,
    confidence: "medium",
    thesisMd: "Open it.",
    sources: [
      {
        title: "Pulse",
        url: "https://example.com/demo-market",
        retrieved_at_utc: "2026-03-17T00:00:00.000Z"
      }
    ],
    decision: {
      action: "open",
      event_slug: "demo-event",
      market_slug: "demo-market",
      token_id: tokenId,
      side: "BUY",
      notional_usd: 2,
      order_type: "FOK",
      ai_prob: 0.62,
      market_prob: 0.55,
      edge: 0.07,
      confidence: "medium",
      thesis_md: "Open it.",
      sources: [
        {
          title: "Pulse",
          url: "https://example.com/demo-market",
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

describe("decision composer", () => {
  it("merges same-token add-ons into an executable open and keeps opposite-token entries", () => {
    const result = composePulseDirectDecisions({
      reviewResults: [createReview()],
      entryPlans: [createEntry("token-no"), createEntry("token-yes")]
    });

    expect(result.decisions).toHaveLength(2);
    expect(result.decisions.some((decision) => decision.token_id === "token-no" && decision.action === "open")).toBe(true);
    expect(result.decisions.some((decision) => decision.token_id === "token-yes" && decision.action === "open")).toBe(true);
    expect(result.skippedEntries).toHaveLength(0);
  });

  it("keeps reduce or close review decisions ahead of same-token add-ons", () => {
    const review = createReview();
    review.action = "close";
    review.decision.action = "close";
    review.decision.side = "SELL";

    const result = composePulseDirectDecisions({
      reviewResults: [review],
      entryPlans: [createEntry("token-no")]
    });

    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]?.action).toBe("close");
    expect(result.skippedEntries).toHaveLength(1);
  });
});
