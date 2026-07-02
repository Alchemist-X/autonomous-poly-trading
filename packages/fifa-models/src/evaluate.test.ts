import { describe, it, expect } from "vitest";

import type { MatchResult, OneXTwo } from "@autopoly/sports-model";
import {
  formatLeaderboard,
  leaderboard,
  rankedProbabilityScore,
  scoreModel,
  type ScoredModel,
} from "./evaluate.js";

// --- Deterministic fixtures -------------------------------------------------

interface Prediction {
  readonly probs: OneXTwo;
  readonly result: MatchResult;
}

const RESULTS: readonly MatchResult[] = ["home", "draw", "away", "home", "away"];

/** A perfect predictor: full probability on the realised class every time. */
const perfectPreds: Prediction[] = RESULTS.map((result) => ({
  result,
  probs: {
    home: result === "home" ? 1 : 0,
    draw: result === "draw" ? 1 : 0,
    away: result === "away" ? 1 : 0,
  },
}));

/** A uniform coin-flip predictor: equal 1/3 mass on every class. */
const coinFlipPreds: Prediction[] = RESULTS.map((result) => ({
  result,
  probs: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 },
}));

// --- rankedProbabilityScore -------------------------------------------------

describe("rankedProbabilityScore", () => {
  it("is 0 for a perfect, fully-confident ordinal forecast", () => {
    expect(rankedProbabilityScore({ home: 1, draw: 0, away: 0 }, "home")).toBe(0);
    expect(rankedProbabilityScore({ home: 0, draw: 1, away: 0 }, "draw")).toBe(0);
    expect(rankedProbabilityScore({ home: 0, draw: 0, away: 1 }, "away")).toBe(0);
  });

  it("penalises a far miss (home vs away) more than a near miss (home vs draw)", () => {
    // Forecast all mass on home, but the result is the adjacent draw vs the far away.
    const all = { home: 1, draw: 0, away: 0 } as const;
    const nearMiss = rankedProbabilityScore(all, "draw");
    const farMiss = rankedProbabilityScore(all, "away");
    expect(farMiss).toBeGreaterThan(nearMiss);
  });

  it("returns the uniform-forecast RPS (1/9 + 4/9) / 2 for a home result", () => {
    // cumPred = [1/3, 2/3]; cumActual (home) = [1, 1]
    // diffs^2 = (2/3)^2 + (1/3)^2 = 4/9 + 1/9; /(r-1)=/2 -> 5/18
    const rps = rankedProbabilityScore(
      { home: 1 / 3, draw: 1 / 3, away: 1 / 3 },
      "home",
    );
    expect(rps).toBeCloseTo(5 / 18, 10);
  });
});

// --- scoreModel -------------------------------------------------------------

describe("scoreModel", () => {
  it("scores a perfect predictor at logLoss≈0 and brier≈0 with full accuracy", () => {
    const s = scoreModel("perfect", "Perfect", perfectPreds);
    expect(s.logLoss).toBeCloseTo(0, 10);
    expect(s.brier).toBeCloseTo(0, 10);
    expect(s.rps).toBeCloseTo(0, 10);
    expect(s.accuracy).toBe(1);
    expect(s.n).toBe(RESULTS.length);
  });

  it("scores a coin-flip predictor strictly worse than a perfect one", () => {
    const perfect = scoreModel("perfect", "Perfect", perfectPreds);
    const coin = scoreModel("coin", "Coin Flip", coinFlipPreds);
    expect(coin.logLoss).toBeGreaterThan(perfect.logLoss);
    expect(coin.brier).toBeGreaterThan(perfect.brier);
    expect(coin.rps).toBeGreaterThan(perfect.rps);
    // Uniform multiclass log-loss is exactly ln(3).
    expect(coin.logLoss).toBeCloseTo(Math.log(3), 10);
    // Uniform multiclass Brier: per sample 2*(1/3)^2 + (2/3)^2 = 2/3.
    expect(coin.brier).toBeCloseTo(2 / 3, 10);
  });

  it("returns all-zero metrics with n=0 for an empty set", () => {
    const s = scoreModel("empty", "Empty", []);
    expect(s).toMatchObject({
      logLoss: 0,
      brier: 0,
      rps: 0,
      accuracy: 0,
      ece: 0,
      n: 0,
    });
  });
});

// --- leaderboard ------------------------------------------------------------

describe("leaderboard", () => {
  const mk = (over: Partial<ScoredModel> & { id: string }): ScoredModel => ({
    name: over.id,
    logLoss: 0,
    brier: 0,
    rps: 0,
    accuracy: 0,
    ece: 0,
    n: 1,
    ...over,
  });

  it("orders ascending by logLoss (primary)", () => {
    const ranked = leaderboard([
      mk({ id: "c", logLoss: 0.9 }),
      mk({ id: "a", logLoss: 0.1 }),
      mk({ id: "b", logLoss: 0.5 }),
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks logLoss ties by brier", () => {
    const ranked = leaderboard([
      mk({ id: "hi", logLoss: 0.4, brier: 0.6 }),
      mk({ id: "lo", logLoss: 0.4, brier: 0.2 }),
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["lo", "hi"]);
  });

  it("does not mutate the input array", () => {
    const input = [mk({ id: "b", logLoss: 0.5 }), mk({ id: "a", logLoss: 0.1 })];
    const snapshot = input.map((m) => m.id);
    leaderboard(input);
    expect(input.map((m) => m.id)).toEqual(snapshot);
  });
});

// --- formatLeaderboard ------------------------------------------------------

describe("formatLeaderboard", () => {
  it("renders a header plus one best-first row per model", () => {
    const perfect = scoreModel("perfect", "Perfect", perfectPreds);
    const coin = scoreModel("coin", "Coin Flip", coinFlipPreds);
    const table = formatLeaderboard([coin, perfect]);
    const lines = table.split("\n");

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain("model");
    expect(lines[0]).toContain("logLoss");
    // Best (perfect) model ranks first regardless of input ordering.
    expect(lines[1]).toContain("Perfect");
    expect(lines[2]).toContain("Coin Flip");
  });
});
