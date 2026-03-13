import { describe, expect, it } from "vitest";
import {
  applyTradeGuards,
  calculateDrawdownPct,
  calculateQuarterKelly,
  shouldHaltForDrawdown
} from "./risk.js";

describe("orchestrator risk helpers", () => {
  it("computes drawdown from high water mark", () => {
    expect(calculateDrawdownPct({ highWaterMarkUsd: 100, totalEquityUsd: 80 })).toBeCloseTo(0.2);
  });

  it("halts once drawdown crosses the configured threshold", () => {
    expect(shouldHaltForDrawdown({ highWaterMarkUsd: 100, totalEquityUsd: 79 }, 0.2)).toBe(true);
  });

  it("derives quarter Kelly sizing", () => {
    const sizing = calculateQuarterKelly({
      aiProb: 0.62,
      marketProb: 0.45,
      bankrollUsd: 1000
    });

    expect(sizing.fullKellyPct).toBeGreaterThan(0);
    expect(sizing.quarterKellyUsd).toBeGreaterThan(0);
  });

  it("clips trade size by exposure and minimum ticket size", () => {
    const amount = applyTradeGuards({
      requestedUsd: 200,
      bankrollUsd: 1000,
      maxTradePct: 0.05,
      liquidityCapUsd: 120,
      totalExposureUsd: 100,
      maxTotalExposurePct: 0.5,
      openPositions: 1,
      maxPositions: 10,
      edge: 0.18
    });

    expect(amount).toBeCloseTo(30);
  });
});

