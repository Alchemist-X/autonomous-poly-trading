import { describe, expect, it } from "vitest";
import { mulberry32, randInt, sampleCategorical } from "./rng.js";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("has an approximately uniform mean", () => {
    const rng = mulberry32(123);
    let sum = 0;
    const n = 50000;
    for (let i = 0; i < n; i += 1) sum += rng();
    expect(sum / n).toBeCloseTo(0.5, 1);
  });
});

describe("sampleCategorical", () => {
  it("respects the distribution over many draws", () => {
    const rng = mulberry32(99);
    const weights = [0.2, 0.5, 0.3];
    const counts = [0, 0, 0];
    const n = 60000;
    for (let i = 0; i < n; i += 1) counts[sampleCategorical(rng, weights)]! += 1;
    expect(counts[0]! / n).toBeCloseTo(0.2, 1);
    expect(counts[1]! / n).toBeCloseTo(0.5, 1);
    expect(counts[2]! / n).toBeCloseTo(0.3, 1);
  });

  it("randInt stays in range", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 500; i += 1) {
      const v = randInt(rng, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
});
