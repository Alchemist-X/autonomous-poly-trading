import { describe, expect, it } from "vitest";
import { loadPaperConfig } from "./config";
import type { MarketFeeParams } from "./fees";
import { isYesNoMarket } from "./evaluator";
import { decideEntry, decideExit, holdNetEdgePp, planHybridExit, stopLossBreached } from "./policy";
import type { OrderBook } from "./polymarket";

const cfg = loadPaperConfig({} as NodeJS.ProcessEnv);
const feeFree: MarketFeeParams = { takerBps: 0, makerBps: 0, tickSize: 0.01 };
const feed: MarketFeeParams = { takerBps: 500, makerBps: 0, tickSize: 0.001 };

const book = (bid: number, ask: number, size = 1000): OrderBook => ({
  bids: [{ price: bid, size }],
  asks: [{ price: ask, size }]
});

describe("holdNetEdgePp", () => {
  it("fair minus executable, fee-free", () => {
    const e = holdNetEdgePp(0.6, book(0.5, 0.52), feeFree);
    expect(e?.edgePp).toBeCloseTo(10, 5);
    expect(e?.mark).toBe(0.5);
  });

  it("taker fee reduces exit value, RAISING the edge of holding", () => {
    const withFee = holdNetEdgePp(0.6, book(0.5, 0.52), feed)!;
    // per-share fee = 0.05 × min(0.5, 0.5) = 0.025 → edge 12.5pp
    expect(withFee.edgePp).toBeCloseTo(12.5, 5);
  });

  it("null when the book has no bids", () => {
    expect(holdNetEdgePp(0.6, { bids: [], asks: [] }, feeFree)).toBeNull();
  });
});

describe("decideExit", () => {
  it("holds on positive edge, exits on negative edge", () => {
    expect(decideExit(cfg, 0.6, 0.4, book(0.5, 0.52), feeFree).action).toBe("hold");
    const exit = decideExit(cfg, 0.4, 0.4, book(0.5, 0.52), feeFree);
    expect(exit.action).toBe("exit");
    expect(exit.reason).toBe("negative_edge");
  });

  it("stop-loss outranks a positive model view", () => {
    const d = decideExit(cfg, 0.9, 0.5, book(0.3, 0.34), feeFree);
    expect(d.action).toBe("exit");
    expect(d.reason).toBe("stop_loss");
  });

  it("stopLossBreached is model-free (usable from the tick)", () => {
    expect(stopLossBreached(cfg, 0.5, book(0.3, 0.34))).toBe(true);
    expect(stopLossBreached(cfg, 0.5, book(0.4, 0.44))).toBe(false);
    expect(stopLossBreached(cfg, 0.5, { bids: [], asks: [] })).toBe(false);
  });

  it("holds (by necessity) when there are no bids", () => {
    const d = decideExit(cfg, 0.1, 0.5, { bids: [], asks: [] }, feeFree);
    expect(d.action).toBe("hold");
    expect(d.netEdgePp).toBeNull();
  });
});

describe("planHybridExit", () => {
  it("splits 50/50 and prices the limit strictly above the bid", () => {
    const plan = planHybridExit(cfg, 100, 0.55, book(0.5, 0.53), 0.01);
    expect(plan.marketShares).toBeCloseTo(50);
    expect(plan.limitShares).toBeCloseTo(50);
    expect(plan.limitPrice).toBeGreaterThan(0.5);
    expect(plan.limitPrice).toBeLessThanOrEqual(0.99);
  });

  it("limit price asks at least the agent's fair value", () => {
    const plan = planHybridExit(cfg, 100, 0.8, book(0.5, 0.53), 0.01);
    expect(plan.limitPrice).toBeGreaterThanOrEqual(0.8);
  });

  it("respects a 0.001 tick book (no coarse rounding onto the bid)", () => {
    // bid .026/ask .027 — the live case that broke a hardcoded 0.01 tick
    const plan = planHybridExit(cfg, 100, 0.02, book(0.026, 0.027), 0.001);
    expect(plan.limitPrice).toBeGreaterThan(0.026);
    expect(Math.round(plan.limitPrice * 1000)).toBeCloseTo(plan.limitPrice * 1000, 5);
  });

  it("ratio 1 (the stop-loss path) leaves nothing resting", () => {
    const allMarket = { ...cfg, hybridMarketRatio: 1 };
    const plan = planHybridExit(allMarket, 100, 0.9, book(0.4, 0.45), 0.01);
    expect(plan.marketShares).toBeCloseTo(100);
    expect(plan.limitShares).toBeCloseTo(0);
  });
});

describe("decideEntry", () => {
  it("enters the YES side when fair clears ask+fee by the threshold", () => {
    const d = decideEntry(cfg, 0.6, book(0.48, 0.5), book(0.48, 0.5), feeFree);
    expect(d.enter).toBe(true);
    expect(d.outcomeIndex).toBe(0);
    expect(d.edgePp).toBeCloseTo(10, 5);
  });

  it("enters the NO side on a symmetric mispricing", () => {
    const d = decideEntry(cfg, 0.3, book(0.28, 0.3), book(0.58, 0.6), feeFree);
    expect(d.enter).toBe(true);
    expect(d.outcomeIndex).toBe(1);
  });

  it("does not enter below the threshold; fees shrink the edge", () => {
    expect(decideEntry(cfg, 0.53, book(0.48, 0.5), book(0.48, 0.5), feeFree).enter).toBe(false);
    const noFee = decideEntry(cfg, 0.6, book(0.48, 0.5), book(0.48, 0.5), feeFree);
    const withFee = decideEntry(cfg, 0.6, book(0.48, 0.5), book(0.48, 0.5), feed);
    expect(withFee.edgePp).toBeLessThan(noFee.edgePp);
  });
});

describe("isYesNoMarket", () => {
  it("accepts only literal Yes/No outcome pairs", () => {
    expect(isYesNoMarket(["Yes", "No"])).toBe(true);
    expect(isYesNoMarket(["yes", "no"])).toBe(true);
    expect(isYesNoMarket(["Up", "Down"])).toBe(false);
    expect(isYesNoMarket(["Switzerland", "Algeria"])).toBe(false);
    expect(isYesNoMarket(["Yes"])).toBe(false);
  });
});
