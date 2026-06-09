import type { MatchResult, OneXTwo } from "./types.js";

// Turns a calibrated 1X2 probability into a decision. The eval (see eval/RESULTS.md)
// shows blanket 1X2 argmax tops out ~54% (even Pinnacle), but the CONFIDENCE-GATED
// subset hits 72-80%. So the product should only surface a "confident pick" when the
// top probability clears a threshold; everything else is shown as a probability, not a call.

export type ConfidenceTier = "high" | "medium" | "low";

export interface ConfidentPick {
  readonly pick: MatchResult;
  readonly probability: number;
  readonly confident: boolean;
  readonly tier: ConfidenceTier;
}

function topOutcome(forecast: OneXTwo): { pick: MatchResult; probability: number } {
  const entries: ReadonlyArray<[MatchResult, number]> = [
    ["home", forecast.home],
    ["draw", forecast.draw],
    ["away", forecast.away]
  ];
  const best = entries.reduce((acc, cur) => (cur[1] > acc[1] ? cur : acc));
  return { pick: best[0], probability: best[1] };
}

export function confidenceTier(probability: number): ConfidenceTier {
  if (probability >= 0.65) return "high";
  if (probability >= 0.5) return "medium";
  return "low";
}

/**
 * Pick the most likely 1X2 outcome and flag whether it clears the confidence
 * gate. Default threshold 0.6 → on the eval set those picks hit ~72% accuracy.
 */
export function confidentPick(forecast: OneXTwo, opts?: { threshold?: number }): ConfidentPick {
  const threshold = opts?.threshold ?? 0.6;
  const { pick, probability } = topOutcome(forecast);
  return { pick, probability, confident: probability >= threshold, tier: confidenceTier(probability) };
}

/**
 * Double-chance probabilities (reduce 3-way to 2-way: "X or Y"). These are
 * higher-probability, higher-accuracy targets than a single 1X2 pick.
 */
export function doubleChance(forecast: OneXTwo): {
  readonly homeOrDraw: number;
  readonly awayOrDraw: number;
  readonly homeOrAway: number;
} {
  return {
    homeOrDraw: forecast.home + forecast.draw,
    awayOrDraw: forecast.away + forecast.draw,
    homeOrAway: forecast.home + forecast.away
  };
}
