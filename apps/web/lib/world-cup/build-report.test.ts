import { describe, expect, it } from "vitest";
import { buildWorldCupMatchReport, __test } from "./build-report";
import { PROHIBITED_TERMS } from "../legal-copy";
import type { MatchPriceInput } from "./build-report";

const SAMPLE: MatchPriceInput = {
  matchId: "fifwc-arg-alg-2026-06-16",
  homeTeam: "Argentina",
  awayTeam: "Algeria",
  group: "J",
  stage: "小组赛 第1轮",
  kickoffUtc: "2026-06-16T20:00:00Z",
  // Raw Polymarket yes-prices include overround (sum > 1).
  homeYesPrice: 0.705,
  drawYesPrice: 0.205,
  awayYesPrice: 0.105
};

const GEN_AT = "2026-06-09T00:00:00.000Z";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("normaliseMarket", () => {
  it("strips the overround so probabilities sum to 1", () => {
    const market = __test.normaliseMarket(SAMPLE);
    expect(sum([market.home, market.draw, market.away])).toBeCloseTo(1, 5);
    // Favourite stays the favourite after normalisation.
    expect(market.home).toBeGreaterThan(market.draw);
    expect(market.draw).toBeGreaterThan(market.away);
  });
});

describe("applyMvpHeuristic", () => {
  it("keeps a valid distribution and shrinks the favourite toward the field", () => {
    const market = __test.normaliseMarket(SAMPLE);
    const model = __test.applyMvpHeuristic(market);
    expect(sum([model.home, model.draw, model.away])).toBeCloseTo(1, 5);
    // Favourite-longshot correction: top comes down, draw/underdog go up.
    expect(model.home).toBeLessThan(market.home);
    expect(model.draw).toBeGreaterThan(market.draw);
  });
});

describe("buildWorldCupMatchReport", () => {
  it("produces a coherent 1X2 report", () => {
    const report = buildWorldCupMatchReport(SAMPLE, GEN_AT);
    expect(report.outcomes).toHaveLength(3);
    expect(sum(report.outcomes.map((o) => o.modelProbability))).toBeCloseTo(1, 2);
    // edge = model - market for every outcome.
    for (const outcome of report.outcomes) {
      expect(outcome.edge).toBeCloseTo(outcome.modelProbability - (outcome.marketProbability ?? 0), 3);
    }
    // Headline is the highest-probability outcome.
    const headline = report.outcomes.find((o) => o.outcome === report.headlineOutcome)!;
    for (const outcome of report.outcomes) {
      expect(headline.modelProbability).toBeGreaterThanOrEqual(outcome.modelProbability);
    }
    // MVP transparency: statistical engine not yet wired.
    expect(report.modelSource.statistical).toBe(false);
    expect(report.modelSource.market).toBe(true);
    expect(report.resolvedOutcome).toBeNull();
  });

  it("never emits prohibited betting-tip language", () => {
    const report = buildWorldCupMatchReport(SAMPLE, GEN_AT);
    const serialized = JSON.stringify(report).toLowerCase();
    for (const term of PROHIBITED_TERMS) {
      expect(serialized.includes(term.toLowerCase())).toBe(false);
    }
  });

  it("is deterministic for the same input", () => {
    const a = buildWorldCupMatchReport(SAMPLE, GEN_AT);
    const b = buildWorldCupMatchReport(SAMPLE, GEN_AT);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
