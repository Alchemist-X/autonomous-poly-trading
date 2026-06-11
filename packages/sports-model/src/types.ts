// Shared contract for @autopoly/sports-model. All probabilities are in [0, 1].
// Every module is a pure function library — no I/O, no mutation, no globals.
// This file is the single source of truth for cross-module types; module
// authors MUST conform to these shapes rather than inventing their own.

export type MatchResult = "home" | "draw" | "away";

/** Home win / draw / away win probabilities. By convention these sum to ~1. */
export interface OneXTwo {
  readonly home: number;
  readonly draw: number;
  readonly away: number;
}

/**
 * Score probability matrix. matrix[h][a] = P(home scores h, away scores a).
 * Always a square (maxGoals+1) × (maxGoals+1) grid indexed from 0.
 */
export type ScoreMatrix = ReadonlyArray<ReadonlyArray<number>>;

/** Expected goals (Poisson rate parameters) for a single fixture. */
export interface GoalExpectation {
  readonly home: number; // lambda_home
  readonly away: number; // lambda_away
}

/** Result of a forecast-vs-actual evaluation over many predictions. */
export interface CalibrationSummary {
  readonly count: number;
  readonly brier: number;
  readonly logLoss: number;
}

export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/** Normalise a 1X2 triple so the three probabilities sum to 1. */
export function normaliseOneXTwo(raw: OneXTwo): OneXTwo {
  const home = Math.max(0, raw.home);
  const draw = Math.max(0, raw.draw);
  const away = Math.max(0, raw.away);
  const total = home + draw + away;
  if (total <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return { home: home / total, draw: draw / total, away: away / total };
}
