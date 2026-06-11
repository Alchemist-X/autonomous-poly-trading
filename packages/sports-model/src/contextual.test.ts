import { describe, expect, it } from "vitest";
import {
  altitudeAdjustmentFactor,
  applyToLambda,
  combineFactors,
  heatPenaltyFactor,
  homeAdvantageMultiplier,
  namedVenueHomeAdvantage,
  restAdvantageFactor,
  rotationDepthFactor,
  travelFatigueFactor,
} from "./contextual.js";

describe("namedVenueHomeAdvantage", () => {
  it("returns the Mexico City altitude-driven factor", () => {
    expect(namedVenueHomeAdvantage("mexico-city")).toBe(1.25);
  });

  it("is case-insensitive and tolerant of spaces/underscores", () => {
    expect(namedVenueHomeAdvantage("Mexico-City")).toBe(1.25);
    expect(namedVenueHomeAdvantage("MEXICO CITY")).toBe(1.25);
    expect(namedVenueHomeAdvantage("Mexico_City")).toBe(1.25);
    expect(namedVenueHomeAdvantage("  mexico-city  ")).toBe(1.25);
  });

  it("returns the lower Vancouver factor", () => {
    expect(namedVenueHomeAdvantage("vancouver")).toBe(1.05);
    expect(namedVenueHomeAdvantage("Vancouver")).toBe(1.05);
  });

  it("falls back to the generic 1.10 for unknown venues", () => {
    expect(namedVenueHomeAdvantage("nowhere-stadium")).toBe(1.1);
    expect(namedVenueHomeAdvantage("")).toBe(1.1);
  });
});

describe("homeAdvantageMultiplier", () => {
  it("defaults to a 1.10 home edge", () => {
    expect(homeAdvantageMultiplier()).toBe(1.1);
    expect(homeAdvantageMultiplier({})).toBe(1.1);
  });

  it("is exactly 1.0 (no effect) at a neutral venue", () => {
    expect(homeAdvantageMultiplier({ neutralVenue: true })).toBe(1.0);
  });

  it("neutral overrides a custom base", () => {
    expect(homeAdvantageMultiplier({ neutralVenue: true, base: 1.3 })).toBe(1.0);
  });

  it("honours a custom base for a home fixture", () => {
    expect(homeAdvantageMultiplier({ base: 1.2 })).toBe(1.2);
  });
});

describe("altitudeAdjustmentFactor", () => {
  it("is 1.0 (no effect) at the team's baseline altitude", () => {
    expect(altitudeAdjustmentFactor(2240, 2240)).toBe(1.0);
  });

  it("is 1.0 for teams already above the match altitude", () => {
    expect(altitudeAdjustmentFactor(0, 2240)).toBe(1.0);
    expect(altitudeAdjustmentFactor(1000, 2240)).toBe(1.0);
  });

  it("penalises a lowland team at Mexico City (2240 m, 0.04/km)", () => {
    // 1 - 0.04 * (2240 / 1000) = 1 - 0.0896 = 0.9104
    expect(altitudeAdjustmentFactor(2240, 0)).toBeCloseTo(0.9104, 10);
  });

  it("decreases monotonically with excess altitude", () => {
    const a = altitudeAdjustmentFactor(1000, 0);
    const b = altitudeAdjustmentFactor(2000, 0);
    const c = altitudeAdjustmentFactor(3000, 0);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("respects the 0.80 floor at extreme altitude", () => {
    // 1 - 0.04 * (10000/1000) = 0.6 -> floored to 0.80
    expect(altitudeAdjustmentFactor(10000, 0)).toBe(0.8);
    expect(altitudeAdjustmentFactor(1e9, 0)).toBe(0.8);
  });

  it("honours a custom per-km penalty", () => {
    // 1 - 0.06 * (2000/1000) = 1 - 0.12 = 0.88
    expect(altitudeAdjustmentFactor(2000, 0, 0.06)).toBeCloseTo(0.88, 10);
  });
});

describe("heatPenaltyFactor", () => {
  it("is 1.0 (no effect) at the threshold", () => {
    expect(heatPenaltyFactor(28)).toBe(1.0);
  });

  it("is 1.0 below the threshold", () => {
    expect(heatPenaltyFactor(20)).toBe(1.0);
    expect(heatPenaltyFactor(10)).toBe(1.0);
  });

  it("penalises WBGT above the threshold", () => {
    // 1 - 0.01 * (33 - 28) = 1 - 0.05 = 0.95
    expect(heatPenaltyFactor(33)).toBeCloseTo(0.95, 10);
  });

  it("decreases monotonically with WBGT past the threshold", () => {
    const a = heatPenaltyFactor(30);
    const b = heatPenaltyFactor(33);
    const c = heatPenaltyFactor(36);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("respects the 0.85 floor in extreme heat", () => {
    // 1 - 0.01 * (200 - 28) = -0.72 -> floored to 0.85
    expect(heatPenaltyFactor(200)).toBe(0.85);
  });

  it("honours custom threshold and slope", () => {
    // threshold 25, slope 0.02: 1 - 0.02 * (30 - 25) = 0.9
    expect(heatPenaltyFactor(30, 25, 0.02)).toBeCloseTo(0.9, 10);
  });
});

describe("travelFatigueFactor", () => {
  it("is 1.0 (no effect) with no travel", () => {
    expect(travelFatigueFactor(0, 0)).toBe(1.0);
  });

  it("is 1.0 with full rest regardless of distance", () => {
    expect(travelFatigueFactor(50000, 4)).toBe(1.0);
    expect(travelFatigueFactor(50000, 10)).toBe(1.0);
  });

  it("penalises long travel on short rest", () => {
    // distanceWeight = min(0.10, 2500/50000) = 0.05
    // restGate = (4 - 0) / 4 = 1 ; factor = 1 - 0.05 = 0.95
    expect(travelFatigueFactor(2500, 0)).toBeCloseTo(0.95, 10);
  });

  it("worsens with less rest at fixed distance", () => {
    const more = travelFatigueFactor(2500, 3);
    const less = travelFatigueFactor(2500, 1);
    expect(more).toBeGreaterThan(less);
  });

  it("worsens with more distance at fixed (short) rest, below saturation", () => {
    // Below the 5000 km saturation point the distance weight is still rising.
    const near = travelFatigueFactor(1000, 0);
    const far = travelFatigueFactor(4000, 0);
    expect(near).toBeGreaterThan(far);
  });

  it("respects the 0.85 floor", () => {
    // Max penalty: distanceWeight 0.10, restGate 1 -> 0.90 (within floor),
    // so even saturated it stays at/above 0.85.
    expect(travelFatigueFactor(1e9, 0)).toBeGreaterThanOrEqual(0.85);
    expect(travelFatigueFactor(1e9, 0)).toBeCloseTo(0.9, 10);
  });
});

describe("restAdvantageFactor", () => {
  it("is exactly 1.0 (no effect) for equal rest", () => {
    expect(restAdvantageFactor(3, 3)).toBe(1.0);
    expect(restAdvantageFactor(0, 0)).toBe(1.0);
    expect(restAdvantageFactor(7, 7)).toBe(1.0);
  });

  it("is > 1 when the team is fresher", () => {
    expect(restAdvantageFactor(4, 2)).toBeGreaterThan(1);
  });

  it("is < 1 when the team is more tired", () => {
    expect(restAdvantageFactor(2, 4)).toBeLessThan(1);
  });

  it("is symmetric around 1.0", () => {
    const up = restAdvantageFactor(4, 2);
    const down = restAdvantageFactor(2, 4);
    expect(up + down).toBeCloseTo(2, 10);
  });

  it("stays within the [0.92, 1.08] band even at large edges", () => {
    expect(restAdvantageFactor(20, 0)).toBeLessThanOrEqual(1.08);
    expect(restAdvantageFactor(20, 0)).toBeCloseTo(1.08, 10);
    expect(restAdvantageFactor(0, 20)).toBeGreaterThanOrEqual(0.92);
    expect(restAdvantageFactor(0, 20)).toBeCloseTo(0.92, 10);
  });
});

describe("rotationDepthFactor", () => {
  it("is exactly 1.0 (no effect) at neutral depth 0.5", () => {
    expect(rotationDepthFactor(0.5)).toBeCloseTo(1.0, 12);
  });

  it("maps elite depth to the upper bound ~1.03", () => {
    expect(rotationDepthFactor(1)).toBeCloseTo(1.03, 10);
  });

  it("maps thin depth to the lower bound ~0.95", () => {
    expect(rotationDepthFactor(0)).toBeCloseTo(0.95, 10);
  });

  it("increases monotonically with depth", () => {
    const a = rotationDepthFactor(0.1);
    const b = rotationDepthFactor(0.5);
    const c = rotationDepthFactor(0.9);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("clamps out-of-range inputs", () => {
    expect(rotationDepthFactor(-5)).toBeCloseTo(0.95, 10);
    expect(rotationDepthFactor(5)).toBeCloseTo(1.03, 10);
  });

  it("stays within ~[0.95, 1.03]", () => {
    for (const d of [0, 0.25, 0.5, 0.75, 1]) {
      const f = rotationDepthFactor(d);
      expect(f).toBeGreaterThanOrEqual(0.95);
      expect(f).toBeLessThanOrEqual(1.03);
    }
  });
});

describe("combineFactors", () => {
  it("is 1.0 (identity) with no factors", () => {
    expect(combineFactors()).toBe(1.0);
  });

  it("returns a single factor unchanged", () => {
    expect(combineFactors(1.25)).toBe(1.25);
  });

  it("multiplies factors together", () => {
    // 1.1 * 0.9 = 0.99
    expect(combineFactors(1.1, 0.9)).toBeCloseTo(0.99, 10);
  });

  it("composes several factors", () => {
    expect(combineFactors(1.1, 0.9, 1.05)).toBeCloseTo(1.1 * 0.9 * 1.05, 10);
  });
});

describe("applyToLambda", () => {
  it("returns base λ unchanged with no factors", () => {
    expect(applyToLambda(1.5)).toBe(1.5);
  });

  it("returns base λ unchanged when factors are all 1.0", () => {
    expect(applyToLambda(1.5, 1.0, 1.0)).toBe(1.5);
  });

  it("scales λ by a single factor", () => {
    // 1.5 * 1.1 = 1.65
    expect(applyToLambda(1.5, 1.1)).toBeCloseTo(1.65, 10);
  });

  it("scales λ by the product of several contextual factors", () => {
    const base = 1.4;
    const home = namedVenueHomeAdvantage("mexico-city"); // 1.25
    const heat = heatPenaltyFactor(33); // 0.95
    const expected = base * 1.25 * 0.95;
    expect(applyToLambda(base, home, heat)).toBeCloseTo(expected, 10);
  });
});
