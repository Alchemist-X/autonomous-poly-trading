import { describe, it, expect } from "vitest";

import {
  generateSyntheticTournament,
  type SyntheticTournament,
} from "./synthetic.js";
import type { TeamMatchStats } from "./types.js";

/** Assert a number is finite and within an inclusive range. */
const inRange = (x: number, lo: number, hi: number): boolean =>
  Number.isFinite(x) && x >= lo && x <= hi;

/** Validate every field of a single TeamMatchStats record is finite + in-range. */
const assertStatsValid = (s: TeamMatchStats): void => {
  expect(inRange(s.goalsFor, 0, 20)).toBe(true);
  expect(inRange(s.goalsAgainst, 0, 20)).toBe(true);
  expect(inRange(s.possessionPct, 0, 100)).toBe(true);
  expect(inRange(s.attemptsAtGoal, 0, 60)).toBe(true);
  expect(inRange(s.attemptsOnTarget, 0, s.attemptsAtGoal)).toBe(true);
  expect(inRange(s.attemptsOffTarget, 0, s.attemptsAtGoal)).toBe(true);
  expect(s.attemptsOnTarget + s.attemptsOffTarget).toBeLessThanOrEqual(
    s.attemptsAtGoal,
  );
  expect(inRange(s.totalPasses, 0, 2000)).toBe(true);
  expect(inRange(s.passesCompleted, 0, s.totalPasses)).toBe(true);
  expect(inRange(s.crosses, 0, 100)).toBe(true);
  expect(inRange(s.ballProgressions, 0, 200)).toBe(true);

  expect(inRange(s.phaseHighPressPct, 0, 100)).toBe(true);
  expect(inRange(s.phaseCounterAttackPct, 0, 100)).toBe(true);
  expect(inRange(s.phaseLowBlockPct, 0, 100)).toBe(true);
  expect(
    s.phaseHighPressPct + s.phaseCounterAttackPct + s.phaseLowBlockPct,
  ).toBeLessThanOrEqual(100);

  expect(inRange(s.lineBreaksAttempted, 0, 200)).toBe(true);
  expect(inRange(s.lineBreaksCompleted, 0, s.lineBreaksAttempted)).toBe(true);
  expect(inRange(s.lb4UnitsCompleted, 0, s.lineBreaksCompleted)).toBe(true);

  expect(s.offerConversionPct).not.toBeNull();
  expect(inRange(s.offerConversionPct as number, 0, 100)).toBe(true);
  expect(s.movementInBehind).not.toBeNull();
  expect(inRange(s.movementInBehind as number, 0, 200)).toBe(true);

  expect(inRange(s.forcedTurnovers, 0, 200)).toBe(true);
  expect(s.ballRecoveryTimeSec).not.toBeNull();
  expect(inRange(s.ballRecoveryTimeSec as number, 0, 60)).toBe(true);

  expect(inRange(s.teamTotalDistanceKm, 80, 140)).toBe(true);
  expect(inRange(s.highIntensityDistanceKm, 0, s.teamTotalDistanceKm)).toBe(
    true,
  );
  expect(inRange(s.sprints, 0, 600)).toBe(true);
  expect(inRange(s.highSpeedRuns, 0, 600)).toBe(true);
  expect(inRange(s.topSpeedMax, 25, 40)).toBe(true);
  expect(inRange(s.minutesPlayed, 900, 1100)).toBe(true);

  expect(s.passNetwork).not.toBeNull();
  for (const e of s.passNetwork ?? []) {
    expect(Number.isFinite(e.count)).toBe(true);
    expect(e.count).toBeGreaterThan(0);
    expect(typeof e.from).toBe("string");
    expect(typeof e.to).toBe("string");
  }

  expect(inRange(s.xgApprox, 0, 12)).toBe(true);
};

describe("generateSyntheticTournament", () => {
  const t: SyntheticTournament = generateSyntheticTournament();

  it("produces 12 groups of 4 with the right round-robin match count", () => {
    // 12 groups of 4 → C(4,2) = 6 matches each → 72 group matches.
    expect(t.matches).toHaveLength(72);
    // Every match carries both perspectives and a result.
    for (const m of t.matches) {
      expect(["home", "draw", "away"]).toContain(m.result);
      expect(m.neutral).toBe(true);
      expect(m.home.team).not.toBe(m.away.team);
    }
  });

  it("builds priors, true strengths, and profiles for all 48 teams", () => {
    expect(t.priors.size).toBe(48);
    expect(t.trueStrength.size).toBe(48);
    expect(t.profiles.size).toBe(48);
    // Elo prior follows 1500 + 220*strength.
    for (const [team, prior] of t.priors) {
      const strength = t.trueStrength.get(team);
      expect(strength).toBeDefined();
      expect(prior.elo).toBeCloseTo(1500 + 220 * (strength as number), 6);
    }
  });

  it("fills every TeamMatchStats field finite and in-range", () => {
    const allStats = t.matches.flatMap((m) => [m.home, m.away]);
    expect(allStats).toHaveLength(144);
    for (const s of allStats) assertStatsValid(s);
  });

  it("uses the report xG formula for xgApprox", () => {
    for (const s of t.matches.flatMap((m) => [m.home, m.away])) {
      const lbToShotProxy = Math.min(
        s.lineBreaksCompleted * 0.18,
        s.attemptsAtGoal,
      );
      const expected =
        0.1 * s.attemptsOnTarget +
        0.03 * s.attemptsOffTarget +
        0.05 * lbToShotProxy;
      expect(s.xgApprox).toBeCloseTo(expected, 6);
    }
  });

  it("produces a 16-match neutral Round-of-32 fixture list", () => {
    expect(t.fixtures).toHaveLength(16);
    const teamCodes = new Set(t.priors.keys());
    for (const f of t.fixtures) {
      expect(f.stage).toBe("R32");
      expect(f.neutral).toBe(true);
      expect(f.teamA).not.toBe(f.teamB);
      expect(teamCodes.has(f.teamA)).toBe(true);
      expect(teamCodes.has(f.teamB)).toBe(true);
    }
  });

  it("is deterministic from the seed", () => {
    const a = generateSyntheticTournament({ seed: 123 });
    const b = generateSyntheticTournament({ seed: 123 });
    expect(JSON.stringify([...a.priors.entries()])).toBe(
      JSON.stringify([...b.priors.entries()]),
    );
    expect(a.matches[0]?.home.xgApprox).toBe(b.matches[0]?.home.xgApprox);
    // Different seed → different tournament.
    const c = generateSyntheticTournament({ seed: 999 });
    expect(JSON.stringify([...a.priors.entries()])).not.toBe(
      JSON.stringify([...c.priors.entries()]),
    );
  });

  it("gives stronger teams a higher attackRate on average", () => {
    const teams = [...t.trueStrength.entries()].sort(
      (x, y) => y[1] - x[1],
    );
    const half = Math.floor(teams.length / 2);
    const strongTeams = teams.slice(0, half);
    const weakTeams = teams.slice(teams.length - half);

    const avgAttack = (group: [string, number][]): number => {
      const rates = group
        .map(([team]) => t.profiles.get(team)?.attackRate)
        .filter((r): r is number => typeof r === "number");
      return rates.reduce((a, b) => a + b, 0) / rates.length;
    };

    expect(avgAttack(strongTeams)).toBeGreaterThan(avgAttack(weakTeams));
  });

  it("respects custom team/group counts", () => {
    const small = generateSyntheticTournament({ teams: 16, groups: 4, seed: 1 });
    expect(small.priors.size).toBe(16);
    // 4 groups of 4 → 6 matches each → 24 matches.
    expect(small.matches).toHaveLength(24);
    // 4 winners + 4 runners-up + 4 best thirds = 12 qualifiers → 6 fixtures.
    expect(small.fixtures).toHaveLength(6);
    for (const f of small.fixtures) {
      expect(f.teamA).not.toBe(f.teamB);
    }
  });
});
