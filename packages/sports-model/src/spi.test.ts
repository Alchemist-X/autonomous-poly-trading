import { describe, expect, it } from "vitest";
import { spiExpectedGoals, spiMatchProbabilities } from "./spi.js";

describe("spiExpectedGoals", () => {
  it("matches a hand-computed value", () => {
    // 1.6 * (1.2 / 1.35) * 1.1
    //   = 1.6 * 0.88888889 * 1.1
    //   = 1.6 * 0.97777778
    //   = 1.56444444...
    expect(spiExpectedGoals(1.6, 1.2, 1.35, 1.1)).toBeCloseTo(1.56444444, 7);
  });

  it("equals offenseRating when defence is league-average and no home bump", () => {
    // opponentDefenseRating == leagueAverageGoals => ratio 1, homeAdvantage 1.
    expect(spiExpectedGoals(1.4, 1.35, 1.35, 1)).toBeCloseTo(1.4, 12);
  });

  it("rejects invalid inputs with 0", () => {
    expect(spiExpectedGoals(-1, 1.2, 1.35)).toBe(0);
    expect(spiExpectedGoals(1.6, -0.1, 1.35)).toBe(0);
    expect(spiExpectedGoals(1.6, 1.2, 0)).toBe(0); // leagueAverageGoals must be > 0
    expect(spiExpectedGoals(NaN, 1.2, 1.35)).toBe(0);
  });
});

describe("spiMatchProbabilities", () => {
  const baseRatings = {
    offenseHome: 1.5,
    defenseHome: 1.2,
    offenseAway: 1.5,
    defenseAway: 1.2,
    leagueAverageGoals: 1.35,
  };

  it("favours the home side when homeAdvantage > 1 and ratings are equal", () => {
    const o = spiMatchProbabilities({ ...baseRatings, homeAdvantage: 1.25 });
    expect(o.home).toBeGreaterThan(o.away);
  });

  it("yields home ~ away with homeAdvantage = 1 and equal ratings", () => {
    const o = spiMatchProbabilities({ ...baseRatings, homeAdvantage: 1 });
    expect(o.home).toBeCloseTo(o.away, 9);
  });

  it("defaults homeAdvantage to 1 (neutral) when omitted", () => {
    const o = spiMatchProbabilities(baseRatings);
    expect(o.home).toBeCloseTo(o.away, 9);
  });

  it("favours the stronger offence / weaker opponent defence", () => {
    const o = spiMatchProbabilities({
      offenseHome: 2.2,
      defenseHome: 0.8,
      offenseAway: 0.9,
      defenseAway: 1.6,
      leagueAverageGoals: 1.35,
      homeAdvantage: 1,
    });
    expect(o.home).toBeGreaterThan(o.away);
  });

  it("outputs sum to 1", () => {
    const o = spiMatchProbabilities({ ...baseRatings, homeAdvantage: 1.1 });
    expect(o.home + o.draw + o.away).toBeCloseTo(1, 12);
  });
});
