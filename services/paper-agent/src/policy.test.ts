import { describe, expect, it } from "vitest";
import { loadPaperConfig } from "./config";
import { feeParamsFor } from "./fees";
import { decideEntry, decideExit, holdNetEdgePp, planHybridExit } from "./policy";
import type { OrderBook } from "./polymarket";

const cfg = loadPaperConfig({} as NodeJS.ProcessEnv);
const feeFree = feeParamsFor("", true); // neg-risk = fee-free, isolates the math
const politics = feeParamsFor("politics", false);

const book = (bid: number, ask: number, size = 1000): OrderBook => ({
  bids: [{ price: bid, size }],
  asks: [{ price: ask, size }]
});

describe("holdNetEdgePp", () => {
  it("fair minus executable, fee-free", () => {
    const e = holdNetEdgePp(0.6, book(0.5, 0.52), 100, feeFree);
    expect(e?.edgePp).toBeCloseTo(10, 5);
    expect(e?.mark).toBe(0.5);
  });

  it("taker fee reduces the exit value, so it RAISES the edge of holding", () => {
    const withFee = holdNetEdgePp(0.6, book(0.5, 0.52), 100, politics)!;
    expect(withFee.edgePp).toBeGreaterThan(10);
  });

  it("null when the book has no bids", () => {
    expect(holdNetEdgePp(0.6, { bids: [], asks: [] }, 100, feeFree)).toBeNull();
  });
});

describe("decideExit", () => {
  it("holds when net edge is positive", () => {
    const d = decideExit(cfg, 0.6, 0.4, book(0.5, 0.52), 100, feeFree);
    expect(d.action).toBe("hold");
  });

  it("exits on negative net edge (agent no longer supports the price)", () => {
    const d = decideExit(cfg, 0.4, 0.4, book(0.5, 0.52), 100, feeFree);
    expect(d.action).toBe("exit");
    expect(d.reason).toBe("negative_edge");
  });

  it("stop-loss outranks a positive model view", () => {
    // agent still believes 90%, but mark collapsed 40% below entry
    const d = decideExit(cfg, 0.9, 0.5, book(0.3, 0.34), 100, feeFree);
    expect(d.action).toBe("exit");
    expect(d.reason).toBe("stop_loss");
  });

  it("holds (by necessity) when there are no bids", () => {
    const d = decideExit(cfg, 0.1, 0.5, { bids: [], asks: [] }, 100, feeFree);
    expect(d.action).toBe("hold");
    expect(d.netEdgePp).toBeNull();
  });
});

describe("planHybridExit", () => {
  it("splits 50/50 by default and prices the limit at/above the bid", () => {
    const plan = planHybridExit(cfg, 100, 0.55, book(0.5, 0.53));
    expect(plan.marketShares).toBeCloseTo(50);
    expect(plan.limitShares).toBeCloseTo(50);
    expect(plan.limitPrice).toBeGreaterThan(0.5);
    expect(plan.limitPrice).toBeLessThanOrEqual(0.99);
  });

  it("limit price asks at least the agent's fair value", () => {
    const plan = planHybridExit(cfg, 100, 0.8, book(0.5, 0.53));
    expect(plan.limitPrice).toBeGreaterThanOrEqual(0.8);
  });

  it("honors a custom market ratio", () => {
    const custom = { ...cfg, hybridMarketRatio: 0.3 };
    const plan = planHybridExit(custom, 100, 0.5, book(0.4, 0.45));
    expect(plan.marketShares).toBeCloseTo(30);
    expect(plan.limitShares).toBeCloseTo(70);
  });

  it("ratio 1 (the stop-loss path) leaves nothing resting", () => {
    const allMarket = { ...cfg, hybridMarketRatio: 1 };
    const plan = planHybridExit(allMarket, 100, 0.9, book(0.4, 0.45));
    expect(plan.marketShares).toBeCloseTo(100);
    expect(plan.limitShares).toBeCloseTo(0);
  });
});

describe("decideEntry", () => {
  it("enters the YES side when fair value clears the ask plus fee by the threshold", () => {
    const d = decideEntry(cfg, 0.6, book(0.48, 0.5), book(0.48, 0.5), feeFree);
    expect(d.enter).toBe(true);
    expect(d.outcomeIndex).toBe(0);
    expect(d.edgePp).toBeCloseTo(10, 5);
  });

  it("enters the NO side on a symmetric mispricing", () => {
    // P(YES)=0.3 → NO fair 0.7; NO ask 0.6 → 10pp edge
    const d = decideEntry(cfg, 0.3, book(0.28, 0.3), book(0.58, 0.6), feeFree);
    expect(d.enter).toBe(true);
    expect(d.outcomeIndex).toBe(1);
  });

  it("does not enter below the threshold", () => {
    const d = decideEntry(cfg, 0.53, book(0.48, 0.5), book(0.48, 0.5), feeFree);
    expect(d.enter).toBe(false);
  });
});
