import { describe, expect, it } from "vitest";
import {
  dixonColesScoreMatrix,
  dixonColesTau,
  timeDecayWeight,
} from "./dixon-coles.js";
import { outcomeProbabilities, scoreMatrix } from "./poisson.js";

describe("dixonColesTau", () => {
  const lh = 1.3;
  const la = 1.1;
  const rho = -0.05;

  it("matches the four hand-computed low-score corrections", () => {
    // tau(0,0) = 1 - lh*la*rho = 1 - 1.3*1.1*(-0.05) = 1 + 0.0715 = 1.0715
    expect(dixonColesTau(0, 0, lh, la, rho)).toBeCloseTo(1.0715, 12);
    // tau(0,1) = 1 + lh*rho = 1 + 1.3*(-0.05) = 0.935
    expect(dixonColesTau(0, 1, lh, la, rho)).toBeCloseTo(0.935, 12);
    // tau(1,0) = 1 + la*rho = 1 + 1.1*(-0.05) = 0.945
    expect(dixonColesTau(1, 0, lh, la, rho)).toBeCloseTo(0.945, 12);
    // tau(1,1) = 1 - rho = 1 - (-0.05) = 1.05
    expect(dixonColesTau(1, 1, lh, la, rho)).toBeCloseTo(1.05, 12);
  });

  it("returns exactly 1 for any cell outside the four low-score cells", () => {
    expect(dixonColesTau(2, 3, lh, la, rho)).toBe(1);
    expect(dixonColesTau(0, 2, lh, la, rho)).toBe(1);
    expect(dixonColesTau(2, 0, lh, la, rho)).toBe(1);
    expect(dixonColesTau(5, 5, lh, la, rho)).toBe(1);
  });
});

describe("dixonColesScoreMatrix", () => {
  it("renormalises so the whole matrix sums to ~1", () => {
    const m = dixonColesScoreMatrix({ home: 1.4, away: 1.2 }, -0.05, 12);
    let sum = 0;
    for (const row of m) for (const p of row) sum += p;
    expect(sum).toBeCloseTo(1, 12);
  });

  it("KEY: inflates the draw probability above plain Poisson (rho < 0)", () => {
    const goals = { home: 1.3, away: 1.1 };
    const dc = outcomeProbabilities(
      dixonColesScoreMatrix(goals, -0.05, 15),
    );
    const plain = outcomeProbabilities(scoreMatrix(goals, 15));
    expect(dc.draw).toBeGreaterThan(plain.draw);
  });

  it("collapses to plain Poisson when rho = 0", () => {
    // With rho=0 tau is identically 1, so the D-C matrix is the plain Poisson
    // matrix up to the renormalisation that absorbs the truncated tail (~1e-5
    // of mass), hence agreement to ~9 decimals rather than machine precision.
    const goals = { home: 1.6, away: 1.0 };
    const dc = dixonColesScoreMatrix(goals, 0, 12);
    const plain = scoreMatrix(goals, 12);
    for (let h = 0; h < dc.length; h += 1) {
      for (let a = 0; a < dc.length; a += 1) {
        expect(dc[h]?.[a]).toBeCloseTo(plain[h]?.[a] ?? 0, 8);
      }
    }
  });
});

describe("timeDecayWeight", () => {
  it("is exactly 1 for a match played today", () => {
    expect(timeDecayWeight(0)).toBe(1);
  });

  it("is strictly decreasing in age", () => {
    const w0 = timeDecayWeight(0);
    const w100 = timeDecayWeight(100);
    const w365 = timeDecayWeight(365);
    expect(w100).toBeLessThan(w0);
    expect(w365).toBeLessThan(w100);
  });

  it("gives a ~2-year half-life at the default xi", () => {
    // exp(-0.00095 * 730) ≈ 0.4998
    expect(timeDecayWeight(730)).toBeCloseTo(0.5, 2);
  });

  it("clamps negative ages to weight 1", () => {
    expect(timeDecayWeight(-50)).toBe(1);
  });
});
