// Bayesian dynamic-update module — reproduces the 贝叶斯动态更新 (Bayesian dynamic
// update) method from Kimi's 2026 World Cup report. The core idea: maintain a
// belief about an event probability and revise it as evidence arrives by working
// in log-odds (logit) space, where independent evidence simply adds. A Beta-
// Binomial conjugate update is provided for count data, plus a normal credible
// interval helper. Pure, immutable, no globals, no I/O.

/**
 * Smallest gap kept between a probability and the hard 0/1 boundaries so that
 * logit / log operations never blow up to ±Infinity.
 */
const PROB_EPS = 1e-12;

/** Clamp a probability into the open interval (0, 1) by PROB_EPS. */
function clampOpen(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1 - PROB_EPS, Math.max(PROB_EPS, p));
}

/**
 * Log-odds (logit) transform.
 *
 * Formula: logit(p) = ln( p / (1 - p) )
 *
 * Maps a probability in (0, 1) to the whole real line. The input is clamped
 * away from 0/1 so the result is always finite.
 *
 * @param p - Probability in [0, 1].
 * @returns The log-odds of p.
 */
export function logit(p: number): number {
  const c = clampOpen(p);
  return Math.log(c / (1 - c));
}

/**
 * Inverse log-odds (logistic / sigmoid) transform.
 *
 * Formula: invLogit(x) = 1 / (1 + e^(-x))
 *
 * Maps a real-valued log-odds back to a probability in (0, 1). The exact
 * inverse of {@link logit} (up to the PROB_EPS clamp).
 *
 * @param x - A log-odds value.
 * @returns The corresponding probability in (0, 1).
 */
export function invLogit(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Bayesian update of a prior probability with independent evidence, performed
 * in log-odds space.
 *
 * Formula: posterior = invLogit( logit(prior) + Σ_i llr_i )
 *
 * In log-odds space Bayes' rule is additive: the posterior log-odds equal the
 * prior log-odds plus the sum of each piece of evidence's log-likelihood-ratio
 * (LLR = ln( P(evidence | event) / P(evidence | ¬event) )). A positive LLR
 * pushes the belief up, a negative LLR pushes it down. With no evidence the
 * prior is returned unchanged.
 *
 * @param prior - Prior probability of the event, in [0, 1].
 * @param logLikelihoodRatios - Per-evidence log-likelihood-ratios to accumulate.
 * @returns The posterior probability in (0, 1).
 */
export function bayesianUpdate(
  prior: number,
  logLikelihoodRatios: readonly number[],
): number {
  let logOdds = logit(prior);
  for (const llr of logLikelihoodRatios) {
    if (Number.isFinite(llr)) logOdds += llr;
  }
  return invLogit(logOdds);
}

/** Posterior of a Beta-Binomial conjugate update. */
export interface BetaBinomialPosterior {
  /** Updated Beta shape parameter alpha' = priorAlpha + successes. */
  readonly alpha: number;
  /** Updated Beta shape parameter beta' = priorBeta + failures. */
  readonly beta: number;
  /** Posterior mean = alpha' / (alpha' + beta'). */
  readonly mean: number;
  /** Posterior variance = alpha'beta' / ((alpha'+beta')^2 (alpha'+beta'+1)). */
  readonly variance: number;
}

/**
 * Beta-Binomial conjugate update for a success probability from count data.
 *
 * Formulas:
 *   alpha'    = priorAlpha + successes
 *   beta'     = priorBeta  + failures
 *   mean      = alpha' / (alpha' + beta')
 *   variance  = (alpha' * beta') / ( (alpha' + beta')^2 * (alpha' + beta' + 1) )
 *
 * The Beta distribution is the conjugate prior of the Binomial, so observing s
 * successes and f failures simply increments the two shape parameters. Useful in
 * the report for updating a team's win rate as new matches are observed.
 *
 * @param priorAlpha - Prior Beta alpha (pseudo-successes), must be > 0.
 * @param priorBeta - Prior Beta beta (pseudo-failures), must be > 0.
 * @param successes - Observed successes (non-negative).
 * @param failures - Observed failures (non-negative).
 * @returns The updated shape parameters with posterior mean and variance.
 */
export function betaBinomialPosterior(
  priorAlpha: number,
  priorBeta: number,
  successes: number,
  failures: number,
): BetaBinomialPosterior {
  const alpha = priorAlpha + successes;
  const beta = priorBeta + failures;
  const total = alpha + beta;
  const mean = total > 0 ? alpha / total : 0.5;
  const variance =
    total > 0 ? (alpha * beta) / (total * total * (total + 1)) : 0;
  return { alpha, beta, mean, variance };
}

/** Standard-normal z-scores for common two-sided credible-interval levels. */
const Z_SCORES: Readonly<Record<string, number>> = {
  "0.5": 0.6745,
  "0.8": 1.2816,
  "0.9": 1.6449,
  "0.95": 1.96,
  "0.99": 2.5758,
};

/** Pick the z-score for a credible level, defaulting to the 0.8 value. */
function zForLevel(level: number): number {
  const key = String(level);
  return Z_SCORES[key] ?? 1.2816;
}

/**
 * Symmetric normal-approximation credible interval for a probability.
 *
 * Formula: [ mean - z * sd , mean + z * sd ], clamped to [0, 1]
 *
 * Treats the posterior as approximately normal with the given mean and standard
 * deviation and returns the central interval covering `level` of the mass. The
 * z multiplier is looked up for the requested level (z ≈ 1.2816 for level 0.8).
 * Bounds are clamped into [0, 1] since the quantity is a probability.
 *
 * @param mean - Posterior mean in [0, 1].
 * @param sd - Posterior standard deviation (non-negative).
 * @param level - Central coverage probability (default 0.8).
 * @returns The [lower, upper] credible interval, clamped to [0, 1].
 */
export function normalCredibleInterval(
  mean: number,
  sd: number,
  level = 0.8,
): [number, number] {
  const z = zForLevel(level);
  const halfWidth = z * Math.max(0, sd);
  const lower = Math.min(1, Math.max(0, mean - halfWidth));
  const upper = Math.min(1, Math.max(0, mean + halfWidth));
  return [lower, upper];
}
