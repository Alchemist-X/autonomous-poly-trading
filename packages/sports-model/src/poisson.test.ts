import { describe, expect, it } from "vitest";
import {
  bothTeamsToScore,
  mostLikelyScores,
  outcomeProbabilities,
  overUnderProbabilities,
  poissonPmf,
  scoreMatrix,
} from "./poisson.js";

describe("poissonPmf", () => {
  it("matches the textbook value P(0; 1) = e^-1", () => {
    // e^(-1) * 1^0 / 0! = e^(-1) = 0.367879441...
    expect(poissonPmf(0, 1)).toBeCloseTo(0.36787944, 7);
  });

  it("matches a hand-computed value P(2; 1.5)", () => {
    // e^(-1.5) * 1.5^2 / 2! = 0.22313016 * 2.25 / 2 = 0.25102143...
    expect(poissonPmf(2, 1.5)).toBeCloseTo(0.25102143, 7);
  });

  it("matches a hand-computed value P(3; 2)", () => {
    // e^(-2) * 2^3 / 3! = 0.13533528 * 8 / 6 = 0.18044704...
    expect(poissonPmf(3, 2)).toBeCloseTo(0.18044704, 7);
  });

  it("returns 1 at k=0 when lambda=0 and 0 otherwise", () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(1, 0)).toBe(0);
  });

  it("rejects invalid inputs with 0", () => {
    expect(poissonPmf(-1, 1)).toBe(0);
    expect(poissonPmf(1.5, 1)).toBe(0);
    expect(poissonPmf(1, -1)).toBe(0);
    expect(poissonPmf(NaN, 1)).toBe(0);
  });

  it("each lambda forms a valid distribution summing to ~1", () => {
    for (const lambda of [0.5, 1.3, 2.7]) {
      let sum = 0;
      for (let k = 0; k <= 30; k += 1) sum += poissonPmf(k, lambda);
      expect(sum).toBeCloseTo(1, 9);
    }
  });
});

describe("scoreMatrix", () => {
  it("produces a square (maxGoals+1) grid", () => {
    const m = scoreMatrix({ home: 1.4, away: 1.1 }, 6);
    expect(m).toHaveLength(7);
    for (const row of m) expect(row).toHaveLength(7);
  });

  it("each row h sums to ~poissonPmf(h, lambda_home)", () => {
    const lambdaHome = 1.6;
    const m = scoreMatrix({ home: lambdaHome, away: 1.2 }, 12);
    for (let h = 0; h <= 6; h += 1) {
      const rowSum = (m[h] ?? []).reduce((s, p) => s + p, 0);
      // sum_a P(h)*P(a) = P(h) * sum_a P(a) ≈ P(h) * 1
      expect(rowSum).toBeCloseTo(poissonPmf(h, lambdaHome), 6);
    }
  });

  it("the whole matrix sums to ~1 for a generous maxGoals", () => {
    const m = scoreMatrix({ home: 1.7, away: 1.3 }, 15);
    let sum = 0;
    for (const row of m) for (const p of row) sum += p;
    expect(sum).toBeCloseTo(1, 6);
  });

  it("cell equals the product of the two marginal pmfs", () => {
    const m = scoreMatrix({ home: 2.0, away: 0.8 }, 10);
    expect(m[2]?.[1]).toBeCloseTo(poissonPmf(2, 2.0) * poissonPmf(1, 0.8), 12);
  });
});

describe("outcomeProbabilities", () => {
  it("yields home ~ away when the two lambdas are equal", () => {
    const m = scoreMatrix({ home: 1.3, away: 1.3 }, 12);
    const o = outcomeProbabilities(m);
    expect(o.home).toBeCloseTo(o.away, 9);
  });

  it("sums to 1", () => {
    const m = scoreMatrix({ home: 1.8, away: 0.9 }, 12);
    const o = outcomeProbabilities(m);
    expect(o.home + o.draw + o.away).toBeCloseTo(1, 12);
  });

  it("favours the stronger side", () => {
    const m = scoreMatrix({ home: 2.2, away: 0.7 }, 12);
    const o = outcomeProbabilities(m);
    expect(o.home).toBeGreaterThan(o.away);
  });
});

describe("overUnderProbabilities", () => {
  it("over + under sums to 1 for a half-integer line", () => {
    const m = scoreMatrix({ home: 1.5, away: 1.2 }, 12);
    const ou = overUnderProbabilities(m, 2.5);
    expect(ou.over + ou.under).toBeCloseTo(1, 12);
  });

  it("a higher line lowers the over probability", () => {
    const m = scoreMatrix({ home: 1.5, away: 1.2 }, 12);
    const low = overUnderProbabilities(m, 1.5);
    const high = overUnderProbabilities(m, 3.5);
    expect(high.over).toBeLessThan(low.over);
  });
});

describe("bothTeamsToScore", () => {
  it("yes + no sums to 1", () => {
    const m = scoreMatrix({ home: 1.4, away: 1.1 }, 12);
    const btts = bothTeamsToScore(m);
    expect(btts.yes + btts.no).toBeCloseTo(1, 12);
  });

  it("matches the closed form yes = (1 - e^-lh)(1 - e^-la)", () => {
    const lh = 1.4;
    const la = 1.1;
    const m = scoreMatrix({ home: lh, away: la }, 15);
    const btts = bothTeamsToScore(m);
    const expected = (1 - Math.exp(-lh)) * (1 - Math.exp(-la));
    expect(btts.yes).toBeCloseTo(expected, 6);
  });
});

describe("mostLikelyScores", () => {
  it("returns topN entries sorted descending by probability", () => {
    const m = scoreMatrix({ home: 1.5, away: 1.2 }, 10);
    const top = mostLikelyScores(m, 5);
    expect(top).toHaveLength(5);
    for (let i = 1; i < top.length; i += 1) {
      expect(top[i - 1]!.prob).toBeGreaterThanOrEqual(top[i]!.prob);
    }
  });

  it("the modal scoreline for lambda<1 each side is 0-0", () => {
    const m = scoreMatrix({ home: 0.8, away: 0.7 }, 10);
    const top = mostLikelyScores(m, 1);
    expect(top[0]).toMatchObject({ home: 0, away: 0 });
  });
});
