import { describe, expect, it } from "vitest";
import {
  devigNormalize,
  devigPower,
  edgeSignal,
  impliedProbabilityFromDecimal,
  overround,
} from "./market.js";

describe("impliedProbabilityFromDecimal", () => {
  it("is the reciprocal of the decimal odds", () => {
    expect(impliedProbabilityFromDecimal(2.0)).toBeCloseTo(0.5, 12);
    expect(impliedProbabilityFromDecimal(4.0)).toBeCloseTo(0.25, 12);
    expect(impliedProbabilityFromDecimal(1.25)).toBeCloseTo(0.8, 12);
  });

  it("returns 0 for invalid odds", () => {
    expect(impliedProbabilityFromDecimal(0)).toBe(0);
    expect(impliedProbabilityFromDecimal(-2)).toBe(0);
  });
});

describe("overround", () => {
  it("is the sum of probabilities minus one", () => {
    // 0.6 + 0.25 + 0.25 = 1.1 -> overround 0.1
    expect(overround([0.6, 0.25, 0.25])).toBeCloseTo(0.1, 12);
  });

  it("is ~0 for a fair book", () => {
    expect(overround([0.5, 0.5])).toBeCloseTo(0, 12);
  });
});

describe("devigNormalize", () => {
  it("rescales probabilities to sum to 1", () => {
    const out = devigNormalize([0.6, 0.25, 0.25]);
    const sum = out.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("preserves the ratios between outcomes", () => {
    const out = devigNormalize([0.6, 0.25, 0.25]);
    // input ratio 0.6 / 0.25 = 2.4 must be preserved
    expect((out[0] ?? 0) / (out[1] ?? 1)).toBeCloseTo(2.4, 12);
    // and each value = p / 1.1
    expect(out[0]).toBeCloseTo(0.6 / 1.1, 12);
    expect(out[1]).toBeCloseTo(0.25 / 1.1, 12);
  });
});

describe("devigPower", () => {
  it("produces probabilities that sum to ~1", () => {
    const out = devigPower([0.6, 0.25, 0.25]);
    const sum = out.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("equals the identity when the book is already fair", () => {
    // already sums to 1 -> exponent k = 1 -> values unchanged
    const out = devigPower([0.5, 0.3, 0.2]);
    expect(out[0]).toBeCloseTo(0.5, 6);
    expect(out[1]).toBeCloseTo(0.3, 6);
    expect(out[2]).toBeCloseTo(0.2, 6);
  });
});

describe("edgeSignal", () => {
  it("is the signed model-minus-market deviation", () => {
    expect(edgeSignal(0.55, 0.5)).toBeCloseTo(0.05, 12);
    expect(edgeSignal(0.4, 0.5)).toBeCloseTo(-0.1, 12);
  });
});
