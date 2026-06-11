import { describe, expect, it } from "vitest";
import type { OneXTwo } from "./types.js";
import { mulberry32 } from "./rng.js";
import {
  estimateOutcomeProbabilities,
  sampleMatchResult,
  simulateGroup,
  simulateKnockout,
  standardError,
} from "./monte-carlo.js";

describe("standardError", () => {
  it("matches sqrt(p(1-p)/n)", () => {
    // sqrt(0.5 * 0.5 / 10000) = sqrt(0.000025) = 0.005
    expect(standardError(0.5, 10000)).toBeCloseTo(0.005, 6);
  });

  it("is zero for a degenerate proportion", () => {
    expect(standardError(0, 1000)).toBe(0);
    expect(standardError(1, 1000)).toBe(0);
  });
});

describe("sampleMatchResult", () => {
  it("only ever returns a certain outcome", () => {
    const rng = mulberry32(11);
    const certainHome: OneXTwo = { home: 1, draw: 0, away: 0 };
    for (let i = 0; i < 100; i += 1) {
      expect(sampleMatchResult(certainHome, rng)).toBe("home");
    }
  });
});

describe("estimateOutcomeProbabilities", () => {
  it("converges to the input probabilities", () => {
    const input: OneXTwo = { home: 0.5, draw: 0.3, away: 0.2 };
    const result = estimateOutcomeProbabilities(input, mulberry32(1), 40000);
    expect(result.home).toBeCloseTo(input.home, 1);
    expect(result.home).toBeGreaterThan(input.home - 0.02);
    expect(result.home).toBeLessThan(input.home + 0.02);
    expect(result.draw).toBeGreaterThan(input.draw - 0.02);
    expect(result.draw).toBeLessThan(input.draw + 0.02);
    expect(result.away).toBeGreaterThan(input.away - 0.02);
    expect(result.away).toBeLessThan(input.away + 0.02);
  });

  it("frequencies sum to 1", () => {
    const input: OneXTwo = { home: 0.4, draw: 0.35, away: 0.25 };
    const result = estimateOutcomeProbabilities(input, mulberry32(7), 5000);
    expect(result.home + result.draw + result.away).toBeCloseTo(1, 10);
  });
});

describe("simulateKnockout", () => {
  it("gives a coin-flip final ~0.5 each", () => {
    const result = simulateKnockout(
      { bracket: ["A", "B"], winProbability: () => 0.5, iterations: 20000 },
      mulberry32(2),
    );
    expect(result.get("A")!).toBeCloseTo(0.5, 1);
    expect(result.get("A")!).toBeGreaterThan(0.47);
    expect(result.get("A")!).toBeLessThan(0.53);
    expect(result.get("B")!).toBeGreaterThan(0.47);
    expect(result.get("B")!).toBeLessThan(0.53);
  });

  it("a team that always wins becomes champion with prob 1", () => {
    // winProbability(a, b) = 1 when a === "A", else 0 -> A beats anyone, and
    // when A is the right side (b), the left team's prob is 0 so A still wins.
    const winProbability = (a: string, _b: string): number => (a === "A" ? 1 : 0);
    const result = simulateKnockout(
      { bracket: ["A", "B", "C", "D"], winProbability, iterations: 5000 },
      mulberry32(3),
    );
    expect(result.get("A")!).toBe(1);
    expect(result.get("B")!).toBe(0);
    expect(result.get("C")!).toBe(0);
    expect(result.get("D")!).toBe(0);
  });

  it("champion probabilities sum to 1", () => {
    const result = simulateKnockout(
      {
        bracket: ["A", "B", "C", "D"],
        winProbability: () => 0.5,
        iterations: 10000,
      },
      mulberry32(4),
    );
    const total = [...result.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("simulateGroup", () => {
  it("a dominant team advances with prob ~1", () => {
    const teams = ["A", "B", "C", "D"];
    const fixtures = [
      { home: "A", away: "B" },
      { home: "A", away: "C" },
      { home: "A", away: "D" },
      { home: "B", away: "C" },
      { home: "B", away: "D" },
      { home: "C", away: "D" },
    ];
    // A always wins: when A is home -> home win; when A is away -> away win.
    // Other fixtures are coin flips.
    const matchProb = (home: string, away: string): OneXTwo => {
      if (home === "A") return { home: 1, draw: 0, away: 0 };
      if (away === "A") return { home: 0, draw: 0, away: 1 };
      return { home: 0.4, draw: 0.2, away: 0.4 };
    };
    const result = simulateGroup(
      { teams, fixtures, matchProb, advanceCount: 2, iterations: 5000 },
      mulberry32(5),
    );
    expect(result.get("A")!).toBe(1);
  });

  it("advance probabilities sum to advanceCount", () => {
    const teams = ["A", "B", "C", "D"];
    const fixtures = [
      { home: "A", away: "B" },
      { home: "C", away: "D" },
      { home: "A", away: "C" },
      { home: "B", away: "D" },
      { home: "A", away: "D" },
      { home: "B", away: "C" },
    ];
    const matchProb = (): OneXTwo => ({ home: 0.4, draw: 0.2, away: 0.4 });
    const result = simulateGroup(
      { teams, fixtures, matchProb, advanceCount: 2, iterations: 8000 },
      mulberry32(6),
    );
    const total = [...result.values()].reduce((s, v) => s + v, 0);
    // Exactly advanceCount teams advance each run, so probs sum to advanceCount.
    expect(total).toBeCloseTo(2, 10);
  });

  it("symmetric teams each advance ~half the time (2 of 4)", () => {
    const teams = ["A", "B", "C", "D"];
    const fixtures = [
      { home: "A", away: "B" },
      { home: "C", away: "D" },
      { home: "A", away: "C" },
      { home: "B", away: "D" },
      { home: "A", away: "D" },
      { home: "B", away: "C" },
    ];
    const matchProb = (): OneXTwo => ({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 });
    const result = simulateGroup(
      { teams, fixtures, matchProb, advanceCount: 2, iterations: 20000 },
      mulberry32(8),
    );
    for (const team of teams) {
      expect(result.get(team)!).toBeGreaterThan(0.42);
      expect(result.get(team)!).toBeLessThan(0.58);
    }
  });
});
