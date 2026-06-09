import { describe, expect, it } from "vitest";
import {
  bivariatePoissonPmf,
  bivariateScoreMatrix,
} from "./bivariate-poisson.js";
import { poissonPmf, scoreMatrix } from "./poisson.js";

describe("bivariatePoissonPmf", () => {
  it("reduces to the product of marginals when l3 = 0", () => {
    // Independent: P(2,3) = poissonPmf(2, l1) * poissonPmf(3, l2)
    const got = bivariatePoissonPmf(2, 3, 1.6, 1.2, 0);
    const want = poissonPmf(2, 1.6) * poissonPmf(3, 1.2);
    expect(got).toBeCloseTo(want, 12);
  });

  it("matches a hand-computed value for P(1,1) with l3 > 0", () => {
    // l1=1.3 l2=0.9 l3=0.3
    // prefix = e^(-2.5) * (1.3^1/1!) * (0.9^1/1!) = 0.082085 * 1.3 * 0.9
    // sum_{k=0}^{1} = C(1,0)C(1,0)0!*r^0 + C(1,1)C(1,1)1!*r^1, r = 0.3/(1.3*0.9)
    //   = 1 + 0.256410... = 1.256410...
    const got = bivariatePoissonPmf(1, 1, 1.3, 0.9, 0.3);
    const prefix = Math.exp(-2.5) * 1.3 * 0.9;
    const ratio = 0.3 / (1.3 * 0.9);
    const sum = 1 + ratio;
    expect(got).toBeCloseTo(prefix * sum, 12);
  });

  it("forms a valid distribution summing to ~1", () => {
    const l1 = 1.3;
    const l2 = 0.9;
    const l3 = 0.3;
    let sum = 0;
    for (let x = 0; x <= 25; x += 1) {
      for (let y = 0; y <= 25; y += 1) {
        sum += bivariatePoissonPmf(x, y, l1, l2, l3);
      }
    }
    expect(sum).toBeCloseTo(1, 9);
  });

  it("has the advertised marginals E[X]=l1+l3, E[Y]=l2+l3", () => {
    const l1 = 1.3;
    const l2 = 0.9;
    const l3 = 0.3;
    let ex = 0;
    let ey = 0;
    for (let x = 0; x <= 30; x += 1) {
      for (let y = 0; y <= 30; y += 1) {
        const p = bivariatePoissonPmf(x, y, l1, l2, l3);
        ex += x * p;
        ey += y * p;
      }
    }
    expect(ex).toBeCloseTo(l1 + l3, 6);
    expect(ey).toBeCloseTo(l2 + l3, 6);
  });

  it("rejects invalid inputs with 0", () => {
    expect(bivariatePoissonPmf(-1, 0, 1, 1, 0.1)).toBe(0);
    expect(bivariatePoissonPmf(0, 1.5, 1, 1, 0.1)).toBe(0);
    expect(bivariatePoissonPmf(0, 0, -1, 1, 0.1)).toBe(0);
  });
});

describe("bivariateScoreMatrix", () => {
  it("KEY: equals the independent scoreMatrix elementwise when covariance = 0", () => {
    const goals = { home: 1.6, away: 1.2 };
    const biv = bivariateScoreMatrix(goals, 0, 10);
    const indep = scoreMatrix(goals, 10);
    for (let x = 0; x < biv.length; x += 1) {
      for (let y = 0; y < biv.length; y += 1) {
        expect(biv[x]?.[y]).toBeCloseTo(indep[x]?.[y] ?? 0, 9);
      }
    }
  });

  it("sums to ~1", () => {
    const m = bivariateScoreMatrix({ home: 1.6, away: 1.2 }, 0.3, 15);
    let sum = 0;
    for (const row of m) for (const p of row) sum += p;
    expect(sum).toBeCloseTo(1, 9);
  });

  it("positive covariance raises P(1,1) versus covariance 0", () => {
    const goals = { home: 1.6, away: 1.2 };
    const indep = bivariateScoreMatrix(goals, 0, 12);
    const coupled = bivariateScoreMatrix(goals, 0.3, 12);
    expect(coupled[1]?.[1] ?? 0).toBeGreaterThan(indep[1]?.[1] ?? 0);
  });

  it("clamps an infeasible covariance instead of producing garbage", () => {
    // covariance 5 exceeds both means; should clamp and still sum to ~1.
    const m = bivariateScoreMatrix({ home: 1.0, away: 0.8 }, 5, 15);
    let sum = 0;
    for (const row of m) for (const p of row) sum += p;
    expect(sum).toBeCloseTo(1, 6);
    for (const row of m) for (const p of row) expect(p).toBeGreaterThanOrEqual(0);
  });

  it("falls back to independence when a side has zero expected goals", () => {
    const goals = { home: 1.5, away: 0 };
    const biv = bivariateScoreMatrix(goals, 0.2, 10);
    const indep = scoreMatrix(goals, 10);
    expect(biv[2]?.[0]).toBeCloseTo(indep[2]?.[0] ?? 0, 9);
  });
});
