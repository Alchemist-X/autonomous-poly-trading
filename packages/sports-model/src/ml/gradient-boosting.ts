// Gradient boosting for regression — 梯度提升 (gradient boosting, à la CatBoost)
// from Kimi's 2026 World Cup report. Boosting fits an additive ensemble of
// shallow regression trees stage by stage: the model is initialised to the mean
// target, and each round fits a new tree to the negative gradient of the squared
// loss (for squared loss this is simply the residual y - prediction), shrinking
// its contribution by a learning rate before adding it in.
//
// Squared loss: L = 1/2 (y - F(x))^2, so the negative gradient w.r.t. F(x) is the
// plain residual (y - F(x)). We therefore fit each tree to the running residuals.
//
// Pure and immutable from the caller's view: fit returns a new model and never
// mutates X / y. No globals, no I/O, no Math.random.
//
// NOTE: this is a compact reference GBM, not a tuned CatBoost/XGBoost. It omits
// ordered boosting, categorical handling, regularisation, and second-order steps.
// Production may swap in a tuned gradient-boosting backend behind the same
// fit/predict interface.

import {
  fitRegressionTree,
  predictTree,
  type RegressionTree,
} from "./decision-tree.js";

/** A fitted gradient-boosting model: a base value plus shrunken tree stages. */
export interface GradientBoostingModel {
  /** Initial prediction for every input (the training-target mean). */
  readonly base: number;
  /** The boosting stages, applied additively in order. */
  readonly trees: readonly RegressionTree[];
  /** Shrinkage applied to every stage's contribution. */
  readonly learningRate: number;
}

/** Options for {@link fitGradientBoosting}. */
export interface FitGradientBoostingOptions {
  /** Number of boosting rounds (trees). Default 50. */
  readonly nRounds?: number;
  /** Shrinkage in (0, 1]; smaller = more rounds needed but smoother. Default 0.1. */
  readonly learningRate?: number;
  /** Maximum depth of each stage tree (kept shallow). Default 2. */
  readonly maxDepth?: number;
  /** Minimum samples required to split a node. Default 2. */
  readonly minSamples?: number;
}

/** Arithmetic mean of a numeric array; 0 for an empty array. */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Fit a gradient-boosting regression model under squared loss. The model starts
 * at mean(y); each round fits a shallow tree to the current residuals and adds
 * `learningRate * tree` to the running prediction.
 *
 * @param X Feature matrix, `number[][]`.
 * @param y Target vector, `number[]`, aligned with the rows of `X`.
 * @param opts nRounds (default 50), learningRate (default 0.1),
 *   maxDepth (default 2), minSamples (default 2).
 * @returns A new {@link GradientBoostingModel}; inputs are never mutated.
 */
export function fitGradientBoosting(
  X: number[][],
  y: number[],
  opts?: FitGradientBoostingOptions,
): GradientBoostingModel {
  const nRounds = opts?.nRounds ?? 50;
  const learningRate = opts?.learningRate ?? 0.1;
  const maxDepth = opts?.maxDepth ?? 2;
  const minSamples = opts?.minSamples ?? 2;

  const n = X.length;
  const base = mean(y);
  if (n === 0) {
    return { base, trees: [], learningRate };
  }

  // Running prediction per training row, starting from the base value.
  const predictions: number[] = new Array(n).fill(base);
  const trees: RegressionTree[] = [];

  for (let round = 0; round < nRounds; round += 1) {
    // Negative gradient of squared loss = residual y - currentPrediction.
    const residuals: number[] = new Array(n);
    for (let i = 0; i < n; i += 1) {
      residuals[i] = (y[i] ?? 0) - (predictions[i] ?? 0);
    }

    const tree = fitRegressionTree(X, residuals, { maxDepth, minSamples });
    trees.push(tree);

    // Update the running predictions with the shrunken stage contribution.
    for (let i = 0; i < n; i += 1) {
      predictions[i] =
        (predictions[i] ?? 0) + learningRate * predictTree(tree, X[i] ?? []);
    }
  }

  return { base, trees, learningRate };
}

/**
 * Predict for a single feature vector `x`: start from the base value and add
 * `learningRate * tree(x)` for every boosting stage in order.
 *
 * @param model A model returned by {@link fitGradientBoosting}.
 * @param x A single feature vector, `number[]`.
 * @returns The boosted prediction.
 */
export function predictGradientBoosting(
  model: GradientBoostingModel,
  x: number[],
): number {
  let value = model.base;
  for (const tree of model.trees) {
    value += model.learningRate * predictTree(tree, x);
  }
  return value;
}
