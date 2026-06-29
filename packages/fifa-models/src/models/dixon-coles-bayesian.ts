/**
 * Model 1 — Dixon-Coles Bayesian variant.
 *
 * The hard part of a Bayesian goal model (shrinking each team's tiny 3-match
 * sample toward a sensible prior) is ALREADY done upstream in profile.ts: it
 * blends the observed xG / goals-against with an Elo-derived prior via
 * `shrink(...)`. So this model needs NO MCMC. It reads the shrunk
 * `attackRate` / `defenseRate` straight off each team's profile, turns them into
 * relative attack/defence strengths around the field's league average, and feeds
 * them through the standard Maher / Dixon-Coles machinery from
 * @autopoly/sports-model:
 *
 *   strength → attackDefenseLambda → dixonColesScoreMatrix(rho) → outcomeProbabilities
 *
 * `fit()` calibrates two scalars on the completed group matches by a cheap grid
 * search that minimises the multiclass Brier score: `rho` (the low-score / draw
 * correction) and a global `scale` on the goal expectations. Everything is
 * market-blind — only FIFA on-pitch xG/goals and Elo priors enter.
 */

import {
  attackDefenseLambda,
  brierMulticlass,
  dixonColesScoreMatrix,
  normaliseOneXTwo,
  outcomeProbabilities,
  type MatchResult,
  type OneXTwo,
} from "@autopoly/sports-model";

import { BASELINE_GOALS } from "../profile.js";
import type {
  CompletedMatch,
  Driver,
  FitInput,
  ModelPrediction,
  PredictionModel,
  Rationale,
  ResolvedFixture,
  TeamProfile,
} from "../types.js";

/** Fitted parameters for the Dixon-Coles Bayesian model. */
export interface DixonColesBayesState {
  /** Low-score dependence / draw-correction parameter (typically slightly negative). */
  readonly rho: number;
  /** Mean goals per team per match across the observed field (the Maher baseline). */
  readonly leagueAvg: number;
  /** Global multiplier on goal expectations, tuned to fit observed scoring. */
  readonly scale: number;
}

/** Default mean goals per team per match (≈ 2.7 total), used before fitting. */
const DEFAULT_LEAGUE_AVG = 2 * BASELINE_GOALS;
const DEFAULT_RHO = -0.05;
/** Candidate rho values for the calibration grid (low-score correction). */
const RHO_GRID = [-0.15, -0.1, -0.05, 0, 0.05] as const;
/** Candidate global goal-scale values for the calibration grid. */
const SCALE_GRID = [0.85, 0.95, 1, 1.05, 1.15] as const;
/** Score-matrix truncation. 8 goals/side is ample for international football. */
const MAX_GOALS = 8;

const clampPositive = (x: number, fallback: number): number =>
  Number.isFinite(x) && x > 1e-6 ? x : fallback;

/**
 * Convert a team's shrunk goal rates into relative attack/defence strengths
 * (1.0 = field average), as the Maher multiplicative model expects.
 */
const strengths = (
  profile: TeamProfile,
  leagueAvg: number,
): { attack: number; defense: number } => ({
  attack: clampPositive(profile.attackRate / leagueAvg, 1),
  defense: clampPositive(profile.defenseRate / leagueAvg, 1),
});

/**
 * Goal expectations for a fixture: lambda = teamA attack vs teamB defence,
 * mu = teamB attack vs teamA defence. Neutral venue → homeAdvantage = 1.
 */
const goalExpectations = (
  profileA: TeamProfile,
  profileB: TeamProfile,
  leagueAvg: number,
  scale: number,
): { lambda: number; mu: number } => {
  const a = strengths(profileA, leagueAvg);
  const b = strengths(profileB, leagueAvg);
  const lambda = attackDefenseLambda(a.attack, b.defense, leagueAvg, 1) * scale;
  const mu = attackDefenseLambda(b.attack, a.defense, leagueAvg, 1) * scale;
  return {
    lambda: clampPositive(lambda, leagueAvg),
    mu: clampPositive(mu, leagueAvg),
  };
};

/** 1X2 probabilities for given goal expectations and rho. */
const probsFor = (lambda: number, mu: number, rho: number): OneXTwo => {
  const matrix = dixonColesScoreMatrix(
    { home: lambda, away: mu },
    rho,
    MAX_GOALS,
  );
  return outcomeProbabilities(matrix);
};

/** Mean goals per team per match observed across all completed matches. */
const observedLeagueAvg = (
  matches: readonly CompletedMatch[],
): number => {
  if (matches.length === 0) return DEFAULT_LEAGUE_AVG;
  let goals = 0;
  let sides = 0;
  for (const m of matches) {
    goals += m.home.goalsFor + m.away.goalsFor;
    sides += 2;
  }
  const avg = sides > 0 ? goals / sides : DEFAULT_LEAGUE_AVG;
  return clampPositive(avg, DEFAULT_LEAGUE_AVG);
};

/**
 * Score one (rho, scale) candidate against the completed matches via the
 * multiclass Brier score. Lower is better. Skips matches whose teams lack a
 * profile so the search stays robust on partial data.
 */
const brierForParams = (
  matches: readonly CompletedMatch[],
  profiles: ReadonlyMap<string, TeamProfile>,
  leagueAvg: number,
  rho: number,
  scale: number,
): number => {
  const forecasts: OneXTwo[] = [];
  const results: MatchResult[] = [];
  for (const m of matches) {
    const profileA = profiles.get(m.home.team);
    const profileB = profiles.get(m.away.team);
    if (!profileA || !profileB) continue;
    const { lambda, mu } = goalExpectations(profileA, profileB, leagueAvg, scale);
    forecasts.push(probsFor(lambda, mu, rho));
    results.push(m.result);
  }
  if (forecasts.length === 0) return Number.POSITIVE_INFINITY;
  return brierMulticlass(forecasts, results);
};

/**
 * Cheap coordinate/grid search over (rho, scale) minimising multiclass Brier.
 * Falls back to defaults when the search is unproductive (no usable matches).
 */
const calibrate = (input: FitInput, leagueAvg: number): { rho: number; scale: number } => {
  let best = { rho: DEFAULT_RHO, scale: 1 };
  let bestBrier = Number.POSITIVE_INFINITY;
  for (const rho of RHO_GRID) {
    for (const scale of SCALE_GRID) {
      const score = brierForParams(
        input.matches,
        input.profiles,
        leagueAvg,
        rho,
        scale,
      );
      if (score < bestBrier) {
        bestBrier = score;
        best = { rho, scale };
      }
    }
  }
  // If nothing scored finitely (e.g. no matches), keep neutral defaults.
  return Number.isFinite(bestBrier) ? best : { rho: DEFAULT_RHO, scale: 1 };
};

const round1 = (x: number): number => Math.round(x * 10) / 10;
const pp = (x: number): number => Math.round(x * 1000) / 10;

/** Plain-language verdict naming the favourite and rough strength. */
const buildHeadline = (
  fixture: ResolvedFixture,
  probs: OneXTwo,
): string => {
  const drawPct = pp(probs.draw);
  const favoursA = probs.home >= probs.away;
  const favourite = favoursA ? fixture.teamA : fixture.teamB;
  const underdog = favoursA ? fixture.teamB : fixture.teamA;
  const winPct = pp(favoursA ? probs.home : probs.away);
  const strength =
    winPct >= 60 ? "a clear favourite" : winPct >= 48 ? "a slight favourite" : "narrowly ahead";
  const drawClause =
    drawPct >= 28
      ? `, though a tight low-scoring draw is very much in play (${drawPct}%)`
      : "";
  return `${favourite} are ${strength} to beat ${underdog} (${winPct}% to win)${drawClause}.`;
};

/** Evidence cards citing the concrete attack/defence and draw-correction story. */
const buildDrivers = (
  fixture: ResolvedFixture,
  lambda: number,
  mu: number,
  probs: OneXTwo,
  rho: number,
): readonly Driver[] => {
  const edge = lambda - mu;
  const favoursA = edge >= 0;
  const stronger = favoursA ? fixture.teamA : fixture.teamB;
  const weaker = favoursA ? fixture.teamB : fixture.teamA;
  const higherGoals = round1(Math.max(lambda, mu));
  const lowerGoals = round1(Math.min(lambda, mu));

  // Attribute the win-edge magnitude to team A's column, signed by who leads.
  const winEdgePp = pp(probs.home - probs.away);

  const drivers: Driver[] = [
    {
      label: "Attack vs defence",
      detail:
        `${stronger}'s attack is projected for about ${higherGoals} goals against ${weaker}'s defence, ` +
        `versus roughly ${lowerGoals} the other way — the scoring gap is what tilts the call.`,
      contributionPp: round1(winEdgePp),
    },
    {
      label: "Goal-creation strength",
      detail:
        `${stronger} carries the stronger end-to-end goal output in their FIFA match stats, ` +
        `so they convert more of their chances into the projected scoreline.`,
      contributionPp: round1((favoursA ? 1 : -1) * Math.min(8, Math.abs(winEdgePp) * 0.4 + 2)),
    },
  ];

  // Draw / low-score correction card: only meaningful when it nudges draws up.
  const drawPp = pp(probs.draw);
  const tightGame = rho < 0 || drawPp >= 26;
  drivers.push({
    label: "Low-scoring caution",
    detail: tightGame
      ? `Both sides project to score few goals, and tight games like this end level more often than raw averages suggest — ` +
        `that keeps the draw alive at ${drawPp}%.`
      : `Goals look likely enough on both sides that an outright draw is the less probable outcome (${drawPp}%).`,
    contributionPp: 0,
  });

  return drivers;
};

/** Market-blind method note, mirroring mc-sim.py's "method" style. */
const buildMethodNote = (state: DixonColesBayesState): string =>
  `Market-blind: each team's FIFA on-pitch scoring rate (xG-for and goals-against, ` +
  `Bayesian-shrunk toward an Elo strength prior in the profile layer) is mapped to ` +
  `relative attack/defence strengths, combined via the Maher multiplicative model into ` +
  `per-team goal expectations on a neutral venue, then expanded into a Dixon-Coles ` +
  `score matrix with low-score dependence rho=${round1(state.rho)} ` +
  `(league baseline ${round1(state.leagueAvg)} goals/side, goal scale ${round1(state.scale)}); ` +
  `cell probabilities are collapsed to win/draw/win. ` +
  `No betting odds or prediction-market prices were used at any step.`;

const buildRationale = (
  fixture: ResolvedFixture,
  lambda: number,
  mu: number,
  probs: OneXTwo,
  state: DixonColesBayesState,
): Rationale => ({
  headline: buildHeadline(fixture, probs),
  drivers: buildDrivers(fixture, lambda, mu, probs, state.rho),
  methodNote: buildMethodNote(state),
});

/**
 * Factory for the Dixon-Coles Bayesian model (Model 1, statistical family).
 */
export function createDixonColesBayes(): PredictionModel<DixonColesBayesState> {
  return {
    id: "dixon-coles-bayes",
    name: "Dixon-Coles (Bayesian-shrunk)",
    family: "statistical",

    fit(input: FitInput): DixonColesBayesState {
      const leagueAvg = observedLeagueAvg(input.matches);
      const { rho, scale } = calibrate(input, leagueAvg);
      return { rho, leagueAvg, scale };
    },

    predict(
      state: DixonColesBayesState,
      fixture: ResolvedFixture,
    ): ModelPrediction {
      const { lambda, mu } = goalExpectations(
        fixture.profileA,
        fixture.profileB,
        state.leagueAvg,
        state.scale,
      );
      const probs = normaliseOneXTwo(probsFor(lambda, mu, state.rho));
      const rationale = buildRationale(fixture, lambda, mu, probs, state);
      return { probs, rationale };
    },
  };
}
