/**
 * Model 8 — Stacked ensemble meta-learner.
 *
 * The seven base models (statistical, Elo, ML) each emit a 1X2 view of a fixture.
 * This meta-learner does NOT re-read any FIFA stats: it learns, from out-of-fold
 * base predictions on the group stage, HOW to weigh and combine those views into a
 * final call. It is a "stack" — base learners feed a top-level learner.
 *
 * Method: flatten the base probabilities into a stable feature vector (sorted model
 * ids; home & draw probabilities per model — away is redundant since the triple sums
 * to 1), then fit three ridge-regularised one-vs-rest logistic regressions (one per
 * outcome). At predict time the three calibrated scores are clamped and renormalised
 * into a 1X2 triple. When the training set is too small or an outcome never occurs
 * (degenerate class), we fall back to an equal-weight logarithmic opinion pool of the
 * base views — a robust geometric-mean consensus that needs no fitting.
 *
 * Market-blind: the only inputs are other market-blind models' probabilities. No
 * betting line, no implied probability, no price ever enters this layer.
 *
 * Pure & immutable: fitMeta/predictMeta never mutate inputs and return fresh objects.
 */

import {
  fitLogisticRegression,
  predictProbability,
  logOpinionPoolOneXTwo,
  normaliseOneXTwo,
  type LogisticModel,
  type OneXTwo,
  type MatchResult,
} from "@autopoly/sports-model";

import type {
  Driver,
  MetaModel,
  MetaTrainingRow,
  ModelPrediction,
  Rationale,
  ResolvedFixture,
} from "../types.js";

/** Minimum out-of-fold rows before we trust a fitted stack over the pool fallback. */
const MIN_ROWS = 10;
/** Ridge (L2) penalty — high, to keep weights small on tiny tournament samples. */
const L2_LAMBDA = 1.0;
const EPOCHS = 800;
const LEARNING_RATE = 0.2;
/** Keep each class score off the 0/1 rails before renormalising. */
const PROB_FLOOR = 1e-4;
const OUTCOMES = ["home", "draw", "away"] as const;

/** Fitted internal state for the stacked ensemble (opaque to callers). */
export interface StackedEnsembleState {
  /** Sorted base-model ids defining the feature-vector column order. */
  readonly modelIds: readonly string[];
  /** One-vs-rest logistic model per outcome, or null when we fall back to pooling. */
  readonly models: {
    readonly home: LogisticModel;
    readonly draw: LogisticModel;
    readonly away: LogisticModel;
  } | null;
  /** Rows seen at fit time — exposed for transparency / rationale wording. */
  readonly trainedRows: number;
}

const clampFloor = (p: number): number =>
  Number.isFinite(p) ? Math.min(1 - PROB_FLOOR, Math.max(PROB_FLOOR, p)) : 0.5;

/** Union of every model id seen across rows, sorted for a deterministic column order. */
const collectModelIds = (rows: readonly MetaTrainingRow[]): string[] => {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const id of row.baseProbs.keys()) ids.add(id);
  }
  return [...ids].sort();
};

/**
 * Flatten base 1X2 views into a feature vector following `modelIds` column order.
 * Two columns per model: P(home) and P(draw). A missing model contributes the
 * uninformative (1/3, 1/3) so column positions stay stable across rows.
 */
const toFeatureVector = (
  baseProbs: ReadonlyMap<string, OneXTwo>,
  modelIds: readonly string[],
): number[] => {
  const features: number[] = [];
  for (const id of modelIds) {
    const view = baseProbs.get(id);
    features.push(view ? view.home : 1 / 3);
    features.push(view ? view.draw : 1 / 3);
  }
  return features;
};

/** One-hot a match result against a target outcome (one-vs-rest label). */
const oneVsRest = (result: MatchResult, target: MatchResult): 0 | 1 =>
  result === target ? 1 : 0;

/** True when every outcome appears at least once (none is degenerate). */
const allClassesRepresented = (rows: readonly MetaTrainingRow[]): boolean => {
  const seen = new Set<MatchResult>();
  for (const row of rows) seen.add(row.result);
  return OUTCOMES.every((o) => seen.has(o));
};

/** Equal-weight log-opinion-pool fallback over the base views. */
const poolFallback = (baseProbs: ReadonlyMap<string, OneXTwo>): OneXTwo => {
  const items = [...baseProbs.values()];
  if (items.length === 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  const weights = items.map(() => 1);
  return logOpinionPoolOneXTwo(items, weights);
};

/**
 * Fit one one-vs-rest ridge-logistic head, or return null to signal that the stack
 * cannot be trained and the pool fallback should be used instead.
 */
const fitHeads = (
  rows: readonly MetaTrainingRow[],
  modelIds: readonly string[],
): StackedEnsembleState["models"] => {
  if (rows.length < MIN_ROWS || !allClassesRepresented(rows)) return null;

  const X = rows.map((row) => toFeatureVector(row.baseProbs, modelIds));
  const opts = { learningRate: LEARNING_RATE, epochs: EPOCHS, l2: L2_LAMBDA };

  return {
    home: fitLogisticRegression(X, rows.map((r) => oneVsRest(r.result, "home")), opts),
    draw: fitLogisticRegression(X, rows.map((r) => oneVsRest(r.result, "draw")), opts),
    away: fitLogisticRegression(X, rows.map((r) => oneVsRest(r.result, "away")), opts),
  };
};

/** Run the three fitted heads over one feature vector and renormalise into a triple. */
const predictFromHeads = (
  models: NonNullable<StackedEnsembleState["models"]>,
  features: number[],
): OneXTwo =>
  normaliseOneXTwo({
    home: clampFloor(predictProbability(models.home, features)),
    draw: clampFloor(predictProbability(models.draw, features)),
    away: clampFloor(predictProbability(models.away, features)),
  });

const verdictTeam = (
  probs: OneXTwo,
  fixture: ResolvedFixture,
): { who: string; conf: string; lean: "home" | "draw" | "away" } => {
  const { home, draw, away } = probs;
  if (draw >= home && draw >= away) {
    return { who: "neither side", conf: "evenly", lean: "draw" };
  }
  const lean = home >= away ? "home" : "away";
  const top = Math.max(home, away);
  const who = lean === "home" ? fixture.teamA : fixture.teamB;
  const conf = top >= 0.6 ? "clearly" : top >= 0.45 ? "narrowly" : "slightly";
  return { who, conf, lean };
};

/** Measure how much the base views agree, in plain language, for the drivers. */
const agreementDriver = (
  baseProbs: ReadonlyMap<string, OneXTwo>,
  fixture: ResolvedFixture,
  blended: OneXTwo,
): Driver => {
  const views = [...baseProbs.values()];
  const leansA = views.filter((v) => v.home >= v.away && v.home >= v.draw).length;
  const leansB = views.filter((v) => v.away > v.home && v.away >= v.draw).length;
  const total = Math.max(views.length, 1);
  const agreeShare = Math.max(leansA, leansB) / total;
  const majority = leansA >= leansB ? fixture.teamA : fixture.teamB;
  const consensus = blended.home >= blended.away ? fixture.teamA : fixture.teamB;
  const detail =
    agreeShare >= 0.7
      ? `${Math.round(agreeShare * 100)}% of the underlying views lean ${majority}, so the blended call sides with ${consensus} with confidence.`
      : `The underlying views are split — about ${Math.round(agreeShare * 100)}% lean ${majority} — so the blended call for ${consensus} is held back.`;
  // Push toward A's win prob when the consensus is A, away from it otherwise.
  const signedMargin = (blended.home - blended.away) * 100;
  return {
    label: "Model agreement",
    detail,
    contributionPp: Number(signedMargin.toFixed(1)),
  };
};

/** Spread driver: how confident the blended verdict is relative to a coin flip. */
const decisivenessDriver = (blended: OneXTwo, fixture: ResolvedFixture): Driver => {
  const top = Math.max(blended.home, blended.draw, blended.away);
  const favoured =
    blended.home >= blended.away && blended.home >= blended.draw
      ? fixture.teamA
      : blended.away > blended.home && blended.away >= blended.draw
        ? fixture.teamB
        : "a draw";
  const detail =
    top >= 0.6
      ? `One outcome (${favoured}) carries most of the weight, so this is a fairly settled call.`
      : `No single outcome dominates — ${favoured} edges it, but the result is close to a toss-up.`;
  const signed = (blended.home - 1 / 3) * 100;
  return {
    label: "How settled",
    detail,
    contributionPp: Number(signed.toFixed(1)),
  };
};

const buildRationale = (
  state: StackedEnsembleState,
  baseProbs: ReadonlyMap<string, OneXTwo>,
  fixture: ResolvedFixture,
  blended: OneXTwo,
): Rationale => {
  const v = verdictTeam(blended, fixture);
  const pct = Math.round(
    (v.lean === "home" ? blended.home : v.lean === "away" ? blended.away : blended.draw) * 100,
  );
  const headline =
    v.lean === "draw"
      ? `This one looks evenly matched between ${fixture.teamA} and ${fixture.teamB}, with a draw the single likeliest result (${pct}%).`
      : `Pulling every angle together, ${v.who} is ${v.conf} the side to back here, at about a ${pct}% chance to win.`;

  const drivers: Driver[] = [
    agreementDriver(baseProbs, fixture, blended),
    decisivenessDriver(blended, fixture),
  ];

  const fitNote = state.models
    ? `trained on ${state.trainedRows} prior matches`
    : `using an equal-weight consensus (too few prior matches to train the stack)`;

  const methodNote =
    `Market-blind: ridge-logistic stack over the 7 base models. Each base view contributes its ` +
    `P(${fixture.teamA} win) and P(draw) as features; three one-vs-rest logistic heads ` +
    `(L2=${L2_LAMBDA}) ${fitNote} produce class scores that are clamped and renormalised to a ` +
    `1X2 triple. Falls back to an equal-weight logarithmic opinion pool of the base views when ` +
    `the sample is thin or an outcome is unseen. No betting odds or market-implied probabilities ` +
    `were used at any stage.`;

  return { headline, drivers, methodNote };
};

/**
 * Build Model 8, the stacked-ensemble meta-learner.
 *
 * @returns A {@link MetaModel} keyed "stacked-ensemble" in the "ensemble" family.
 */
export function createStackedEnsemble(): MetaModel<StackedEnsembleState> {
  return {
    id: "stacked-ensemble",
    name: "Stacked Ensemble",
    family: "ensemble",

    fitMeta(rows: readonly MetaTrainingRow[]): StackedEnsembleState {
      const modelIds = collectModelIds(rows);
      const models = fitHeads(rows, modelIds);
      return { modelIds, models, trainedRows: rows.length };
    },

    predictMeta(
      state: StackedEnsembleState,
      baseProbs: ReadonlyMap<string, OneXTwo>,
      fixture: ResolvedFixture,
    ): ModelPrediction {
      const blended = state.models
        ? predictFromHeads(state.models, toFeatureVector(baseProbs, state.modelIds))
        : poolFallback(baseProbs);
      const probs = normaliseOneXTwo(blended);
      return { probs, rationale: buildRationale(state, baseProbs, fixture, probs) };
    },
  };
}
