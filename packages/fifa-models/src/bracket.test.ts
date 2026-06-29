import { describe, it, expect } from "vitest";
import { computeStandings } from "./bracket.js";
import type { CompletedMatch, TeamMatchStats } from "./types.js";

const tms = (team: string, opponent: string, gf: number, ga: number, id: string): TeamMatchStats => ({
  team, opponent, matchId: id, date: "2026-06-11", neutral: true, goalsFor: gf, goalsAgainst: ga,
  possessionPct: 50, attemptsAtGoal: 10, attemptsOnTarget: 4, attemptsOffTarget: 6,
  totalPasses: 400, passesCompleted: 340, crosses: 10, ballProgressions: 100,
  phaseHighPressPct: 20, phaseCounterAttackPct: 10, phaseLowBlockPct: 20,
  lineBreaksAttempted: 30, lineBreaksCompleted: 18, lb4UnitsCompleted: 3,
  offerConversionPct: null, movementInBehind: null, forcedTurnovers: 30, ballRecoveryTimeSec: null,
  teamTotalDistanceKm: 105, highIntensityDistanceKm: 9, sprints: 0, highSpeedRuns: 0,
  topSpeedMax: 0, minutesPlayed: 0, passNetwork: null, xgApprox: 1.2,
});

const match = (a: string, b: string, ga: number, gb: number, id: string): CompletedMatch => ({
  home: tms(a, b, ga, gb, id),
  away: tms(b, a, gb, ga, id),
  date: "2026-06-11",
  neutral: true,
  result: ga > gb ? "home" : ga < gb ? "away" : "draw",
});

// Group A teams (canonical names matching GROUPS_2026).
const A = ["Mexico", "Korea Republic", "Czechia", "South Africa"] as const;

describe("computeStandings", () => {
  it("ranks a group by points (3 wins > 2 > 1 > 0)", () => {
    const matches: CompletedMatch[] = [
      match(A[0], A[1], 2, 0, "M1"), match(A[0], A[2], 2, 0, "M2"), match(A[0], A[3], 2, 0, "M3"),
      match(A[1], A[2], 1, 0, "M4"), match(A[1], A[3], 1, 0, "M5"),
      match(A[2], A[3], 1, 0, "M6"),
    ];
    const standings = computeStandings(matches);
    expect(standings.A!.map((s) => s.team)).toEqual([
      "Mexico", "Korea Republic", "Czechia", "South Africa",
    ]);
    expect(standings.A![0]!.points).toBe(9);
    expect(standings.A![0]!.gd).toBe(6);
    expect(standings.A![3]!.points).toBe(0);
  });

  it("breaks equal points by goal difference", () => {
    // Mexico & Korea both beat the bottom two, draw each other -> equal points,
    // Mexico has the bigger goal difference and must rank first.
    const matches: CompletedMatch[] = [
      match(A[0], A[1], 1, 1, "M1"),
      match(A[0], A[2], 5, 0, "M2"), match(A[0], A[3], 5, 0, "M3"),
      match(A[1], A[2], 1, 0, "M4"), match(A[1], A[3], 1, 0, "M5"),
      match(A[2], A[3], 0, 0, "M6"),
    ];
    const standings = computeStandings(matches);
    expect(standings.A!.slice(0, 2).map((s) => s.team)).toEqual(["Mexico", "Korea Republic"]);
    expect(standings.A![0]!.gd).toBeGreaterThan(standings.A![1]!.gd);
  });

  it("covers all 12 groups even with partial matches", () => {
    const standings = computeStandings([match(A[0], A[1], 1, 0, "M1")]);
    expect(Object.keys(standings).sort()).toEqual(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
    );
    expect(standings.B!.every((s) => s.played === 0)).toBe(true);
  });
});
