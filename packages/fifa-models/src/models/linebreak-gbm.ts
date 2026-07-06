/**
 * Model 6 — Line-breaks & offers efficiency, gradient-boosted.
 *
 * Idea: in knockout football the side that penetrates the opponent's defensive
 * lines more cleanly (higher line-break success, more 4-unit penetrations) and
 * converts the resulting chances (offer conversion) tends to win. We learn how
 * those penetration/creation signals map to outcomes from the group stage and
 * apply that mapping to a knockout fixture.
 *
 * Mechanics: the feature vector for a fixture is the team-A-minus-team-B
 * DIFFERENCE of six profile fields. We train three one-vs-rest gradient-boosted
 * regressors (one each for the home / draw / away target) and read their three
 * raw scores at predict time, then clamp + normalise into a 1X2 probability.
 *
 * Leakage-safety: training rows for a group match are built from each team's
 * `profileAsOf(match.date)` — i.e. only that team's matches strictly before the
 * fixture — so a match never sees itself or the future. Cold start (< MIN_ROWS
 * usable rows) falls back to a logistic of the attack/defence gap.
 *
 * Market-blind: only FIFA on-pitch stats and pre-tournament Elo priors (already
 * baked into the profiles) are consumed. No betting or market data ever enters.
 */

import {
  fitGradientBoosting,
  predictGradientBoosting,
  fitLogisticRegression,
  predictProbability,
  normaliseOneXTwo,
  clampProbability,
  type GradientBoostingModel,
  type LogisticModel,
  type MatchResult,
  type OneXTwo,
} from "@autopoly/sports-model";

import type {
  Driver,
  FitInput,
  ModelPrediction,
  PredictionModel,
  Rationale,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

import {
  buildFieldContext,
  profileAsOf,
  type FieldContext,
} from "../profile.js";

/** Minimum usable training rows before we trust the boosted model. */
const MIN_ROWS = 8;
/** Boosting hyper-parameters (compact, deterministic). */
const N_ROUNDS = 40;
const LEARNING_RATE = 0.1;
const MAX_DEPTH = 3;
/** Logistic fallback: how strongly the attack/defence gap maps to a win. */
const FALLBACK_GAP_SCALE = 1.4;

/** Fitted state: three one-vs-rest boosters, the fallback, and feature means. */
export interface LinebreakGbmState {
  readonly home: GradientBoostingModel | null;
  readonly draw: GradientBoostingModel | null;
  readonly away: GradientBoostingModel | null;
  /** Per-feature training means, for any future imputation / inspection. */
  readonly featureMeans: readonly number[];
  /** Number of leakage-safe rows used to fit. */
  readonly rows: number;
  /** Cold-start logistic on the attack/defence gap (always fitted as a floor). */
  readonly fallback: LogisticModel;
  /** Whether the boosted models are trusted (rows >= MIN_ROWS). */
  readonly useBoosted: boolean;
}

/** The six penetration/creation features, in fixed order. */
const FEATURE_LABELS = [
  "lineBreakSuccessPct",
  "lb4UnitShare",
  "offerConversionPct",
  "attackRate",
  "defenseRate",
  "possessionPct",
] as const;

/** Project a single profile onto the model's raw feature space (pre-difference). */
function profileFeatures(p: TeamProfile): readonly number[] {
  return [
    p.lineBreakSuccessPct,
    p.lb4UnitShare,
    p.offerConversionPct,
    p.attackRate,
    p.defenseRate,
    p.possessionPct,
  ];
}

/** Feature vector for a fixture = element-wise difference (team A − team B). */
function featureDiff(a: TeamProfile, b: TeamProfile): number[] {
  const fa = profileFeatures(a);
  const fb = profileFeatures(b);
  return fa.map((v, i) => v - (fb[i] ?? 0));
}

/** Net attack-minus-defence quality for one team (used by the fallback). */
function netQuality(p: TeamProfile): number {
  return p.attackRate - p.defenseRate;
}

/** Column means of a feature matrix; zeros when the matrix is empty. */
function columnMeans(rows: readonly number[][], width: number): number[] {
  const sums = new Array<number>(width).fill(0);
  if (rows.length === 0) return sums;
  for (const row of rows) {
    for (let j = 0; j < width; j += 1) sums[j] = (sums[j] ?? 0) + (row[j] ?? 0);
  }
  return sums.map((s) => s / rows.length);
}

/** Group every team's stats from the completed matches (both perspectives). */
function statsByTeam(
  input: FitInput,
): { all: TeamMatchStats[]; byTeam: Map<string, TeamMatchStats[]> } {
  const all: TeamMatchStats[] = [];
  const byTeam = new Map<string, TeamMatchStats[]>();
  for (const m of input.matches) {
    for (const s of [m.home, m.away]) {
      all.push(s);
      const list = byTeam.get(s.team) ?? [];
      byTeam.set(s.team, [...list, s]);
    }
  }
  return { all, byTeam };
}

/** Resolve a team's prior, defaulting to the field-mean Elo when unknown. */
function priorFor(
  team: string,
  priors: ReadonlyMap<string, TeamPrior>,
  field: FieldContext,
): TeamPrior {
  return (
    priors.get(team) ?? { team, elo: field.eloMean, squadValueIndex: null }
  );
}

/**
 * Build leakage-safe training rows: for each completed match, both teams'
 * profiles "as of" that match's date, the A−B feature difference, and the label.
 */
function buildTrainingRows(
  input: FitInput,
): { X: number[][]; labels: MatchResult[] } {
  const { all, byTeam } = statsByTeam(input);
  const field = buildFieldContext(all, input.priors);

  const X: number[][] = [];
  const labels: MatchResult[] = [];

  for (const m of input.matches) {
    const teamA = m.home.team;
    const teamB = m.away.team;
    const priorA = priorFor(teamA, input.priors, field);
    const priorB = priorFor(teamB, input.priors, field);

    const profileA = profileAsOf(
      teamA,
      byTeam.get(teamA) ?? [],
      priorA,
      field,
      m.date,
    );
    const profileB = profileAsOf(
      teamB,
      byTeam.get(teamB) ?? [],
      priorB,
      field,
      m.date,
    );

    X.push(featureDiff(profileA, profileB));
    labels.push(m.result);
  }

  return { X, labels };
}

/** Fit one one-vs-rest booster for a given outcome; null when no rows. */
function fitOneVsRest(
  X: number[][],
  labels: readonly MatchResult[],
  target: MatchResult,
): GradientBoostingModel | null {
  if (X.length === 0) return null;
  const y = labels.map((r) => (r === target ? 1 : 0));
  return fitGradientBoosting(X, y, {
    nRounds: N_ROUNDS,
    learningRate: LEARNING_RATE,
    maxDepth: MAX_DEPTH,
  });
}

/** Fit the cold-start logistic: P(A win) from the net attack/defence gap. */
function fitFallback(
  X: number[][],
  labels: readonly MatchResult[],
  input: FitInput,
): LogisticModel {
  const { all, byTeam } = statsByTeam(input);
  const field = buildFieldContext(all, input.priors);
  const gapRows: number[][] = [];
  const y: (0 | 1)[] = [];
  for (const m of input.matches) {
    const priorA = priorFor(m.home.team, input.priors, field);
    const priorB = priorFor(m.away.team, input.priors, field);
    const pa = profileAsOf(m.home.team, byTeam.get(m.home.team) ?? [], priorA, field, m.date);
    const pb = profileAsOf(m.away.team, byTeam.get(m.away.team) ?? [], priorB, field, m.date);
    gapRows.push([(netQuality(pa) - netQuality(pb)) * FALLBACK_GAP_SCALE]);
    y.push(m.result === "home" ? 1 : 0);
  }
  if (gapRows.length === 0) return { weights: [1], bias: 0 };
  return fitLogisticRegression(gapRows, y, { epochs: 400, learningRate: 0.2 });
}

/** Raw boosted score for an outcome, or a neutral 1/3 when its model is absent. */
function boostedScore(
  model: GradientBoostingModel | null,
  x: number[],
): number {
  if (!model) return 1 / 3;
  return clampProbability(predictGradientBoosting(model, x));
}

/** Cold-start probabilities from the net-quality gap logistic. */
function fallbackProbs(state: LinebreakGbmState, gap: number): OneXTwo {
  const pHome = predictProbability(state.fallback, [gap * FALLBACK_GAP_SCALE]);
  const pAway = predictProbability(state.fallback, [-gap * FALLBACK_GAP_SCALE]);
  // Draw mass shrinks as the gap (decisiveness) grows.
  const draw = 0.27 * Math.exp(-Math.abs(gap));
  return normaliseOneXTwo({
    home: pHome * (1 - draw),
    draw,
    away: pAway * (1 - draw),
  });
}

/** Pick a plain-language strength word for the headline given the leader's edge. */
function strengthWord(margin: number): string {
  if (margin >= 0.3) return "clear favourites";
  if (margin >= 0.12) return "favoured";
  return "narrow favourites";
}

/** Build the decision-first rationale (jargon-free headline + evidence cards). */
function buildRationale(
  fixture: ResolvedFixture,
  probs: OneXTwo,
  diff: readonly number[],
  usedBoosted: boolean,
): Rationale {
  const { teamA, teamB } = fixture;
  const leadA = probs.home >= probs.away;
  const leader = leadA ? teamA : teamB;
  const trailer = leadA ? teamB : teamA;
  const margin = Math.abs(probs.home - probs.away);

  const headline =
    margin < 0.06
      ? `${teamA} and ${teamB} look evenly matched, with a real chance of a draw.`
      : `${leader} are ${strengthWord(margin)} to beat ${trailer}, mostly on cleaner attacking play.`;

  // Each feature's signed nudge toward team A's win, scaled to percentage points.
  const get = (i: number): number => diff[i] ?? 0;
  const drivers: Driver[] = [];

  const lbGap = get(0);
  drivers.push({
    label: "Breaking through the defence",
    detail:
      lbGap >= 0
        ? `${teamA} completed line-breaking passes more reliably, slicing through ${teamB}'s lines more often.`
        : `${teamB} completed line-breaking passes more reliably, slicing through ${teamA}'s lines more often.`,
    contributionPp: Number((lbGap * 0.9).toFixed(1)),
  });

  const offerGap = get(2);
  drivers.push({
    label: "Converting chances",
    detail:
      offerGap >= 0
        ? `${teamA} turned more of its forward runs into real scoring looks than ${teamB} did.`
        : `${teamB} turned more of its forward runs into real scoring looks than ${teamA} did.`,
    contributionPp: Number((offerGap * 0.6).toFixed(1)),
  });

  const attGap = get(3);
  const defGap = get(4); // higher defenseRate = concedes more, so A's edge is -defGap
  const balance = attGap - defGap;
  drivers.push({
    label: "Scoring vs leaking goals",
    detail:
      balance >= 0
        ? `${teamA} created more and conceded less across the group stage, a stronger net goal balance.`
        : `${teamB} created more and conceded less across the group stage, a stronger net goal balance.`,
    contributionPp: Number((balance * 12).toFixed(1)),
  });

  const possGap = get(5);
  if (Math.abs(possGap) >= 3) {
    drivers.push({
      label: "Controlling the ball",
      detail:
        possGap >= 0
          ? `${teamA} held possession noticeably more, keeping ${teamB} chasing the game.`
          : `${teamB} held possession noticeably more, keeping ${teamA} chasing the game.`,
      contributionPp: Number((possGap * 0.15).toFixed(1)),
    });
  }

  const methodNote =
    `Market-blind: per-team penetration/creation profiles (line-break success, ` +
    `4-unit penetration share, offer conversion, shrunk attack/defence rates, ` +
    `possession) are differenced (team A − team B) into one feature vector. ` +
    (usedBoosted
      ? `Three one-vs-rest gradient-boosted regression ensembles (${N_ROUNDS} rounds, ` +
        `depth ${MAX_DEPTH}, learning rate ${LEARNING_RATE}), trained on ` +
        `leakage-safe group-stage rows (each match seen only with prior-match ` +
        `profiles), score the home/draw/away outcomes; scores are clamped to [0,1] ` +
        `and normalised to sum to 1.`
      : `With too few group-stage rows to train the boosted ensemble, a logistic ` +
        `of the net attack-minus-defence gap supplies the call.`) +
    ` No betting odds, prices, or market-implied probabilities were used.`;

  return { headline, drivers, methodNote };
}

/**
 * Factory for Model 6: line-breaks & offers efficiency, gradient-boosted.
 * Returns a pure {@link PredictionModel}; fit/predict never mutate inputs.
 */
export function createLinebreakGbm(): PredictionModel<LinebreakGbmState> {
  return {
    id: "linebreak-gbm",
    name: "Line-breaks & offers efficiency (gradient-boosted)",
    family: "ml",

    fit(input: FitInput): LinebreakGbmState {
      const { X, labels } = buildTrainingRows(input);
      const fallback = fitFallback(X, labels, input);
      const useBoosted = X.length >= MIN_ROWS;
      const featureMeans = columnMeans(X, FEATURE_LABELS.length);

      if (!useBoosted) {
        return {
          home: null,
          draw: null,
          away: null,
          featureMeans,
          rows: X.length,
          fallback,
          useBoosted: false,
        };
      }

      return {
        home: fitOneVsRest(X, labels, "home"),
        draw: fitOneVsRest(X, labels, "draw"),
        away: fitOneVsRest(X, labels, "away"),
        featureMeans,
        rows: X.length,
        fallback,
        useBoosted: true,
      };
    },

    predict(
      state: LinebreakGbmState,
      fixture: ResolvedFixture,
    ): ModelPrediction {
      const diff = featureDiff(fixture.profileA, fixture.profileB);
      const gap = netQuality(fixture.profileA) - netQuality(fixture.profileB);

      const probs = state.useBoosted
        ? normaliseOneXTwo({
            home: boostedScore(state.home, diff),
            draw: boostedScore(state.draw, diff),
            away: boostedScore(state.away, diff),
          })
        : fallbackProbs(state, gap);

      const rationale = buildRationale(fixture, probs, diff, state.useBoosted);
      return { probs, rationale };
    },
  };
}
