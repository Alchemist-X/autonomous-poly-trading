// Zero-Inflated Generalized Poisson (ZIGP) goal model — Kimi's 2026 World Cup
// report "model 7". Two refinements stack on top of the independent-Poisson
// baseline:
//   1. Consul's *generalized* Poisson adds a dispersion parameter delta that
//      lets the variance differ from the mean (delta > 0 over-dispersion,
//      delta < 0 under-dispersion); delta = 0 recovers the ordinary Poisson.
//   2. *Zero-inflation* mixes in an extra point mass at 0, capturing the surplus
//      of goalless results (defensive locks, low-event matches) that a plain
//      Poisson under-predicts.
// Pure, immutable, no globals.

import type { GoalExpectation } from "./types.js";

/** Natural log of k! via ln(k!) = sum_{i=2}^{k} ln(i). */
function logFactorial(k: number): number {
  let sum = 0;
  for (let i = 2; i <= k; i += 1) sum += Math.log(i);
  return sum;
}

/**
 * Consul's generalized Poisson probability mass function.
 *
 * Formula: P(X = k) = lambda * (lambda + delta*k)^(k-1) * e^(-(lambda + delta*k)) / k!
 *
 * The dispersion parameter delta controls variance relative to the mean:
 * delta = 0 reduces exactly to the standard Poisson e^(-lambda) * lambda^k / k!
 * (the (lambda)^(k-1) * lambda numerator collapses to lambda^k); delta > 0 fattens
 * the tails (over-dispersion, e.g. a higher P(0)); delta < 0 thins them.
 *
 * @param k - Non-negative integer goal count.
 * @param lambda - Base rate, must be > 0.
 * @param delta - Dispersion parameter, requires |delta| < 1 for a valid law.
 * @returns Probability of exactly k goals; 0 for invalid inputs.
 */
export function generalizedPoissonPmf(
  k: number,
  lambda: number,
  delta: number,
): number {
  if (!Number.isFinite(k) || !Number.isFinite(lambda) || !Number.isFinite(delta))
    return 0;
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (lambda <= 0) return 0;
  if (Math.abs(delta) >= 1) return 0;
  // theta = lambda + delta*k must stay positive for the mass to be defined.
  const theta = lambda + delta * k;
  if (theta <= 0) return 0;
  // log P = ln(lambda) + (k-1)*ln(theta) - theta - ln(k!)
  const logPmf = Math.log(lambda) + (k - 1) * Math.log(theta) - theta - logFactorial(k);
  return Math.exp(logPmf);
}

/**
 * Zero-inflated generalized Poisson probability mass function.
 *
 * Formula (pi = zeroInflation, GP = generalizedPoissonPmf):
 *   P(0)     = pi + (1 - pi) * GP(0)
 *   P(k > 0) = (1 - pi) * GP(k)
 *
 * A pi fraction of matches are forced to 0 goals; the remaining (1 - pi) follow
 * the generalized Poisson. pi = 0 leaves the generalized Poisson untouched.
 *
 * @param k - Non-negative integer goal count.
 * @param lambda - Base rate, must be > 0.
 * @param delta - Dispersion parameter, requires |delta| < 1.
 * @param zeroInflation - Extra point mass at 0, pi in [0, 1].
 * @returns Probability of exactly k goals; 0 for invalid inputs.
 */
export function zigpPmf(
  k: number,
  lambda: number,
  delta: number,
  zeroInflation: number,
): number {
  if (!Number.isFinite(zeroInflation)) return 0;
  if (zeroInflation < 0 || zeroInflation > 1) return 0;
  const gp = generalizedPoissonPmf(k, lambda, delta);
  if (k === 0) return zeroInflation + (1 - zeroInflation) * gp;
  return (1 - zeroInflation) * gp;
}

/**
 * Full score probability matrix under the ZIGP assumption.
 *
 * Formula: m[h][a] = zigpPmf(h, lambda_home, ...) * zigpPmf(a, lambda_away, ...)
 * with the same (delta, zeroInflation) applied to both sides, then renormalised
 * so every cell sums to exactly 1 (the generalized-Poisson and zero-inflation
 * marginals do not sum to 1 over a truncated grid, so explicit renormalisation
 * keeps the joint a proper distribution).
 *
 * @param goals - Expected goals (base rates) for home and away.
 * @param opts - Optional delta (default 0) and zeroInflation (default 0).
 * @param maxGoals - Inclusive upper bound on goals per side (default 10).
 * @returns A (maxGoals+1) x (maxGoals+1) matrix summing to 1.
 */
export function zigpScoreMatrix(
  goals: GoalExpectation,
  opts?: { delta?: number; zeroInflation?: number },
  maxGoals = 10,
): number[][] {
  const delta = opts?.delta ?? 0;
  const zeroInflation = opts?.zeroInflation ?? 0;
  const size = maxGoals + 1;
  const homePmf = Array.from({ length: size }, (_, h) =>
    zigpPmf(h, goals.home, delta, zeroInflation),
  );
  const awayPmf = Array.from({ length: size }, (_, a) =>
    zigpPmf(a, goals.away, delta, zeroInflation),
  );
  const raw = Array.from({ length: size }, (_, h) =>
    Array.from(
      { length: size },
      (_, a) => (homePmf[h] ?? 0) * (awayPmf[a] ?? 0),
    ),
  );
  let total = 0;
  for (const row of raw) for (const p of row) total += p;
  if (total <= 0) {
    const uniform = 1 / (size * size);
    return Array.from({ length: size }, () =>
      Array.from({ length: size }, () => uniform),
    );
  }
  return raw.map((row) => row.map((p) => p / total));
}
