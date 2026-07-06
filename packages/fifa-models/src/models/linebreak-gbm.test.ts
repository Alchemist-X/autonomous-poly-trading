import { describe, it, expect } from "vitest";

import { createLinebreakGbm } from "./linebreak-gbm.js";
import type {
  CompletedMatch,
  FitInput,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures (no randomness) ---------------------------------

const BASE_PROFILE: TeamProfile = {
  team: "BASE",
  matchesObserved: 3,
  prior: { team: "BASE", elo: 1800, squadValueIndex: null },
  attackRate: 1.4,
  defenseRate: 1.3,
  possessionPct: 50,
  highPressPct: 25,
  counterAttackPct: 12,
  lowBlockPct: 20,
  lineBreakSuccessPct: 60,
  lb4UnitShare: 0.1,
  offerConversionPct: 50,
  sprintLoadPerMin: 0.02,
  highIntensityShare: 0.18,
  avgHighIntensityKm: 18,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
};

const profile = (
  team: string,
  overrides: Partial<TeamProfile>,
): TeamProfile => {
  const prior: TeamPrior = {
    team,
    elo: overrides.prior?.elo ?? 1800,
    squadValueIndex: overrides.prior?.squadValueIndex ?? null,
  };
  return { ...BASE_PROFILE, ...overrides, team, prior };
};

const strongProfile = (team: string): TeamProfile =>
  profile(team, {
    prior: { team, elo: 1950, squadValueIndex: null },
    attackRate: 2.1,
    defenseRate: 0.8,
    lineBreakSuccessPct: 74,
    lb4UnitShare: 0.18,
    offerConversionPct: 64,
    possessionPct: 58,
  });

const weakProfile = (team: string): TeamProfile =>
  profile(team, {
    prior: { team, elo: 1650, squadValueIndex: null },
    attackRate: 0.9,
    defenseRate: 1.9,
    lineBreakSuccessPct: 48,
    lb4UnitShare: 0.06,
    offerConversionPct: 38,
    possessionPct: 43,
  });

const resolvedFixture = (
  profileA: TeamProfile,
  profileB: TeamProfile,
): ResolvedFixture => ({
  id: `fifwc-${profileA.team}-${profileB.team}-2026-07-04`,
  stage: "QF",
  teamA: profileA.team,
  teamB: profileB.team,
  neutral: true,
  kickoffUtc: "2026-07-04T18:00:00Z",
  profileA,
  profileB,
  priorA: profileA.prior,
  priorB: profileB.prior,
});

// Minimal TeamMatchStats so the leakage-safe profileAsOf path can run.
const BASE_STATS: TeamMatchStats = {
  team: "BASE",
  opponent: "OPP",
  matchId: "m",
  date: "2026-06-10",
  neutral: true,
  goalsFor: 1,
  goalsAgainst: 1,
  possessionPct: 50,
  attemptsAtGoal: 10,
  attemptsOnTarget: 4,
  attemptsOffTarget: 6,
  totalPasses: 500,
  passesCompleted: 420,
  crosses: 12,
  ballProgressions: 40,
  phaseHighPressPct: 25,
  phaseCounterAttackPct: 12,
  phaseLowBlockPct: 20,
  lineBreaksAttempted: 50,
  lineBreaksCompleted: 30,
  lb4UnitsCompleted: 3,
  offerConversionPct: 50,
  movementInBehind: null,
  forcedTurnovers: 8,
  ballRecoveryTimeSec: null,
  teamTotalDistanceKm: 110,
  highIntensityDistanceKm: 20,
  sprints: 90,
  highSpeedRuns: 120,
  topSpeedMax: 34,
  minutesPlayed: 990,
  passNetwork: null,
  xgApprox: 1.3,
};

const stat = (
  team: string,
  opponent: string,
  date: string,
  o: Partial<TeamMatchStats>,
): TeamMatchStats => ({
  ...BASE_STATS,
  team,
  opponent,
  matchId: `${team}-${opponent}-${date}`,
  date,
  ...o,
});

// A small deterministic group stage: STRONG beats weak teams, weak teams draw/lose.
const completedMatch = (
  home: TeamMatchStats,
  away: TeamMatchStats,
  result: CompletedMatch["result"],
): CompletedMatch => ({ home, away, date: home.date, neutral: true, result });

const strongStat = (team: string, opp: string, date: string): TeamMatchStats =>
  stat(team, opp, date, {
    goalsFor: 3,
    goalsAgainst: 0,
    xgApprox: 2.2,
    lineBreaksCompleted: 40,
    lb4UnitsCompleted: 7,
    offerConversionPct: 64,
    possessionPct: 58,
  });

const weakStat = (team: string, opp: string, date: string): TeamMatchStats =>
  stat(team, opp, date, {
    goalsFor: 0,
    goalsAgainst: 3,
    xgApprox: 0.7,
    lineBreaksCompleted: 22,
    lb4UnitsCompleted: 1,
    offerConversionPct: 38,
    possessionPct: 43,
  });

function buildFitInput(): FitInput {
  // Teams S1,S2 (strong) consistently beat W1,W2 (weak) over a round-robin.
  const teams = { S1: "S1", S2: "S2", W1: "W1", W2: "W2" };
  const dates = [
    "2026-06-11",
    "2026-06-12",
    "2026-06-13",
    "2026-06-14",
    "2026-06-15",
    "2026-06-16",
  ];
  const pairs: Array<[string, string, "home" | "away"]> = [
    [teams.S1, teams.W1, "home"],
    [teams.S2, teams.W2, "home"],
    [teams.S1, teams.W2, "home"],
    [teams.S2, teams.W1, "home"],
    [teams.W1, teams.S2, "away"],
    [teams.W2, teams.S1, "away"],
  ];
  const matches: CompletedMatch[] = pairs.map(([h, a, result], i) => {
    const date = dates[i] ?? "2026-06-11";
    const strongIsHome = h.startsWith("S");
    const home = strongIsHome ? strongStat(h, a, date) : weakStat(h, a, date);
    const away = strongIsHome ? weakStat(a, h, date) : strongStat(a, h, date);
    return completedMatch(home, away, result);
  });

  const priors = new Map<string, TeamPrior>([
    ["S1", { team: "S1", elo: 1950, squadValueIndex: null }],
    ["S2", { team: "S2", elo: 1930, squadValueIndex: null }],
    ["W1", { team: "W1", elo: 1650, squadValueIndex: null }],
    ["W2", { team: "W2", elo: 1640, squadValueIndex: null }],
  ]);

  return { matches, profiles: new Map(), priors };
}

const sum = (p: { home: number; draw: number; away: number }): number =>
  p.home + p.draw + p.away;

// --- Tests ------------------------------------------------------------------

describe("createLinebreakGbm", () => {
  it("returns probabilities that sum to ~1", () => {
    const model = createLinebreakGbm();
    const state = model.fit(buildFitInput());
    const { probs } = model.predict(
      state,
      resolvedFixture(strongProfile("ARG"), weakProfile("CAN")),
    );
    expect(sum(probs)).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThanOrEqual(0);
    expect(probs.draw).toBeGreaterThanOrEqual(0);
    expect(probs.away).toBeGreaterThanOrEqual(0);
  });

  it("gives the clearly stronger team a higher win probability", () => {
    const model = createLinebreakGbm();
    const state = model.fit(buildFitInput());
    const { probs } = model.predict(
      state,
      resolvedFixture(strongProfile("ARG"), weakProfile("CAN")),
    );
    expect(probs.home).toBeGreaterThan(probs.away);
  });

  it("is symmetric: swapping sides flips the favourite", () => {
    const model = createLinebreakGbm();
    const state = model.fit(buildFitInput());
    const direct = model.predict(
      state,
      resolvedFixture(strongProfile("ARG"), weakProfile("CAN")),
    );
    const swapped = model.predict(
      state,
      resolvedFixture(weakProfile("CAN"), strongProfile("ARG")),
    );
    expect(direct.probs.home).toBeGreaterThan(direct.probs.away);
    expect(swapped.probs.away).toBeGreaterThan(swapped.probs.home);
  });

  it("falls back gracefully on cold start (too few rows) and still favours the stronger team", () => {
    const model = createLinebreakGbm();
    const full = buildFitInput();
    const coldInput: FitInput = {
      ...full,
      matches: full.matches.slice(0, 2), // < MIN_ROWS
    };
    const state = model.fit(coldInput);
    expect(state.useBoosted).toBe(false);
    const { probs } = model.predict(
      state,
      resolvedFixture(strongProfile("ARG"), weakProfile("CAN")),
    );
    expect(sum(probs)).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThan(probs.away);
  });

  it("produces a plain-language headline and >= 2 evidence drivers", () => {
    const model = createLinebreakGbm();
    const state = model.fit(buildFitInput());
    const { rationale } = model.predict(
      state,
      resolvedFixture(strongProfile("ARG"), weakProfile("CAN")),
    );
    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    for (const d of rationale.drivers) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.detail.length).toBeGreaterThan(0);
      expect(Number.isFinite(d.contributionPp)).toBe(true);
    }
  });

  it("emits a market-blind method note and no market jargon in the headline", () => {
    const model = createLinebreakGbm();
    const state = model.fit(buildFitInput());
    const { rationale } = model.predict(
      state,
      resolvedFixture(strongProfile("ARG"), weakProfile("CAN")),
    );
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    const banned = /elo|bayesian|lambda|credible interval|\bedge\b/i;
    expect(banned.test(rationale.headline)).toBe(false);
    for (const d of rationale.drivers) {
      expect(banned.test(d.detail)).toBe(false);
    }
  });
});
