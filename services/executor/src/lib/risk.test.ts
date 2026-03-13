import { describe, expect, it } from "vitest";
import { calculatePositionPnlPct, shouldTriggerStopLoss } from "./risk.js";

describe("executor stop-loss helpers", () => {
  it("computes floating pnl percentage", () => {
    expect(calculatePositionPnlPct(0.5, 0.35)).toBeCloseTo(-0.3);
  });

  it("triggers stop loss at 30 percent drawdown", () => {
    expect(shouldTriggerStopLoss(0.5, 0.35, 0.3)).toBe(true);
    expect(shouldTriggerStopLoss(0.5, 0.42, 0.3)).toBe(false);
  });
});
