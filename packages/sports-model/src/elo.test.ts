import { describe, expect, it } from "vitest";
import {
  eloExpectedScore,
  eloToOneXTwo,
  eloUpdate,
  fifaSumExpected,
} from "./elo.js";

describe("eloExpectedScore", () => {
  it("matches the hand-computed FIFA logistic (scale 600)", () => {
    // 1 / (1 + 10^((1820-2040)/600)) = 1 / (1 + 10^(-0.36667)) ≈ 0.69937
    expect(eloExpectedScore(2040, 1820)).toBeCloseTo(0.6993, 3);
  });

  it("is exactly 0.5 for equal ratings", () => {
    expect(eloExpectedScore(1500, 1500)).toBe(0.5);
  });

  it("is symmetric: expected(A,B) + expected(B,A) = 1", () => {
    expect(eloExpectedScore(2040, 1820) + eloExpectedScore(1820, 2040)).toBeCloseTo(
      1,
      12,
    );
  });

  it("honours a custom scale", () => {
    // scale = 400: 1 / (1 + 10^(-400/400)) = 1 / (1 + 0.1) = 0.90909...
    expect(eloExpectedScore(1900, 1500, 400)).toBeCloseTo(10 / 11, 12);
  });
});

describe("eloUpdate", () => {
  it("awards half of K for beating a coin-flip expectation", () => {
    // 1500 + 60 * (1 - 0.5) = 1530
    expect(eloUpdate(1500, 0.5, 1, 60)).toBe(1530);
  });

  it("subtracts on a loss against expectation", () => {
    // 1500 + 60 * (0 - 0.5) = 1470
    expect(eloUpdate(1500, 0.5, 0, 60)).toBe(1470);
  });

  it("leaves the rating unchanged when result equals expectation", () => {
    expect(eloUpdate(2000, 0.7, 0.7, 60)).toBe(2000);
  });

  it("rewards a draw above expectation", () => {
    // 1500 + 60 * (0.5 - 0.3) = 1512
    expect(eloUpdate(1500, 0.3, 0.5, 60)).toBeCloseTo(1512, 10);
  });
});

describe("fifaSumExpected", () => {
  it("equals eloExpectedScore with scale 600", () => {
    expect(fifaSumExpected(2040, 1820)).toBe(eloExpectedScore(2040, 1820, 600));
    expect(fifaSumExpected(2040, 1820)).toBeCloseTo(0.6993, 3);
  });
});

describe("eloToOneXTwo", () => {
  it("is symmetric with no home advantage and sums to 1", () => {
    // Equal ratings, homeAdvantage = 0: wH = wA = 1, wD = 0.70, total = 2.70.
    // home = away = 1/2.70, draw = 0.70/2.70 ≈ 0.25926.
    const p = eloToOneXTwo(1500, 1500, { homeAdvantage: 0, drawNu: 0.7 });
    expect(p.home).toBeCloseTo(p.away, 12);
    expect(p.draw).toBeCloseTo(0.7 / 2.7, 10);
    expect(p.home).toBeCloseTo(1 / 2.7, 10);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
  });

  it("gives the home side an edge when homeAdvantage > 0", () => {
    const p = eloToOneXTwo(1500, 1500, { homeAdvantage: 65, drawNu: 0.7 });
    expect(p.home).toBeGreaterThan(p.away);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
  });

  it("uses FIFA defaults (scale 600, homeAdvantage 65, drawNu 0.70)", () => {
    // wH = 10^(65/600) ≈ 1.28612, wA = 1, wD = 0.7*sqrt(wH) ≈ 0.79378.
    // total ≈ 3.07990 -> home ≈ 0.41756, draw ≈ 0.25773, away ≈ 0.32468 (manual).
    const p = eloToOneXTwo(1500, 1500);
    const wH = Math.pow(10, 65 / 600);
    const wD = 0.7 * Math.sqrt(wH);
    const total = wH + wD + 1;
    expect(p.home).toBeCloseTo(wH / total, 12);
    expect(p.draw).toBeCloseTo(wD / total, 12);
    expect(p.away).toBeCloseTo(1 / total, 12);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
  });

  it("favours the stronger rating", () => {
    // Strong home side: home should dominate.
    const p = eloToOneXTwo(2040, 1820);
    expect(p.home).toBeGreaterThan(p.away);
    expect(p.home).toBeGreaterThan(p.draw);
  });
});
