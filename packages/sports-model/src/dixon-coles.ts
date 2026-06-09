// Dixon-Coles goal model. Extends the independent-Poisson baseline with the
// 1982 Dixon & Coles correction: a low-score dependence parameter rho that
// inflates the probability of 0-0 and 1-1 (and tweaks 1-0 / 0-1), fixing the
// well-known Poisson under-prediction of draws and tight low-scoring games. Also
// provides the exponential time-decay weight used to age historical matches.
// Pure, immutable, no globals.

import type { GoalExpectation } from "./types.js";
import { poissonPmf } from "./poisson.js";

/**
 * Dixon-Coles low-score dependence adjustment tau(h, a; lh, la, rho).
 *
 * Defined (Dixon & Coles 1997) only on the four lowest cells, 1 elsewhere:
 *   tau(0,0) = 1 - lambda_home * lambda_away * rho
 *   tau(0,1) = 1 + lambda_home * rho
 *   tau(1,0) = 1 + lambda_away * rho
 *   tau(1,1) = 1 - rho
 *   otherwise = 1
 *
 * A negative rho (typical, ~-0.05) raises tau(0,0) and tau(1,1) above 1 (more
 * mass on those draws) while lowering tau(1,0)/tau(0,1).
 *
 * @param homeGoals - Home score h.
 * @param awayGoals - Away score a.
 * @param lambdaHome - Home expected goals.
 * @param lambdaAway - Away expected goals.
 * @param rho - Dependence parameter.
 * @returns The multiplicative correction factor.
 */
export function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - lambdaHome * lambdaAway * rho;
  }
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

/**
 * Full Dixon-Coles score matrix.
 *
 * Formula: m[h][a] = poissonPmf(h, lh) * poissonPmf(a, la) * tau(h, a; lh, la, rho)
 * then the entire matrix is renormalised to sum to 1 (tau breaks the unit sum,
 * and truncation drops a little tail mass).
 *
 * @param goals - Expected goals for home and away.
 * @param rho - Dependence parameter (default -0.05).
 * @param maxGoals - Inclusive upper bound on goals per side (default 10).
 * @returns A (maxGoals+1) x (maxGoals+1) matrix of joint probabilities summing to 1.
 */
export function dixonColesScoreMatrix(
  goals: GoalExpectation,
  rho = -0.05,
  maxGoals = 10,
): number[][] {
  const size = maxGoals + 1;
  const raw = Array.from({ length: size }, (_, h) =>
    Array.from({ length: size }, (_, a) => {
      const base = poissonPmf(h, goals.home) * poissonPmf(a, goals.away);
      const tau = dixonColesTau(h, a, goals.home, goals.away, rho);
      return base * tau;
    }),
  );
  let total = 0;
  for (const row of raw) for (const p of row) total += p;
  if (total <= 0) return raw;
  return raw.map((row) => row.map((p) => p / total));
}

/**
 * Exponential time-decay weight for ageing historical matches.
 *
 * Formula: w(t) = exp(-xi * daysAgo)
 *
 * The default xi = 0.00095 ≈ ln(2) / 730 gives a half-life of ~730 days (about
 * two years): a match two years old contributes roughly half the weight of a
 * match played today. Recent form thus dominates the fit.
 *
 * @param daysAgo - Age of the match in days (>= 0). Negative ages clamp to 0.
 * @param xi - Decay rate per day (default 0.00095).
 * @returns A weight in (0, 1]; exactly 1 when daysAgo is 0.
 */
export function timeDecayWeight(daysAgo: number, xi = 0.00095): number {
  const age = Math.max(0, daysAgo);
  return Math.exp(-xi * age);
}
