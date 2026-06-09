import { describe, expect, it } from "vitest";
import type { OneXTwo } from "./types.js";
import {
  linearPool,
  logarithmicOpinionPool,
  logOpinionPoolOneXTwo,
} from "./ensemble.js";

describe("linearPool", () => {
  it("is the weighted arithmetic mean", () => {
    // equal weights: (0.6 + 0.8) / 2 = 0.7
    expect(linearPool([0.6, 0.8], [1, 1])).toBeCloseTo(0.7, 12);
  });

  it("respects unequal weights", () => {
    // (3*0.6 + 1*0.8) / 4 = (1.8 + 0.8)/4 = 0.65
    expect(linearPool([0.6, 0.8], [3, 1])).toBeCloseTo(0.65, 12);
  });

  it("falls back to 0.5 when weights sum to zero", () => {
    expect(linearPool([0.6, 0.8], [0, 0])).toBeCloseTo(0.5, 12);
  });
});

describe("logarithmicOpinionPool", () => {
  it("returns the common value when models agree", () => {
    expect(logarithmicOpinionPool([0.6, 0.6], [1, 1])).toBeCloseTo(0.6, 12);
  });

  it("matches the hand-computed geometric-mean value", () => {
    // weights normalise to [0.5, 0.5]
    // num = 0.8^0.5 * 0.5^0.5 = sqrt(0.4) = 0.6324555
    // den = num + 0.2^0.5 * 0.5^0.5 = num + sqrt(0.1) = num + 0.3162278
    // pool = sqrt(0.4) / (sqrt(0.4) + sqrt(0.1)) = 2/3 = 0.666667
    expect(logarithmicOpinionPool([0.8, 0.5], [1, 1])).toBeCloseTo(0.6667, 4);
    expect(logarithmicOpinionPool([0.8, 0.5], [1, 1])).toBeCloseTo(2 / 3, 12);
  });

  it("is sharper than the linear pool for confident agreement", () => {
    // both models say 0.9 -> log pool returns 0.9 (agreement is preserved)
    expect(logarithmicOpinionPool([0.9, 0.9], [2, 5])).toBeCloseTo(0.9, 12);
  });
});

describe("logOpinionPoolOneXTwo", () => {
  it("returns the shared triple when all models agree", () => {
    const triple: OneXTwo = { home: 0.5, draw: 0.3, away: 0.2 };
    const out = logOpinionPoolOneXTwo([triple, triple], [1, 1]);
    expect(out.home).toBeCloseTo(0.5, 12);
    expect(out.draw).toBeCloseTo(0.3, 12);
    expect(out.away).toBeCloseTo(0.2, 12);
  });

  it("always returns a normalised triple", () => {
    const a: OneXTwo = { home: 0.5, draw: 0.3, away: 0.2 };
    const b: OneXTwo = { home: 0.4, draw: 0.35, away: 0.25 };
    const out = logOpinionPoolOneXTwo([a, b], [1, 2]);
    expect(out.home + out.draw + out.away).toBeCloseTo(1, 12);
  });
});
