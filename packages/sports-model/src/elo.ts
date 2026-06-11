// Elo / FIFA-SUM strength module — a faithful reproduction of the Elo method
// described in Kimi's 2026 World Cup report. Pure functions only: no mutation,
// no globals, no I/O. FIFA's "SUM" rating system uses a logistic with scale 600
// and a World Cup K-factor of 60.

import type { OneXTwo } from "./types.js";
import { normaliseOneXTwo } from "./types.js";

/**
 * Logistic expected score of A vs B: 1 / (1 + 10^((ratingB - ratingA) / scale)).
 * FIFA uses scale = 600; returns A's expected result in [0, 1].
 */
export function eloExpectedScore(
  ratingA: number,
  ratingB: number,
  scale = 600,
): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / scale));
}

/**
 * Elo rating update: rating + k * (actual - expected), actual ∈ {1, 0.5, 0}.
 * World Cup K = 60.
 */
export function eloUpdate(
  rating: number,
  expected: number,
  actual: number,
  k: number,
): number {
  return rating + k * (actual - expected);
}

/**
 * FIFA-SUM elo-ized expected result of A vs B: same logistic with scale 600,
 * i.e. 1 / (1 + 10^((ratingB - ratingA) / 600)).
 */
export function fifaSumExpected(ratingA: number, ratingB: number): number {
  return eloExpectedScore(ratingA, ratingB, 600);
}

/** Tuning knobs for {@link eloToOneXTwo}; all optional with FIFA-style defaults. */
export interface EloToOneXTwoOptions {
  readonly scale?: number;
  readonly homeAdvantage?: number;
  readonly drawNu?: number;
}

/**
 * Davidson (1970) ties extension of Bradley–Terry: with
 * wH = 10^((ratingHome + homeAdvantage)/scale), wA = 10^(ratingAway/scale),
 * wD = drawNu * sqrt(wH * wA), return normalise(home: wH, draw: wD, away: wA).
 * Defaults: scale = 600, homeAdvantage = 65, drawNu = 0.70.
 */
export function eloToOneXTwo(
  ratingHome: number,
  ratingAway: number,
  opts?: EloToOneXTwoOptions,
): OneXTwo {
  const scale = opts?.scale ?? 600;
  const homeAdvantage = opts?.homeAdvantage ?? 65;
  const drawNu = opts?.drawNu ?? 0.7;

  const wH = Math.pow(10, (ratingHome + homeAdvantage) / scale);
  const wA = Math.pow(10, ratingAway / scale);
  const wD = drawNu * Math.sqrt(wH * wA);

  return normaliseOneXTwo({ home: wH, draw: wD, away: wA });
}
