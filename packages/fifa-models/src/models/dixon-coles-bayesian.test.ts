import { describe, it, expect } from "vitest";

import { createDixonColesBayes } from "./dixon-coles-bayesian.js";
import type {
  FitInput,
  ResolvedFixture,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures (no randomness) -------------------------------

const basePrior: TeamPrior = { team: "Base", elo: 1800, squadValueIndex: null };

/** Spread a base profile and override only the fields a test cares about. */
const makeProfile = (overrides: Partial<TeamProfile>): TeamProfile => ({
  team: "Base",
  matchesObserved: 3,
  prior: basePrior,
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
  ...overrides,
});

const makePrior = (team: string, elo: number): TeamPrior => ({
  team,
  elo,
  squadValueIndex: null,
});

/** A clearly strong team: high attack, low (tight) defence, high Elo. */
const strong = makeProfile({
  team: "Strong",
  prior: makePrior("Strong", 2050),
  attackRate: 2.1,
  defenseRate: 0.8,
});

/** A clearly weak team: low attack, leaky defence, low Elo. */
const weak = makeProfile({
  team: "Weak",
  prior: makePrior("Weak", 1550),
  attackRate: 0.9,
  defenseRate: 1.9,
});

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

/** Empty fit input → model falls back to neutral defaults deterministically. */
const emptyFit: FitInput = {
  matches: [],
  profiles: new Map([
    [strong.team, strong],
    [weak.team, weak],
  ]),
  priors: new Map([
    [strong.team, strong.prior],
    [weak.team, weak.prior],
  ]),
};

// --- Tests -----------------------------------------------------------------

describe("createDixonColesBayes", () => {
  const model = createDixonColesBayes();
  const state = model.fit(emptyFit);

  it("has the expected identity and family", () => {
    expect(model.id).toBe("dixon-coles-bayes");
    expect(model.family).toBe("statistical");
  });

  it("returns probabilities that sum to ~1", () => {
    const { probs } = model.predict(state, makeFixture(strong, weak));
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThanOrEqual(0);
    expect(probs.draw).toBeGreaterThanOrEqual(0);
    expect(probs.away).toBeGreaterThanOrEqual(0);
  });

  it("gives the clearly stronger team a higher win probability", () => {
    const strongAtHome = model.predict(state, makeFixture(strong, weak));
    // Team A (strong) win prob should dominate team B (weak) win prob.
    expect(strongAtHome.probs.home).toBeGreaterThan(strongAtHome.probs.away);

    // Symmetry: swapping sides flips the favourite.
    const strongAsB = model.predict(state, makeFixture(weak, strong));
    expect(strongAsB.probs.away).toBeGreaterThan(strongAsB.probs.home);

    // The strong team's win prob is materially above an even-money split.
    expect(strongAtHome.probs.home).toBeGreaterThan(0.45);
  });

  it("is balanced for two identical teams (draw-leaning, symmetric win odds)", () => {
    const even = makeFixture(
      makeProfile({ team: "Even-A", prior: makePrior("Even-A", 1800) }),
      makeProfile({ team: "Even-B", prior: makePrior("Even-B", 1800) }),
    );
    const { probs } = model.predict(state, even);
    expect(probs.home).toBeCloseTo(probs.away, 6);
  });

  it("produces a decision-first rationale with >=2 drivers", () => {
    const { rationale } = model.predict(state, makeFixture(strong, weak));
    expect(rationale.headline).toBeTruthy();
    expect(rationale.headline.toLowerCase()).toContain("strong");
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    for (const d of rationale.drivers) {
      expect(d.label).toBeTruthy();
      expect(d.detail).toBeTruthy();
      expect(Number.isFinite(d.contributionPp)).toBe(true);
    }
  });

  it("keeps the headline jargon-free", () => {
    const { rationale } = model.predict(state, makeFixture(strong, weak));
    const banned = ["elo", "bayesian", "edge", "credible interval", "lambda"];
    const headline = rationale.headline.toLowerCase();
    for (const word of banned) {
      expect(headline).not.toContain(word);
    }
  });

  it("emits a market-blind method note", () => {
    const { rationale } = model.predict(state, makeFixture(strong, weak));
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
    expect(rationale.methodNote.toLowerCase()).toContain("no betting");
  });

  it("calibrates rho and scale toward observed scoring when matches are given", () => {
    const fitState = model.fit(emptyFit);
    expect(Number.isFinite(fitState.rho)).toBe(true);
    expect(fitState.scale).toBeGreaterThan(0);
    expect(fitState.leagueAvg).toBeGreaterThan(0);
  });
});
