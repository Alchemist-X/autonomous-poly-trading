// CART regression tree — 决策树 (decision tree) from Kimi's 2026 World Cup report.
//
// This is a compact reference implementation of the Classification And Regression
// Trees (CART) algorithm for the regression case: greedily split on the
// (feature, threshold) pair that maximises variance reduction, and have each leaf
// predict the mean of its training targets. It is the building block reused by
// random-forest.js and gradient-boosting.js.
//
// Pure and immutable from the caller's view: fit returns a brand new tree object
// and never mutates the input X / y. No globals, no I/O, no Math.random.
//
// NOTE: this is a teaching-grade reference implementation, not a tuned production
// learner. Production code may swap in a heavily optimised CART (or a different
// backend entirely) behind the same fit/predict interface.

/** A leaf node: predicts a constant value (the mean of its training targets). */
export interface LeafNode {
  readonly kind: "leaf";
  readonly value: number;
}

/** An internal split node: route x to {@link left} if x[feature] < threshold. */
export interface SplitNode {
  readonly kind: "split";
  readonly feature: number;
  readonly threshold: number;
  readonly left: TreeNode;
  readonly right: TreeNode;
}

/** A node in a {@link RegressionTree}: either a split or a leaf. */
export type TreeNode = LeafNode | SplitNode;

/** A fitted CART regression tree. */
export interface RegressionTree {
  readonly root: TreeNode;
}

/** Options for {@link fitRegressionTree}. */
export interface FitTreeOptions {
  /** Maximum tree depth (root = depth 0). Default 4. */
  readonly maxDepth?: number;
  /** Minimum samples required to attempt a split. Default 4. */
  readonly minSamples?: number;
  /**
   * Optional restriction of candidate features (column indices). When omitted,
   * every feature is considered. Used by random forests for feature subsampling.
   */
  readonly featureIndices?: readonly number[];
}

/** Arithmetic mean of a numeric array; 0 for an empty array. */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Sum of squared deviations from the mean (n * variance) for `values`. */
function sumSquaredError(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  let sse = 0;
  for (const v of values) {
    const d = v - m;
    sse += d * d;
  }
  return sse;
}

/** A candidate split and its resulting child target partitions. */
interface BestSplit {
  readonly feature: number;
  readonly threshold: number;
  readonly leftIdx: readonly number[];
  readonly rightIdx: readonly number[];
}

/**
 * Find the (feature, threshold) split over `indices` that maximises variance
 * reduction, considering only the supplied candidate `features`. Returns null
 * when no split strictly reduces the sum of squared error.
 */
function findBestSplit(
  X: readonly number[][],
  y: readonly number[],
  indices: readonly number[],
  features: readonly number[],
): BestSplit | null {
  const parentTargets = indices.map((i) => y[i] ?? 0);
  const parentSse = sumSquaredError(parentTargets);
  let best: BestSplit | null = null;
  let bestSse = parentSse;

  for (const feature of features) {
    // Candidate thresholds = midpoints between sorted unique feature values.
    const sorted = [...indices].sort(
      (a, b) => (X[a]?.[feature] ?? 0) - (X[b]?.[feature] ?? 0),
    );
    for (let k = 1; k < sorted.length; k += 1) {
      const prev = X[sorted[k - 1] ?? 0]?.[feature] ?? 0;
      const curr = X[sorted[k] ?? 0]?.[feature] ?? 0;
      if (curr === prev) continue;
      const threshold = (prev + curr) / 2;

      const leftIdx: number[] = [];
      const rightIdx: number[] = [];
      for (const i of indices) {
        if ((X[i]?.[feature] ?? 0) < threshold) leftIdx.push(i);
        else rightIdx.push(i);
      }
      if (leftIdx.length === 0 || rightIdx.length === 0) continue;

      const leftSse = sumSquaredError(leftIdx.map((i) => y[i] ?? 0));
      const rightSse = sumSquaredError(rightIdx.map((i) => y[i] ?? 0));
      const splitSse = leftSse + rightSse;
      if (splitSse < bestSse) {
        bestSse = splitSse;
        best = { feature, threshold, leftIdx, rightIdx };
      }
    }
  }
  return best;
}

/** Recursively grow a subtree over the rows referenced by `indices`. */
function buildNode(
  X: readonly number[][],
  y: readonly number[],
  indices: readonly number[],
  features: readonly number[],
  depth: number,
  maxDepth: number,
  minSamples: number,
): TreeNode {
  const targets = indices.map((i) => y[i] ?? 0);
  const leaf: LeafNode = { kind: "leaf", value: mean(targets) };

  if (depth >= maxDepth || indices.length < minSamples) return leaf;

  const split = findBestSplit(X, y, indices, features);
  if (split === null) return leaf;

  return {
    kind: "split",
    feature: split.feature,
    threshold: split.threshold,
    left: buildNode(
      X,
      y,
      split.leftIdx,
      features,
      depth + 1,
      maxDepth,
      minSamples,
    ),
    right: buildNode(
      X,
      y,
      split.rightIdx,
      features,
      depth + 1,
      maxDepth,
      minSamples,
    ),
  };
}

/**
 * Fit a CART regression tree on dataset `X` (rows are feature vectors) and
 * targets `y`, splitting greedily on maximum variance reduction. Each leaf
 * predicts the mean target of its samples.
 *
 * @param X Feature matrix, `number[][]`; every row should have the same length.
 * @param y Target vector, `number[]`, aligned with the rows of `X`.
 * @param opts maxDepth (default 4), minSamples (default 4), featureIndices.
 * @returns A new {@link RegressionTree}; inputs are never mutated.
 */
export function fitRegressionTree(
  X: number[][],
  y: number[],
  opts?: FitTreeOptions,
): RegressionTree {
  const maxDepth = opts?.maxDepth ?? 4;
  const minSamples = opts?.minSamples ?? 4;
  const featureCount = X[0]?.length ?? 0;
  const features =
    opts?.featureIndices ?? Array.from({ length: featureCount }, (_, i) => i);

  if (X.length === 0 || y.length === 0) {
    return { root: { kind: "leaf", value: 0 } };
  }

  const indices = Array.from({ length: X.length }, (_, i) => i);
  const root = buildNode(
    X,
    y,
    indices,
    features,
    0,
    maxDepth,
    minSamples,
  );
  return { root };
}

/**
 * Predict the target for a single feature vector `x` by routing it from the
 * root to a leaf (go left when x[feature] < threshold) and returning the leaf
 * value.
 *
 * @param tree A tree returned by {@link fitRegressionTree}.
 * @param x A single feature vector, `number[]`.
 * @returns The predicted scalar value.
 */
export function predictTree(tree: RegressionTree, x: number[]): number {
  let node: TreeNode = tree.root;
  while (node.kind === "split") {
    node = (x[node.feature] ?? 0) < node.threshold ? node.left : node.right;
  }
  return node.value;
}
