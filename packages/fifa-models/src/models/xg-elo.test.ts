import { describe, it, expect } from "vitest";

import { createXgElo } from "./xg-elo.js";
import type {
  CompletedMatch,
  FitInput,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures (no randomness) ---------------------------------

const BASE_STATS: TeamMatchStats = {
  team: "base",
  opponent: "opp",
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
  crosses: 12,
  ballProgressions: 40,
  phaseHighPressPct: 25,
  phaseCounterAttackPct: 12,
  phaseLowBlockPct: 20,
  lineBreaksAttempted: 30,
  lineBreaksCompleted: 18,
  lb4UnitsCompleted: 2,
  offerConversionPct: 50,
  movementInBehind: 10,
  forcedTurnovers: 25,
  ballRecoveryTimeSec: 6,
  teamTotalDistanceKm: 110,
  highIntensityDistanceKm: 9,
  sprints: 120,
  highSpeedRuns: 180,
  topSpeedMax: 33,
  minutesPlayed: 990,
  passNetwork: null,
  xgApprox: 1.35,
};

const stats = (over: Partial<TeamMatchStats>): TeamMatchStats => ({
  ...BASE_STATS,
  ...over,
});

const BASE_PROFILE: TeamProfile = {
  team: "base",
  matchesObserved: 3,
  prior: { team: "base", elo: 1500, squadValueIndex: null },
  attackRate: 1.35,
  defenseRate: 1.35,
  possessionPct: 50,
  highPressPct: 25,
  counterAttackPct: 12,
  lowBlockPct: 20,
  lineBreakSuccessPct: 60,
  lb4UnitShare: 0.1,
  offerConversionPct: 50,
  sprintLoadPerMin: 0.3,
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

const prior = (team: string, elo: number): TeamPrior => ({
  team,
  elo,
  squadValueIndex: null,
});

/** One completed group match where `home` out-created `away` by `xgEdge`. */
const completed = (
  homeTeam: string,
  awayTeam: string,
  date: string,
  homeXg: number,
  awayXg: number,
): CompletedMatch => ({
  home: stats({ team: homeTeam, opponent: awayTeam, date, xgApprox: homeXg }),
  away: stats({ team: awayTeam, opponent: homeTeam, date, xgApprox: awayXg }),
  date,
  neutral: true,
  result: homeXg > awayXg ? "home" : homeXg < awayXg ? "away" : "draw",
});

// A three-team group: "strong" dominates xG, "weak" gets out-created, "mid" is even.
const PRIORS = new Map<string, TeamPrior>([
  ["strong", prior("strong", 1700)],
  ["weak", prior("weak", 1450)],
  ["mid", prior("mid", 1550)],
]);

const MATCHES: readonly CompletedMatch[] = [
  completed("strong", "weak", "2026-06-10", 2.6, 0.4),
  completed("strong", "mid", "2026-06-13", 2.1, 1.0),
  completed("mid", "weak", "2026-06-16", 1.8, 0.6),
];

const PROFILES = new Map<string, TeamProfile>([
  ["strong", profile({ team: "strong", attackRate: 2.4, defenseRate: 0.6, prior: prior("strong", 1700) })],
  ["weak", profile({ team: "weak", attackRate: 0.7, defenseRate: 2.2, prior: prior("weak", 1450) })],
  ["mid", profile({ team: "mid", attackRate: 1.4, defenseRate: 1.3, prior: prior("mid", 1550) })],
]);

const FIT_INPUT: FitInput = {
  matches: MATCHES,
  profiles: PROFILES,
  priors: PRIORS,
};

const fixture = (teamA: string, teamB: string): ResolvedFixture => ({
  id: `fifwc-${teamA}-${teamB}-2026-07-04`,
  stage: "QF",
  teamA,
  teamB,
  neutral: true,
  kickoffUtc: "2026-07-04T18:00:00Z",
  profileA: PROFILES.get(teamA)!,
  profileB: PROFILES.get(teamB)!,
  priorA: PRIORS.get(teamA)!,
  priorB: PRIORS.get(teamB)!,
});

// --- Tests ------------------------------------------------------------------

describe("createXgElo", () => {
  const model = createXgElo();

  it("exposes the expected model identity", () => {
    expect(model.id).toBe("xg-elo");
    expect(model.family).toBe("elo");
  });

  it("produces probabilities that sum to ~1", () => {
    const state = model.fit(FIT_INPUT);
    const { probs } = model.predict(state, fixture("strong", "weak"));
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThanOrEqual(0);
    expect(probs.draw).toBeGreaterThanOrEqual(0);
    expect(probs.away).toBeGreaterThanOrEqual(0);
  });

  it("favours the team that out-created opponents (higher xG form + Elo prior)", () => {
    const state = model.fit(FIT_INPUT);

    const strongAsA = model.predict(state, fixture("strong", "weak"));
    // Stronger team listed as A should win (home) far more often than it loses (away).
    expect(strongAsA.probs.home).toBeGreaterThan(strongAsA.probs.away);

    // Symmetry: swapping the slots flips the favourite onto the away side.
    const strongAsB = model.predict(state, fixture("weak", "strong"));
    expect(strongAsB.probs.away).toBeGreaterThan(strongAsB.probs.home);
    expect(strongAsB.probs.away).toBeCloseTo(strongAsA.probs.home, 6);
  });

  it("rates the xG-dominant team above the even-form team", () => {
    const state = model.fit(FIT_INPUT);
    const strongRating = state.ratings.get("strong") ?? 0;
    const midRating = state.ratings.get("mid") ?? 0;
    const weakRating = state.ratings.get("weak") ?? 0;
    expect(strongRating).toBeGreaterThan(midRating);
    expect(midRating).toBeGreaterThan(weakRating);
  });

  it("returns a decision-first rationale with a headline and >=2 drivers", () => {
    const state = model.fit(FIT_INPUT);
    const { rationale } = model.predict(state, fixture("strong", "weak"));

    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    for (const d of rationale.drivers) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.detail.length).toBeGreaterThan(0);
      expect(Number.isFinite(d.contributionPp)).toBe(true);
    }
  });

  it("keeps the headline jargon-free", () => {
    const state = model.fit(FIT_INPUT);
    const { rationale } = model.predict(state, fixture("strong", "weak"));
    const banned = ["Elo", "Bayesian", "edge", "credible interval", "lambda"];
    for (const word of banned) {
      expect(rationale.headline.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("emits a market-blind method note", () => {
    const state = model.fit(FIT_INPUT);
    const { rationale } = model.predict(state, fixture("strong", "weak"));
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    expect(rationale.methodNote.toLowerCase()).toContain("no betting");
  });

  it("does not mutate the input match array", () => {
    const before = FIT_INPUT.matches.map((m) => m.date);
    model.fit(FIT_INPUT);
    const after = FIT_INPUT.matches.map((m) => m.date);
    expect(after).toEqual(before);
  });
});
