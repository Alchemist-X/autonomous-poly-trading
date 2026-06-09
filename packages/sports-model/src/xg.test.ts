import { describe, expect, it } from "vitest";
import {
  attackDefenseLambda,
  buildLinearThreatGrid,
  expectedThreatAdded,
  xgEnhancedLambda,
} from "./xg.js";

describe("xgEnhancedLambda", () => {
  it("blends xG and goals with Kimi's alpha = 0.7", () => {
    // 0.7 * 1.5 + 0.3 * 1.0 = 1.05 + 0.30 = 1.35
    expect(xgEnhancedLambda(1.5, 1.0, 0.7)).toBeCloseTo(1.35, 10);
  });

  it("defaults alpha to 0.7", () => {
    expect(xgEnhancedLambda(1.5, 1.0)).toBeCloseTo(1.35, 10);
  });

  it("alpha = 1 returns the xG term only", () => {
    expect(xgEnhancedLambda(2.2, 0.5, 1)).toBeCloseTo(2.2, 10);
  });

  it("alpha = 0 returns the goal term only", () => {
    expect(xgEnhancedLambda(2.2, 0.5, 0)).toBeCloseTo(0.5, 10);
  });
});

describe("attackDefenseLambda", () => {
  it("multiplies attack, defence, league average and home advantage", () => {
    // 1.2 * 1.1 * 1.35 * 1.1 = 1.9602
    expect(attackDefenseLambda(1.2, 1.1, 1.35, 1.1)).toBeCloseTo(1.9602, 10);
  });

  it("defaults home advantage to 1 (neutral venue)", () => {
    expect(attackDefenseLambda(1.2, 1.1, 1.35)).toBeCloseTo(1.782, 10);
  });

  it("returns the league average for an average-vs-average neutral fixture", () => {
    expect(attackDefenseLambda(1, 1, 1.4, 1)).toBeCloseTo(1.4, 10);
  });
});

describe("expectedThreatAdded", () => {
  const grid = [
    [0.1, 0.2, 0.3],
    [0.1, 0.2, 0.3],
  ];

  it("is positive when moving toward a higher-value cell", () => {
    const xt = expectedThreatAdded(
      grid,
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    );
    // 0.3 - 0.1 = 0.2
    expect(xt).toBeCloseTo(0.2, 10);
    expect(xt).toBeGreaterThan(0);
  });

  it("is negative when moving backward to a lower-value cell", () => {
    const xt = expectedThreatAdded(
      grid,
      { row: 0, col: 2 },
      { row: 0, col: 0 },
    );
    expect(xt).toBeCloseTo(-0.2, 10);
  });

  it("treats out-of-bounds cells as zero value", () => {
    // from is out of bounds -> 0; to = 0.3 -> increment 0.3
    expect(
      expectedThreatAdded(grid, { row: 9, col: 9 }, { row: 0, col: 2 }),
    ).toBeCloseTo(0.3, 10);
    // to is out of bounds -> 0; from = 0.3 -> increment -0.3
    expect(
      expectedThreatAdded(grid, { row: 0, col: 2 }, { row: 9, col: 9 }),
    ).toBeCloseTo(-0.3, 10);
  });
});

describe("buildLinearThreatGrid", () => {
  it("produces the requested dimensions", () => {
    const grid = buildLinearThreatGrid(3, 5);
    expect(grid).toHaveLength(3);
    for (const row of grid) expect(row).toHaveLength(5);
  });

  it("keeps every value in [0, 1]", () => {
    const grid = buildLinearThreatGrid(4, 6);
    for (const row of grid) {
      for (const value of row) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("increases toward the attacking end (higher column index)", () => {
    const grid = buildLinearThreatGrid(1, 4);
    const row = grid[0]!;
    expect(row[0]).toBeCloseTo(0, 10);
    expect(row[3]).toBeCloseTo(1, 10);
    for (let c = 1; c < row.length; c += 1) {
      expect(row[c]!).toBeGreaterThan(row[c - 1]!);
    }
  });

  it("degenerates to zeros when there is no horizontal gradient", () => {
    const grid = buildLinearThreatGrid(2, 1);
    expect(grid).toEqual([[0], [0]]);
  });
});
