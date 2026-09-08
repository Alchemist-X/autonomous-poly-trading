import { describe, expect, it } from "vitest";
import { loadPaperConfig } from "./config";
import type { MarketFeeParams } from "./fees";
import { isYesNoMarket } from "./evaluator";
import {
  applySaturatedHold,
  decideEntry,
  decideExit,
  holdNetEdgePp,
  planHybridExit,
  stopLossBreached
} from "./policy";
import type { OrderBook } from "./polymarket";

const cfg = loadPaperConfig({} as NodeJS.ProcessEnv);
const feeFree: MarketFeeParams = { takerBps: 0, makerBps: 0, tickSize: 0.01, feeRate: 0, category: null, rateSource: "clob_fee_free" };
// Fee-enabled market (CLOB taker_base_fee=1000 is a flag, not a rate) in the
// Sports bucket: taker fee = shares × 0.05 × p × (1 − p), makers pay 0.
const feed: MarketFeeParams = { takerBps: 1000, makerBps: 1000, tickSize: 0.001, feeRate: 0.05, category: "sports", rateSource: "category" };

const book = (bid: number, ask: number, size = 1000): OrderBook => ({
  bids: [{ price: bid, size }],
  asks: [{ price: ask, size }]
});

describe("applySaturatedHold", () => {
  const noPos = 1; // holds NO → favorable clamp is probYes at the FLOOR
  const yesPos = 0; // holds YES → favorable clamp is probYes at the CEIL

  const negEdge = (agentProb: number, b: OrderBook, fees: MarketFeeParams = feeFree) =>
    decideExit(cfg, agentProb, 0.5, b, fees);

  it("vetoes the mojtaba case: NO position, floor-saturated, bid above the ceiling", () => {
    const raw = negEdge(0.99, book(0.994, 0.996));
    expect(raw.reason).toBe("negative_edge");
    const d = applySaturatedHold(cfg, raw, "floor", noPos, book(0.994, 0.996), feeFree);
    expect(d.action).toBe("hold");
    expect(d.reason).toBe("hold");
    expect(d.detail).toContain("saturated");
    // Observability fields preserved for the ledger.
    expect(d.mark).toBe(raw.mark);
    expect(d.netEdgePp).toBe(raw.netEdgePp);
  });

  it("vetoes the mirror case: YES position, ceil-saturated", () => {
    const raw = negEdge(0.99, book(0.995, 0.997));
    const d = applySaturatedHold(cfg, raw, "ceil", yesPos, book(0.995, 0.997), feeFree);
    expect(d.action).toBe("hold");
  });

  it("does NOT veto when the clamp binds against the held side", () => {
    // NO position with probYes pinned at the CEIL means P(NO) pinned at 0.01 —
    // the model thinks we are wrong; the exit is informative and must stand.
    const raw = negEdge(0.01, book(0.4, 0.42));
    expect(raw.reason).toBe("negative_edge");
    expect(applySaturatedHold(cfg, raw, "ceil", noPos, book(0.4, 0.42), feeFree).action).toBe("exit");
    expect(applySaturatedHold(cfg, raw, "floor", yesPos, book(0.4, 0.42), feeFree).action).toBe("exit");
  });

  it("does NOT veto an unsaturated evaluation", () => {
    const raw = negEdge(0.975, book(0.976, 0.978));
    expect(applySaturatedHold(cfg, raw, null, noPos, book(0.976, 0.978), feeFree).action).toBe("exit");
  });

  it("allows full-value capture: bid net of fees at/above 0.999 still sells", () => {
    const raw = negEdge(0.99, book(0.999, 1));
    expect(raw.reason).toBe("negative_edge");
    const d = applySaturatedHold(cfg, raw, "floor", noPos, book(0.999, 1), feeFree);
    expect(d.action).toBe("exit");
  });

  it("vetoes just below the full-value line", () => {
    const raw = negEdge(0.99, book(0.998, 1));
    const d = applySaturatedHold(cfg, raw, "floor", noPos, book(0.998, 1), feeFree);
    expect(d.action).toBe("hold");
  });

  it("a taker fee can pull a 0.999 bid back under the full-value line", () => {
    // 0.05 rate on bid 0.999: fee = 0.05 × 0.999 × 0.001 ≈ 0.00005 →
    // net 0.99895 < 0.999 → veto applies.
    const raw = negEdge(0.99, book(0.999, 1), feed);
    expect(raw.reason).toBe("negative_edge");
    const d = applySaturatedHold(cfg, raw, "floor", noPos, book(0.999, 1), feed);
    expect(d.action).toBe("hold");
  });

  it("never touches stop-loss or plain holds", () => {
    const stop = decideExit(cfg, 0.99, 0.9, book(0.3, 0.34), feeFree);
    expect(stop.reason).toBe("stop_loss");
    expect(applySaturatedHold(cfg, stop, "floor", noPos, book(0.3, 0.34), feeFree)).toEqual(stop);

    const hold = decideExit(cfg, 0.99, 0.5, book(0.9, 0.92), feeFree);
    expect(hold.action).toBe("hold");
    expect(applySaturatedHold(cfg, hold, "floor", noPos, book(0.9, 0.92), feeFree)).toEqual(hold);
  });

  it("marks the veto with saturatedHold for ledger/limit-cancel consumers", () => {
    const raw = negEdge(0.99, book(0.994, 0.996));
    expect(applySaturatedHold(cfg, raw, "floor", noPos, book(0.994, 0.996), feeFree).saturatedHold).toBe(true);
    expect(applySaturatedHold(cfg, raw, "ceil", noPos, book(0.994, 0.996), feeFree).saturatedHold).toBeUndefined();
  });

  it("does NOT veto when even a true P=1 would still fail the exit threshold", () => {
    // exitEdgePp 5, bid 0.97: max possible hold edge is (1 − 0.97)×100 = 3pp
    // < 5pp — the exit is correct for every value in the clamp band.
    const strict = { ...cfg, exitEdgePp: 5 };
    const raw = decideExit(strict, 0.99, 0.5, book(0.97, 0.98), feeFree);
    expect(raw.reason).toBe("negative_edge");
    expect(applySaturatedHold(strict, raw, "floor", noPos, book(0.97, 0.98), feeFree).action).toBe("exit");
    // exitEdgePp 2.5 at the same bid: clamped edge 2.0pp fires the exit, but
    // a true P near 1 could clear 2.5pp (max edge 3.0pp) — veto applies.
    const loose = { ...cfg, exitEdgePp: 2.5 };
    const raw2 = decideExit(loose, 0.99, 0.5, book(0.97, 0.98), feeFree);
    expect(raw2.reason).toBe("negative_edge");
    expect(applySaturatedHold(loose, raw2, "floor", noPos, book(0.97, 0.98), feeFree).action).toBe("hold");
  });

  it("kill switch accepts 0/false/off/no (case-insensitive); other values stay enabled", () => {
    for (const v of ["0", "false", "FALSE", "off", "No"]) {
      const off = loadPaperConfig({ PAPER_SATURATED_HOLD: v } as NodeJS.ProcessEnv);
      expect(off.saturatedHoldEnabled, `PAPER_SATURATED_HOLD=${v}`).toBe(false);
    }
    for (const v of ["1", "true", "", "on"]) {
      const on = loadPaperConfig({ PAPER_SATURATED_HOLD: v } as NodeJS.ProcessEnv);
      expect(on.saturatedHoldEnabled, `PAPER_SATURATED_HOLD=${v}`).toBe(true);
    }
    const off = loadPaperConfig({ PAPER_SATURATED_HOLD: "0" } as NodeJS.ProcessEnv);
    const raw = negEdge(0.99, book(0.994, 0.996));
    expect(applySaturatedHold(off, raw, "floor", noPos, book(0.994, 0.996), feeFree).action).toBe("exit");
  });

  it("is enabled by default", () => {
    expect(cfg.saturatedHoldEnabled).toBe(true);
  });
});

describe("holdNetEdgePp", () => {
  it("fair minus executable, fee-free", () => {
    const e = holdNetEdgePp(0.6, book(0.5, 0.52), feeFree);
    expect(e?.edgePp).toBeCloseTo(10, 5);
    expect(e?.mark).toBe(0.5);
  });

  it("taker fee reduces exit value, RAISING the edge of holding", () => {
    const withFee = holdNetEdgePp(0.6, book(0.5, 0.52), feed)!;
    // per-share fee = 0.05 × 0.5 × (1 − 0.5) = 0.0125 → edge 11.25pp
    expect(withFee.edgePp).toBeCloseTo(11.25, 5);
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
