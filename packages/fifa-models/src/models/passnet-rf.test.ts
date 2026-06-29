import { describe, it, expect } from "vitest";

import { createPassnetRf } from "./passnet-rf.js";
import type {
  CompletedMatch,
  FitInput,
  MatchResult,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures -------------------------------------------------

const BASE_STATS: TeamMatchStats = {
  team: "X",
  opponent: "Y",
  matchId: "m",
  date: "2026-06-01",
  neutral: true,
  goalsFor: 1,
  goalsAgainst: 1,
  possessionPct: 50,
  attemptsAtGoal: 10,
  attemptsOnTarget: 4,
  attemptsOffTarget: 6,
  totalPasses: 500,
  passesCompleted: 420,
  crosses: 14,
  ballProgressions: 40,
  phaseHighPressPct: 25,
  phaseCounterAttackPct: 12,
  phaseLowBlockPct: 20,
  lineBreaksAttempted: 30,
  lineBreaksCompleted: 18,
  lb4UnitsCompleted: 2,
  offerConversionPct: 50,
  movementInBehind: 10,
  forcedTurnovers: 8,
  ballRecoveryTimeSec: 7,
  teamTotalDistanceKm: 110,
  highIntensityDistanceKm: 9,
  sprints: 120,
  highSpeedRuns: 150,
  topSpeedMax: 34,
  minutesPlayed: 990,
  passNetwork: null,
  xgApprox: 1.3,
};

const stats = (over: Partial<TeamMatchStats>): TeamMatchStats => ({
  ...BASE_STATS,
  ...over,
});

const BASE_PROFILE: TeamProfile = {
  team: "X",
  matchesObserved: 3,
  prior: { team: "X", elo: 1700, squadValueIndex: null },
  attackRate: 1.4,
  defenseRate: 1.2,
  possessionPct: 52,
  highPressPct: 25,
  counterAttackPct: 12,
  lowBlockPct: 20,
  lineBreakSuccessPct: 60,
  lb4UnitShare: 0.1,
  offerConversionPct: 50,
  sprintLoadPerMin: 0.27,
  highIntensityShare: 0.08,
  avgHighIntensityKm: 9,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
};

const profile = (over: Partial<TeamProfile>): TeamProfile => ({
  ...BASE_PROFILE,
  ...over,
});

const fixture = (
  profileA: TeamProfile,
  profileB: TeamProfile,
): ResolvedFixture => ({
  id: "fx",
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

// Build a varied, leakage-safe-friendly slate of completed matches between three
// teams of clearly different strength so the forests learn a usable signal.
const mkMatch = (
  home: string,
  away: string,
  date: string,
  homeXg: number,
  awayXg: number,
  result: MatchResult,
  netHome: number,
  netAway: number,
): CompletedMatch => ({
  date,
  neutral: true,
  result,
  home: stats({
    team: home,
    opponent: away,
    date,
    xgApprox: homeXg,
    goalsAgainst: awayXg,
    possessionPct: 50 + (homeXg - awayXg) * 10,
    phaseHighPressPct: 20 + netHome * 10,
  }),
  away: stats({
    team: away,
    opponent: home,
    date,
    xgApprox: awayXg,
    goalsAgainst: homeXg,
    possessionPct: 50 + (awayXg - homeXg) * 10,
    phaseHighPressPct: 20 + netAway * 10,
  }),
});

const buildFitInput = (): FitInput => {
  // strong=A, mid=B, weak=C
  const matches: CompletedMatch[] = [
    mkMatch("A", "B", "2026-06-02", 2.2, 1.0, "home", 1.0, 0.4),
    mkMatch("A", "C", "2026-06-05", 2.6, 0.6, "home", 1.0, 0.2),
    mkMatch("B", "C", "2026-06-08", 1.8, 0.9, "home", 0.6, 0.3),
    mkMatch("B", "A", "2026-06-11", 0.9, 2.3, "away", 0.4, 1.0),
    mkMatch("C", "A", "2026-06-14", 0.5, 2.5, "away", 0.2, 1.0),
    mkMatch("C", "B", "2026-06-17", 1.0, 1.7, "away", 0.3, 0.6),
    mkMatch("A", "B", "2026-06-20", 1.6, 1.4, "draw", 0.5, 0.5),
    mkMatch("B", "C", "2026-06-23", 1.5, 1.3, "draw", 0.5, 0.5),
  ];

  const priors = new Map<string, TeamPrior>([
    ["A", { team: "A", elo: 1850, squadValueIndex: null }],
    ["B", { team: "B", elo: 1700, squadValueIndex: null }],
    ["C", { team: "C", elo: 1550, squadValueIndex: null }],
  ]);

  return { matches, profiles: new Map(), priors };
};

// --- Tests ------------------------------------------------------------------

describe("createPassnetRf", () => {
  it("returns 1X2 probabilities that sum to ~1", () => {
    const model = createPassnetRf();
    const state = model.fit(buildFitInput());
    const strong = profile({ team: "A", attackRate: 2.0, defenseRate: 0.8, networkDensity: 0.6 });
    const weak = profile({ team: "C", attackRate: 0.9, defenseRate: 1.6, networkDensity: 0.3 });
    const { probs } = model.predict(state, fixture(strong, weak));

    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThanOrEqual(0);
    expect(probs.draw).toBeGreaterThanOrEqual(0);
    expect(probs.away).toBeGreaterThanOrEqual(0);
  });

  it("gives the clearly stronger team a higher win probability", () => {
    const model = createPassnetRf();
    const state = model.fit(buildFitInput());

    const strong = profile({
      team: "A",
      attackRate: 2.2,
      defenseRate: 0.7,
      networkDensity: 0.62,
      networkCentralization: 0.25,
      top5EdgeShare: 0.24,
      possessionPct: 60,
      prior: { team: "A", elo: 1880, squadValueIndex: null },
    });
    const weak = profile({
      team: "C",
      attackRate: 0.8,
      defenseRate: 1.7,
      networkDensity: 0.32,
      networkCentralization: 0.5,
      top5EdgeShare: 0.42,
      possessionPct: 40,
      prior: { team: "C", elo: 1520, squadValueIndex: null },
    });

    const { probs } = model.predict(state, fixture(strong, weak));
    expect(probs.home).toBeGreaterThan(probs.away);
  });

  it("produces a headline plus >=2 drivers and a market-blind method note", () => {
    const model = createPassnetRf();
    const state = model.fit(buildFitInput());
    const a = profile({ team: "A", attackRate: 1.9, networkDensity: 0.58 });
    const b = profile({ team: "B", attackRate: 1.1, networkDensity: 0.4 });

    const { rationale } = model.predict(state, fixture(a, b));

    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    expect(rationale.methodNote.toLowerCase()).toContain("no betting or market data");
  });

  it("falls back to the logistic cold-start under fewer than 8 training rows", () => {
    const full = buildFitInput();
    const fewMatches = full.matches.slice(0, 3);
    const model = createPassnetRf();
    const state = model.fit({ ...full, matches: fewMatches });

    expect(state.forests).toBeNull();

    const strong = profile({ team: "A", attackRate: 2.1, networkDensity: 0.6, networkCentralization: 0.25 });
    const weak = profile({ team: "C", attackRate: 0.9, networkDensity: 0.32, networkCentralization: 0.5 });
    const { probs, rationale } = model.predict(state, fixture(strong, weak));

    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThan(probs.away);
    expect(rationale.headline.length).toBeGreaterThan(0);
  });

  it("is deterministic: same input yields identical probabilities", () => {
    const model = createPassnetRf();
    const input = buildFitInput();
    const s1 = model.fit(input);
    const s2 = model.fit(input);
    const a = profile({ team: "A", attackRate: 1.8 });
    const b = profile({ team: "B", attackRate: 1.2 });

    const p1 = model.predict(s1, fixture(a, b)).probs;
    const p2 = model.predict(s2, fixture(a, b)).probs;
    expect(p1).toEqual(p2);
  });
});
