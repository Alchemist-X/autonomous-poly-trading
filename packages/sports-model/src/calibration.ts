// Calibration / evaluation module — reproduces the 校准 (calibration) and scoring
// methods from Kimi's 2026 World Cup report. After a model produces forecasts we
// must score how good they are: Brier score and log-loss measure sharpness +
// calibration jointly, while the Expected Calibration Error (ECE) isolates how
// well predicted probabilities match observed frequencies. Pure, immutable, no
// globals, no I/O.

import type { MatchResult, OneXTwo } from "./types.js";

/** The fixed class order used when scoring 1X2 forecasts. */
const CLASSES: readonly MatchResult[] = ["home", "draw", "away"];

/**
 * Binary Brier score — mean squared error of probabilistic forecasts.
 *
 * Formula: Brier = (1/N) * Σ_i ( p_i - o_i )^2 ,  o_i ∈ {0, 1}
 *
 * 0 is perfect, 1 is worst (always wrong with full confidence), 0.25 is the
 * score of a constant 0.5 forecast. Lower is better.
 *
 * @param forecasts - Predicted probabilities of the positive class, in [0, 1].
 * @param outcomes - Realised binary outcomes (0 or 1), same length as forecasts.
 * @returns The mean squared error; 0 for an empty input.
 */
export function brierBinary(
  forecasts: readonly number[],
  outcomes: readonly (0 | 1)[],
): number {
  const n = Math.min(forecasts.length, outcomes.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const p = forecasts[i] ?? 0;
    const o = outcomes[i] ?? 0;
    sum += (p - o) ** 2;
  }
  return sum / n;
}

/**
 * Multi-class (3-class 1X2) Brier score.
 *
 * Formula: Brier = (1/N) * Σ_i Σ_c ( p_{i,c} - 1{c = actual_i} )^2
 *
 * Per sample, sum the squared error over the three classes (home/draw/away)
 * against the one-hot actual result, then average over samples. Ranges 0..2;
 * 0 is a perfect, fully-confident forecast. Lower is better.
 *
 * @param forecasts - Predicted 1X2 triples, one per sample.
 * @param results - Realised match results, same length as forecasts.
 * @returns The mean per-sample multi-class Brier; 0 for an empty input.
 */
export function brierMulticlass(
  forecasts: readonly OneXTwo[],
  results: readonly MatchResult[],
): number {
  const n = Math.min(forecasts.length, results.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const f = forecasts[i];
    const actual = results[i];
    if (!f || !actual) continue;
    for (const c of CLASSES) {
      const p = f[c];
      const indicator = c === actual ? 1 : 0;
      sum += (p - indicator) ** 2;
    }
  }
  return sum / n;
}

/**
 * Logarithmic loss (cross-entropy) for binary forecasts.
 *
 * Formula: logLoss = -(1/N) * Σ_i [ o_i * ln(p_i) + (1 - o_i) * ln(1 - p_i) ]
 *
 * Probabilities are clipped to [eps, 1 - eps] before the log so a confident
 * wrong forecast yields a large-but-finite penalty rather than Infinity. 0 is a
 * perfect forecast; lower is better. Punishes confident mistakes harder than the
 * Brier score does.
 *
 * @param forecasts - Predicted probabilities of the positive class, in [0, 1].
 * @param outcomes - Realised binary outcomes (0 or 1), same length as forecasts.
 * @param eps - Clipping epsilon to keep logs finite (default 1e-15).
 * @returns The mean negative log-likelihood; 0 for an empty input.
 */
export function logLoss(
  forecasts: readonly number[],
  outcomes: readonly (0 | 1)[],
  eps = 1e-15,
): number {
  const n = Math.min(forecasts.length, outcomes.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const raw = forecasts[i] ?? 0;
    const p = Math.min(1 - eps, Math.max(eps, raw));
    const o = outcomes[i] ?? 0;
    sum += o * Math.log(p) + (1 - o) * Math.log(1 - p);
  }
  return -sum / n;
}

/**
 * Expected Calibration Error (ECE) for binary forecasts.
 *
 * Formula: bin forecasts into B equal-width buckets of [0, 1]; then
 *   ECE = Σ_b ( n_b / N ) * | acc_b - conf_b |
 * where for bucket b, n_b is its count, acc_b is the mean outcome (observed
 * frequency) and conf_b is the mean forecast (predicted confidence).
 *
 * Measures the average gap between predicted probability and observed frequency.
 * 0 means perfectly calibrated. Empty buckets contribute nothing.
 *
 * @param forecasts - Predicted probabilities of the positive class, in [0, 1].
 * @param outcomes - Realised binary outcomes (0 or 1), same length as forecasts.
 * @param bins - Number of equal-width probability buckets (default 10).
 * @returns The expected calibration error in [0, 1]; 0 for an empty input.
 */
export function expectedCalibrationError(
  forecasts: readonly number[],
  outcomes: readonly (0 | 1)[],
  bins = 10,
): number {
  const n = Math.min(forecasts.length, outcomes.length);
  if (n === 0) return 0;
  const binCount = Math.max(1, Math.floor(bins));
  const counts = new Array<number>(binCount).fill(0);
  const confSum = new Array<number>(binCount).fill(0);
  const accSum = new Array<number>(binCount).fill(0);

  for (let i = 0; i < n; i += 1) {
    const p = Math.min(1, Math.max(0, forecasts[i] ?? 0));
    const o = outcomes[i] ?? 0;
    // Map p into [0, binCount); p === 1 lands in the last bucket.
    const idx = Math.min(binCount - 1, Math.floor(p * binCount));
    counts[idx] = (counts[idx] ?? 0) + 1;
    confSum[idx] = (confSum[idx] ?? 0) + p;
    accSum[idx] = (accSum[idx] ?? 0) + o;
  }

  let ece = 0;
  for (let b = 0; b < binCount; b += 1) {
    const nb = counts[b] ?? 0;
    if (nb === 0) continue;
    const conf = (confSum[b] ?? 0) / nb;
    const acc = (accSum[b] ?? 0) / nb;
    ece += (nb / n) * Math.abs(acc - conf);
  }
  return ece;
}
