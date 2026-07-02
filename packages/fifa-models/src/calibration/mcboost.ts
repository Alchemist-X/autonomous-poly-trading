/**
 * MCBoost multicalibration (report section 5).
 *
 * A single 1X2 forecaster can be well-calibrated *on average* yet badly
 * miscalibrated on identifiable slices of fixtures — e.g. it may systematically
 * over-rate possession-dominant sides or under-rate counter-attacking ones. The
 * report's section 5 borrows the "multicalibration" idea (Hébert-Johnson et al.):
 * rather than only matching the global base rate, force the forecaster to be
 * calibrated *simultaneously* across a chosen collection of overlapping
 * subgroups. MCBoost is the boosting-style algorithm that achieves this.
 *
 * The procedure (report pseudocode):
 *   repeat up to T times
 *     for every (subgroup g, outcome class c), measure the calibration gap
 *       err(g, c) = mean_{x in g}[ 1{actual=c} ] − mean_{x in g}[ f(x)_c ]
 *     pick the (g*, c*) with the largest |err|
 *     if |err(g*, c*)| <= alpha: stop (everything is calibrated enough)
 *     fit a constant residual r = err(g*, c*) on that slice and nudge every
 *       member's class-c* probability:  f(x)_{c*} <- f(x)_{c*} + eta · r
 *     renormalise f(x) back to a probability simplex
 *   store the ordered list of (subgroupId, class residuals) corrections so the
 *   exact same nudges can be replayed on any new fixture.
 *
 * Everything here is market-blind: subgroup membership is decided purely from
 * FIFA-derived tactical/physical profile fields and Elo priors. No betting or
 * prediction-market data is read. The module is pure and immutable: fitting
 * returns a new model; applying returns a new probability triple.
 *
 * Per-subgroup samples at a single World Cup are tiny, so section 5.5 of the
 * report pairs the point estimate with a bootstrap confidence interval on the
 * per-subgroup calibration error (see {@link bootstrapCalibrationCI}).
 */

import {
  expectedCalibrationError,
  mulberry32,
  normaliseOneXTwo,
  randInt,
} from "@autopoly/sports-model";
import type { MatchResult, OneXTwo, ResolvedFixture } from "../types.js";

/** Fixed class order, matching @autopoly/sports-model's 1X2 convention. */
const CLASSES: readonly MatchResult[] = ["home", "draw", "away"];

/** Read a 1X2 triple's probability for a class given by its index 0/1/2. */
function probAtClass(probs: OneXTwo, classIndex: number): number {
  const cls = CLASSES[classIndex];
  if (cls === undefined) return 0;
  return probs[cls];
}

/** Build a new 1X2 triple from the constituent class probabilities. */
function tripleFrom(home: number, draw: number, away: number): OneXTwo {
  return { home, draw, away };
}

/**
 * Add `delta` to a single class of a 1X2 triple (clamped at 0) and renormalise.
 * Pure — returns a fresh triple, never mutates the input.
 */
function nudgeClass(probs: OneXTwo, classIndex: number, delta: number): OneXTwo {
  const home = probs.home + (classIndex === 0 ? delta : 0);
  const draw = probs.draw + (classIndex === 1 ? delta : 0);
  const away = probs.away + (classIndex === 2 ? delta : 0);
  return normaliseOneXTwo(tripleFrom(home, draw, away));
}

/**
 * A subgroup of fixtures the forecaster must be calibrated on. `test` decides
 * membership from on-pitch profile fields available in a ResolvedFixture (plus
 * the current prediction, which lets a subgroup condition on the forecast too,
 * though the shipped subgroups do not).
 */
export interface Subgroup {
  readonly id: string;
  readonly label: string;
  readonly test: (fixture: ResolvedFixture, probs: OneXTwo) => boolean;
}

/**
 * Tunable thresholds for the subgroup definitions. Defaults follow the report's
 * section 5 cut points; `c4HighIntensityKm` is the field-mean proxy for the
 * "high physical load" slice (C4) and is accepted as a threshold because the true
 * dataset mean depends on the tournament's extracted physical tables.
 * `confederationOf` is the optional cross-confederation lookup for C6: when it is
 * absent (or returns undefined for a team) the C6 subgroup matches nothing and is
 * effectively skipped, per the report's "if unavailable, skip" instruction.
 */
export interface SubgroupOptions {
  readonly c4HighIntensityKm?: number;
  readonly confederationOf?: (team: string) => string | undefined;
}

const DEFAULT_C4_HIGH_INTENSITY_KM = 9.0;

/**
 * Build the report's subgroup collection (C1..C6) bound to the given thresholds.
 * Each subgroup keys off team A's profile (the side whose win prob is `home`),
 * mirroring how the base models orient a fixture.
 */
export function makeSubgroups(opts: SubgroupOptions = {}): readonly Subgroup[] {
  const c4Threshold = opts.c4HighIntensityKm ?? DEFAULT_C4_HIGH_INTENSITY_KM;
  const confederationOf = opts.confederationOf;

  return [
    {
      id: "C1",
      label: "High possession (A possession > 55%)",
      test: (f) => f.profileA.possessionPct > 55,
    },
    {
      id: "C2",
      label: "High press (A high-press phase > 30%)",
      test: (f) => f.profileA.highPressPct > 30,
    },
    {
      id: "C3",
      label: "Defensive counter (A counter > 15% and possession < 45%)",
      test: (f) =>
        f.profileA.counterAttackPct > 15 && f.profileA.possessionPct < 45,
    },
    {
      id: "C4",
      label: "High physical load (A avg high-intensity km above field mean)",
      test: (f) => f.profileA.avgHighIntensityKm > c4Threshold,
    },
    {
      id: "C5",
      label: "Strength mismatch (|Elo_A − Elo_B| > 150)",
      test: (f) => Math.abs(f.priorA.elo - f.priorB.elo) > 150,
    },
    {
      id: "C6",
      label: "Cross-confederation (A and B from different confederations)",
      test: (f) => {
        if (confederationOf === undefined) return false;
        const confA = confederationOf(f.teamA);
        const confB = confederationOf(f.teamB);
        if (confA === undefined || confB === undefined) return false;
        return confA !== confB;
      },
    },
  ];
}

/**
 * Default subgroup collection (C6 inert because no confederation lookup is bound
 * here). Callers that have a confederation map should build their own with
 * {@link makeSubgroups} and pass it to {@link fitMCBoost} via `opts.subgroups`.
 */
export const SUBGROUPS: readonly Subgroup[] = makeSubgroups();

/** One labelled training point: a fixture, its current forecast, the result. */
export interface CalibrationSample {
  readonly fixture: ResolvedFixture;
  readonly probs: OneXTwo;
  readonly outcome: MatchResult;
}

/** One stored correction: a per-class residual applied to a subgroup's members. */
export interface MCBoostCorrection {
  readonly subgroupId: string;
  /** Signed residual nudge for each class, ordered home/draw/away. */
  readonly classResiduals: readonly [number, number, number];
}

/** The fitted multicalibrator: the subgroup set plus the ordered corrections. */
export interface MCBoostModel {
  readonly subgroups: readonly Subgroup[];
  readonly corrections: readonly MCBoostCorrection[];
  readonly alpha: number;
  readonly eta: number;
  readonly iterations: number;
}

/** Knobs for {@link fitMCBoost}. */
export interface FitMCBoostOptions extends SubgroupOptions {
  /** Calibration tolerance; stop once every subgroup×class gap is <= alpha. */
  readonly alpha?: number;
  /** Step size on each residual nudge (0..1]. */
  readonly eta?: number;
  /** Maximum boosting rounds. */
  readonly maxIterations?: number;
  /** Override the subgroup collection (e.g. with C6 bound to a real lookup). */
  readonly subgroups?: readonly Subgroup[];
}

const DEFAULT_ALPHA = 0.15; // relaxed tolerance for tiny per-subgroup samples
const DEFAULT_ETA = 1.0;
const DEFAULT_MAX_ITERATIONS = 20;

interface WorstSlice {
  readonly subgroupIndex: number;
  readonly classIndex: number;
  readonly residual: number; // mean(actual==c) − mean(predicted_c) on the slice
  readonly absError: number;
}

/**
 * Scan every subgroup×class and return the slice with the largest absolute
 * calibration gap, or null if no subgroup currently has any members.
 */
function findWorstSlice(
  subgroups: readonly Subgroup[],
  current: readonly OneXTwo[],
  samples: readonly CalibrationSample[],
): WorstSlice | null {
  let worst: WorstSlice | null = null;

  for (let g = 0; g < subgroups.length; g += 1) {
    const subgroup = subgroups[g];
    if (subgroup === undefined) continue;

    // Collect member indices once, reused across all three classes.
    const members: number[] = [];
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      const pred = current[i];
      if (sample === undefined || pred === undefined) continue;
      if (subgroup.test(sample.fixture, pred)) members.push(i);
    }
    if (members.length === 0) continue;

    for (let c = 0; c < CLASSES.length; c += 1) {
      const cls = CLASSES[c];
      if (cls === undefined) continue;
      let predSum = 0;
      let actualSum = 0;
      for (const i of members) {
        const pred = current[i];
        const sample = samples[i];
        if (pred === undefined || sample === undefined) continue;
        predSum += probAtClass(pred, c);
        actualSum += sample.outcome === cls ? 1 : 0;
      }
      const residual = (actualSum - predSum) / members.length;
      const absError = Math.abs(residual);
      if (worst === null || absError > worst.absError) {
        worst = { subgroupIndex: g, classIndex: c, residual, absError };
      }
    }
  }

  return worst;
}

/**
 * Fit the MCBoost multicalibrator on a labelled sample collection.
 *
 * Iteratively locates the worst-calibrated subgroup×class, records a constant
 * residual correction for it, and applies an `eta`-scaled nudge to every member's
 * prediction (renormalising afterwards). Stops once the largest remaining gap is
 * within `alpha` or after `maxIterations` rounds. The returned model stores the
 * corrections in application order so {@link applyMCBoost} can replay them.
 *
 * @returns A fitted, immutable {@link MCBoostModel}.
 */
export function fitMCBoost(
  samples: readonly CalibrationSample[],
  opts: FitMCBoostOptions = {},
): MCBoostModel {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const eta = opts.eta ?? DEFAULT_ETA;
  const maxIterations = Math.max(0, opts.maxIterations ?? DEFAULT_MAX_ITERATIONS);
  const subgroups =
    opts.subgroups ??
    makeSubgroups({
      c4HighIntensityKm: opts.c4HighIntensityKm,
      confederationOf: opts.confederationOf,
    });

  // Working copy of predictions, replaced (never mutated) each round.
  let current: readonly OneXTwo[] = samples.map((s) =>
    normaliseOneXTwo(s.probs),
  );
  const corrections: MCBoostCorrection[] = [];

  let rounds = 0;
  for (let t = 0; t < maxIterations; t += 1) {
    const worst = findWorstSlice(subgroups, current, samples);
    if (worst === null || worst.absError <= alpha) break;
    rounds += 1;

    const subgroup = subgroups[worst.subgroupIndex];
    if (subgroup === undefined) break;

    const delta = eta * worst.residual;
    const classResiduals: [number, number, number] = [0, 0, 0];
    classResiduals[worst.classIndex] = delta;
    corrections.push({ subgroupId: subgroup.id, classResiduals });

    // Apply the nudge to every current member and renormalise.
    current = current.map((pred, i) => {
      const sample = samples[i];
      if (sample === undefined) return pred;
      if (!subgroup.test(sample.fixture, pred)) return pred;
      return nudgeClass(pred, worst.classIndex, delta);
    });
  }

  return {
    subgroups,
    corrections,
    alpha,
    eta,
    iterations: rounds,
  };
}

/**
 * Replay a fitted model's stored corrections on a fresh fixture+prediction.
 *
 * Corrections are applied in the exact order they were learned; membership is
 * re-tested against the *running* prediction at each step (matching how fitting
 * re-tested members between rounds), and the triple is renormalised after each
 * applied nudge. Returns a new probability triple; the input is never mutated.
 */
export function applyMCBoost(
  model: MCBoostModel,
  fixture: ResolvedFixture,
  probs: OneXTwo,
): OneXTwo {
  const byId = new Map(model.subgroups.map((g) => [g.id, g]));
  let current = normaliseOneXTwo(probs);

  for (const correction of model.corrections) {
    const subgroup = byId.get(correction.subgroupId);
    if (subgroup === undefined) continue;
    if (!subgroup.test(fixture, current)) continue;
    for (let c = 0; c < correction.classResiduals.length; c += 1) {
      const delta = correction.classResiduals[c] ?? 0;
      if (delta === 0) continue;
      current = nudgeClass(current, c, delta);
    }
  }

  return current;
}

/** A bootstrap confidence interval on a per-subgroup calibration error. */
export interface CalibrationCI {
  readonly lo: number;
  readonly mean: number;
  readonly hi: number;
}

/** Knobs for {@link bootstrapCalibrationCI}. */
export interface BootstrapOptions extends SubgroupOptions {
  /** Number of bootstrap resamples (report 5.5 uses 1000). */
  readonly resamples?: number;
  /** Seed for the deterministic mulberry32 RNG (reproducible CIs). */
  readonly seed?: number;
  /** Lower percentile of the interval (default 2.5 → a 95% CI with `hiPct`). */
  readonly loPct?: number;
  /** Upper percentile of the interval (default 97.5). */
  readonly hiPct?: number;
  /** ECE bin count (default 10, matching sports-model). */
  readonly bins?: number;
  /** Override the subgroup collection. */
  readonly subgroups?: readonly Subgroup[];
}

const DEFAULT_RESAMPLES = 1000;
const DEFAULT_SEED = 0xc0ffee;
const DEFAULT_LO_PCT = 2.5;
const DEFAULT_HI_PCT = 97.5;

/** Linear-interpolated percentile of an ascending-sorted numeric array. */
function percentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;
  const rank = (Math.min(100, Math.max(0, pct)) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? loVal;
  if (lo === hi) return loVal;
  return loVal + (hiVal - loVal) * (rank - lo);
}

/**
 * Per-subgroup, per-class calibration error via a deterministic bootstrap.
 *
 * The members of `subgroupId` are resampled with replacement `B` times (seeded
 * mulberry32 + randInt); each resample's calibration error for class
 * `classIndex` is the binary Expected Calibration Error of that class's
 * predicted probability against the one-hot outcome (reusing sports-model's
 * {@link expectedCalibrationError}). The returned {lo, mean, hi} are the
 * percentile interval and mean of those B errors. Because per-subgroup samples
 * are tiny (report 5.5), this interval is what should be reported alongside the
 * point estimate. Returns all-zero when the subgroup has no members.
 *
 * @param subgroupId - Which subgroup (C1..C6) to evaluate.
 * @param classIndex - Class to score: 0=home, 1=draw, 2=away.
 */
export function bootstrapCalibrationCI(
  samples: readonly CalibrationSample[],
  subgroupId: string,
  classIndex: number,
  opts: BootstrapOptions = {},
): CalibrationCI {
  const resamples = Math.max(1, opts.resamples ?? DEFAULT_RESAMPLES);
  const seed = opts.seed ?? DEFAULT_SEED;
  const loPct = opts.loPct ?? DEFAULT_LO_PCT;
  const hiPct = opts.hiPct ?? DEFAULT_HI_PCT;
  const bins = opts.bins ?? 10;
  const cls = CLASSES[classIndex];

  const subgroups =
    opts.subgroups ??
    makeSubgroups({
      c4HighIntensityKm: opts.c4HighIntensityKm,
      confederationOf: opts.confederationOf,
    });
  const subgroup = subgroups.find((g) => g.id === subgroupId);

  if (subgroup === undefined || cls === undefined) {
    return { lo: 0, mean: 0, hi: 0 };
  }

  // Materialise the subgroup's (forecast, outcome) pairs once.
  const forecasts: number[] = [];
  const outcomes: (0 | 1)[] = [];
  for (const sample of samples) {
    const normalised = normaliseOneXTwo(sample.probs);
    if (!subgroup.test(sample.fixture, normalised)) continue;
    forecasts.push(probAtClass(normalised, classIndex));
    outcomes.push(sample.outcome === cls ? 1 : 0);
  }

  const n = forecasts.length;
  if (n === 0) return { lo: 0, mean: 0, hi: 0 };

  const rng = mulberry32(seed);
  const errors: number[] = [];
  for (let b = 0; b < resamples; b += 1) {
    const fSample = new Array<number>(n);
    const oSample = new Array<0 | 1>(n);
    for (let i = 0; i < n; i += 1) {
      const idx = randInt(rng, n);
      fSample[i] = forecasts[idx] ?? 0;
      oSample[i] = outcomes[idx] ?? 0;
    }
    errors.push(expectedCalibrationError(fSample, oSample, bins));
  }

  const sorted = [...errors].sort((a, b) => a - b);
  const mean = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  return {
    lo: percentile(sorted, loPct),
    mean,
    hi: percentile(sorted, hiPct),
  };
}
