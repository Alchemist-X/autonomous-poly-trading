// Model evaluation + leaderboard for the FIFA-data 8-model engine.
//
// After every base/meta model produces 1X2 forecasts for a held-out set of
// matches, we need a single, comparable scorecard per model so we can rank them.
// This module computes the standard proper scoring rules from Kimi's 2026 World
// Cup report — multiclass log-loss, multiclass Brier, ordered Ranked Probability
// Score (RPS), top-class accuracy and Expected Calibration Error (ECE) — then
// builds and renders an ascending leaderboard.
//
// It reuses @autopoly/sports-model primitives (brierMulticlass,
// expectedCalibrationError) where they fit and computes the rest directly.
// Pure, immutable, market-blind. No I/O, no globals, no mutation.

import {
  brierMulticlass,
  expectedCalibrationError,
} from "@autopoly/sports-model";
import type { MatchResult, OneXTwo } from "@autopoly/sports-model";

/** The fixed 1X2 class order, ordered home > draw > away (ordinal for RPS). */
const CLASSES: readonly MatchResult[] = ["home", "draw", "away"];

/** A model's full scorecard over one evaluation set. Lower is better for all
 *  metrics except `accuracy` (higher is better). */
export interface ScoredModel {
  readonly id: string;
  readonly name: string;
  readonly logLoss: number;
  readonly brier: number;
  readonly rps: number;
  readonly accuracy: number;
  readonly ece: number;
  readonly n: number;
}

/** One forecast paired with the realised result. */
interface Prediction {
  readonly probs: OneXTwo;
  readonly result: MatchResult;
}

/** Clip a probability into [eps, 1 - eps] so logs stay finite. */
function clip(p: number, eps: number): number {
  if (!Number.isFinite(p)) return eps;
  return Math.min(1 - eps, Math.max(eps, p));
}

/** Index of the most-probable class in a 1X2 triple (ties resolved by order). */
function argmaxClass(probs: OneXTwo): MatchResult {
  let best: MatchResult = "home";
  let bestP = -Infinity;
  for (const c of CLASSES) {
    const p = probs[c];
    if (p > bestP) {
      bestP = p;
      best = c;
    }
  }
  return best;
}

/**
 * Ordered Ranked Probability Score for the three ordinal outcomes
 * home > draw > away (the report's RPS formula).
 *
 * Formula: with r = 3 ordered categories and cumulative predicted/actual
 * vectors cumPred_j, cumActual_j,
 *   RPS = (1 / (r - 1)) * Σ_{j=1..r-1} ( cumPred_j - cumActual_j )^2
 *
 * Summing only the first r-1 cumulative differences (the last cumulative pair is
 * always 1) and dividing by (r - 1) bounds the score to [0, 1]; 0 is a perfect,
 * fully-confident ordinal forecast. Lower is better. Unlike Brier, RPS rewards
 * forecasts that miss by a "near" category (home vs draw) over a "far" one
 * (home vs away).
 *
 * @param probs - Predicted 1X2 triple (not required to sum exactly to 1).
 * @param result - Realised match result.
 * @returns The ordered RPS in [0, 1].
 */
export function rankedProbabilityScore(
  probs: OneXTwo,
  result: MatchResult,
): number {
  const r = CLASSES.length;
  let cumPred = 0;
  let cumActual = 0;
  let sum = 0;
  // Accumulate over the first r-1 categories; the r-th pair cancels (both = 1).
  for (let j = 0; j < r - 1; j += 1) {
    const c = CLASSES[j] ?? "home";
    cumPred += probs[c];
    cumActual += c === result ? 1 : 0;
    sum += (cumPred - cumActual) ** 2;
  }
  return sum / (r - 1);
}

/** Mean of a numeric list, or 0 for an empty list. */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Score one model over its (forecast, result) pairs into a full ScoredModel.
 *
 * - logLoss: multiclass cross-entropy computed directly as the mean of
 *   -ln(p_trueclass) with probabilities clipped to keep the log finite.
 * - brier: multiclass Brier via sports-model `brierMulticlass`.
 * - rps: mean ordered `rankedProbabilityScore`.
 * - accuracy: share of matches whose argmax class equals the result.
 * - ece: `expectedCalibrationError` of the top-class probability against the
 *   indicator that the top class was correct (a calibration view of confidence).
 *
 * An empty prediction set yields all-zero metrics with n = 0.
 *
 * @param id - Stable model id.
 * @param name - Human-readable model name.
 * @param preds - Forecast/result pairs to score.
 * @param eps - Log-loss clipping epsilon (default 1e-15).
 * @returns The model's scorecard.
 */
export function scoreModel(
  id: string,
  name: string,
  preds: readonly Prediction[],
  eps = 1e-15,
): ScoredModel {
  const n = preds.length;
  if (n === 0) {
    return { id, name, logLoss: 0, brier: 0, rps: 0, accuracy: 0, ece: 0, n: 0 };
  }

  const forecasts = preds.map((p) => p.probs);
  const results = preds.map((p) => p.result);

  // Direct multiclass log-loss: -mean ln(p of the true class).
  const logLoss = mean(
    preds.map((p) => -Math.log(clip(p.probs[p.result], eps))),
  );

  const brier = brierMulticlass(forecasts, results);
  const rps = mean(preds.map((p) => rankedProbabilityScore(p.probs, p.result)));

  const hits = preds.map((p): 0 | 1 =>
    argmaxClass(p.probs) === p.result ? 1 : 0,
  );
  const accuracy = mean(hits);

  // ECE on confidence: top-class probability vs the indicator it was correct.
  const topProbs = preds.map((p) => p.probs[argmaxClass(p.probs)]);
  const ece = expectedCalibrationError(topProbs, hits);

  return { id, name, logLoss, brier, rps, accuracy, ece, n };
}

/**
 * Rank models ascending by log-loss (primary), breaking ties by Brier.
 * Pure: returns a new sorted array and never mutates the input.
 *
 * @param models - Scorecards to rank.
 * @returns A new array sorted best-first (lowest log-loss).
 */
export function leaderboard(models: readonly ScoredModel[]): ScoredModel[] {
  return [...models].sort((a, b) => {
    if (a.logLoss !== b.logLoss) return a.logLoss - b.logLoss;
    return a.brier - b.brier;
  });
}

/** Right-pad a string to a fixed width (left-align for the model name column). */
function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

/** Left-pad a string to a fixed width (right-align for numeric columns). */
function padLeft(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

/**
 * Render a leaderboard as a tidy aligned text table for terminal visibility
 * (INFO-level). Columns: rank, model, logLoss, brier, rps, acc, ece, n.
 * The input is ranked first so the table is always best-first regardless of the
 * caller's ordering. Pure: builds and returns a string, no I/O.
 *
 * @param models - Scorecards to render.
 * @returns A multi-line table string (header + one row per model).
 */
export function formatLeaderboard(models: readonly ScoredModel[]): string {
  const ranked = leaderboard(models);

  const fmt4 = (v: number): string => v.toFixed(4);
  const fmt3 = (v: number): string => v.toFixed(3);

  // Model column width adapts to the longest name (with a sane minimum).
  const nameWidth = Math.max(
    5,
    ...ranked.map((m) => m.name.length),
  );

  const header =
    padLeft("#", 3) +
    "  " +
    padRight("model", nameWidth) +
    "  " +
    padLeft("logLoss", 8) +
    "  " +
    padLeft("brier", 7) +
    "  " +
    padLeft("rps", 7) +
    "  " +
    padLeft("acc", 6) +
    "  " +
    padLeft("ece", 7) +
    "  " +
    padLeft("n", 4);

  const rows = ranked.map((m, i) =>
    padLeft(String(i + 1), 3) +
    "  " +
    padRight(m.name, nameWidth) +
    "  " +
    padLeft(fmt4(m.logLoss), 8) +
    "  " +
    padLeft(fmt4(m.brier), 7) +
    "  " +
    padLeft(fmt4(m.rps), 7) +
    "  " +
    padLeft(fmt3(m.accuracy), 6) +
    "  " +
    padLeft(fmt4(m.ece), 7) +
    "  " +
    padLeft(String(m.n), 4),
  );

  return [header, ...rows].join("\n");
}
