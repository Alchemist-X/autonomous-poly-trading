import { describe, it, expect } from "vitest";

import { createProdegy } from "./prodegy.js";
import type {
  CompletedMatch,
  FitInput,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures (no randomness) ---------------------------------

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
  sprintLoadPerMin: 0.1,
  highIntensityShare: 0.3,
  avgHighIntensityKm: 2.5,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
};

const profile = (over: Partial<TeamProfile> & { team: string }): TeamProfile => ({
  ...baseProfile,
  prior: { team: over.team, elo: 1500, squadValueIndex: null },
  ...over,
});

const baseStats: TeamMatchStats = {
  team: "BASE",
  opponent: "OPP",
  matchId: "m",
  date: "2026-06-01",
  neutral: true,
  goalsFor: 1,
  goalsAgainst: 1,
  possessionPct: 50,
  attemptsAtGoal: 12,
  attemptsOnTarget: 4,
  attemptsOffTarget: 8,
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
  forcedTurnovers: 50,
  ballRecoveryTimeSec: null,
  teamTotalDistanceKm: 110,
  highIntensityDistanceKm: 33,
  sprints: 120,
  highSpeedRuns: 200,
  topSpeedMax: 34,
  minutesPlayed: 990,
  passNetwork: null,
  xgApprox: 1.0,
};

const stats = (
  over: Partial<TeamMatchStats> & { team: string; opponent: string },
): TeamMatchStats => ({ ...baseStats, ...over });

const prior = (team: string, elo: number): TeamPrior => ({
  team,
  elo,
  squadValueIndex: null,
});

// A strong attacking team (STRONG) and a weak team (WEAK) that played each other,
// plus a neutral team (MID) so the field context has spread.
const buildInput = (): FitInput => {
  const matches: CompletedMatch[] = [
    {
      date: "2026-06-10",
      neutral: true,
      result: "home",
      home: stats({ team: "STRONG", opponent: "WEAK", goalsFor: 3, goalsAgainst: 0, xgApprox: 2.8 }),
      away: stats({ team: "WEAK", opponent: "STRONG", goalsFor: 0, goalsAgainst: 3, xgApprox: 0.4 }),
    },
    {
      date: "2026-06-12",
      neutral: true,
      result: "home",
      home: stats({ team: "STRONG", opponent: "MID", goalsFor: 2, goalsAgainst: 1, xgApprox: 2.3 }),
      away: stats({ team: "MID", opponent: "STRONG", goalsFor: 1, goalsAgainst: 2, xgApprox: 1.1 }),
    },
    {
      date: "2026-06-14",
      neutral: true,
      result: "away",
      home: stats({ team: "WEAK", opponent: "MID", goalsFor: 0, goalsAgainst: 2, xgApprox: 0.5 }),
      away: stats({ team: "MID", opponent: "WEAK", goalsFor: 2, goalsAgainst: 0, xgApprox: 1.9 }),
    },
  ];

  const priors = new Map<string, TeamPrior>([
    ["STRONG", prior("STRONG", 1750)],
    ["MID", prior("MID", 1500)],
    ["WEAK", prior("WEAK", 1300)],
  ]);

  return { matches, profiles: new Map(), priors };
};

const fixture = (
  teamA: string,
  teamB: string,
  profileA: TeamProfile,
  profileB: TeamProfile,
  priorA: TeamPrior,
  priorB: TeamPrior,
): ResolvedFixture => ({
  id: `fx-${teamA}-${teamB}`,
  stage: "QF",
  teamA,
  teamB,
  neutral: true,
  kickoffUtc: "2026-07-04T18:00:00Z",
  profileA,
  profileB,
  priorA,
  priorB,
});

describe("createProdegy", () => {
  const model = createProdegy();
  const input = buildInput();
  const state = model.fit(input);

  const strongProfile = profile({ team: "STRONG", attackRate: 2.4, defenseRate: 0.7 });
  const weakProfile = profile({ team: "WEAK", attackRate: 0.6, defenseRate: 2.2 });

  it("exposes the expected model identity", () => {
    expect(model.id).toBe("prodegy");
    expect(model.family).toBe("elo");
  });

  it("returns 1X2 probabilities that sum to ~1", () => {
    const fx = fixture(
      "STRONG",
      "WEAK",
      strongProfile,
      weakProfile,
      prior("STRONG", 1750),
      prior("WEAK", 1300),
    );
    const { probs } = model.predict(state, fx);
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);
    for (const p of [probs.home, probs.draw, probs.away]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("favours the clearly stronger team", () => {
    const fx = fixture(
      "STRONG",
      "WEAK",
      strongProfile,
      weakProfile,
      prior("STRONG", 1750),
      prior("WEAK", 1300),
    );
    const { probs } = model.predict(state, fx);
    expect(probs.home).toBeGreaterThan(probs.away);
    // Reversing the fixture must reverse the favourite (symmetry sanity check).
    const reversed = fixture(
      "WEAK",
      "STRONG",
      weakProfile,
      strongProfile,
      prior("WEAK", 1300),
      prior("STRONG", 1750),
    );
    const r = model.predict(state, reversed);
    expect(r.probs.away).toBeGreaterThan(r.probs.home);
  });

  it("produces a decision-first rationale with evidence cards", () => {
    const fx = fixture(
      "STRONG",
      "WEAK",
      strongProfile,
      weakProfile,
      prior("STRONG", 1750),
      prior("WEAK", 1300),
    );
    const { rationale } = model.predict(state, fx);
    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    // Headline must stay jargon-free.
    for (const banned of ["Elo", "Bayesian", "lambda", "edge", "credible"]) {
      expect(rationale.headline.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  it("is deterministic across repeated fits and predicts", () => {
    const fx = fixture(
      "STRONG",
      "WEAK",
      strongProfile,
      weakProfile,
      prior("STRONG", 1750),
      prior("WEAK", 1300),
    );
    const a = createProdegy().predict(createProdegy().fit(buildInput()), fx);
    const b = createProdegy().predict(createProdegy().fit(buildInput()), fx);
    expect(a.probs).toEqual(b.probs);
  });
});
