import { describe, it, expect } from "vitest";

import { createTacticalMElo } from "./tactical-melo.js";
import type {
  CompletedMatch,
  FitInput,
  MatchResult,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures (no randomness) -------------------------------

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
  sprintLoadPerMin: 0.05,
  highIntensityShare: 0.3,
  avgHighIntensityKm: 30,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
};

const profile = (over: Partial<TeamProfile>): TeamProfile => {
  const prior: TeamPrior = {
    team: over.team ?? BASE_PROFILE.team,
    elo: over.prior?.elo ?? BASE_PROFILE.prior.elo,
    squadValueIndex: null,
  };
  return { ...BASE_PROFILE, ...over, prior };
};

const BASE_STATS: TeamMatchStats = {
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
  crosses: 12,
  ballProgressions: 40,
  phaseHighPressPct: 25,
  phaseCounterAttackPct: 12,
  phaseLowBlockPct: 20,
  lineBreaksAttempted: 30,
  lineBreaksCompleted: 18,
  lb4UnitsCompleted: 2,
  offerConversionPct: 50,
  movementInBehind: null,
  forcedTurnovers: 8,
  ballRecoveryTimeSec: null,
  teamTotalDistanceKm: 110,
  highIntensityDistanceKm: 33,
  sprints: 90,
  highSpeedRuns: 120,
  topSpeedMax: 33,
  minutesPlayed: 990,
  passNetwork: null,
  xgApprox: 1.4,
};

const stats = (team: string, over: Partial<TeamMatchStats>): TeamMatchStats => ({
  ...BASE_STATS,
  team,
  ...over,
});

const completed = (
  homeTeam: string,
  awayTeam: string,
  result: MatchResult,
  date: string,
): CompletedMatch => ({
  home: stats(homeTeam, { opponent: awayTeam, date }),
  away: stats(awayTeam, { opponent: homeTeam, date }),
  date,
  neutral: true,
  result,
});

const fixture = (a: TeamProfile, b: TeamProfile): ResolvedFixture => ({
  id: `${a.team}-${b.team}`,
  stage: "R16",
  teamA: a.team,
  teamB: b.team,
  neutral: true,
  kickoffUtc: "2026-07-04T18:00:00Z",
  profileA: a,
  profileB: b,
  priorA: a.prior,
  priorB: b.prior,
});

// A clearly stronger team and a clearly weaker team.
const STRONG = profile({
  team: "STRONG",
  prior: { team: "STRONG", elo: 2050, squadValueIndex: null },
  attackRate: 2.1,
  defenseRate: 0.8,
  possessionPct: 60,
  highPressPct: 38,
});
const WEAK = profile({
  team: "WEAK",
  prior: { team: "WEAK", elo: 1550, squadValueIndex: null },
  attackRate: 0.9,
  defenseRate: 1.9,
  lowBlockPct: 40,
});

const buildInput = (): FitInput => {
  const profiles = new Map<string, TeamProfile>([
    [STRONG.team, STRONG],
    [WEAK.team, WEAK],
  ]);
  const priors = new Map<string, TeamPrior>([
    [STRONG.team, STRONG.prior],
    [WEAK.team, WEAK.prior],
  ]);
  // Strong beats weak in the group stage; deterministic results.
  const matches: CompletedMatch[] = [
    completed(STRONG.team, WEAK.team, "home", "2026-06-12"),
    completed(WEAK.team, STRONG.team, "away", "2026-06-16"),
  ];
  return { matches, profiles, priors };
};

// --- Tests ----------------------------------------------------------------

describe("tactical-melo", () => {
  const model = createTacticalMElo();

  it("exposes the expected id/family", () => {
    expect(model.id).toBe("tactical-melo");
    expect(model.family).toBe("elo");
  });

  it("produces probabilities that sum to ~1", () => {
    const state = model.fit(buildInput());
    const { probs } = model.predict(state, fixture(STRONG, WEAK));
    const sum = probs.home + probs.draw + probs.away;
    expect(sum).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThanOrEqual(0);
    expect(probs.draw).toBeGreaterThanOrEqual(0);
    expect(probs.away).toBeGreaterThanOrEqual(0);
  });

  it("gives the clearly stronger team a higher win probability", () => {
    const state = model.fit(buildInput());
    // STRONG as team A.
    const strongHome = model.predict(state, fixture(STRONG, WEAK)).probs;
    expect(strongHome.home).toBeGreaterThan(strongHome.away);
    // Symmetry: with WEAK as team A, the weaker side's win prob is lower.
    const weakHome = model.predict(state, fixture(WEAK, STRONG)).probs;
    expect(weakHome.away).toBeGreaterThan(weakHome.home);
    // The strong side's win prob should clearly exceed the weak side's.
    expect(strongHome.home).toBeGreaterThan(weakHome.home);
  });

  it("returns a plain-language headline and at least two drivers", () => {
    const state = model.fit(buildInput());
    const { rationale } = model.predict(state, fixture(STRONG, WEAK));
    expect(typeof rationale.headline).toBe("string");
    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    for (const d of rationale.drivers) {
      expect(typeof d.detail).toBe("string");
      expect(Number.isFinite(d.contributionPp)).toBe(true);
    }
  });

  it("uses a market-blind method note with no banned jargon in the headline", () => {
    const state = model.fit(buildInput());
    const { rationale } = model.predict(state, fixture(STRONG, WEAK));
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    expect(rationale.methodNote).toMatch(/no market data was used\.$/);
    const headline = rationale.headline.toLowerCase();
    for (const banned of ["elo", "bayesian", "edge", "lambda", "credible interval"]) {
      expect(headline.includes(banned)).toBe(false);
    }
  });

  it("captures a non-transitive style clash that can favour a lower-rated side", () => {
    // Two equal-strength teams with opposing tactical vectors: the antisymmetric
    // Omega term must break the tie toward exactly one of them.
    const cyclicA = profile({
      team: "CYC_A",
      prior: { team: "CYC_A", elo: 1800, squadValueIndex: null },
      tacticalVector: [1.5, 0, 0, 0],
    });
    const cyclicB = profile({
      team: "CYC_B",
      prior: { team: "CYC_B", elo: 1800, squadValueIndex: null },
      tacticalVector: [0, 1.5, 0, 0],
    });
    const profiles = new Map<string, TeamProfile>([
      [cyclicA.team, cyclicA],
      [cyclicB.team, cyclicB],
    ]);
    const priors = new Map<string, TeamPrior>([
      [cyclicA.team, cyclicA.prior],
      [cyclicB.team, cyclicB.prior],
    ]);
    const state = model.fit({ matches: [], profiles, priors });
    const ab = model.predict(state, fixture(cyclicA, cyclicB)).probs;
    const ba = model.predict(state, fixture(cyclicB, cyclicA)).probs;
    // With equal mu, the clash term alone decides — and it must be antisymmetric:
    // whoever it favours as team A it favours again as team B.
    expect(ab.home).not.toBeCloseTo(ab.away, 3);
    expect(ab.home).toBeCloseTo(ba.away, 6);
    expect(ab.away).toBeCloseTo(ba.home, 6);
  });
});
