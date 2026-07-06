/**
 * Model 7 — Passing-network structure, random forest ("passnet-rf").
 *
 * Reads how a team builds play: is its passing web fluid and spread across many
 * players (hard to mark, many routes forward), or funnelled through one or two
 * pivots (predictable, easier to shut down)? Three one-vs-rest random forests are
 * trained on the DIFFERENCE (team A minus team B) of graph + style features, so
 * the model learns "the side with the more distributed network tends to win".
 *
 * Market-blind: the forests consume only FIFA on-pitch descriptors and the
 * Elo-derived priors baked into the profiles. No betting / market data is read.
 *
 * Reuse: @autopoly/sports-model supplies the ML primitives (fitRandomForest /
 * predictForest), the deterministic Rng (mulberry32), the logistic cold-start
 * solver, and normaliseOneXTwo. We do not reimplement any of those here.
 *
 * Data caveat: passing-network features (networkDensity / networkCentralization /
 * top5EdgeShare) live in the GRAPHICAL layer of the FIFA PDF. profile.ts defaults
 * them to neutral constants when passNetwork is null, so until those graphs are
 * hand/OCR annotated this model partly degrades to the style features
 * (possession / high press / attack rate).
 */

import {
  fitRandomForest,
  predictForest,
  fitLogisticRegression,
  predictProbability,
  mulberry32,
  normaliseOneXTwo,
  type RandomForest,
  type LogisticModel,
  type MatchResult,
  type OneXTwo,
  type Rng,
} from "@autopoly/sports-model";

import type {
  Driver,
  FitInput,
  PredictionModel,
  Rationale,
  ResolvedFixture,
  TeamMatchStats,
  TeamProfile,
} from "../types.js";
import { buildFieldContext, profileAsOf, type FieldContext } from "../profile.js";

/** Fitted state: three one-vs-rest forests, plus a logistic cold-start fallback. */
export interface PassnetRfState {
  readonly forests: {
    readonly home: RandomForest;
    readonly draw: RandomForest;
    readonly away: RandomForest;
  } | null;
  /** Used only when fewer than MIN_ROWS leakage-safe training rows exist. */
  readonly coldStart: LogisticModel;
  readonly rowCount: number;
}

const MIN_ROWS = 8;
const N_TREES = 60;
const SEED = 0x9e3779b1;

const clamp01 = (x: number): number =>
  Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;

/**
 * Difference feature vector (team A minus team B) of graph + style descriptors.
 * Order is fixed and shared by training and prediction. Percentages are scaled
 * to [0, 1] so no single axis dominates the tree splits.
 */
const featurize = (a: TeamProfile, b: TeamProfile): number[] => [
  a.networkDensity - b.networkDensity,
  a.networkCentralization - b.networkCentralization,
  a.top5EdgeShare - b.top5EdgeShare,
  (a.possessionPct - b.possessionPct) / 100,
  (a.highPressPct - b.highPressPct) / 100,
  a.attackRate - b.attackRate,
];

/** Compact cold-start vector: passing-structure gap + attack gap (no leakage). */
const coldStartFeatures = (a: TeamProfile, b: TeamProfile): number[] => [
  a.networkDensity - b.networkDensity,
  a.networkCentralization - b.networkCentralization,
  a.attackRate - b.attackRate,
];

interface TrainingRow {
  readonly features: number[];
  readonly coldFeatures: number[];
  readonly result: MatchResult;
}

/**
 * Build leakage-safe training rows: each row's profiles are rebuilt from only the
 * matches strictly before that match's date (profileAsOf), mirroring Model 6.
 */
const buildRows = (
  input: FitInput,
  field: FieldContext,
  statsByTeam: ReadonlyMap<string, readonly TeamMatchStats[]>,
): TrainingRow[] => {
  const rows: TrainingRow[] = [];
  for (const m of input.matches) {
    const teamA = m.home.team;
    const teamB = m.away.team;
    const priorA = input.priors.get(teamA) ?? {
      team: teamA,
      elo: field.eloMean,
      squadValueIndex: null,
    };
    const priorB = input.priors.get(teamB) ?? {
      team: teamB,
      elo: field.eloMean,
      squadValueIndex: null,
    };
    const profileA = profileAsOf(
      teamA,
      statsByTeam.get(teamA) ?? [],
      priorA,
      field,
      m.date,
    );
    const profileB = profileAsOf(
      teamB,
      statsByTeam.get(teamB) ?? [],
      priorB,
      field,
      m.date,
    );
    rows.push({
      features: featurize(profileA, profileB),
      coldFeatures: coldStartFeatures(profileA, profileB),
      result: m.result,
    });
  }
  return rows;
};

/** One-vs-rest target: 1 when the match result equals `target`, else 0. */
const oneVsRest = (rows: readonly TrainingRow[], target: MatchResult): number[] =>
  rows.map((r) => (r.result === target ? 1 : 0));

const fitForest = (
  X: number[][],
  y: number[],
  rng: Rng,
): RandomForest =>
  fitRandomForest(
    X,
    y,
    { nTrees: N_TREES, maxDepth: 5, minSamples: 2, featureSubsample: 0.7 },
    rng,
  );

/**
 * Translate a fitted passing-structure profile into a plain-language verdict:
 * higher density / lower centralization / lower top-5 share = more distributed,
 * harder to mark. Returns a scalar "fluidity" score for headline phrasing.
 */
const fluidityScore = (p: TeamProfile): number =>
  p.networkDensity - p.networkCentralization - (p.top5EdgeShare - 0.3);

const strongerSide = (
  pA: number,
  pB: number,
  nameA: string,
  nameB: string,
): { name: string; gap: number } =>
  pA >= pB
    ? { name: nameA, gap: pA - pB }
    : { name: nameB, gap: pB - pA };

const buildRationale = (
  fixture: ResolvedFixture,
  probs: OneXTwo,
  degraded: boolean,
): Rationale => {
  const { profileA, profileB, teamA, teamB } = fixture;
  const favoured =
    probs.home >= probs.away
      ? { name: teamA, win: probs.home }
      : { name: teamB, win: probs.away };
  const strength =
    favoured.win > 0.55 ? "clear favourite" : favoured.win > 0.45 ? "slight edge" : "near coin-flip";

  const headline =
    strength === "near coin-flip"
      ? `${teamA} and ${teamB} look evenly matched on how they build play, with a ${Math.round(favoured.win * 100)}% lean to ${favoured.name}.`
      : `${favoured.name} is the ${strength} (${Math.round(favoured.win * 100)}%) — its passing play is the harder one to break down.`;

  const fluid = strongerSide(
    fluidityScore(profileA),
    fluidityScore(profileB),
    teamA,
    teamB,
  );
  const structureGapPp = clamp01(fluid.gap) * 12;
  const fluidDetail =
    fluid.name === favoured.name
      ? `${fluid.name} spreads passes across more players and fewer go through one pivot, so it keeps more routes forward when pressed.`
      : `${fluid.name} builds through more players, but ${favoured.name}'s other strengths outweigh it here.`;

  const drivers: Driver[] = [
    {
      label: "Passing structure",
      detail: degraded
        ? `${fluidDetail} (Passing-network detail was unavailable, so this leans on possession and pressing instead.)`
        : fluidDetail,
      contributionPp:
        favoured.name === teamA ? structureGapPp : -structureGapPp,
    },
    {
      label: "Ball control",
      detail: `${profileA.possessionPct >= profileB.possessionPct ? teamA : teamB} keeps the ball more (${Math.round(profileA.possessionPct)}% vs ${Math.round(profileB.possessionPct)}%), dictating the tempo of build-up.`,
      contributionPp:
        (profileA.possessionPct - profileB.possessionPct) * 0.15,
    },
    {
      label: "Scoring threat",
      detail: `${profileA.attackRate >= profileB.attackRate ? teamA : teamB} has created the better chances on average (${profileA.attackRate.toFixed(2)} vs ${profileB.attackRate.toFixed(2)} expected goals a game).`,
      contributionPp: (profileA.attackRate - profileB.attackRate) * 18,
    },
  ];

  const methodNote =
    "Market-blind: three one-vs-rest random forests (60 CART trees each, depth 5, " +
    "70% feature subsampling) over the A-minus-B difference of passing-network graph " +
    "features (density, centralization, top-5 edge share) and style features (possession, " +
    "high-press share, expected-goal rate); forest scores are clamped to [0,1] and " +
    "normalised to a 1X2 distribution. Training rows are leakage-safe (each rebuilt from " +
    "matches strictly before its date) and fall back to a logistic model on structure and " +
    "attack gaps under eight rows. No betting or market data was used.";

  return { headline, drivers, methodNote };
};

/** Cold-start probabilities: distributed-network + attack gap → logistic A-win lean. */
const coldStartProbs = (
  state: PassnetRfState,
  fixture: ResolvedFixture,
): OneXTwo => {
  const pA = predictProbability(
    state.coldStart,
    coldStartFeatures(fixture.profileA, fixture.profileB),
  );
  // Spread the residual mass into a modest, fixed draw band.
  const draw = 0.26;
  const home = pA * (1 - draw);
  const away = (1 - pA) * (1 - draw);
  return normaliseOneXTwo({ home, draw, away });
};

export function createPassnetRf(): PredictionModel<PassnetRfState> {
  return {
    id: "passnet-rf",
    name: "Passing-network structure (random forest)",
    family: "ml",

    fit(input: FitInput): PassnetRfState {
      const allStats = input.matches.flatMap((m) => [m.home, m.away]);
      const field = buildFieldContext(allStats, input.priors);

      const statsByTeam = new Map<string, TeamMatchStats[]>();
      for (const s of allStats) {
        statsByTeam.set(s.team, [...(statsByTeam.get(s.team) ?? []), s]);
      }

      const rows = buildRows(input, field, statsByTeam);

      const X = rows.map((r) => r.features);
      const cold = fitLogisticRegression(
        rows.map((r) => r.coldFeatures),
        rows.map((r) => (r.result === "home" ? 1 : 0)) as (0 | 1)[],
        { epochs: 400, learningRate: 0.2, l2: 0.01 },
      );

      if (rows.length < MIN_ROWS) {
        return { forests: null, coldStart: cold, rowCount: rows.length };
      }

      const rng = mulberry32(SEED);
      const forests = {
        home: fitForest(X, oneVsRest(rows, "home"), rng),
        draw: fitForest(X, oneVsRest(rows, "draw"), rng),
        away: fitForest(X, oneVsRest(rows, "away"), rng),
      };
      return { forests, coldStart: cold, rowCount: rows.length };
    },

    predict(state: PassnetRfState, fixture: ResolvedFixture) {
      if (!state.forests) {
        const probs = coldStartProbs(state, fixture);
        return { probs, rationale: buildRationale(fixture, probs, true) };
      }

      const x = featurize(fixture.profileA, fixture.profileB);
      const raw: OneXTwo = {
        home: clamp01(predictForest(state.forests.home, x)),
        draw: clamp01(predictForest(state.forests.draw, x)),
        away: clamp01(predictForest(state.forests.away, x)),
      };
      const probs = normaliseOneXTwo(raw);

      // Flag degradation when both sides carry the defaulted network constants,
      // so the rationale can be honest about leaning on style features.
      const degraded =
        Math.abs(fixture.profileA.networkDensity - 0.45) < 1e-6 &&
        Math.abs(fixture.profileB.networkDensity - 0.45) < 1e-6;

      return { probs, rationale: buildRationale(fixture, probs, degraded) };
    },
  };
}
