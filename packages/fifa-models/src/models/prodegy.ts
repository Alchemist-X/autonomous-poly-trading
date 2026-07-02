/**
 * Model 3 — PRODEGY: attack/defence split Elo in goal units.
 *
 * Classic Elo gives every team a single scalar strength. PRODEGY splits that into
 * two independent ratings expressed directly in goals:
 *   - xOS (expected offence strength): goals this team tends to manufacture
 *   - xDS (expected defence strength): goals this team tends to concede-suppress
 *
 * Both are seeded from the team's pre-tournament Elo prior (via the same
 * eloToGoalRates mapping the profiles use), then nudged match-by-match toward the
 * on-pitch xG it actually generated and allowed, relative to the opponent's
 * defence/offence. A team that out-creates strong defences ratchets its xOS up; a
 * team repeatedly carved open ratchets its xDS down.
 *
 * Prediction turns the two ratings into Poisson goal rates for the fixture and
 * reads 1X2 off the score matrix (reusing @autopoly/sports-model). Market-blind:
 * only FIFA on-pitch xG and Elo priors feed the ratings — no prices, ever.
 */

import {
  scoreMatrix,
  outcomeProbabilities,
  type GoalExpectation,
} from "@autopoly/sports-model";
import type {
  FitInput,
  ResolvedFixture,
  ModelPrediction,
  PredictionModel,
  TeamMatchStats,
  TeamProfile,
  TeamPrior,
  Driver,
  Rationale,
} from "../types.js";
import { eloToGoalRates, buildFieldContext, BASELINE_GOALS } from "../profile.js";

/** Learning rates for the offence / defence sequential updates (goal units). */
const LEARN_OFFENCE = 0.15;
const LEARN_DEFENCE = 0.15;
/** League-wide baseline added to every fixture's raw goal rate before clamping. */
const LEAGUE_BASE = BASELINE_GOALS;
/** Floor so Poisson rates stay positive even for lopsided ratings. */
const MIN_RATE = 0.2;
/** Clamp a rating to a sane goals-per-match band so updates can't run away. */
const MIN_RATING = 0.2;
const MAX_RATING = 4;

/** Final split-Elo ratings for one team, in goals per match. */
export interface SplitRating {
  /** Expected offence strength: goals this team tends to create. */
  readonly xOS: number;
  /** Expected defence strength: goals this team tends to concede (lower is better). */
  readonly xDS: number;
}

/** Fitted state: every team's final attack/defence ratings + the seeds for fallback. */
export interface ProdegyState {
  readonly ratings: ReadonlyMap<string, SplitRating>;
  readonly seeds: ReadonlyMap<string, SplitRating>;
}

const clampRating = (x: number): number =>
  Math.min(MAX_RATING, Math.max(MIN_RATING, x));

/**
 * Seed a team's split rating from its Elo prior. A stronger team starts with a
 * higher offence rating and a lower (better) defence rating, symmetrically around
 * the baseline, mirroring how the profiles derive their prior goal rates.
 */
const seedRating = (
  prior: TeamPrior,
  field: ReturnType<typeof buildFieldContext>,
): SplitRating => {
  const rates = eloToGoalRates(prior.elo, field);
  return { xOS: clampRating(rates.attack), xDS: clampRating(rates.defense) };
};

/**
 * One sequential update for a single team after observing a match.
 *
 * xOS rises when the team's xG-created exceeds what the opponent's defence
 * usually allows; xDS falls (improves) when xG-conceded is below what the
 * opponent's offence usually produces. Both moves are scaled by a fixed rate.
 */
const updateRating = (
  rating: SplitRating,
  opponent: SplitRating,
  xgFor: number,
  xgAgainst: number,
): SplitRating => ({
  xOS: clampRating(rating.xOS + LEARN_OFFENCE * (xgFor - opponent.xDS)),
  xDS: clampRating(rating.xDS + LEARN_DEFENCE * (xgAgainst - opponent.xOS)),
});

/** xG one team produced in a match; falls back to actual goals if xG is missing. */
const matchXg = (stats: TeamMatchStats): number =>
  Number.isFinite(stats.xgApprox) ? stats.xgApprox : stats.goalsFor;

const ensureRating = (
  team: string,
  ratings: Map<string, SplitRating>,
  seeds: ReadonlyMap<string, SplitRating>,
): SplitRating =>
  ratings.get(team) ??
  seeds.get(team) ?? { xOS: BASELINE_GOALS, xDS: BASELINE_GOALS };

/**
 * Fit: seed every team from its Elo prior, then replay the completed matches in
 * chronological order, applying a paired offence/defence update to both sides of
 * each fixture. Pure — builds and returns fresh maps without mutating the input.
 */
const fit = (input: FitInput): ProdegyState => {
  const allStats = input.matches.flatMap((m) => [m.home, m.away]);
  const field = buildFieldContext(allStats, input.priors);

  const seeds = new Map<string, SplitRating>();
  for (const [team, prior] of input.priors) {
    seeds.set(team, seedRating(prior, field));
  }
  // Any team appearing in matches but missing a prior gets a baseline seed.
  for (const s of allStats) {
    if (!seeds.has(s.team)) {
      seeds.set(s.team, { xOS: BASELINE_GOALS, xDS: BASELINE_GOALS });
    }
  }

  const ratings = new Map<string, SplitRating>(seeds);
  const ordered = [...input.matches].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  for (const match of ordered) {
    const teamA = match.home.team;
    const teamB = match.away.team;
    const before = {
      a: ensureRating(teamA, ratings, seeds),
      b: ensureRating(teamB, ratings, seeds),
    };
    const xgA = matchXg(match.home);
    const xgB = matchXg(match.away);
    // Update both from the SAME pre-match ratings to keep the step order-free.
    ratings.set(teamA, updateRating(before.a, before.b, xgA, xgB));
    ratings.set(teamB, updateRating(before.b, before.a, xgB, xgA));
  }

  return { ratings, seeds };
};

const round1 = (x: number): number => Math.round(x * 10) / 10;
const pp = (x: number): number => Math.round(x * 1000) / 10;

/** Build the plain-language verdict + evidence cards for a resolved fixture. */
const buildRationale = (
  fixture: ResolvedFixture,
  ratingA: SplitRating,
  ratingB: SplitRating,
  lambda: number,
  mu: number,
  probHome: number,
  probAway: number,
): Rationale => {
  const a = fixture.teamA;
  const b = fixture.teamB;
  const margin = pp(Math.abs(probHome - probAway));
  const leader = probHome >= probAway ? a : b;
  const strength =
    margin >= 25 ? "clearly favoured" : margin >= 10 ? "the favourite" : "narrowly ahead";

  const headline =
    Math.abs(probHome - probAway) < 0.04
      ? `${a} and ${b} look evenly matched, with no side meaningfully on top.`
      : `${leader} is ${strength}, expected to generate the better scoring chances over 90 minutes.`;

  // Attack-vs-defence contrasts, expressed in goals so a PM can read them.
  const aAttackEdge = ratingA.xOS - ratingB.xDS;
  const bAttackEdge = ratingB.xOS - ratingA.xDS;

  const drivers: Driver[] = [
    {
      label: "Attack vs defence",
      detail: `${a} has been creating about ${round1(
        ratingA.xOS,
      )} goals of chances a game; ${b}'s defence usually allows about ${round1(
        ratingB.xDS,
      )}. That points to roughly ${round1(lambda)} goals for ${a}.`,
      contributionPp: pp(0.5 * Math.tanh(aAttackEdge)),
    },
    {
      label: "Defence vs attack",
      detail: `${b} has been creating about ${round1(
        ratingB.xOS,
      )} goals of chances a game; ${a}'s defence usually allows about ${round1(
        ratingA.xDS,
      )}. That points to roughly ${round1(mu)} goals for ${b}.`,
      contributionPp: pp(-0.5 * Math.tanh(bAttackEdge)),
    },
    {
      label: "Two-way balance",
      detail: `Across both ends, ${a} projects to outscore ${b} by about ${round1(
        lambda - mu,
      )} goals on the night.`,
      contributionPp: pp(0.4 * Math.tanh(0.6 * (lambda - mu))),
    },
  ];

  const methodNote =
    "Market-blind: independent offence (xOS) and defence (xDS) ratings in goal " +
    "units, seeded from pre-tournament Elo priors and updated sequentially over " +
    "group-stage FIFA xG (rate 0.15) against each opponent's opposing rating. " +
    "Fixture goal rates lambda = xOS_A - xDS_B + base and mu = xOS_B - xDS_A + " +
    "base feed an independent-Poisson score matrix; 1X2 read off and normalised. " +
    "No betting or prediction-market data was used.";

  return { headline, drivers, methodNote };
};

/**
 * Predict one fixture: convert both teams' split ratings into Poisson goal rates,
 * build the score matrix, and read off normalised 1X2 plus a decision-first
 * rationale. Uses the fitted rating when present, otherwise the prior seed.
 */
const predict = (state: ProdegyState, fixture: ResolvedFixture): ModelPrediction => {
  const fallback: SplitRating = { xOS: BASELINE_GOALS, xDS: BASELINE_GOALS };
  const ratingA =
    state.ratings.get(fixture.teamA) ??
    state.seeds.get(fixture.teamA) ??
    fallback;
  const ratingB =
    state.ratings.get(fixture.teamB) ??
    state.seeds.get(fixture.teamB) ??
    fallback;

  const lambda = Math.max(MIN_RATE, ratingA.xOS - ratingB.xDS + LEAGUE_BASE);
  const mu = Math.max(MIN_RATE, ratingB.xOS - ratingA.xDS + LEAGUE_BASE);

  const goals: GoalExpectation = { home: lambda, away: mu };
  const matrix = scoreMatrix(goals);
  const probs = outcomeProbabilities(matrix);

  const rationale = buildRationale(
    fixture,
    ratingA,
    ratingB,
    lambda,
    mu,
    probs.home,
    probs.away,
  );

  return { probs, rationale };
};

/**
 * Factory for the PRODEGY model. The fitted state is a pair of team→rating maps
 * (final ratings + Elo seeds for fallback) — opaque to callers.
 */
export function createProdegy(): PredictionModel<ProdegyState> {
  return {
    id: "prodegy",
    name: "PRODEGY split attack/defence Elo",
    family: "elo",
    fit,
    predict,
  };
}
