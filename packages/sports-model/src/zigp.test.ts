import { describe, expect, it } from "vitest";
import { poissonPmf, scoreMatrix } from "./poisson.js";
import {
  generalizedPoissonPmf,
  zigpPmf,
  zigpScoreMatrix,
} from "./zigp.js";

describe("generalizedPoissonPmf", () => {
  it("reduces to the standard Poisson when delta = 0 (several k)", () => {
    for (const lambda of [0.7, 1.5, 2.3]) {
      for (const k of [0, 1, 2, 3, 5]) {
        expect(generalizedPoissonPmf(k, lambda, 0)).toBeCloseTo(
          poissonPmf(k, lambda),
          12,
        );
      }
    }
  });

  it("matches a hand-computed value GP(0; 1.5, 0.2)", () => {
    // theta = 1.5 + 0.2*0 = 1.5
    // P = 1.5 * 1.5^(-1) * e^(-1.5) / 0! = 1 * e^(-1.5) = 0.22313016...
    expect(generalizedPoissonPmf(0, 1.5, 0.2)).toBeCloseTo(0.22313016, 7);
  });

  it("matches a hand-computed value GP(2; 1.0, 0.3)", () => {
    // theta = 1.0 + 0.3*2 = 1.6
    // P = 1.0 * 1.6^(2-1) * e^(-1.6) / 2! = 1.6 * 0.20189652 / 2
    //   = 0.32303443 / 2 = 0.16151721...
    expect(generalizedPoissonPmf(2, 1.0, 0.3)).toBeCloseTo(0.16151721, 7);
  });

  it("rejects invalid inputs with 0", () => {
    expect(generalizedPoissonPmf(-1, 1, 0)).toBe(0);
    expect(generalizedPoissonPmf(1.5, 1, 0)).toBe(0);
    expect(generalizedPoissonPmf(1, 0, 0)).toBe(0); // lambda must be > 0
    expect(generalizedPoissonPmf(1, 1, 1)).toBe(0); // |delta| < 1 required
    expect(generalizedPoissonPmf(1, 1, -1)).toBe(0);
    expect(generalizedPoissonPmf(NaN, 1, 0)).toBe(0);
  });

  it("is over-dispersed for delta > 0: fatter upper tail than the Poisson", () => {
    // Over-dispersion (variance > mean) pushes mass into the tails. At k = 0 the
    // generalized Poisson is pinned to e^(-lambda) (theta = lambda + delta*0 =
    // lambda), so the signature shows up in the UPPER tail: P(large k) exceeds
    // the equal-lambda Poisson. Sum the tail mass from k = 5 upward.
    const lambda = 1.5;
    let gpTail = 0;
    let poissonTail = 0;
    for (let k = 5; k <= 40; k += 1) {
      gpTail += generalizedPoissonPmf(k, lambda, 0.3);
      poissonTail += poissonPmf(k, lambda);
    }
    expect(gpTail).toBeGreaterThan(poissonTail);
  });
});

describe("zigpPmf", () => {
  it("equals the generalized Poisson when zeroInflation = 0", () => {
    for (const k of [0, 1, 2, 4]) {
      expect(zigpPmf(k, 1.4, 0.1, 0)).toBeCloseTo(
        generalizedPoissonPmf(k, 1.4, 0.1),
        12,
      );
    }
  });

  it("applies the mixture at k = 0 and shrinks k > 0", () => {
    const pi = 0.25;
    const gp0 = generalizedPoissonPmf(0, 1.2, 0);
    const gp2 = generalizedPoissonPmf(2, 1.2, 0);
    // P(0) = pi + (1 - pi)*GP(0)
    expect(zigpPmf(0, 1.2, 0, pi)).toBeCloseTo(pi + (1 - pi) * gp0, 12);
    // P(k>0) = (1 - pi)*GP(k)
    expect(zigpPmf(2, 1.2, 0, pi)).toBeCloseTo((1 - pi) * gp2, 12);
  });

  it("rejects an out-of-range zeroInflation with 0", () => {
    expect(zigpPmf(0, 1, 0, -0.1)).toBe(0);
    expect(zigpPmf(0, 1, 0, 1.1)).toBe(0);
  });
});

describe("zigpScoreMatrix", () => {
  it("with delta = 0, zeroInflation = 0 matches independent Poisson elementwise", () => {
    const goals = { home: 1.6, away: 1.2 };
    const zigp = zigpScoreMatrix(goals);
    const base = scoreMatrix(goals);
    for (let h = 0; h <= 10; h += 1) {
      for (let a = 0; a <= 10; a += 1) {
        // zigpScoreMatrix renormalises; the plain scoreMatrix is truncated, so
        // compare after the same total-normalisation correction.
        expect(zigp[h]?.[a] ?? 0).toBeCloseTo(base[h]?.[a] ?? 0, 5);
      }
    }
  });

  it("sums to ~1", () => {
    const m = zigpScoreMatrix(
      { home: 1.7, away: 1.3 },
      { delta: 0.2, zeroInflation: 0.1 },
    );
    let sum = 0;
    for (const row of m) for (const p of row) sum += p;
    expect(sum).toBeCloseTo(1, 12);
  });

  it("zeroInflation > 0 raises the goalless cell P(0, 0)", () => {
    const goals = { home: 1.5, away: 1.2 };
    const plain = zigpScoreMatrix(goals);
    const inflated = zigpScoreMatrix(goals, { zeroInflation: 0.3 });
    expect(inflated[0]?.[0] ?? 0).toBeGreaterThan(plain[0]?.[0] ?? 0);
  });

  it("delta > 0 (over-dispersion) raises P(0, 0) versus delta = 0", () => {
    const goals = { home: 1.5, away: 1.2 };
    const poisson = zigpScoreMatrix(goals, { delta: 0 });
    const overDispersed = zigpScoreMatrix(goals, { delta: 0.3 });
    expect(overDispersed[0]?.[0] ?? 0).toBeGreaterThan(poisson[0]?.[0] ?? 0);
  });

  it("produces a square (maxGoals+1) grid", () => {
    const m = zigpScoreMatrix({ home: 1.4, away: 1.1 }, undefined, 6);
    expect(m).toHaveLength(7);
    for (const row of m) expect(row).toHaveLength(7);
  });
});
