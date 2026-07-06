/**
 * Model 2 — xG-corrected Elo.
 *
 * A plain Elo ladder learns only from who won. That throws away how a team won:
 * scraping a 1-0 on one lucky shot looks identical to dominating 1-0 with twenty
 * chances. This variant replays the group stage but feeds Elo the *expected-goal
 * difference* of each match instead of the bare result, so a team that out-creates
 * its opponents climbs the ladder even when the scoreline was tight, and a team
 * that won on luck climbs less.
 *
 * Replay (chronological):
 *   xGD            = home.xgApprox - away.xgApprox          (per match)
 *   S_xG           = 1 / (1 + e^(-c * xGD))                 (logistic "merit" score, c = 1.8)
 *   expected(home) = eloExpectedScore(ratingHome, ratingAway, scale = 400)
 *   rating' = eloUpdate(rating, expected, S_xG, K = 24)
 *
 * Predict: eloToOneXTwo(ratingA, ratingB, {scale: 400, homeAdvantage: 0, drawNu: 0.7}).
 * Knockout venues are neutral, so there is no home bonus.
 *
 * Market-blind: only FIFA on-pitch xG (TeamMatchStats.xgApprox) and the pre-tournament
 * Elo prior feed the ladder. No betting or prediction-market data is ever consulted.
 */

import {
  eloExpectedScore,
  eloToOneXTwo,
  eloUpdate,
} from "@autopoly/sports-model";

import type {
  Driver,
  FitInput,
  ModelPrediction,
  PredictionModel,
  Rationale,
  ResolvedFixture,
} from "../types.js";

/** Logistic steepness mapping expected-goal difference to a [0, 1] merit score. */
const XGD_STEEPNESS = 1.8;
/** Elo scale for the merit ladder (tighter than FIFA's 600 → more responsive). */
const ELO_SCALE = 400;
/** Per-match learning rate for the replay. */
const ELO_K = 24;
/** Davidson draw weight passed to eloToOneXTwo. */
const DRAW_NU = 0.7;

/** Fitted state: final merit ratings keyed by team, plus the replay xG aggregates. */
export interface XgEloState {
  /** Final xG-corrected Elo rating per team. */
  readonly ratings: ReadonlyMap<string, number>;
  /** Net xG (created minus conceded) accumulated over the group stage, per team. */
  readonly netXg: ReadonlyMap<string, number>;
  /** Matches replayed per team (for averaging the form gap). */
  readonly played: ReadonlyMap<string, number>;
}

/** Logistic merit score from an expected-goal difference. */
const meritScore = (xgDiff: number): number =>
  1 / (1 + Math.exp(-XGD_STEEPNESS * xgDiff));

/** Read a rating, falling back to the team's seed prior when unseen. */
const ratingOf = (
  ratings: ReadonlyMap<string, number>,
  team: string,
  fallback: number,
): number => ratings.get(team) ?? fallback;

/**
 * Seed every team's rating from its pre-tournament Elo prior, then replay the
 * completed matches in chronological order, updating both sides by the merit
 * score derived from their expected-goal difference.
 */
const fit = (input: FitInput): XgEloState => {
  const ratings = new Map<string, number>();
  const netXg = new Map<string, number>();
  const played = new Map<string, number>();

  // Seed ratings from priors (single source: the supplied prior map).
  for (const [team, prior] of input.priors) {
    ratings.set(team, prior.elo);
  }

  // Chronological replay. Copy before sorting so the caller's array is untouched.
  const ordered = [...input.matches].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  for (const match of ordered) {
    const homeTeam = match.home.team;
    const awayTeam = match.away.team;

    // Lazily seed any team missing from the prior map at the field-neutral 1500.
    const ratingHome = ratingOf(ratings, homeTeam, 1500);
    const ratingAway = ratingOf(ratings, awayTeam, 1500);

    const xgDiff = match.home.xgApprox - match.away.xgApprox;
    const sHome = meritScore(xgDiff);
    const sAway = 1 - sHome;

    const expectedHome = eloExpectedScore(ratingHome, ratingAway, ELO_SCALE);
    const expectedAway = 1 - expectedHome;

    ratings.set(homeTeam, eloUpdate(ratingHome, expectedHome, sHome, ELO_K));
    ratings.set(awayTeam, eloUpdate(ratingAway, expectedAway, sAway, ELO_K));

    netXg.set(homeTeam, (netXg.get(homeTeam) ?? 0) + xgDiff);
    netXg.set(awayTeam, (netXg.get(awayTeam) ?? 0) - xgDiff);
    played.set(homeTeam, (played.get(homeTeam) ?? 0) + 1);
    played.set(awayTeam, (played.get(awayTeam) ?? 0) + 1);
  }

  return { ratings, netXg, played };
};

/** Mean net xG per match for a team over the replayed group stage. */
const formGap = (state: XgEloState, team: string): number => {
  const games = state.played.get(team) ?? 0;
  if (games <= 0) return 0;
  return (state.netXg.get(team) ?? 0) / games;
};

/** Capitalise the first letter for headline use without mutating the input. */
const titleCase = (team: string): string =>
  team.length === 0 ? team : team[0]!.toUpperCase() + team.slice(1);

/** Strength word for the favourite, scaled to the win-probability margin. */
const strengthWord = (margin: number): string =>
  margin >= 0.3 ? "the clear favourite"
  : margin >= 0.15 ? "favoured"
  : margin >= 0.05 ? "a slight favourite"
  : "barely separated from the other side";

/** Round to one decimal place for human-facing prose. */
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Build the plain-language headline + evidence cards + market-blind method note. */
const buildRationale = (
  fixture: ResolvedFixture,
  probHome: number,
  probAway: number,
  gapA: number,
  gapB: number,
): Rationale => {
  const aFav = probHome >= probAway;
  const favTeam = aFav ? fixture.teamA : fixture.teamB;
  const dogTeam = aFav ? fixture.teamB : fixture.teamA;
  const favProb = aFav ? probHome : probAway;
  const dogProb = aFav ? probAway : probHome;
  const margin = Math.abs(probHome - probAway);

  const headline =
    `${titleCase(favTeam)} are ${strengthWord(margin)} to beat ${titleCase(dogTeam)}, ` +
    `winning roughly ${Math.round(favProb * 100)} times out of 100 to ` +
    `${dogTeam}'s ${Math.round(dogProb * 100)}.`;

  // Form gap = goals created minus conceded per group match, the signal this model adds.
  const favGap = aFav ? gapA : gapB;
  const dogGap = aFav ? gapB : gapA;
  const gapEdge = favGap - dogGap;

  const drivers: Driver[] = [];

  drivers.push({
    label: "Chance-creation form",
    detail:
      `Across the group stage ${titleCase(favTeam)} created ` +
      `${round1(Math.abs(favGap))} more good chances per game than they gave up, ` +
      `versus ${round1(Math.abs(dogGap))} for ${dogTeam} — ` +
      `${titleCase(favTeam)} simply made better chances more often.`,
    // Map the per-match form-gap advantage onto a bounded probability nudge.
    contributionPp: round1(
      (aFav ? 1 : -1) * Math.max(-12, Math.min(12, gapEdge * 6)),
    ),
  });

  drivers.push({
    label: "Earned standing, not lucky results",
    detail:
      `${titleCase(favTeam)} are rated on how convincingly they out-created ` +
      `opponents, not on tight scorelines, so wins built on real dominance ` +
      `count more than results that hinged on a single lucky goal.`,
    contributionPp: round1(
      (aFav ? 1 : -1) * Math.max(0, Math.min(8, margin * 16)),
    ),
  });

  drivers.push({
    label: "Margin of safety",
    detail:
      margin >= 0.15
        ? `The gap is wide enough that ${dogTeam} would need a clear upset to advance.`
        : `The two sides are close, so a single moment could swing the tie either way.`,
    contributionPp: round1((aFav ? 1 : -1) * Math.min(4, margin * 8)),
  });

  const methodNote =
    "Market-blind: each team's pre-tournament Elo prior is replayed through the " +
    "group stage using expected-goal difference as the match outcome — a logistic " +
    `merit score S_xG = 1/(1+e^(-${XGD_STEEPNESS}·xGD)) drives a standard Elo update ` +
    `(scale ${ELO_SCALE}, K=${ELO_K}) so chance-creation, not the raw scoreline, moves ratings; ` +
    "the fixture is then converted to 1X2 via a Davidson ties model on the neutral-venue " +
    "rating difference. Inputs are FIFA on-pitch xG and Elo priors only — no betting or " +
    "prediction-market data was used.";

  return { headline, drivers, methodNote };
};

/**
 * Predict one knockout fixture from the fitted merit ratings. Team A maps to
 * `home` in the returned OneXTwo, per the package convention.
 */
const predict = (state: XgEloState, fixture: ResolvedFixture): ModelPrediction => {
  const ratingA = ratingOf(state.ratings, fixture.teamA, fixture.priorA.elo);
  const ratingB = ratingOf(state.ratings, fixture.teamB, fixture.priorB.elo);

  const probs = eloToOneXTwo(ratingA, ratingB, {
    scale: ELO_SCALE,
    homeAdvantage: 0,
    drawNu: DRAW_NU,
  });

  const gapA = formGap(state, fixture.teamA);
  const gapB = formGap(state, fixture.teamB);

  const rationale = buildRationale(fixture, probs.home, probs.away, gapA, gapB);

  return { probs, rationale };
};

/**
 * Factory for the xG-corrected Elo model (Model 2). Returns a fresh, immutable
 * PredictionModel each call; no shared mutable state across instances.
 */
export function createXgElo(): PredictionModel<XgEloState> {
  return {
    id: "xg-elo",
    name: "xG-corrected Elo",
    family: "elo",
    fit,
    predict,
  };
}
