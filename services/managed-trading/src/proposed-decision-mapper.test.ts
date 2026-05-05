import { describe, expect, it } from "vitest";
import {
  mapPulseRecommendationToProposedDecisions,
  mapSinglePlanToProposedDecision,
  normalizeConfidence,
  type PulsePlannedExecution,
  type PulseRecommendationFile,
  type PulseTradeDecision
} from "./proposed-decision-mapper.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<PulsePlannedExecution> = {}): PulsePlannedExecution {
  return {
    action: "open",
    marketSlug: "will-finland-win-eurovision-2026",
    eventSlug: "eurovision-winner-2026",
    tokenId: "tok-1",
    side: "BUY",
    notionalUsd: 20.0576,
    bankrollRatio: 0.0366,
    thesisMd: "plan-thesis",
    orderType: "FOK",
    gtcLimitPrice: null,
    categorySlug: "music",
    negRisk: true,
    ...overrides
  };
}

function makeDecision(overrides: Partial<PulseTradeDecision> = {}): PulseTradeDecision {
  return {
    action: "open",
    event_slug: "eurovision-winner-2026",
    market_slug: "will-finland-win-eurovision-2026",
    token_id: "tok-1",
    side: "BUY",
    notional_usd: 22,
    ai_prob: 0.72,
    market_prob: 0.367,
    edge: 0.353,
    confidence: "medium",
    thesis_md: "decision-thesis",
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Single-plan mapper
// ---------------------------------------------------------------------------

describe("mapSinglePlanToProposedDecision", () => {
  it("joins plan + decision on tokenId, taking notional from plan and ai metadata from decision", () => {
    const plan = makePlan({ notionalUsd: 18.5 });
    const decision = makeDecision({ ai_prob: 0.65, market_prob: 0.5, edge: 0.15 });
    const result = mapSinglePlanToProposedDecision(plan, decision);
    expect("decision" in result).toBe(true);
    if (!("decision" in result)) return;
    expect(result.decision).toEqual({
      action: "open",
      eventSlug: "eurovision-winner-2026",
      marketSlug: "will-finland-win-eurovision-2026",
      tokenId: "tok-1",
      side: "BUY",
      // notional comes from the plan (post-orchestrator-sizing), NOT from
      // the raw TradeDecision.notional_usd.
      notionalUsd: 18.5,
      aiProb: 0.65,
      marketProb: 0.5,
      edge: 0.15,
      confidence: "medium",
      // thesis prefers the plan's value (which is identical to the
      // decision's at orchestrator emit time, but plan wins on conflict).
      thesisMd: "plan-thesis"
    });
  });

  it("falls back to decision.thesis_md when plan.thesisMd is missing", () => {
    const plan = makePlan({ thesisMd: undefined });
    const decision = makeDecision({ thesis_md: "from-decision" });
    const result = mapSinglePlanToProposedDecision(plan, decision);
    if (!("decision" in result)) throw new Error("expected mapped decision");
    expect(result.decision.thesisMd).toBe("from-decision");
  });

  it("returns no_matching_decision when no decision is provided", () => {
    const plan = makePlan({ tokenId: "orphan" });
    const result = mapSinglePlanToProposedDecision(plan, undefined);
    if ("decision" in result) throw new Error("expected unmappable result");
    expect(result.reason).toBe("no_matching_decision");
    expect(result.detail).toContain("orphan");
  });

  it("rejects unsupported actions", () => {
    const plan = makePlan({ action: "skip" });
    const result = mapSinglePlanToProposedDecision(plan, makeDecision());
    if ("decision" in result) throw new Error("expected unmappable result");
    expect(result.reason).toBe("unsupported_action");
  });

  it("rejects unsupported sides", () => {
    const plan = makePlan({ side: "LONG" });
    const result = mapSinglePlanToProposedDecision(plan, makeDecision());
    if ("decision" in result) throw new Error("expected unmappable result");
    expect(result.reason).toBe("unsupported_side");
  });

  it("rejects non-positive notional", () => {
    const plan = makePlan({ notionalUsd: 0 });
    const result = mapSinglePlanToProposedDecision(plan, makeDecision());
    if ("decision" in result) throw new Error("expected unmappable result");
    expect(result.reason).toBe("invalid_notional");
  });

  it("rejects NaN notional", () => {
    const plan = makePlan({ notionalUsd: Number.NaN });
    const result = mapSinglePlanToProposedDecision(plan, makeDecision());
    if ("decision" in result) throw new Error("expected unmappable result");
    expect(result.reason).toBe("invalid_notional");
  });

  it("supports SELL side for close + reduce actions", () => {
    const plan = makePlan({ action: "close", side: "SELL" });
    const decision = makeDecision({ action: "close", side: "SELL" });
    const result = mapSinglePlanToProposedDecision(plan, decision);
    if (!("decision" in result)) throw new Error("expected mapped decision");
    expect(result.decision.action).toBe("close");
    expect(result.decision.side).toBe("SELL");
  });

  it("supports hold action even though buildExecutionPlan typically filters it", () => {
    const plan = makePlan({ action: "hold" });
    const decision = makeDecision({ action: "hold" });
    const result = mapSinglePlanToProposedDecision(plan, decision);
    if (!("decision" in result)) throw new Error("expected mapped decision");
    expect(result.decision.action).toBe("hold");
  });

  it("clamps ai_prob / market_prob to [0,1]", () => {
    const plan = makePlan();
    const decision = makeDecision({ ai_prob: 1.7, market_prob: -0.4 });
    const result = mapSinglePlanToProposedDecision(plan, decision);
    if (!("decision" in result)) throw new Error("expected mapped decision");
    expect(result.decision.aiProb).toBe(1);
    expect(result.decision.marketProb).toBe(0);
  });

  it("treats non-finite edge as 0", () => {
    const plan = makePlan();
    const decision = makeDecision({ edge: Number.NaN });
    const result = mapSinglePlanToProposedDecision(plan, decision);
    if (!("decision" in result)) throw new Error("expected mapped decision");
    expect(result.decision.edge).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Confidence normalization
// ---------------------------------------------------------------------------

describe("normalizeConfidence", () => {
  it("passes low/medium/high through unchanged", () => {
    expect(normalizeConfidence("low")).toBe("low");
    expect(normalizeConfidence("medium")).toBe("medium");
    expect(normalizeConfidence("high")).toBe("high");
  });

  it("maps medium-high to high", () => {
    expect(normalizeConfidence("medium-high")).toBe("high");
  });

  it("falls back to medium for unknown values", () => {
    expect(normalizeConfidence("ultra-high")).toBe("medium");
    expect(normalizeConfidence("")).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// Recommendation-file mapper
// ---------------------------------------------------------------------------

describe("mapPulseRecommendationToProposedDecisions", () => {
  it("returns proposed decisions in plan order, joining by tokenId", () => {
    const recommendation: PulseRecommendationFile = {
      executablePlans: [
        makePlan({ tokenId: "t1", marketSlug: "m1", notionalUsd: 10 }),
        makePlan({ tokenId: "t2", marketSlug: "m2", notionalUsd: 20 })
      ],
      decisions: [
        makeDecision({ token_id: "t1", market_slug: "m1", ai_prob: 0.55 }),
        makeDecision({ token_id: "t2", market_slug: "m2", ai_prob: 0.66 })
      ]
    };
    const result = mapPulseRecommendationToProposedDecisions(recommendation);
    expect(result.proposedDecisions).toHaveLength(2);
    expect(result.unmappable).toHaveLength(0);
    expect(result.proposedDecisions[0]?.tokenId).toBe("t1");
    expect(result.proposedDecisions[0]?.aiProb).toBe(0.55);
    expect(result.proposedDecisions[1]?.tokenId).toBe("t2");
    expect(result.proposedDecisions[1]?.aiProb).toBe(0.66);
  });

  it("collects unmappable plans into the unmappable bucket without throwing", () => {
    const recommendation: PulseRecommendationFile = {
      executablePlans: [
        makePlan({ tokenId: "matched" }),
        makePlan({ tokenId: "orphan" })
      ],
      decisions: [makeDecision({ token_id: "matched" })]
    };
    const result = mapPulseRecommendationToProposedDecisions(recommendation);
    expect(result.proposedDecisions).toHaveLength(1);
    expect(result.unmappable).toHaveLength(1);
    expect(result.unmappable[0]?.reason).toBe("no_matching_decision");
    expect(result.unmappable[0]?.plan.tokenId).toBe("orphan");
  });

  it("returns empty result for an empty recommendation", () => {
    const result = mapPulseRecommendationToProposedDecisions({
      executablePlans: [],
      decisions: []
    });
    expect(result.proposedDecisions).toHaveLength(0);
    expect(result.unmappable).toHaveLength(0);
  });

  it("tolerates missing executablePlans / decisions arrays", () => {
    const result = mapPulseRecommendationToProposedDecisions(
      {} as unknown as PulseRecommendationFile
    );
    expect(result.proposedDecisions).toHaveLength(0);
    expect(result.unmappable).toHaveLength(0);
  });
});
