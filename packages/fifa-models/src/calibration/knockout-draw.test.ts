import { describe, it, expect } from "vitest";
import { calibrateKnockoutDraw, knockoutEvenness } from "./knockout-draw.js";
import type { TeamProfile } from "../types.js";

const prof = (elo: number, attackRate: number, lowBlockPct: number): TeamProfile => ({
  team: "T",
  matchesObserved: 3,
  prior: { team: "T", elo, squadValueIndex: null },
  attackRate,
  defenseRate: 1.2,
  possessionPct: 50,
  highPressPct: 20,
  counterAttackPct: 10,
  lowBlockPct,
  lineBreakSuccessPct: 60,
  lb4UnitShare: 0.1,
  offerConversionPct: 50,
  sprintLoadPerMin: 0.2,
  highIntensityShare: 0.1,
  avgHighIntensityKm: 6,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
});

const sum = (p: { home: number; draw: number; away: number }) => p.home + p.draw + p.away;

describe("knockout draw calibration", () => {
  it("lifts the draw more for an even, low-scoring, defensive tie", () => {
    const even = calibrateKnockoutDraw({ home: 0.4, draw: 0.25, away: 0.35 }, prof(1800, 1.0, 30), prof(1810, 1.1, 28));
    expect(even.draw).toBeGreaterThan(0.25);
    expect(even.draw).toBeGreaterThan(0.32); // even tie → meaningful lift
    expect(sum(even)).toBeCloseTo(1, 10);
  });

  it("barely moves a lopsided tie", () => {
    const lop = calibrateKnockoutDraw({ home: 0.7, draw: 0.18, away: 0.12 }, prof(2150, 2.0, 20), prof(1600, 1.0, 18));
    expect(lop.draw).toBeGreaterThan(0.18);
    expect(lop.draw).toBeLessThan(0.24); // small lift only
    expect(sum(lop)).toBeCloseTo(1, 10);
  });

  it("preserves the home:away ratio (who is favoured is untouched)", () => {
    const before = { home: 0.5, draw: 0.2, away: 0.3 };
    const after = calibrateKnockoutDraw(before, prof(1800, 1.2, 30), prof(1790, 1.3, 30));
    expect(after.home / after.away).toBeCloseTo(before.home / before.away, 9);
  });

  it("evenness is in [0,1] and higher for closer teams", () => {
    const close = knockoutEvenness(prof(1800, 1.0, 30), prof(1810, 1.0, 30));
    const far = knockoutEvenness(prof(2200, 2.0, 20), prof(1500, 1.0, 20));
    expect(close).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(0);
    expect(close).toBeLessThanOrEqual(1);
  });

  it("returns the input unchanged on a degenerate draw=1", () => {
    const p = { home: 0, draw: 1, away: 0 };
    expect(calibrateKnockoutDraw(p, prof(1800, 1, 30), prof(1800, 1, 30))).toEqual(p);
  });
});
