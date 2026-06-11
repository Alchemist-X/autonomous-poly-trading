// Model-fusion (ensemble) module — reproduces the 模型融合 (model fusion) methods
// from Kimi's 2026 World Cup report. Several base models (Poisson, Elo, market-
// derived, …) each produce a probability; this module combines them into a
// single consensus forecast via a linear opinion pool (weighted arithmetic mean)
// or a logarithmic opinion pool (weighted geometric mean). Pure, immutable, no
// globals, no I/O.

import type { OneXTwo } from "./types.js";
import { normaliseOneXTwo } from "./types.js";

/**
 * Smallest gap kept between a probability and 0/1 before taking logs / powers in
 * the logarithmic pool, so that ln(0) / 0^w never appears.
 */
const PROB_EPS = 1e-12;

/** Clamp a probability into the open interval (0, 1). */
function clampOpen(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1 - PROB_EPS, Math.max(PROB_EPS, p));
}

/**
 * Linear opinion pool — weighted arithmetic mean of probabilities.
 *
 * Formula: pool = ( Σ_i w_i * p_i ) / ( Σ_i w_i )
 *
 * The standard "average the experts" fusion: each model's probability is
 * weighted by its trust weight. Robust and easy to interpret; the pooled value
 * always lies between the smallest and largest input. Returns 0.5 if the weights
 * sum to zero.
 *
 * @param probs - Per-model probabilities in [0, 1].
 * @param weights - Per-model non-negative weights (same length as probs).
 * @returns The weighted-average probability.
 */
export function linearPool(
  probs: readonly number[],
  weights: readonly number[],
): number {
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < probs.length; i += 1) {
    const p = probs[i] ?? 0;
    const w = weights[i] ?? 0;
    if (!Number.isFinite(p) || !Number.isFinite(w) || w < 0) continue;
    weighted += w * p;
    weightSum += w;
  }
  if (weightSum <= 0) return 0.5;
  return weighted / weightSum;
}

/** Normalise weights to sum to 1; returns equal weights if the sum is zero. */
function normaliseWeights(
  weights: readonly number[],
  count: number,
): number[] {
  let sum = 0;
  for (const w of weights) if (Number.isFinite(w) && w > 0) sum += w;
  if (sum <= 0) return Array.from({ length: count }, () => 1 / Math.max(1, count));
  return Array.from({ length: count }, (_, i) => {
    const w = weights[i] ?? 0;
    return Number.isFinite(w) && w > 0 ? w / sum : 0;
  });
}

/**
 * Logarithmic opinion pool (binary) — weighted geometric mean in odds space.
 *
 * Formula (weights w_i normalised to sum 1):
 *   pool = Π_i p_i^{w_i}  /  ( Π_i p_i^{w_i} + Π_i (1 - p_i)^{w_i} )
 *
 * Equivalent to averaging the log-odds of the models with the given weights.
 * Compared with the linear pool it is sharper (more confident) and, when the
 * models agree, returns their common value. Probabilities are clamped away from
 * 0/1 so the powers stay finite.
 *
 * @param probs - Per-model probabilities in [0, 1].
 * @param weights - Per-model non-negative weights (normalised internally).
 * @returns The log-pooled probability in (0, 1).
 */
export function logarithmicOpinionPool(
  probs: readonly number[],
  weights: readonly number[],
): number {
  const w = normaliseWeights(weights, probs.length);
  let logNum = 0; // Σ w_i * ln(p_i)
  let logDen = 0; // Σ w_i * ln(1 - p_i)
  for (let i = 0; i < probs.length; i += 1) {
    const p = clampOpen(probs[i] ?? 0.5);
    const wi = w[i] ?? 0;
    logNum += wi * Math.log(p);
    logDen += wi * Math.log(1 - p);
  }
  const num = Math.exp(logNum);
  const den = num + Math.exp(logDen);
  if (den <= 0) return 0.5;
  return num / den;
}

/**
 * Logarithmic opinion pool over 1X2 triples.
 *
 * Formula: for each class c in {home, draw, away},
 *   g_c = Π_i p_{i,c}^{w_i}   (weighted geometric mean, weights summing to 1)
 * then normalise (g_home, g_draw, g_away) to sum to 1 via normaliseOneXTwo.
 *
 * The multi-class analogue of {@link logarithmicOpinionPool}: take the weighted
 * geometric mean per class, then renormalise the triple. When every model gives
 * the same triple the result is that triple unchanged.
 *
 * @param items - Per-model 1X2 probability triples.
 * @param weights - Per-model non-negative weights (normalised internally).
 * @returns The log-pooled 1X2 triple, summing to 1.
 */
export function logOpinionPoolOneXTwo(
  items: readonly OneXTwo[],
  weights: readonly number[],
): OneXTwo {
  if (items.length === 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  const w = normaliseWeights(weights, items.length);
  let logHome = 0;
  let logDraw = 0;
  let logAway = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item) continue;
    const wi = w[i] ?? 0;
    logHome += wi * Math.log(clampOpen(item.home));
    logDraw += wi * Math.log(clampOpen(item.draw));
    logAway += wi * Math.log(clampOpen(item.away));
  }
  return normaliseOneXTwo({
    home: Math.exp(logHome),
    draw: Math.exp(logDraw),
    away: Math.exp(logAway),
  });
}
