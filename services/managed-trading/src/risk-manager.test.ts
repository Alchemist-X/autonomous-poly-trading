import { describe, expect, it } from "vitest";
import { applyCaps, getRiskCapsForTier } from "./risk-manager.js";
import type { ProposedDecision } from "./types.js";

function makeOpen(overrides: Partial<ProposedDecision> = {}): ProposedDecision {
  return {
    action: "open",
    eventSlug: "evt-default",
    marketSlug: "mkt-default",
    tokenId: "tok-default",
    side: "BUY",
    notionalUsd: 100,
    aiProb: 0.6,
    marketProb: 0.5,
    edge: 0.1,
    confidence: "medium",
    thesisMd: "test",
    ...overrides
  };
}

describe("getRiskCapsForTier", () => {
  it("returns conservative caps", () => {
    const caps = getRiskCapsForTier("conservative");
    expect(caps).toEqual({
      perPositionPct: 0.10,
      totalExposurePct: 0.50,
      perEventPct: 0.20,
      maxPositions: 15,
      minNotionalUsd: 5
    });
  });

  it("returns balanced caps that mirror Pizza wallet defaults", () => {
    const caps = getRiskCapsForTier("balanced");
    expect(caps).toEqual({
      perPositionPct: 0.15,
      totalExposurePct: 0.80,
      perEventPct: 0.30,
      maxPositions: 22,
      minNotionalUsd: 5
    });
  });

  it("returns aggressive caps", () => {
    const caps = getRiskCapsForTier("aggressive");
    expect(caps).toEqual({
      perPositionPct: 0.20,
      totalExposurePct: 0.95,
      perEventPct: 0.40,
      maxPositions: 30,
      minNotionalUsd: 5
    });
  });
});

describe("applyCaps - per-position", () => {
  it("truncates per-position notional to bankroll * perPositionPct", () => {
    const caps = getRiskCapsForTier("balanced"); // 15% of bankroll = $150
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1", notionalUsd: 500 })],
      caps,
      1000
    );
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.notionalUsd).toBeCloseTo(150, 2);
    expect(result.skipped).toHaveLength(0);
  });

  it("does not inflate notionals already below the cap", () => {
    const caps = getRiskCapsForTier("balanced");
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1", notionalUsd: 50 })],
      caps,
      1000
    );
    expect(result.kept[0]?.notionalUsd).toBeCloseTo(50, 2);
  });
});

describe("applyCaps - max-positions", () => {
  it("keeps the top-N highest-edge decisions and skips the rest", () => {
    const caps = {
      perPositionPct: 0.15,
      totalExposurePct: 1.0,
      perEventPct: 1.0,
      maxPositions: 3,
      minNotionalUsd: 1
    };
    const decisions: ProposedDecision[] = [];
    for (let i = 0; i < 10; i += 1) {
      decisions.push(makeOpen({
        tokenId: `t${i}`,
        eventSlug: `e${i}`,
        notionalUsd: 10,
        edge: 0.01 * (10 - i) // descending edges: 0.10, 0.09, 0.08...
      }));
    }
    const result = applyCaps(decisions, caps, 10000);
    expect(result.kept).toHaveLength(3);
    expect(result.skipped).toHaveLength(7);
    // The top-3 highest-edge tokens should be t0, t1, t2.
    const keptTokens = result.kept.map((d) => d.tokenId).sort();
    expect(keptTokens).toEqual(["t0", "t1", "t2"]);
    expect(result.skipped[0]?.skippedReason).toContain("blocked_by_max_positions");
  });
});

describe("applyCaps - min-notional", () => {
  it("skips decisions whose post-cap notional falls below minNotionalUsd", () => {
    const caps = {
      perPositionPct: 0.005, // 0.5% of $100 bankroll = $0.50, below $5 floor
      totalExposurePct: 1.0,
      perEventPct: 1.0,
      maxPositions: 22,
      minNotionalUsd: 5
    };
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1", notionalUsd: 50 })],
      caps,
      100
    );
    expect(result.kept).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.skippedReason).toContain("blocked_by_min_notional");
  });

  it("uses correct skipped reason text format", () => {
    const caps = getRiskCapsForTier("balanced");
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1", notionalUsd: 2 })],
      caps,
      1000
    );
    expect(result.skipped[0]?.skippedReason).toMatch(/^blocked_by_min_notional:/);
  });
});

describe("applyCaps - total-exposure", () => {
  it("keeps highest-edge decisions until total cap reached, drops low-edge first-out", () => {
    const caps = {
      perPositionPct: 1.0,
      totalExposurePct: 0.20, // 20% of $1000 = $200 total
      perEventPct: 1.0,
      maxPositions: 22,
      minNotionalUsd: 5
    };
    const decisions: ProposedDecision[] = [
      makeOpen({ tokenId: "t-high", eventSlug: "e1", notionalUsd: 100, edge: 0.20 }),
      makeOpen({ tokenId: "t-mid", eventSlug: "e2", notionalUsd: 100, edge: 0.10 }),
      makeOpen({ tokenId: "t-low", eventSlug: "e3", notionalUsd: 100, edge: 0.05 })
    ];
    const result = applyCaps(decisions, caps, 1000);
    // Total cap is $200, so high (100) + mid (100) = 200 fits, low gets dropped.
    expect(result.kept).toHaveLength(2);
    const keptIds = result.kept.map((d) => d.tokenId).sort();
    expect(keptIds).toEqual(["t-high", "t-mid"]);
    expect(result.skipped[0]?.tokenId).toBe("t-low");
    expect(result.skipped[0]?.skippedReason).toContain("blocked_by_total_exposure_cap");
  });
});

describe("applyCaps - ordering", () => {
  it("applies per-position cap before total-exposure", () => {
    // Setup: bankroll $100, per-position 50% ($50), total 80% ($80).
    // Single $1000 row should first be capped to $50 (per-position),
    // then fit under total exposure (which would have skipped it
    // entirely if total ran first).
    const caps = {
      perPositionPct: 0.50,
      totalExposurePct: 0.80,
      perEventPct: 1.0,
      maxPositions: 22,
      minNotionalUsd: 1
    };
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1", notionalUsd: 1000 })],
      caps,
      100
    );
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.notionalUsd).toBeCloseTo(50, 2);
  });

  it("applies per-event cap before total-exposure (so multi-row events don't double-spend headroom)", () => {
    // Two open rows on the same event, each $50. Per-event cap 30%
    // of $100 = $30. Per-position 50%. Total exposure 80%.
    // After per-position: both stay at $50 each.
    // After per-event: highest-edge $30 kept, second $0 (dropped).
    // After total: $30 fits under $80, kept stays.
    const caps = {
      perPositionPct: 0.50,
      totalExposurePct: 0.80,
      perEventPct: 0.30,
      maxPositions: 22,
      minNotionalUsd: 1
    };
    const result = applyCaps(
      [
        makeOpen({ tokenId: "t-high", eventSlug: "shared-event", notionalUsd: 50, edge: 0.20 }),
        makeOpen({ tokenId: "t-low", eventSlug: "shared-event", notionalUsd: 50, edge: 0.05 })
      ],
      caps,
      100
    );
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.tokenId).toBe("t-high");
    expect(result.kept[0]?.notionalUsd).toBeCloseTo(30, 2);
    expect(result.skipped[0]?.skippedReason).toContain("blocked_by_per_event_cap");
  });
});

describe("applyCaps - bankroll edge cases", () => {
  it("skips all decisions when bankroll is zero", () => {
    const caps = getRiskCapsForTier("balanced");
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1" })],
      caps,
      0
    );
    expect(result.kept).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.skippedReason).toContain("blocked_by_zero_bankroll");
  });

  it("passes through close/reduce/hold rows without bankroll-cap math", () => {
    const caps = getRiskCapsForTier("balanced");
    const result = applyCaps(
      [
        makeOpen({ tokenId: "t-open", eventSlug: "e1", notionalUsd: 50 }),
        { ...makeOpen({ tokenId: "t-close", eventSlug: "e1", notionalUsd: 999 }), action: "close" },
        { ...makeOpen({ tokenId: "t-hold", eventSlug: "e1", notionalUsd: 999 }), action: "hold" }
      ],
      caps,
      1000
    );
    const tokens = result.kept.map((d) => d.tokenId).sort();
    expect(tokens).toEqual(["t-close", "t-hold", "t-open"]);
  });

  it("populates bankrollRatio on kept decisions", () => {
    const caps = getRiskCapsForTier("balanced");
    const result = applyCaps(
      [makeOpen({ tokenId: "t1", eventSlug: "e1", notionalUsd: 100 })],
      caps,
      1000
    );
    expect(result.kept[0]?.bankrollRatio).toBeCloseTo(0.1, 6);
  });
});
