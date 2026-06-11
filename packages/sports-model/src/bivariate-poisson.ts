// Bivariate-Poisson goal model. Introduces a shared component lambda_3 that
// couples home and away goals positively (e.g. open, end-to-end games where both
// teams score more, or cagey games where both score less). Marginals stay
// Poisson with E[X] = l1 + l3, E[Y] = l2 + l3, and Cov(X, Y) = l3. When l3 = 0
// it reduces exactly to the independent-Poisson model. Pure, immutable, no globals.

import type { GoalExpectation } from "./types.js";
import { poissonPmf, scoreMatrix } from "./poisson.js";

/**
 * Bivariate-Poisson probability mass function P(X = x, Y = y).
 *
 * Formula (Karlis & Ntzoufras 2003):
 *   P(x, y) = e^(-(l1+l2+l3)) * (l1^x / x!) * (l2^y / y!)
 *             * sum_{k=0}^{min(x,y)} C(x,k) * C(y,k) * k! * (l3 / (l1*l2))^k
 *
 * The common component l3 = Cov(X, Y) >= 0 induces positive dependence; l3 = 0
 * leaves the two marginals independent. l1 and l2 must be > 0 for the ratio term
 * (when l3 > 0); if l3 = 0 the sum collapses to its k=0 term so l1/l2 = 0 is fine.
 *
 * @param x - Home goal count (non-negative integer).
 * @param y - Away goal count (non-negative integer).
 * @param l1 - Home-specific rate.
 * @param l2 - Away-specific rate.
 * @param l3 - Shared (covariance) rate, >= 0.
 * @returns The joint probability; 0 for invalid inputs.
 */
export function bivariatePoissonPmf(
  x: number,
  y: number,
  l1: number,
  l2: number,
  l3: number,
): number {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return 0;
  if (l1 < 0 || l2 < 0 || l3 < 0) return 0;
  if (l3 === 0) {
    // Independent case: only the k=0 term survives -> product of marginals.
    return poissonPmf(x, l1) * poissonPmf(y, l2);
  }

  const prefix =
    Math.exp(-(l1 + l2 + l3)) *
    (Math.pow(l1, x) / factorial(x)) *
    (Math.pow(l2, y) / factorial(y));

  const ratio = l3 / (l1 * l2);
  let sum = 0;
  const kMax = Math.min(x, y);
  for (let k = 0; k <= kMax; k += 1) {
    sum += choose(x, k) * choose(y, k) * factorial(k) * Math.pow(ratio, k);
  }
  return prefix * sum;
}

/** k! for small non-negative integers (goal counts stay tiny). */
function factorial(k: number): number {
  let product = 1;
  for (let i = 2; i <= k; i += 1) product *= i;
  return product;
}

/** Binomial coefficient C(n, k) via the multiplicative formula. */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i += 1) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/**
 * Full bivariate-Poisson score matrix from expected goals.
 *
 * Decomposition: l3 = covariance, l1 = goals.home - covariance,
 * l2 = goals.away - covariance — so the marginals E[X] = l1 + l3 = goals.home
 * and E[Y] = l2 + l3 = goals.away are preserved. If the requested covariance
 * would drive l1 or l2 non-positive it is clamped down to the largest value that
 * keeps both strictly positive (and to 0 if even that is impossible), guarding
 * the l3/(l1*l2) ratio.
 *
 * Formula: m[x][y] = bivariatePoissonPmf(x, y, l1, l2, l3)
 *
 * @param goals - Expected goals for home and away.
 * @param covariance - Desired Cov(home, away) >= 0 (default 0.1).
 * @param maxGoals - Inclusive upper bound on goals per side (default 10).
 * @returns A (maxGoals+1) x (maxGoals+1) matrix of joint probabilities.
 */
export function bivariateScoreMatrix(
  goals: GoalExpectation,
  covariance = 0.1,
  maxGoals = 10,
): number[][] {
  const size = maxGoals + 1;
  const l3 = resolveCovariance(goals, covariance);

  if (l3 === 0) {
    // Exactly the independent-Poisson model — share one implementation.
    return scoreMatrix(goals, maxGoals);
  }

  const l1 = goals.home - l3;
  const l2 = goals.away - l3;
  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      bivariatePoissonPmf(x, y, l1, l2, l3),
    ),
  );
}

/**
 * Clamp the desired covariance so l1 = home - cov and l2 = away - cov stay
 * strictly positive. Returns 0 when no positive covariance is feasible (e.g. a
 * side with zero expected goals).
 */
function resolveCovariance(goals: GoalExpectation, covariance: number): number {
  if (!Number.isFinite(covariance) || covariance <= 0) return 0;
  const maxFeasible = Math.min(goals.home, goals.away);
  if (maxFeasible <= 0) return 0;
  // Keep l1, l2 strictly positive: cap just under the smaller mean.
  const safeCap = maxFeasible * (1 - 1e-9);
  return Math.min(covariance, safeCap);
}
