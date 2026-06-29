import { describe, it, expect } from "vitest";

import {
  SUBGROUPS,
  applyMCBoost,
  bootstrapCalibrationCI,
  fitMCBoost,
  makeSubgroups,
} from "./mcboost.js";
import type { CalibrationSample } from "./mcboost.js";
import type {
  MatchResult,
  OneXTwo,
  ResolvedFixture,
  TeamPrior,
  TeamProfile,
} from "../types.js";

/** A neutral baseline profile; helpers override only the fields that matter. */
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

const makePrior = (team: string, elo: number): TeamPrior => ({
  team,
  elo,
  squadValueIndex: null,
});

const makeFixture = (
  id: string,
  profileA: TeamProfile,
  profileB: TeamProfile,
): ResolvedFixture => ({
  id,
  stage: "R16",
  teamA: profileA.team,
  teamB: profileB.team,
  neutral: true,
  kickoffUtc: "2026-07-04T18:00:00Z",
  profileA,
  profileB,
  priorA: makePrior(profileA.team, profileA.prior.elo),
  priorB: makePrior(profileB.team, profileB.prior.elo),
});

/** Largest |observed − predicted| gap across all subgroups and classes. */
const CLASS_ORDER: readonly MatchResult[] = ["home", "draw", "away"];

function maxSubgroupError(
  samples: readonly CalibrationSample[],
  predict: (s: CalibrationSample) => OneXTwo,
): number {
  let worst = 0;
  for (const subgroup of SUBGROUPS) {
    const members = samples
      .map((s) => ({ s, p: predict(s) }))
      .filter(({ s, p }) => subgroup.test(s.fixture, p));
    if (members.length === 0) continue;
    for (let c = 0; c < CLASS_ORDER.length; c += 1) {
      const cls = CLASS_ORDER[c]!;
      let predSum = 0;
      let actualSum = 0;
      for (const { s, p } of members) {
        predSum += p[cls];
        actualSum += s.outcome === cls ? 1 : 0;
      }
      const gap = Math.abs((actualSum - predSum) / members.length);
      if (gap > worst) worst = gap;
    }
  }
  return worst;
}

/**
 * Build a synthetic set where the high-possession subgroup (C1) is deliberately
 * miscalibrated: those fixtures are forecast as strong home wins but actually
 * resolve to draws/away half the time, so the home class is badly over-predicted.
 */
function makeSamples(): CalibrationSample[] {
  const samples: CalibrationSample[] = [];

  // C1 members: possession > 55. Predicted home-heavy, but outcomes mixed.
  const highPoss = makeProfile("POSS", { possessionPct: 70 });
  const opp = makeProfile("OPP", { possessionPct: 40 });
  const c1Outcomes: MatchResult[] = [
    "home",
    "draw",
    "away",
    "draw",
    "away",
    "home",
    "away",
    "draw",
  ];
  c1Outcomes.forEach((outcome, i) => {
    samples.push({
      fixture: makeFixture(`c1-${i}`, highPoss, opp),
      probs: { home: 0.8, draw: 0.12, away: 0.08 },
      outcome,
    });
  });

  // Neutral, well-calibrated filler not in C1 (possession ~50).
  const neutralA = makeProfile("NA", { possessionPct: 50 });
  const neutralB = makeProfile("NB", { possessionPct: 50 });
  const fillerOutcomes: MatchResult[] = [
    "home",
    "draw",
    "away",
    "home",
    "draw",
    "away",
  ];
  fillerOutcomes.forEach((outcome, i) => {
    samples.push({
      fixture: makeFixture(`f-${i}`, neutralA, neutralB),
      probs: { home: 0.34, draw: 0.33, away: 0.33 },
      outcome,
    });
  });

  return samples;
}

describe("makeSubgroups / SUBGROUPS", () => {
  it("exposes the six report subgroups C1..C6", () => {
    expect(SUBGROUPS.map((g) => g.id)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
    ]);
  });

  it("C1 matches high-possession sides only", () => {
    const high = makeFixture(
      "x",
      makeProfile("H", { possessionPct: 60 }),
      makeProfile("L", { possessionPct: 40 }),
    );
    const low = makeFixture(
      "y",
      makeProfile("L1", { possessionPct: 50 }),
      makeProfile("L2", { possessionPct: 50 }),
    );
    const c1 = SUBGROUPS.find((g) => g.id === "C1")!;
    const probs: OneXTwo = { home: 0.4, draw: 0.3, away: 0.3 };
    expect(c1.test(high, probs)).toBe(true);
    expect(c1.test(low, probs)).toBe(false);
  });

  it("C3 requires both high counter and low possession", () => {
    const c3 = SUBGROUPS.find((g) => g.id === "C3")!;
    const probs: OneXTwo = { home: 0.4, draw: 0.3, away: 0.3 };
    const match = makeFixture(
      "z",
      makeProfile("CTR", { counterAttackPct: 20, possessionPct: 40 }),
      makeProfile("OPP", {}),
    );
    const noMatch = makeFixture(
      "w",
      makeProfile("CTR2", { counterAttackPct: 20, possessionPct: 50 }),
      makeProfile("OPP2", {}),
    );
    expect(c3.test(match, probs)).toBe(true);
    expect(c3.test(noMatch, probs)).toBe(false);
  });

  it("C5 fires on a large Elo gap", () => {
    const c5 = SUBGROUPS.find((g) => g.id === "C5")!;
    const probs: OneXTwo = { home: 0.4, draw: 0.3, away: 0.3 };
    const mismatch = makeFixture(
      "m",
      makeProfile("STRONG", { prior: { team: "STRONG", elo: 1800, squadValueIndex: null } }),
      makeProfile("WEAK", { prior: { team: "WEAK", elo: 1500, squadValueIndex: null } }),
    );
    expect(c5.test(mismatch, probs)).toBe(true);
  });

  it("C6 is inert without a confederation lookup but fires when one is bound", () => {
    const probs: OneXTwo = { home: 0.4, draw: 0.3, away: 0.3 };
    const cross = makeFixture("cc", makeProfile("BRA", {}), makeProfile("GER", {}));

    const inert = SUBGROUPS.find((g) => g.id === "C6")!;
    expect(inert.test(cross, probs)).toBe(false);

    const conf: Record<string, string> = { BRA: "CONMEBOL", GER: "UEFA" };
    const bound = makeSubgroups({ confederationOf: (t) => conf[t] }).find(
      (g) => g.id === "C6",
    )!;
    expect(bound.test(cross, probs)).toBe(true);
  });
});

describe("fitMCBoost", () => {
  it("does not increase the worst-subgroup calibration error", () => {
    const samples = makeSamples();
    const before = maxSubgroupError(samples, (s) => s.probs);

    const model = fitMCBoost(samples);
    const after = maxSubgroupError(samples, (s) =>
      applyMCBoost(model, s.fixture, s.probs),
    );

    // Multicalibration must never make the worst slice worse.
    expect(after).toBeLessThanOrEqual(before + 1e-9);
  });

  it("drives a deliberately miscalibrated subgroup down toward the tolerance", () => {
    const samples = makeSamples();
    const before = maxSubgroupError(samples, (s) => s.probs);
    expect(before).toBeGreaterThan(0.15); // C1 home is badly over-predicted

    const model = fitMCBoost(samples, { alpha: 0.15, maxIterations: 20 });
    expect(model.corrections.length).toBeGreaterThan(0);

    const after = maxSubgroupError(samples, (s) =>
      applyMCBoost(model, s.fixture, s.probs),
    );
    expect(after).toBeLessThan(before);
  });

  it("is a no-op (no corrections) when already within tolerance", () => {
    const samples = makeSamples();
    const model = fitMCBoost(samples, { alpha: 1.0 });
    expect(model.corrections).toHaveLength(0);
    for (const s of samples) {
      const out = applyMCBoost(model, s.fixture, s.probs);
      expect(out.home + out.draw + out.away).toBeCloseTo(1, 10);
    }
  });
});

describe("applyMCBoost", () => {
  it("returns a renormalised triple and never mutates the input", () => {
    const samples = makeSamples();
    const model = fitMCBoost(samples);
    const input: OneXTwo = { home: 0.8, draw: 0.12, away: 0.08 };
    const frozen = Object.freeze({ ...input });
    const fixture = samples[0]!.fixture;

    const out = applyMCBoost(model, fixture, frozen);
    expect(out.home + out.draw + out.away).toBeCloseTo(1, 10);
    // Original untouched.
    expect(frozen).toEqual({ home: 0.8, draw: 0.12, away: 0.08 });
  });
});

describe("bootstrapCalibrationCI", () => {
  it("returns an ordered, deterministic interval for a populated subgroup", () => {
    const samples = makeSamples();
    const ci1 = bootstrapCalibrationCI(samples, "C1", 0, {
      resamples: 200,
      seed: 42,
    });
    const ci2 = bootstrapCalibrationCI(samples, "C1", 0, {
      resamples: 200,
      seed: 42,
    });

    expect(ci1.lo).toBeLessThanOrEqual(ci1.mean + 1e-9);
    expect(ci1.mean).toBeLessThanOrEqual(ci1.hi + 1e-9);
    expect(ci1.mean).toBeGreaterThan(0); // C1 is miscalibrated
    // Same seed → identical interval.
    expect(ci2).toEqual(ci1);
  });

  it("returns all-zero for an empty / unknown subgroup", () => {
    const samples = makeSamples();
    const empty = bootstrapCalibrationCI(samples, "C6", 0, { resamples: 50 });
    expect(empty).toEqual({ lo: 0, mean: 0, hi: 0 });

    const unknown = bootstrapCalibrationCI(samples, "NOPE", 0, {
      resamples: 50,
    });
    expect(unknown).toEqual({ lo: 0, mean: 0, hi: 0 });
  });
});
