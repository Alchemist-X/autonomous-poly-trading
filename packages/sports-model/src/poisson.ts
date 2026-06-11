// Independent-Poisson goal model. The classic baseline used in the Kimi 2026
// World Cup report: home and away goals are modelled as two independent Poisson
// variables with rates lambda_home / lambda_away, giving a full score matrix
// from which every derived market (1X2, over/under, BTTS, correct score) is read
// off by summing the relevant cells. Pure, immutable, no globals.

import type { GoalExpectation, OneXTwo, ScoreMatrix } from "./types.js";
import { normaliseOneXTwo } from "./types.js";

/**
 * Poisson probability mass function.
 *
 * Formula: P(X = k) = e^(-lambda) * lambda^k / k!
 *
 * Computed in log space then exponentiated to stay numerically stable for
 * larger k (avoids overflow of lambda^k and k! taken separately).
 *
 * @param k - Non-negative integer goal count.
 * @param lambda - Poisson rate (expected goals), must be >= 0.
 * @returns Probability of exactly k goals; 0 for invalid inputs.
 */
export function poissonPmf(k: number, lambda: number): number {
  if (!Number.isFinite(k) || !Number.isFinite(lambda)) return 0;
  if (k < 0 || lambda < 0 || !Number.isInteger(k)) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;
  // log P = -lambda + k*ln(lambda) - ln(k!)
  const logPmf = -lambda + k * Math.log(lambda) - logFactorial(k);
  return Math.exp(logPmf);
}

/** Natural log of k! via the log-gamma identity ln(k!) = lnGamma(k + 1). */
function logFactorial(k: number): number {
  let sum = 0;
  for (let i = 2; i <= k; i += 1) sum += Math.log(i);
  return sum;
}

/**
 * Full score probability matrix under the independent-Poisson assumption.
 *
 * Formula: m[h][a] = poissonPmf(h, lambda_home) * poissonPmf(a, lambda_away)
 *
 * Rows are home goals 0..maxGoals, columns are away goals 0..maxGoals. The grid
 * is truncated at maxGoals so rows/columns sum to slightly under 1 (the missing
 * tail mass is negligible for sane lambdas).
 *
 * @param goals - Expected goals for home and away.
 * @param maxGoals - Inclusive upper bound on goals per side (default 10).
 * @returns A (maxGoals+1) x (maxGoals+1) matrix of joint probabilities.
 */
export function scoreMatrix(goals: GoalExpectation, maxGoals = 10): number[][] {
  const size = maxGoals + 1;
  const homePmf = Array.from({ length: size }, (_, h) =>
    poissonPmf(h, goals.home),
  );
  const awayPmf = Array.from({ length: size }, (_, a) =>
    poissonPmf(a, goals.away),
  );
  return Array.from({ length: size }, (_, h) =>
    Array.from(
      { length: size },
      (_, a) => (homePmf[h] ?? 0) * (awayPmf[a] ?? 0),
    ),
  );
}

/**
 * Collapse a score matrix into home / draw / away probabilities.
 *
 * P(home) = sum over h > a, P(draw) = sum over h == a, P(away) = sum over h < a.
 * The result is normalised so the triple sums to 1 (correcting the truncation
 * tail dropped by a finite matrix).
 *
 * @param matrix - Joint score probabilities.
 * @returns Normalised 1X2 probabilities.
 */
export function outcomeProbabilities(matrix: ScoreMatrix): OneXTwo {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h < matrix.length; h += 1) {
    const row = matrix[h] ?? [];
    for (let a = 0; a < row.length; a += 1) {
      const p = row[a] ?? 0;
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  return normaliseOneXTwo({ home, draw, away });
}

/**
 * Over/Under total-goals probabilities for a given line.
 *
 * "Over" = P(home + away > line), "Under" = P(home + away < line). Lines are
 * conventionally half-integers (e.g. 2.5) so no exact push is possible; with an
 * integer line the push mass falls into neither bucket. The two returned values
 * are renormalised to sum to 1 (push removed, tail truncation corrected).
 *
 * @param matrix - Joint score probabilities.
 * @param line - Total-goals threshold, e.g. 2.5.
 * @returns Over and under probabilities summing to 1.
 */
export function overUnderProbabilities(
  matrix: ScoreMatrix,
  line: number,
): { over: number; under: number } {
  let over = 0;
  let under = 0;
  for (let h = 0; h < matrix.length; h += 1) {
    const row = matrix[h] ?? [];
    for (let a = 0; a < row.length; a += 1) {
      const p = row[a] ?? 0;
      const total = h + a;
      if (total > line) over += p;
      else if (total < line) under += p;
      // total === line is a push: counted in neither bucket.
    }
  }
  const sum = over + under;
  if (sum <= 0) return { over: 0.5, under: 0.5 };
  return { over: over / sum, under: under / sum };
}

/**
 * Both-Teams-To-Score (BTTS) probabilities.
 *
 * yes = P(home >= 1 AND away >= 1), no = 1 - yes. Computed by summing every cell
 * with h >= 1 and a >= 1, then renormalising the yes/no pair to sum to 1 so the
 * truncation tail is absorbed.
 *
 * @param matrix - Joint score probabilities.
 * @returns BTTS yes and no probabilities summing to 1.
 */
export function bothTeamsToScore(matrix: ScoreMatrix): {
  yes: number;
  no: number;
} {
  let yes = 0;
  let total = 0;
  for (let h = 0; h < matrix.length; h += 1) {
    const row = matrix[h] ?? [];
    for (let a = 0; a < row.length; a += 1) {
      const p = row[a] ?? 0;
      total += p;
      if (h >= 1 && a >= 1) yes += p;
    }
  }
  if (total <= 0) return { yes: 0, no: 1 };
  const yesNorm = yes / total;
  return { yes: yesNorm, no: 1 - yesNorm };
}

/**
 * The most likely exact scorelines, sorted by descending probability.
 *
 * @param matrix - Joint score probabilities.
 * @param topN - Number of scorelines to return (default 5).
 * @returns Up to topN entries { home, away, prob }, highest probability first.
 */
export function mostLikelyScores(
  matrix: ScoreMatrix,
  topN = 5,
): Array<{ home: number; away: number; prob: number }> {
  const entries: Array<{ home: number; away: number; prob: number }> = [];
  for (let h = 0; h < matrix.length; h += 1) {
    const row = matrix[h] ?? [];
    for (let a = 0; a < row.length; a += 1) {
      entries.push({ home: h, away: a, prob: row[a] ?? 0 });
    }
  }
  return [...entries]
    .sort((x, y) => y.prob - x.prob)
    .slice(0, Math.max(0, topN));
}
