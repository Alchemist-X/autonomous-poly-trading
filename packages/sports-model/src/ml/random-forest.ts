// Random forest regression — 随机森林 (random forest) from Kimi's 2026 World Cup
// report. An ensemble of CART regression trees, each grown on a bootstrap sample
// of the rows (sampling with replacement) and a random subset of the features.
// The forest prediction is the average of its trees' predictions — bagging plus
// feature subsampling decorrelates the trees and reduces variance.
//
// All randomness flows through the explicit Rng passed by the caller, so a fixed
// seed reproduces the same forest. Pure and immutable from the caller's view:
// fit returns a new model and never mutates X / y.
//
// NOTE: this is a compact reference implementation. Production may swap in a
// tuned ensemble behind the same fit/predict interface.

import { randInt, type Rng } from "../rng.js";
import {
  fitRegressionTree,
  predictTree,
  type RegressionTree,
} from "./decision-tree.js";

/** A fitted random forest: an ensemble of regression trees. */
export interface RandomForest {
  readonly trees: readonly RegressionTree[];
}

/** Options for {@link fitRandomForest}. */
export interface FitForestOptions {
  /** Number of trees in the ensemble. Default 20. */
  readonly nTrees?: number;
  /** Maximum depth of each tree. Default 6. */
  readonly maxDepth?: number;
  /** Minimum samples required to split a node. Default 2. */
  readonly minSamples?: number;
  /**
   * Fraction of features each tree may consider, in (0, 1]. Default 1 (use all).
   * At least one feature is always retained.
   */
  readonly featureSubsample?: number;
}

/**
 * Draw a bootstrap sample of `n` row indices in [0, n) with replacement using
 * the supplied Rng. Returns a new array; the Rng is advanced as a side effect
 * (this is the intended, explicit source of stochasticity).
 */
function bootstrapIndices(n: number, rng: Rng): number[] {
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) out[i] = randInt(rng, n);
  return out;
}

/**
 * Pick `k` distinct feature indices from [0, total) via a partial Fisher–Yates
 * shuffle driven by the Rng. Returns a new sorted array.
 */
function sampleFeatures(total: number, k: number, rng: Rng): number[] {
  const pool = Array.from({ length: total }, (_, i) => i);
  const take = Math.max(1, Math.min(k, total));
  for (let i = 0; i < take; i += 1) {
    const j = i + randInt(rng, total - i);
    const tmp = pool[i] ?? 0;
    pool[i] = pool[j] ?? 0;
    pool[j] = tmp;
  }
  return pool.slice(0, take).sort((a, b) => a - b);
}

/**
 * Fit a bagged random forest of CART regression trees. Each tree is trained on
 * its own bootstrap sample of the rows and a random subset of the features.
 *
 * @param X Feature matrix, `number[][]`.
 * @param y Target vector, `number[]`, aligned with the rows of `X`.
 * @param opts nTrees (default 20), maxDepth (default 6), minSamples (default 2),
 *   featureSubsample fraction in (0, 1] (default 1).
 * @param rng The explicit random source; the same seed reproduces the forest.
 * @returns A new {@link RandomForest}; inputs are never mutated.
 */
export function fitRandomForest(
  X: number[][],
  y: number[],
  opts: FitForestOptions,
  rng: Rng,
): RandomForest {
  const nTrees = opts.nTrees ?? 20;
  const maxDepth = opts.maxDepth ?? 6;
  const minSamples = opts.minSamples ?? 2;
  const subsample = opts.featureSubsample ?? 1;

  const n = X.length;
  const featureCount = X[0]?.length ?? 0;
  if (n === 0 || featureCount === 0) {
    return { trees: [] };
  }

  const featuresPerTree = Math.max(1, Math.round(featureCount * subsample));
  const trees: RegressionTree[] = [];

  for (let t = 0; t < nTrees; t += 1) {
    const rowIdx = bootstrapIndices(n, rng);
    // Build a fresh bootstrap dataset; copy rows so inputs are never mutated.
    const bootX = rowIdx.map((i) => [...(X[i] ?? [])]);
    const bootY = rowIdx.map((i) => y[i] ?? 0);
    const featureIndices = sampleFeatures(featureCount, featuresPerTree, rng);

    trees.push(
      fitRegressionTree(bootX, bootY, { maxDepth, minSamples, featureIndices }),
    );
  }

  return { trees };
}

/**
 * Predict for a single feature vector `x` by averaging the predictions of every
 * tree in the forest. An empty forest predicts 0.
 *
 * @param forest A forest returned by {@link fitRandomForest}.
 * @param x A single feature vector, `number[]`.
 * @returns The averaged prediction.
 */
export function predictForest(forest: RandomForest, x: number[]): number {
  if (forest.trees.length === 0) return 0;
  let sum = 0;
  for (const tree of forest.trees) sum += predictTree(tree, x);
  return sum / forest.trees.length;
}
