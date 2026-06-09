// Market de-vig / deviation module — reproduces the 市场偏差 (market deviation)
// analysis from Kimi's 2026 World Cup report. Bookmaker odds embed a margin
// ("vig" / overround) so the raw implied probabilities sum to more than 1; this
// module recovers fair probabilities (de-vig) and measures how far the model's
// view sits from the market consensus. Pure, immutable, no globals, no I/O.
//
// IMPORTANT: the deviation produced here is a RESEARCH signal — the market is
// treated as a "consensus bias research variable", NOT as an instruction to bet.

/** Tolerance used by the bisection root-finder in {@link devigPower}. */
const POWER_TOLERANCE = 1e-12;
/** Maximum bisection iterations for {@link devigPower}. */
const POWER_MAX_ITERS = 200;

/**
 * Implied probability of a decimal-odds quote.
 *
 * Formula: p = 1 / decimalOdds
 *
 * Decimal odds of `d` pay `d` per unit staked (stake included), so the
 * break-even / implied probability is its reciprocal. Returns 0 for non-positive
 * or non-finite odds.
 *
 * @param decimalOdds - Decimal (European) odds, e.g. 2.0 for evens.
 * @returns The implied probability in (0, 1], or 0 for invalid input.
 */
export function impliedProbabilityFromDecimal(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 0) return 0;
  return 1 / decimalOdds;
}

/**
 * Bookmaker overround (vig / margin) of a set of implied probabilities.
 *
 * Formula: overround = ( Σ_i p_i ) - 1
 *
 * Fair probabilities sum to exactly 1; anything above that is the bookmaker's
 * built-in margin. A positive value is the usual overround, ~0 is a fair book.
 *
 * @param probs - Implied probabilities of mutually-exclusive outcomes.
 * @returns The overround (sum minus one).
 */
export function overround(probs: readonly number[]): number {
  let sum = 0;
  for (const p of probs) if (Number.isFinite(p)) sum += p;
  return sum - 1;
}

/**
 * Proportional (basic) de-vig: rescale implied probabilities so they sum to 1.
 *
 * Formula: q_i = p_i / Σ_j p_j
 *
 * The simplest fair-probability estimate — it divides the margin out in
 * proportion to each outcome's raw probability, preserving their ratios. Returns
 * all-zeros if the inputs sum to zero.
 *
 * @param probs - Raw implied probabilities (may sum to more than 1).
 * @returns Fair probabilities summing to 1 (same length as input).
 */
export function devigNormalize(probs: readonly number[]): number[] {
  let sum = 0;
  for (const p of probs) if (Number.isFinite(p)) sum += p;
  if (sum <= 0) return probs.map(() => 0);
  return probs.map((p) => (Number.isFinite(p) ? p / sum : 0));
}

/** Σ_i p_i^k for the power-de-vig objective. */
function powerSum(probs: readonly number[], k: number): number {
  let sum = 0;
  for (const p of probs) {
    if (Number.isFinite(p) && p > 0) sum += Math.pow(p, k);
  }
  return sum;
}

/**
 * Power-method de-vig: find the exponent k for which the powered probabilities
 * sum to 1, then return them.
 *
 * Formula: choose k such that  Σ_i p_i^k = 1 ,  return q_i = p_i^k
 *
 * Unlike proportional de-vig, the power method removes more margin from
 * longer-priced outcomes (favourite-longshot correction), which the report uses
 * as a better fair-probability estimate. Because Σ p_i^k decreases as k grows
 * (each p_i < 1), the equation has a unique root, found by bisection on
 * k ∈ [0.5, 2]. The returned values sum to ~1 (to POWER_TOLERANCE).
 *
 * @param probs - Raw implied probabilities (may sum to more than 1).
 * @returns Fair probabilities summing to ~1 (same length as input).
 */
export function devigPower(probs: readonly number[]): number[] {
  // Degenerate inputs: fall back to proportional de-vig.
  const positive = probs.filter((p) => Number.isFinite(p) && p > 0);
  if (positive.length === 0) return probs.map(() => 0);

  let lo = 0.5;
  let hi = 2;
  // powerSum is monotonically decreasing in k, so f(k) = powerSum(k) - 1 is too.
  // Expand the bracket if the root lies outside the default [0.5, 2] window.
  while (powerSum(probs, lo) < 1 && lo > 1e-6) lo /= 2;
  while (powerSum(probs, hi) > 1 && hi < 1e6) hi *= 2;

  let k = 1;
  for (let i = 0; i < POWER_MAX_ITERS; i += 1) {
    k = (lo + hi) / 2;
    const diff = powerSum(probs, k) - 1;
    if (Math.abs(diff) < POWER_TOLERANCE) break;
    // diff > 0 means Σ too large -> need a larger k to shrink it.
    if (diff > 0) lo = k;
    else hi = k;
  }

  return probs.map((p) => (Number.isFinite(p) && p > 0 ? Math.pow(p, k) : 0));
}

/**
 * Model-vs-market deviation signal for a single outcome.
 *
 * Formula: signal = modelProb - marketProb
 *
 * The signed gap between the model's probability and the (de-vigged) market
 * consensus. A positive value means the model is more bullish than the market.
 *
 * RESEARCH NOTE: this is a 市场偏差信号 (market-deviation research variable),
 * NOT a betting edge. The market consensus is consumed as an input feature to
 * study where the model and the crowd disagree — it is not a trade instruction.
 *
 * @param modelProb - The model's probability in [0, 1].
 * @param marketProb - The market consensus (fair) probability in [0, 1].
 * @returns The signed deviation modelProb - marketProb.
 */
export function edgeSignal(modelProb: number, marketProb: number): number {
  return modelProb - marketProb;
}
