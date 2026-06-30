/**
 * Knockout 90-minute DRAW recalibration, grounded in 2022 Qatar WC knockout data.
 *
 * The models are fit on group-stage scoring and under-weight the 90' draw for
 * knockouts: real WC knockouts sit at ~31% level-at-90' (5/16 in 2022) but the
 * engine averages ~23%. This lifts the draw probability toward the 2022 base
 * rate, scaled by how EVEN a tie looks on-pitch — even / low-scoring / defensive
 * ties draw more; lopsided ties barely move. Mass moves from {home, away} into
 * draw only, preserving the home:away ratio (who is favoured is untouched).
 *
 * 1X2-only (the Elo/Davidson models expose no goal matrix), applied per-forecaster
 * to knockout fixtures only. See runtime-artifacts/world-cup/fifa/2022-knockout/
 * calibration-spec.md for the derivation and the n=16 / extra-time caveats.
 *
 * Market-blind: uses only Elo priors + on-pitch FIFA stats; no prices.
 */

import type { OneXTwo, TeamProfile } from "../types.js";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Solved so the headline mean 90' draw across the live R32 fixtures hits 31.25%. */
export const KNOCKOUT_DRAW_K = 0.283;

/**
 * Evenness score e ∈ [0,1] for a tie: higher = more even / low-scoring / defensive
 * (more draw-prone). Weights 0.50 closeness / 0.30 low-scoring / 0.20 defensive
 * (only the defensive ratio survived the 2022 length confound; see spec §1.3–1.4).
 */
export const knockoutEvenness = (a: TeamProfile, b: TeamProfile): number => {
  const close = 1 - clamp01(Math.abs(a.prior.elo - b.prior.elo) / 200);
  const low = 1 - clamp01((a.attackRate + b.attackRate) / 4.0);
  const defensive = clamp01((a.lowBlockPct + b.lowBlockPct) / 55);
  return clamp01(0.5 * close + 0.3 * low + 0.2 * defensive);
};

/**
 * Lift the draw of a knockout 1X2 toward the historical rate, scaled by evenness.
 * Pure: returns a new triple summing to 1; never mutates. Degenerate inputs
 * (draw ≥ 1, no win mass) return the input unchanged.
 */
export const calibrateKnockoutDraw = (
  probs: OneXTwo,
  profileA: TeamProfile,
  profileB: TeamProfile,
  k: number = KNOCKOUT_DRAW_K,
): OneXTwo => {
  const { home, draw, away } = probs;
  const winMass = home + away;
  if (!(draw < 1) || winMass <= 0) return probs;
  const e = knockoutEvenness(profileA, profileB);
  const drawNew = Math.min(0.9, draw + k * e * (1 - draw));
  const scale = (1 - drawNew) / winMass; // preserves home:away, total stays 1
  return { home: home * scale, draw: drawNew, away: away * scale };
};
