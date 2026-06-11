import { describe, expect, it } from "vitest";
import {
  fitGradientBoosting,
  predictGradientBoosting,
} from "./gradient-boosting.js";

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

/** Build a 1-D dataset of (x, f(x)) over an evenly spaced grid on [0, 1]. */
function grid(count: number, f: (x: number) => number): {
  X: number[][];
  y: number[];
} {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = i / (count - 1);
    X.push([x]);
    y.push(f(x));
  }
  return { X, y };
}

describe("fitGradientBoosting / predictGradientBoosting", () => {
  it("monotonically decreases training MSE across rounds on y = sin(2πx)", () => {
    const { X, y } = grid(40, (x) => Math.sin(2 * Math.PI * x));

    const oneRound = fitGradientBoosting(X, y, {
      nRounds: 1,
      learningRate: 0.3,
      maxDepth: 3,
    });
    const manyRounds = fitGradientBoosting(X, y, {
      nRounds: 60,
      learningRate: 0.3,
      maxDepth: 3,
    });

    const mse1 = mse(X, y, (x) => predictGradientBoosting(oneRound, x));
    const mseN = mse(X, y, (x) => predictGradientBoosting(manyRounds, x));
    expect(mseN).toBeLessThan(mse1);
  });

  it("final MSE beats the mean-only baseline on y = x^2", () => {
    const { X, y } = grid(40, (x) => x * x);
    const model = fitGradientBoosting(X, y, {
      nRounds: 50,
      learningRate: 0.2,
      maxDepth: 2,
    });

    const baseMean = y.reduce((s, v) => s + v, 0) / y.length;
    const baselineMse = mse(X, y, () => baseMean);
    const modelMse = mse(X, y, (x) => predictGradientBoosting(model, x));
    expect(modelMse).toBeLessThan(baselineMse);
  });

  it("base prediction equals the target mean (single round, lr→0 limit aside)", () => {
    const { X, y } = grid(20, (x) => 5 + 3 * x);
    const model = fitGradientBoosting(X, y, { nRounds: 0 });
    const targetMean = y.reduce((s, v) => s + v, 0) / y.length;
    // With zero rounds the model is exactly the base mean.
    expect(model.base).toBeCloseTo(targetMean, 12);
    expect(predictGradientBoosting(model, [0.5])).toBeCloseTo(targetMean, 12);
  });

  it("is deterministic and finite", () => {
    const { X, y } = grid(30, (x) => Math.cos(3 * x));
    const a = fitGradientBoosting(X, y, { nRounds: 20 });
    const b = fitGradientBoosting(X, y, { nRounds: 20 });
    const pa = predictGradientBoosting(a, [0.42]);
    const pb = predictGradientBoosting(b, [0.42]);
    expect(pa).toBe(pb);
    expect(Number.isFinite(pa)).toBe(true);
  });

  it("does not mutate the input arrays", () => {
    const { X, y } = grid(16, (x) => x * x);
    const xSnapshot = JSON.stringify(X);
    const ySnapshot = JSON.stringify(y);
    fitGradientBoosting(X, y, { nRounds: 10 });
    expect(JSON.stringify(X)).toBe(xSnapshot);
    expect(JSON.stringify(y)).toBe(ySnapshot);
  });
});
