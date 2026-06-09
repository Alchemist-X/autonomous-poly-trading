import { describe, expect, it } from "vitest";
import { confidentPick, confidenceTier, doubleChance } from "./decision.js";

describe("confidentPick", () => {
  it("picks the argmax outcome", () => {
    const p = confidentPick({ home: 0.62, draw: 0.23, away: 0.15 });
    expect(p.pick).toBe("home");
    expect(p.probability).toBeCloseTo(0.62, 6);
  });

  it("flags confident only above the threshold", () => {
    expect(confidentPick({ home: 0.62, draw: 0.23, away: 0.15 }).confident).toBe(true);
    expect(confidentPick({ home: 0.45, draw: 0.3, away: 0.25 }).confident).toBe(false);
    expect(confidentPick({ home: 0.45, draw: 0.3, away: 0.25 }, { threshold: 0.4 }).confident).toBe(true);
  });

  it("assigns tiers", () => {
    expect(confidenceTier(0.7)).toBe("high");
    expect(confidenceTier(0.55)).toBe("medium");
    expect(confidenceTier(0.4)).toBe("low");
  });
});

describe("doubleChance", () => {
  it("sums the two component outcomes", () => {
    const dc = doubleChance({ home: 0.5, draw: 0.3, away: 0.2 });
    expect(dc.homeOrDraw).toBeCloseTo(0.8, 6);
    expect(dc.awayOrDraw).toBeCloseTo(0.5, 6);
    expect(dc.homeOrAway).toBeCloseTo(0.7, 6);
  });
});
