/**
 * Model 4 — Physical-decay dynamic-K Elo.
 *
 * A market-blind Elo variant where the learning rate (K) and the effective
 * rating both bend to FIFA physical-output data. Two on-pitch mechanisms:
 *
 *  1. Dynamic K during fitting. A match where a team ran an unusually high sprint
 *     load is treated as more informative about its true level, so its rating moves
 *     further:  K = K_base · (1 + eta · (sprintLoad − meanSprintLoad)/meanSprintLoad)
 *     · stageWeight. Knockout fixtures carry a larger stage weight (results there
 *     matter more), though the group-stage replay used to seed ratings sits at the
 *     baseline weight.
 *
 *  2. Fatigue penalty at prediction time. A team whose average high-intensity
 *     running distance across the group stage sat well above the field mean has
 *     burned more in the tank; we subtract a rating penalty proportional to that
 *     excess as a proxy for accumulated load:
 *       penalty = sigma · max(0, (avgHighIntensityKm − fieldMeanHI)/fieldMeanHI) · ratingScale.
 *
 * Everything consumed is FIFA on-pitch physical output plus pre-tournament Elo
 * priors. No betting or market data is ever read.
 */

import {
  eloExpectedScore,
  eloToOneXTwo,
  eloUpdate,
  normaliseOneXTwo,
  restAdvantageFactor,
} from "@autopoly/sports-model";
import type {
  Driver,
  FitInput,
  KnockoutStage,
  ModelPrediction,
  PredictionModel,
  Rationale,
  ResolvedFixture,
  TeamMatchStats,
  TeamProfile,
} from "../types.js";

/** Base Elo learning rate before the sprint-load and stage modulation. */
const K_BASE = 24;
/** Sensitivity of K to relative sprint load (eta). */
const K_SPRINT_ETA = 0.6;
/** Bounds on the dynamic K multiplier so a single outlier match cannot dominate. */
const K_MULT_MIN = 0.4;
const K_MULT_MAX = 1.8;
/** Fatigue-penalty strength (sigma) and the rating scale it acts on. */
const FATIGUE_SIGMA = 0.5;
const FATIGUE_RATING_SCALE = 120;
/** Cap on the fatigue rating penalty (Elo points). */
const FATIGUE_PENALTY_CAP = 90;
/** Logistic scale used to turn the rating gap into 1X2 probabilities. */
const PREDICT_SCALE = 400;
/** Davidson draw weight (nu). */
const DRAW_NU = 0.7;

/** Knockout stages carry more weight than the group-stage replay baseline. */
const STAGE_WEIGHT: Readonly<Record<KnockoutStage, number>> = {
  R32: 1.1,
  R16: 1.2,
  QF: 1.3,
  SF: 1.4,
  "3P": 1.2,
  F: 1.5,
};

/** Fitted state: dynamic-K Elo ratings plus the field-level physical means. */
export interface FatigueEloState {
  readonly ratings: ReadonlyMap<string, number>;
  readonly meanSprintLoad: number;
  readonly fieldMeanHI: number;
}

const clamp = (value: number, lo: number, hi: number): number =>
  value < lo ? lo : value > hi ? hi : value;

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Per-match sprint load proxy: sprints + high-speed runs per minute played. */
const matchSprintLoad = (s: TeamMatchStats): number =>
  s.minutesPlayed > 1e-9 ? (s.sprints + s.highSpeedRuns) / s.minutesPlayed : 0;

/**
 * Dynamic learning rate for one team in one match.
 * Higher-than-average sprint load amplifies K; lower load damps it. The stage
 * weight (1.0 for the group-stage replay) scales the whole thing. The multiplier
 * is bounded so a freak reading can't blow up a rating in a single update.
 */
const dynamicK = (
  sprintLoad: number,
  meanSprintLoad: number,
  stageWeight: number,
): number => {
  const rel =
    meanSprintLoad > 1e-9 ? (sprintLoad - meanSprintLoad) / meanSprintLoad : 0;
  const mult = clamp(1 + K_SPRINT_ETA * rel, K_MULT_MIN, K_MULT_MAX);
  return K_BASE * mult * stageWeight;
};

/**
 * Rating penalty for a team that ran far above the field's average high-intensity
 * distance during the group stage — a proxy for accumulated physical load that
 * makes it likelier to tire in a knockout. Zero for teams at or below the mean.
 */
const fatiguePenalty = (avgHighIntensityKm: number, fieldMeanHI: number): number => {
  if (fieldMeanHI <= 1e-9) return 0;
  const excess = Math.max(0, (avgHighIntensityKm - fieldMeanHI) / fieldMeanHI);
  return Math.min(FATIGUE_PENALTY_CAP, FATIGUE_SIGMA * excess * FATIGUE_RATING_SCALE);
};

/**
 * Replay every completed match in chronological order, updating each team's Elo
 * (seeded from its prior) with a sprint-load-driven dynamic K. Returns the final
 * ratings plus the field means the penalty and K modulation reference.
 */
const replay = (input: FitInput): FatigueEloState => {
  const ratings = new Map<string, number>();
  const seed = (team: string): number => {
    const existing = ratings.get(team);
    if (existing !== undefined) return existing;
    const prior = input.priors.get(team);
    const r = prior ? prior.elo : 1500;
    ratings.set(team, r);
    return r;
  };

  const allLoads: number[] = [];
  for (const m of input.matches) {
    allLoads.push(matchSprintLoad(m.home), matchSprintLoad(m.away));
  }
  const meanSprintLoad = mean(allLoads);

  // Group-stage replay sits at the baseline stage weight.
  const stageWeight = 1;
  const ordered = [...input.matches].sort((a, b) => a.date.localeCompare(b.date));

  for (const m of ordered) {
    const teamA = m.home.team;
    const teamB = m.away.team;
    const ra = seed(teamA);
    const rb = seed(teamB);

    const expectedA = eloExpectedScore(ra, rb, PREDICT_SCALE);
    const actualA = m.result === "home" ? 1 : m.result === "draw" ? 0.5 : 0;

    const kA = dynamicK(matchSprintLoad(m.home), meanSprintLoad, stageWeight);
    const kB = dynamicK(matchSprintLoad(m.away), meanSprintLoad, stageWeight);

    ratings.set(teamA, eloUpdate(ra, expectedA, actualA, kA));
    ratings.set(teamB, eloUpdate(rb, 1 - expectedA, 1 - actualA, kB));
  }

  const hiValues = [...input.profiles.values()].map((p) => p.avgHighIntensityKm);
  const fieldMeanHI = mean(hiValues);

  return { ratings, meanSprintLoad, fieldMeanHI };
};

/** Effective rating for a fixture side: fitted (or prior) rating minus fatigue. */
const effectiveRating = (
  profile: TeamProfile,
  priorElo: number,
  state: FatigueEloState,
): { base: number; penalty: number; effective: number } => {
  const base = state.ratings.get(profile.team) ?? priorElo;
  const penalty = fatiguePenalty(profile.avgHighIntensityKm, state.fieldMeanHI);
  return { base, penalty, effective: base - penalty };
};

/** Pick the side that carried the heavier physical load (higher fatigue penalty). */
const buildDrivers = (
  fixture: ResolvedFixture,
  a: { penalty: number; base: number },
  b: { penalty: number; base: number },
  restFactorA: number,
): readonly Driver[] => {
  const { teamA, teamB } = fixture;
  const drivers: Driver[] = [];

  // Driver 1: who ran more in the group stage and is likelier to tire.
  const heavier = a.penalty >= b.penalty ? teamA : teamB;
  const lighter = a.penalty >= b.penalty ? teamB : teamA;
  const penaltyGap = Math.abs(a.penalty - b.penalty);
  // The team carrying more load is the one nudged DOWN, so the sign favours the
  // fresher side. Express the contribution as a small share of the rating gap.
  const fatigueContributionPp = clamp(
    (a.penalty >= b.penalty ? -1 : 1) * penaltyGap * 0.06,
    -18,
    18,
  );
  drivers.push({
    label: "Physical load",
    detail:
      penaltyGap < 1
        ? `${teamA} and ${teamB} ran similar high-intensity distances in the group stage, so neither looks more likely to tire late.`
        : `${heavier} ran a heavier high-intensity workload in the group stage than ${lighter}, leaving it more likely to tire and fade as this match wears on.`,
    contributionPp: Number(fatigueContributionPp.toFixed(1)),
  });

  // Driver 2: the underlying strength gap from the replayed ratings.
  const ratingGap = a.base - b.base;
  const stronger = ratingGap >= 0 ? teamA : teamB;
  const strengthContributionPp = clamp(ratingGap * 0.05, -30, 30);
  drivers.push({
    label: "Form and strength",
    detail:
      Math.abs(ratingGap) < 8
        ? `${teamA} and ${teamB} look closely matched on group-stage results, so the call is finely balanced.`
        : `${stronger} carried stronger group-stage results into this fixture and starts as the on-paper favourite.`,
    contributionPp: Number(strengthContributionPp.toFixed(1)),
  });

  // Driver 3 (optional): a meaningful rest edge between the two sides.
  if (Math.abs(restFactorA - 1) > 1e-6) {
    const fresher = restFactorA > 1 ? teamA : teamB;
    drivers.push({
      label: "Rest edge",
      detail: `${fresher} comes in with the better turnaround between matches and should be the fresher side at kickoff.`,
      contributionPp: Number(clamp((restFactorA - 1) * 100, -10, 10).toFixed(1)),
    });
  }

  return drivers;
};

const buildHeadline = (
  fixture: ResolvedFixture,
  probs: { home: number; draw: number; away: number },
): string => {
  const { teamA, teamB } = fixture;
  const aPct = Math.round(probs.home * 100);
  const bPct = Math.round(probs.away * 100);
  const drawPct = Math.round(probs.draw * 100);
  const lead = Math.abs(aPct - bPct);
  const favourite = aPct >= bPct ? teamA : teamB;
  const favPct = Math.max(aPct, bPct);

  if (lead <= 4) {
    return `${teamA} and ${teamB} are too close to call, with a real chance the match goes the distance (${drawPct}% to end level).`;
  }
  const strength = lead >= 20 ? "clearly the stronger side" : "a slight favourite";
  return `${favourite} is ${strength} here with about a ${favPct}% chance to win, partly because the other side ran a heavier physical load and is likelier to tire.`;
};

const METHOD_NOTE =
  "Market-blind: dynamic-K Elo replayed over group-stage results, seeded from " +
  "pre-tournament Elo priors. Each rating update used a learning rate scaled by " +
  "the team's relative sprint load (sprints + high-speed runs per minute) and a " +
  "knockout stage weight. At prediction time each team's effective rating is " +
  "reduced by a fatigue penalty proportional to how far its average high-intensity " +
  "running distance exceeded the field mean, and the rating gap is mapped to a 1X2 " +
  "distribution via a Davidson-tie logistic (scale 400, no home advantage, draw " +
  "nu 0.7). No betting or prediction-market data was used.";

/** Factory for Model 4: physical-decay dynamic-K Elo. */
export function createFatigueElo(): PredictionModel<FatigueEloState> {
  return {
    id: "fatigue-elo",
    name: "Physical-decay dynamic-K Elo",
    family: "elo",

    fit(input: FitInput): FatigueEloState {
      return replay(input);
    },

    predict(state: FatigueEloState, fixture: ResolvedFixture): ModelPrediction {
      const a = effectiveRating(fixture.profileA, fixture.priorA.elo, state);
      const b = effectiveRating(fixture.profileB, fixture.priorB.elo, state);

      // Optional rest edge from relative sprint load (lighter load ≈ fresher).
      // Both teams' loads are unknown at fixture time, so we approximate the
      // rest edge from the inverse of accumulated high-intensity distance.
      const restDaysA = -fixturePenaltyDays(a.penalty);
      const restDaysB = -fixturePenaltyDays(b.penalty);
      const restFactorA = restAdvantageFactor(restDaysA, restDaysB);

      const probs = normaliseOneXTwo(
        eloToOneXTwo(a.effective, b.effective, {
          scale: PREDICT_SCALE,
          homeAdvantage: 0,
          drawNu: DRAW_NU,
        }),
      );

      const rationale: Rationale = {
        headline: buildHeadline(fixture, probs),
        drivers: buildDrivers(fixture, a, b, restFactorA),
        methodNote: METHOD_NOTE,
      };

      return { probs, rationale };
    },
  };
}

/** Map a fatigue rating penalty to an equivalent "rest days lost" proxy. */
const fixturePenaltyDays = (penalty: number): number => penalty / 60;
