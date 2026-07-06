import { afterEach, describe, expect, it } from "vitest";
import {
  isMarketPriceSource,
  marketBlind,
  marketBlindDirective,
  mentionsMarketPricing,
} from "./market-blind";
import {
  applyLlrs,
  clusterFactors,
  credibilityCap,
  credibleInterval,
  PROB_CEIL,
  PROB_FLOOR,
} from "./bayes";

const savedEnv = process.env.FORECAST_MARKET_BLIND;
afterEach(() => {
  if (savedEnv === undefined) delete process.env.FORECAST_MARKET_BLIND;
  else process.env.FORECAST_MARKET_BLIND = savedEnv;
});

describe("market-blind mode", () => {
  it("is off by default and on with FORECAST_MARKET_BLIND=1", () => {
    delete process.env.FORECAST_MARKET_BLIND;
    expect(marketBlind()).toBe(false);
    expect(marketBlindDirective()).toBe("");
    process.env.FORECAST_MARKET_BLIND = "1";
    expect(marketBlind()).toBe(true);
    expect(marketBlindDirective()).toContain("MARKET-BLIND RULE");
  });

  it("blocks prediction-market domains including subdomains", () => {
    expect(isMarketPriceSource("https://polymarket.com/event/putin-out")).toBe(true);
    expect(isMarketPriceSource("https://www.kalshi.com/markets/foo")).toBe(true);
    expect(isMarketPriceSource("https://data.manifold.markets/x")).toBe(true);
    expect(isMarketPriceSource("polymarket.com/event/no-scheme")).toBe(true);
  });

  it("does not block ordinary or lookalike domains", () => {
    expect(isMarketPriceSource("https://reuters.com/article")).toBe(false);
    expect(isMarketPriceSource("https://notpolymarket.com/x")).toBe(false);
    expect(isMarketPriceSource("https://en.wikipedia.org/wiki/Polymarket")).toBe(false);
  });

  it("flags market-price wording but not ordinary financial prose", () => {
    expect(mentionsMarketPricing("currently trading around 76-83% on Polymarket")).toBe(true);
    expect(mentionsMarketPricing("Kalshi prices Trump at roughly 7% implied probability")).toBe(true);
    expect(mentionsMarketPricing("base rate for one-year regime survival is ~97%")).toBe(false);
    expect(mentionsMarketPricing("NVDA closed 2% higher after earnings")).toBe(false);
  });
});

describe("credibilityCap", () => {
  it("caps low-credibility sources hardest and leaves high untouched", () => {
    expect(credibilityCap("low", 1.5)).toBeCloseTo(0.25);
    expect(credibilityCap("low", -1.5)).toBeCloseTo(-0.25);
    expect(credibilityCap("medium", 1.5)).toBeCloseTo(0.8);
    expect(credibilityCap("high", 1.5)).toBeCloseTo(1.5);
    expect(credibilityCap("unknown-tag", 1.5)).toBeCloseTo(0.8); // defaults to medium
  });
});

describe("clusterFactors cross-round decay", () => {
  it("keeps the legacy per-round behavior without prior counts", () => {
    const f = clusterFactors(["a", "a", "b"], [1.0, 0.5, 0.8]);
    expect(f[0]).toBe(1); // strongest in cluster a
    expect(f[1]).toBe(0.5);
    expect(f[2]).toBe(1); // solo cluster
  });

  it("offsets ranks by the cluster's already-counted prior entries", () => {
    const prior = new Map([["status-quo-continuation", 2]]);
    const f = clusterFactors(["status-quo-continuation"], [0.8], prior);
    // rank 0 + offset 2 → decay^2 = 0.25
    expect(f[0]).toBeCloseTo(0.25);
  });

  it("applies the offset to every member of a repeated cluster", () => {
    const prior = new Map([["story-x", 1]]);
    const f = clusterFactors(["story-x", "story-x", "fresh"], [1.0, 0.5, 0.7], prior);
    expect(f[0]).toBeCloseTo(0.5); // decay^(0+1)
    expect(f[1]).toBeCloseTo(0.25); // decay^(1+1)
    expect(f[2]).toBe(1); // untouched independent cluster
  });
});

describe("applyLlrs saturation detection", () => {
  it("reports pinned=floor when the unclamped posterior crosses the floor", () => {
    const { post, pinned } = applyLlrs(0.05, [-3, -3]);
    expect(post).toBe(PROB_FLOOR);
    expect(pinned).toBe("floor");
  });

  it("reports pinned=ceil symmetrically", () => {
    const { post, pinned } = applyLlrs(0.95, [3, 3]);
    expect(post).toBe(PROB_CEIL);
    expect(pinned).toBe("ceil");
  });

  it("reports pinned=null for an interior posterior", () => {
    const { pinned } = applyLlrs(0.4, [0.3, -0.1]);
    expect(pinned).toBeNull();
  });
});

describe("credibleInterval endpoints", () => {
  it("never renders a band outside the engine's expressible range", () => {
    const [lo, hi] = credibleInterval(PROB_FLOOR, 1, "low");
    expect(lo).toBeGreaterThanOrEqual(PROB_FLOOR);
    const [, hi2] = credibleInterval(PROB_CEIL, 1, "low");
    expect(hi2).toBeLessThanOrEqual(PROB_CEIL);
    expect(hi).toBeGreaterThan(lo);
  });
});
