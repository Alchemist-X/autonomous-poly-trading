/** Forecast-evaluation metrics for 1X2 (3-class) and binary markets. */
import type { MatchResult, OneXTwo } from "../src/types.js";

const ORDER: readonly MatchResult[] = ["home", "draw", "away"];

function indicator(result: MatchResult): [number, number, number] {
  return [result === "home" ? 1 : 0, result === "draw" ? 1 : 0, result === "away" ? 1 : 0];
}

function asArray(p: OneXTwo): [number, number, number] {
  return [p.home, p.draw, p.away];
}

/** Ranked Probability Score — the standard ordered-1X2 metric (lower is better). */
export function rankedProbabilityScore(forecast: OneXTwo, result: MatchResult): number {
  const p = asArray(forecast);
  const o = indicator(result);
  let cumP = 0;
  let cumO = 0;
  let sum = 0;
  for (let i = 0; i < ORDER.length - 1; i += 1) {
    cumP += p[i] ?? 0;
    cumO += o[i] ?? 0;
    sum += (cumP - cumO) ** 2;
  }
  return sum / (ORDER.length - 1);
}

/** Multiclass log loss for a single 1X2 prediction (lower is better). */
export function logLossOneXTwo(forecast: OneXTwo, result: MatchResult, eps = 1e-15): number {
  const idx = ORDER.indexOf(result);
  const p = Math.min(1 - eps, Math.max(eps, asArray(forecast)[idx] ?? eps));
  return -Math.log(p);
}

/** 3-class Brier score for a single prediction (range 0..2). */
export function brierOneXTwo(forecast: OneXTwo, result: MatchResult): number {
  const p = asArray(forecast);
  const o = indicator(result);
  return p.reduce((acc, pi, i) => acc + (pi - (o[i] ?? 0)) ** 2, 0);
}

export function argmaxResult(forecast: OneXTwo): MatchResult {
  const p = asArray(forecast);
  let best = 0;
  for (let i = 1; i < p.length; i += 1) if ((p[i] ?? 0) > (p[best] ?? 0)) best = i;
  return ORDER[best] ?? "home";
}

export interface AggregateMetrics {
  readonly n: number;
  readonly rps: number;
  readonly logLoss: number;
  readonly brier: number;
  readonly accuracy: number;
}

/** Aggregate metrics over many 1X2 forecasts vs actual results. */
export function aggregate1x2(
  forecasts: ReadonlyArray<OneXTwo>,
  results: ReadonlyArray<MatchResult>
): AggregateMetrics {
  const n = forecasts.length;
  if (n === 0) return { n: 0, rps: NaN, logLoss: NaN, brier: NaN, accuracy: NaN };
  let rps = 0;
  let ll = 0;
  let brier = 0;
  let correct = 0;
  for (let i = 0; i < n; i += 1) {
    const f = forecasts[i]!;
    const r = results[i]!;
    rps += rankedProbabilityScore(f, r);
    ll += logLossOneXTwo(f, r);
    brier += brierOneXTwo(f, r);
    if (argmaxResult(f) === r) correct += 1;
  }
  return { n, rps: rps / n, logLoss: ll / n, brier: brier / n, accuracy: correct / n };
}

/** Binary log loss (e.g. over/under). */
export function binaryLogLoss(probs: readonly number[], outcomes: readonly (0 | 1)[], eps = 1e-15): number {
  if (probs.length === 0) return NaN;
  let sum = 0;
  for (let i = 0; i < probs.length; i += 1) {
    const p = Math.min(1 - eps, Math.max(eps, probs[i] ?? 0.5));
    sum += (outcomes[i] ?? 0) === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  return sum / probs.length;
}

/** Reliability table: bins predictions and compares predicted vs observed frequency. */
export function reliabilityTable(
  probs: readonly number[],
  outcomes: readonly (0 | 1)[],
  bins = 10
): Array<{ bin: string; n: number; predicted: number; observed: number }> {
  const buckets = Array.from({ length: bins }, () => ({ count: 0, pSum: 0, oSum: 0 }));
  for (let i = 0; i < probs.length; i += 1) {
    const p = Math.min(0.999999, Math.max(0, probs[i] ?? 0));
    const b = Math.min(bins - 1, Math.floor(p * bins));
    const bucket = buckets[b]!;
    bucket.count += 1;
    bucket.pSum += p;
    bucket.oSum += outcomes[i] ?? 0;
  }
  return buckets.map((bucket, i) => ({
    bin: `${(i / bins).toFixed(1)}-${((i + 1) / bins).toFixed(1)}`,
    n: bucket.count,
    predicted: bucket.count ? bucket.pSum / bucket.count : 0,
    observed: bucket.count ? bucket.oSum / bucket.count : 0
  }));
}
