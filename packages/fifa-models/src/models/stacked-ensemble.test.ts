import { describe, it, expect } from "vitest";

import type { OneXTwo } from "@autopoly/sports-model";
import { createStackedEnsemble } from "./stacked-ensemble.js";
import type {
  MetaTrainingRow,
  ResolvedFixture,
  TeamPrior,
  TeamProfile,
} from "../types.js";

// --- Deterministic fixtures -------------------------------------------------

const basePrior: TeamPrior = { team: "BASE", elo: 1800, squadValueIndex: null };

const baseProfile: TeamProfile = {
  team: "BASE",
  matchesObserved: 3,
  prior: basePrior,
  attackRate: 1.4,
  defenseRate: 1.4,
  possessionPct: 50,
  highPressPct: 25,
  counterAttackPct: 12,
  lowBlockPct: 20,
  lineBreakSuccessPct: 60,
  lb4UnitShare: 0.1,
  offerConversionPct: 50,
  sprintLoadPerMin: 0.1,
  highIntensityShare: 0.3,
  avgHighIntensityKm: 8,
  networkDensity: 0.45,
  networkCentralization: 0.35,
  top5EdgeShare: 0.3,
  tacticalVector: [0, 0, 0, 0],
};

const makeProfile = (over: Partial<TeamProfile> & { team: string }): TeamProfile => ({
  ...baseProfile,
  ...over,
  prior: { ...basePrior, team: over.team, ...(over.prior ?? {}) },
});

const makeFixture = (teamA: string, teamB: string): ResolvedFixture => {
  const profileA = makeProfile({
    team: teamA,
    attackRate: 2.1,
    defenseRate: 0.9,
    prior: { team: teamA, elo: 2050, squadValueIndex: null },
  });
  const profileB = makeProfile({
    team: teamB,
    attackRate: 0.9,
    defenseRate: 1.9,
    prior: { team: teamB, elo: 1600, squadValueIndex: null },
  });
  return {
    id: `fifwc-${teamA}-${teamB}-test`,
    stage: "QF",
    teamA,
    teamB,
    neutral: true,
    kickoffUtc: "2026-07-04T18:00:00Z",
    profileA,
    profileB,
    priorA: profileA.prior,
    priorB: profileB.prior,
  };
};

const probsFor = (home: number, draw: number): OneXTwo => ({
  home,
  draw,
  away: Math.max(0, 1 - home - draw),
});

const MODEL_IDS = ["dixon-coles", "elo", "ensemble", "ml-forest", "poisson", "spi", "xg"];

/** Build a base-probs map where every base model gives the same triple. */
const uniformBaseProbs = (home: number, draw: number): Map<string, OneXTwo> =>
  new Map(MODEL_IDS.map((id) => [id, probsFor(home, draw)]));

/**
 * Deterministic training set: home-leaning rows resolve "home", away-leaning rows
 * resolve "away", balanced rows resolve "draw". All three classes represented,
 * >= MIN_ROWS so the stack actually trains.
 */
const buildTrainingRows = (): MetaTrainingRow[] => {
  const rows: MetaTrainingRow[] = [];
  for (let i = 0; i < 8; i += 1) {
    rows.push({ baseProbs: uniformBaseProbs(0.7, 0.18), result: "home" });
  }
  for (let i = 0; i < 8; i += 1) {
    rows.push({ baseProbs: uniformBaseProbs(0.15, 0.18), result: "away" });
  }
  for (let i = 0; i < 6; i += 1) {
    rows.push({ baseProbs: uniformBaseProbs(0.34, 0.4), result: "draw" });
  }
  return rows;
};

// --- Tests ------------------------------------------------------------------

describe("createStackedEnsemble", () => {
  it("exposes the meta-model identity", () => {
    const model = createStackedEnsemble();
    expect(model.id).toBe("stacked-ensemble");
    expect(model.family).toBe("ensemble");
  });

  it("produces a normalised 1X2 triple from a trained stack", () => {
    const model = createStackedEnsemble();
    const state = model.fitMeta(buildTrainingRows());
    expect(state.models).not.toBeNull();

    const fixture = makeFixture("ARG", "PAN");
    const { probs } = model.predictMeta(state, uniformBaseProbs(0.7, 0.18), fixture);
    const sum = probs.home + probs.draw + probs.away;
    expect(sum).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThan(0);
    expect(probs.away).toBeGreaterThan(0);
  });

  it("favours the side the base views agree on (stronger > weaker)", () => {
    const model = createStackedEnsemble();
    const state = model.fitMeta(buildTrainingRows());
    const fixture = makeFixture("ARG", "PAN");

    // Base views strongly favour team A (home) vs strongly favour team B (away).
    const aFavoured = model.predictMeta(state, uniformBaseProbs(0.72, 0.16), fixture).probs;
    const bFavoured = model.predictMeta(state, uniformBaseProbs(0.12, 0.16), fixture).probs;

    expect(aFavoured.home).toBeGreaterThan(bFavoured.home);
    expect(aFavoured.home).toBeGreaterThan(aFavoured.away);
    expect(bFavoured.away).toBeGreaterThan(bFavoured.home);
  });

  it("emits a plain-language headline, >= 2 drivers, and a market-blind method note", () => {
    const model = createStackedEnsemble();
    const state = model.fitMeta(buildTrainingRows());
    const fixture = makeFixture("ARG", "PAN");
    const { rationale } = model.predictMeta(state, uniformBaseProbs(0.7, 0.18), fixture);

    expect(rationale.headline.length).toBeGreaterThan(0);
    expect(rationale.drivers.length).toBeGreaterThanOrEqual(2);
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);

    // Headline must avoid banned jargon.
    const banned = /\b(elo|bayesian|edge|credible interval|lambda)\b/i;
    expect(banned.test(rationale.headline)).toBe(false);
    for (const d of rationale.drivers) {
      expect(banned.test(d.detail)).toBe(false);
      expect(Number.isFinite(d.contributionPp)).toBe(true);
    }
  });

  it("falls back to an equal-weight pool when there are too few rows", () => {
    const model = createStackedEnsemble();
    const rows: MetaTrainingRow[] = [
      { baseProbs: uniformBaseProbs(0.7, 0.18), result: "home" },
      { baseProbs: uniformBaseProbs(0.15, 0.18), result: "away" },
    ];
    const state = model.fitMeta(rows);
    expect(state.models).toBeNull();

    const fixture = makeFixture("ARG", "PAN");
    const { probs, rationale } = model.predictMeta(
      state,
      uniformBaseProbs(0.7, 0.18),
      fixture,
    );
    const sum = probs.home + probs.draw + probs.away;
    expect(sum).toBeCloseTo(1, 6);
    // When all base views agree, the pool returns roughly that consensus.
    expect(probs.home).toBeGreaterThan(probs.away);
    expect(rationale.methodNote.startsWith("Market-blind:")).toBe(true);
  });

  it("falls back when a class is never observed (degenerate)", () => {
    const model = createStackedEnsemble();
    const rows: MetaTrainingRow[] = [];
    for (let i = 0; i < 12; i += 1) {
      // Only home and away results — "draw" never appears.
      rows.push({
        baseProbs: uniformBaseProbs(i % 2 === 0 ? 0.7 : 0.15, 0.18),
        result: i % 2 === 0 ? "home" : "away",
      });
    }
    const state = model.fitMeta(rows);
    expect(state.models).toBeNull();
  });
});
