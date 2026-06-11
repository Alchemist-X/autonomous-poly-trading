import { describe, expect, it } from "vitest";
import { fitRegressionTree, predictTree } from "./decision-tree.js";

/** Mean squared error of `predict` over the (X, y) dataset. */
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

describe("fitRegressionTree / predictTree", () => {
  it("recovers a step function: y=0 for x<0.5, y=1 otherwise", () => {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const x = i / 20; // 0, 0.05, ... 0.95
      X.push([x]);
      y.push(x < 0.5 ? 0 : 1);
    }
    const tree = fitRegressionTree(X, y, { maxDepth: 4, minSamples: 2 });

    // Predictions are near 0 on the left of the step and near 1 on the right.
    expect(predictTree(tree, [0.1])).toBeCloseTo(0, 6);
    expect(predictTree(tree, [0.3])).toBeCloseTo(0, 6);
    expect(predictTree(tree, [0.7])).toBeCloseTo(1, 6);
    expect(predictTree(tree, [0.9])).toBeCloseTo(1, 6);
  });

  it("achieves ~0 training MSE on the step function with enough depth", () => {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const x = i / 20;
      X.push([x]);
      y.push(x < 0.5 ? 0 : 1);
    }
    const tree = fitRegressionTree(X, y, { maxDepth: 4, minSamples: 2 });
    expect(mse(X, y, (x) => predictTree(tree, x))).toBeLessThan(1e-9);
  });

  it("picks the informative feature among several", () => {
    // Only feature 1 carries signal; feature 0 is noise-free constant.
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const signal = i / 16;
      X.push([0.5, signal]);
      y.push(signal < 0.5 ? -1 : 1);
    }
    const tree = fitRegressionTree(X, y, { maxDepth: 3, minSamples: 2 });
    expect(predictTree(tree, [0.5, 0.2])).toBeCloseTo(-1, 6);
    expect(predictTree(tree, [0.5, 0.8])).toBeCloseTo(1, 6);
  });

  it("returns the global mean for a depth-0 (stump-less) tree", () => {
    const X = [[0], [1], [2], [3]];
    const y = [1, 3, 5, 7]; // mean = 4
    const tree = fitRegressionTree(X, y, { maxDepth: 0 });
    expect(predictTree(tree, [0])).toBeCloseTo(4, 12);
    expect(predictTree(tree, [99])).toBeCloseTo(4, 12);
  });

  it("does not mutate the input arrays", () => {
    const X = [[0.2], [0.8], [0.1], [0.9]];
    const y = [0, 1, 0, 1];
    const xSnapshot = JSON.stringify(X);
    const ySnapshot = JSON.stringify(y);
    fitRegressionTree(X, y);
    expect(JSON.stringify(X)).toBe(xSnapshot);
    expect(JSON.stringify(y)).toBe(ySnapshot);
  });

  it("handles empty input by predicting 0", () => {
    const tree = fitRegressionTree([], []);
    expect(predictTree(tree, [1, 2, 3])).toBe(0);
  });
});
