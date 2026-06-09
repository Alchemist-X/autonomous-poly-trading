import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng.js";
import {
  fitLogisticRegression,
  predictLabel,
  predictProbability,
} from "./logistic-regression.js";

/** Build a linearly separable 2D dataset split by the line x0 + x1 = 1. */
function separableDataset(count: number, rng: () => number): {
  X: number[][];
  y: (0 | 1)[];
} {
  const X: number[][] = [];
  const y: (0 | 1)[] = [];
  for (let i = 0; i < count; i += 1) {
    const x0 = rng() * 2 - 1; // [-1, 1)
    const x1 = rng() * 2 - 1;
    // Margin band removed so the classes are cleanly separable.
    const score = x0 + x1;
    if (Math.abs(score) < 0.15) continue;
    X.push([x0, x1]);
    y.push(score > 0 ? 1 : 0);
  }
  return { X, y };
}

describe("fitLogisticRegression", () => {
  it("achieves >0.95 training accuracy on a linearly separable set", () => {
    const rng = mulberry32(2026);
    const { X, y } = separableDataset(200, rng);
    const model = fitLogisticRegression(X, y, {
      learningRate: 0.5,
      epochs: 800,
    });

    let correct = 0;
    for (let i = 0; i < X.length; i += 1) {
      if (predictLabel(model, X[i] ?? []) === (y[i] ?? 0)) correct += 1;
    }
    const accuracy = correct / X.length;
    expect(accuracy).toBeGreaterThan(0.95);
  });

  it("produces probabilities strictly inside (0, 1) and finite weights", () => {
    const rng = mulberry32(11);
    const { X, y } = separableDataset(120, rng);
    const model = fitLogisticRegression(X, y, { epochs: 300 });

    for (const x of X) {
      const p = predictProbability(model, x);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
    for (const w of model.weights) expect(Number.isFinite(w)).toBe(true);
    expect(Number.isFinite(model.bias)).toBe(true);
  });

  it("learns the correct sign of the decision boundary", () => {
    const rng = mulberry32(303);
    const { X, y } = separableDataset(150, rng);
    const model = fitLogisticRegression(X, y, {
      learningRate: 0.5,
      epochs: 600,
    });
    // Deep in the positive region -> high probability; negative region -> low.
    expect(predictProbability(model, [0.9, 0.9])).toBeGreaterThan(0.8);
    expect(predictProbability(model, [-0.9, -0.9])).toBeLessThan(0.2);
    expect(predictLabel(model, [0.9, 0.9])).toBe(1);
    expect(predictLabel(model, [-0.9, -0.9])).toBe(0);
  });

  it("honours a custom decision threshold", () => {
    const rng = mulberry32(77);
    const { X, y } = separableDataset(100, rng);
    const model = fitLogisticRegression(X, y, { epochs: 400 });
    const x: number[] = [0.05, 0.05]; // near the boundary -> p near 0.5
    const p = predictProbability(model, x);
    expect(predictLabel(model, x, 0.99)).toBe(p >= 0.99 ? 1 : 0);
    expect(predictLabel(model, x, 0.01)).toBe(p >= 0.01 ? 1 : 0);
  });

  it("is deterministic for the same data and options", () => {
    const { X, y } = separableDataset(80, mulberry32(5));
    const a = fitLogisticRegression(X, y, { epochs: 100 });
    const b = fitLogisticRegression(X, y, { epochs: 100 });
    expect(a.bias).toBe(b.bias);
    expect(a.weights).toEqual(b.weights);
  });

  it("does not mutate the input arrays", () => {
    const X = [[1, 1], [-1, -1], [0.8, 0.9], [-0.8, -0.9]];
    const y: (0 | 1)[] = [1, 0, 1, 0];
    const xSnapshot = JSON.stringify(X);
    const ySnapshot = JSON.stringify(y);
    fitLogisticRegression(X, y, { epochs: 50 });
    expect(JSON.stringify(X)).toBe(xSnapshot);
    expect(JSON.stringify(y)).toBe(ySnapshot);
  });
});
