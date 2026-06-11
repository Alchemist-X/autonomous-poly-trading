// Binary logistic regression — 逻辑回归 (logistic regression) from Kimi's 2026
// World Cup report. A linear model passed through the sigmoid to produce a class
// probability, trained by full-batch gradient descent on the cross-entropy
// (log) loss with optional L2 weight regularisation.
//
// For weights w and bias b, p = sigmoid(w · x + b). The cross-entropy gradient
// w.r.t. each weight is mean_i (p_i - y_i) * x_ij (plus the L2 term), and w.r.t.
// the bias is mean_i (p_i - y_i). We descend along the negative gradient.
//
// Pure and immutable from the caller's view: fit returns a new model and never
// mutates X / y. No globals, no I/O, no Math.random.
//
// NOTE: this is a compact reference implementation. Production may swap in a
// tuned / regularised solver behind the same fit/predict interface.

/** A fitted binary logistic-regression model. */
export interface LogisticModel {
  /** One weight per input feature. */
  readonly weights: readonly number[];
  /** The intercept term. */
  readonly bias: number;
}

/** Options for {@link fitLogisticRegression}. */
export interface FitLogisticOptions {
  /** Gradient-descent step size. Default 0.1. */
  readonly learningRate?: number;
  /** Number of full-batch passes over the data. Default 500. */
  readonly epochs?: number;
  /** L2 (ridge) penalty strength on the weights; 0 disables it. Default 0. */
  readonly l2?: number;
}

/** Numerically stable logistic sigmoid: 1 / (1 + e^-z). */
function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

/** Dot product of weights and features plus bias; missing entries treated as 0. */
function linear(
  weights: readonly number[],
  bias: number,
  x: readonly number[],
): number {
  let z = bias;
  for (let j = 0; j < weights.length; j += 1) {
    z += (weights[j] ?? 0) * (x[j] ?? 0);
  }
  return z;
}

/**
 * Fit a binary logistic-regression classifier by full-batch gradient descent on
 * the cross-entropy loss, with optional L2 regularisation on the weights.
 *
 * @param X Feature matrix, `number[][]`; rows share a common length.
 * @param y Binary labels, each 0 or 1, aligned with the rows of `X`.
 * @param opts learningRate (default 0.1), epochs (default 500), l2 (default 0).
 * @returns A new {@link LogisticModel}; inputs are never mutated.
 */
export function fitLogisticRegression(
  X: number[][],
  y: (0 | 1)[],
  opts?: FitLogisticOptions,
): LogisticModel {
  const learningRate = opts?.learningRate ?? 0.1;
  const epochs = opts?.epochs ?? 500;
  const l2 = opts?.l2 ?? 0;

  const n = X.length;
  const featureCount = X[0]?.length ?? 0;
  if (n === 0 || featureCount === 0) {
    return { weights: new Array(featureCount).fill(0), bias: 0 };
  }

  // Mutable local accumulators only; the returned model is a fresh object.
  let weights: number[] = new Array(featureCount).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW: number[] = new Array(featureCount).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i += 1) {
      const row = X[i] ?? [];
      const p = sigmoid(linear(weights, bias, row));
      const error = p - (y[i] ?? 0);
      for (let j = 0; j < featureCount; j += 1) {
        gradW[j] = (gradW[j] ?? 0) + error * (row[j] ?? 0);
      }
      gradB += error;
    }

    const nextWeights: number[] = new Array(featureCount);
    for (let j = 0; j < featureCount; j += 1) {
      const meanGrad = (gradW[j] ?? 0) / n;
      const reg = l2 * (weights[j] ?? 0);
      nextWeights[j] = (weights[j] ?? 0) - learningRate * (meanGrad + reg);
    }
    weights = nextWeights;
    bias -= learningRate * (gradB / n);
  }

  return { weights, bias };
}

/**
 * Probability that `x` belongs to the positive class: sigmoid(w · x + b).
 *
 * @param model A model from {@link fitLogisticRegression}.
 * @param x A single feature vector, `number[]`.
 * @returns A probability strictly inside (0, 1) for finite inputs.
 */
export function predictProbability(model: LogisticModel, x: number[]): number {
  return sigmoid(linear(model.weights, model.bias, x));
}

/**
 * Hard class label for `x`: 1 when {@link predictProbability} ≥ threshold, else 0.
 *
 * @param model A model from {@link fitLogisticRegression}.
 * @param x A single feature vector, `number[]`.
 * @param threshold Decision boundary on the probability. Default 0.5.
 * @returns 0 or 1.
 */
export function predictLabel(
  model: LogisticModel,
  x: number[],
  threshold = 0.5,
): 0 | 1 {
  return predictProbability(model, x) >= threshold ? 1 : 0;
}
