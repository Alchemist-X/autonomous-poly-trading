import { describe, it, expect } from "vitest";

import { createFatigueElo } from "./fatigue-elo.js";
import type {
  CompletedMatch,
  FitInput,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

/** A neutral baseline profile; tests override only the fields that matter. */
const baseProfile: TeamProfile = {
  team: "BASE",
  matchesObserved: 3,
  prior: { team: "BASE", elo: 1500, squadValueIndex: null },
  attackRate: 1.35,
  defenseRate: 1.35,
  possessionPct: 50,
  highPressPct: 25,
  counterAttackPct: 12,
  lowBlockPct: 20,
  lineBreakSuccessPct: 60,
  lb4UnitShare: 0.1,
  offerConversionPct: 50,
  sprintLoadPerMin: 0.12,
  highIntensityShare: 0.3,
  avgHighIntensityKm: 9.0,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
};

const makeProfile = (
  team: string,
  overrides: Partial<TeamProfile>,
): TeamProfile => ({
  ...baseProfile,
  team,
  prior: { team, elo: overrides.prior?.elo ?? 1500, squadValueIndex: null },
  ...overrides,
});

/** A neutral baseline match-stats row; spread to build CompletedMatch sides. */
const baseStats: TeamMatchStats = {
  team: "BASE",
  opponent: "OPP",
  matchId: "m",
  date: "2026-06-15",
  neutral: true,
  goalsFor: 1,
  goalsAgainst: 1,
  possessionPct: 50,
  attemptsAtGoal: 10,
  attemptsOnTarget: 4,
  attemptsOffTarget: 6,
  totalPasses: 500,
  passesCompleted: 420,
  crosses: 15,
  ballProgressions: 40,
  phaseHighPressPct: 25,
  phaseCounterAttackPct: 12,
  phaseLowBlockPct: 20,
  lineBreaksAttempted: 30,
  lineBreaksCompleted: 18,
  lb4UnitsCompleted: 2,
  offerConversionPct: 50,
  movementInBehind: null,
  forcedTurnovers: 12,
  ballRecoveryTimeSec: null,
  teamTotalDistanceKm: 110,
  highIntensityDistanceKm: 9,
  sprints: 90,
  highSpeedRuns: 60,
  topSpeedMax: 33,
  minutesPlayed: 990,
  passNetwork: null,
  xgApprox: 1.3,
};

const makeStats = (
  team: string,
  overrides: Partial<TeamMatchStats>,
): TeamMatchStats => ({ ...baseStats, team, ...overrides });

const makeMatch = (
  home: TeamMatchStats,
  away: TeamMatchStats,
  result: CompletedMatch["result"],
  date = "2026-06-15",
): CompletedMatch => ({ home, away, date, neutral: true, result });

const priorOf = (team: string, elo: number): TeamPrior => ({
  team,
  elo,
  squadValueIndex: null,
});

const buildFitInput = (
  matches: readonly CompletedMatch[],
  profiles: ReadonlyMap<string, TeamProfile>,
  priors: ReadonlyMap<string, TeamPrior>,
): FitInput => ({ matches, profiles, priors });

const makeFixture = (
  profileA: TeamProfile,
  profileB: TeamProfile,
): ResolvedFixture => ({
  id: `fifwc-${profileA.team}-${profileB.team}-2026`,
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

describe("createFatigueElo", () => {
  const model = createFatigueElo();

  // Strong team: high Elo prior, high attack, low defence. Weak team: opposite.
  const strong = makeProfile("STRONG", {
    prior: { team: "STRONG", elo: 1800, squadValueIndex: null },
    attackRate: 2.1,
    defenseRate: 0.8,
    avgHighIntensityKm: 8.5,
  });
  const weak = makeProfile("WEAK", {
    prior: { team: "WEAK", elo: 1300, squadValueIndex: null },
    attackRate: 0.9,
    defenseRate: 2.0,
    avgHighIntensityKm: 9.0,
  });

  const profiles = new Map<string, TeamProfile>([
    ["STRONG", strong],
    ["WEAK", weak],
  ]);
  const priors = new Map<string, TeamPrior>([
    ["STRONG", priorOf("STRONG", 1800)],
    ["WEAK", priorOf("WEAK", 1300)],
  ]);

  // One group-stage replay match where STRONG beat WEAK.
  const matches: readonly CompletedMatch[] = [
    makeMatch(
      makeStats("STRONG", { goalsFor: 3, goalsAgainst: 0 }),
      makeStats("WEAK", { goalsFor: 0, goalsAgainst: 3 }),
      "home",
    ),
  ];

  const state = model.fit(buildFitInput(matches, profiles, priors));

  it("returns probabilities that sum to ~1", () => {
    const { probs } = model.predict(state, makeFixture(strong, weak));
    const total = probs.home + probs.draw + probs.away;
    expect(total).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThanOrEqual(0);
    expect(probs.draw).toBeGreaterThanOrEqual(0);
    expect(probs.away).toBeGreaterThanOrEqual(0);
  });

  it("gives the clearly stronger team a higher win probability", () => {
    const { probs } = model.predict(state, makeFixture(strong, weak));
    // teamA = STRONG => probs.home is STRONG's win prob.
    expect(probs.home).toBeGreaterThan(probs.away);

    // Symmetry: flipping the sides flips the favourite.
    const flipped = model.predict(state, makeFixture(weak, strong));
    expect(flipped.probs.away).toBeGreaterThan(flipped.probs.home);
  });

  it("penalises the team that carried the heavier physical load", () => {
    // Two evenly-rated teams; the one with far higher HI distance should be
    // the underdog purely from the fatigue penalty.
    const fresh = makeProfile("FRESH", {
      prior: { team: "FRESH", elo: 1500, squadValueIndex: null },
      avgHighIntensityKm: 8.0,
    });
    const tired = makeProfile("TIRED", {
      prior: { team: "TIRED", elo: 1500, squadValueIndex: null },
      avgHighIntensityKm: 13.0,
    });
    const evenProfiles = new Map<string, TeamProfile>([
      ["FRESH", fresh],
      ["TIRED", tired],
    ]);
    const evenPriors = new Map<string, TeamPrior>([
      ["FRESH", priorOf("FRESH", 1500)],
      ["TIRED", priorOf("TIRED", 1500)],
    ]);
    const evenState = model.fit(buildFitInput([], evenProfiles, evenPriors));
    const { probs } = model.predict(evenState, makeFixture(fresh, tired));
    expect(probs.home).toBeGreaterThan(probs.away);
  });

  it("produces a plain-language headline and >=2 drivers", () => {
    const { rationale } = model.predict(state, makeFixture(strong, weak));
    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    for (const d of rationale.drivers) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.detail.length).toBeGreaterThan(0);
      expect(Number.isFinite(d.contributionPp)).toBe(true);
    }
  });

  it("headline and drivers stay free of modelling jargon", () => {
    const { rationale } = model.predict(state, makeFixture(strong, weak));
    const banned = /\b(elo|bayesian|edge|credible interval|lambda)\b/i;
    expect(banned.test(rationale.headline)).toBe(false);
    for (const d of rationale.drivers) {
      expect(banned.test(d.detail)).toBe(false);
    }
  });

  it("emits a market-blind method note", () => {
    const { rationale } = model.predict(state, makeFixture(strong, weak));
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    expect(rationale.methodNote.toLowerCase()).toContain("no betting");
  });
});
