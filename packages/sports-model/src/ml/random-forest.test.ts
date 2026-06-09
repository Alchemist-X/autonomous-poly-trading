import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng.js";
import { fitRandomForest, predictForest } from "./random-forest.js";

/** Population variance of a numeric array (the constant-mean baseline MSE). */
function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  let sse = 0;
  for (const v of values) {
    const d = v - m;
    sse += d * d;
  }
  return sse / values.length;
}

/** MSE of `predict` over the (X, y) dataset. */
function mse(
  X: number[][],
  y: number[],
  predict: (x: number[]) => number,
): number {
  let sum = 0;
  for (let i = 0; i < X.length; i += 1) {
    const d = (y[i] ?? 0) - predict(X[i] ?? []);
    sum += d * d;
  }
  return sum / X.length;
}

describe("fitRandomForest / predictForest", () => {
  it("beats the constant-mean baseline on a noisy linear-ish dataset", () => {
    const rng = mulberry32(12345);
    // Build train + test from y = 2*x0 - x1 + small noise.
    const make = (count: number, r: () => number) => {
      const X: number[][] = [];
      const y: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const x0 = r();
        const x1 = r();
        const noise = (r() - 0.5) * 0.1;
        X.push([x0, x1]);
        y.push(2 * x0 - x1 + noise);
      }
      return { X, y };
    };
    const train = make(120, rng);
    const test = make(60, rng);

    const forest = fitRandomForest(
      train.X,
      train.y,
      { nTrees: 25, maxDepth: 6, featureSubsample: 1 },
      mulberry32(999),
    );

    const testMse = mse(test.X, test.y, (x) => predictForest(forest, x));
    const baseline = variance(test.y);
    expect(testMse).toBeLessThan(baseline);
  });

  it("returns the constant when all targets are identical", () => {
    const X = [[0.1, 0.9], [0.4, 0.2], [0.7, 0.5], [0.3, 0.8], [0.6, 0.1]];
    const y = [3, 3, 3, 3, 3];
    const forest = fitRandomForest(
      X,
      y,
      { nTrees: 10, maxDepth: 4 },
      mulberry32(7),
    );
    expect(predictForest(forest, [0.5, 0.5])).toBeCloseTo(3, 12);
    expect(predictForest(forest, [0.9, 0.1])).toBeCloseTo(3, 12);
  });

  it("is deterministic for a fixed seed", () => {
    const X = [[0.1], [0.4], [0.7], [0.2], [0.9], [0.5]];
    const y = [0.2, 0.8, 1.4, 0.4, 1.8, 1.0];
    const a = fitRandomForest(X, y, { nTrees: 8 }, mulberry32(42));
    const b = fitRandomForest(X, y, { nTrees: 8 }, mulberry32(42));
    expect(predictForest(a, [0.6])).toBe(predictForest(b, [0.6]));
  });

  it("respects feature subsampling without crashing", () => {
    const rng = mulberry32(2024);
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const f = [rng(), rng(), rng(), rng()];
      X.push(f);
      y.push((f[0] ?? 0) * 3);
    }
    const forest = fitRandomForest(
      X,
      y,
      { nTrees: 15, featureSubsample: 0.5 },
      mulberry32(5),
    );
    expect(forest.trees.length).toBe(15);
    expect(Number.isFinite(predictForest(forest, [0.5, 0.5, 0.5, 0.5]))).toBe(
      true,
    );
  });

  it("does not mutate input rows", () => {
    const X = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]];
    const y = [1, 2, 3, 4];
    const snapshot = JSON.stringify(X);
    fitRandomForest(X, y, { nTrees: 5 }, mulberry32(1));
    expect(JSON.stringify(X)).toBe(snapshot);
  });
});
