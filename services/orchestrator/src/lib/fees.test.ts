import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateFeePct,
  calculateNetEdge,
  calculateRoundTripFee,
  calculateRoundTripFeePct,
  calculateTakerFee,
  clearDynamicFeeCache,
  feeDetailsToFeeParams,
  fetchDynamicFeeParams,
  formatCategoryFee,
  formatEdgeWithFee,
  lookupCategoryFeeParams,
  peakFeePct,
  verifyFeeEstimate,
  type FeeParams
} from "./fees.js";

describe("lookupCategoryFeeParams", () => {
  it("returns exact match for known categories", () => {
    expect(lookupCategoryFeeParams("politics")).toEqual({ feeRate: 0.04, exponent: 1 });
    expect(lookupCategoryFeeParams("crypto")).toEqual({ feeRate: 0.072, exponent: 1 });
    expect(lookupCategoryFeeParams("geopolitics")).toEqual({ feeRate: 0, exponent: 0 });
    expect(lookupCategoryFeeParams("sports")).toEqual({ feeRate: 0.03, exponent: 1 });
    expect(lookupCategoryFeeParams("economics")).toEqual({ feeRate: 0.03, exponent: 0.5 });
    expect(lookupCategoryFeeParams("weather")).toEqual({ feeRate: 0.025, exponent: 0.5 });
    expect(lookupCategoryFeeParams("mentions")).toEqual({ feeRate: 0.25, exponent: 2 });
  });

  it("is case-insensitive", () => {
    expect(lookupCategoryFeeParams("Politics")).toEqual({ feeRate: 0.04, exponent: 1 });
    expect(lookupCategoryFeeParams("CRYPTO")).toEqual({ feeRate: 0.072, exponent: 1 });
    expect(lookupCategoryFeeParams("  Sports  ")).toEqual({ feeRate: 0.03, exponent: 1 });
  });

  it("matches partial aliases for known patterns", () => {
    expect(lookupCategoryFeeParams("trump")).toEqual({ feeRate: 0.04, exponent: 1 });
    expect(lookupCategoryFeeParams("us-election-2026")).toEqual({ feeRate: 0.04, exponent: 1 });
    expect(lookupCategoryFeeParams("nba-playoffs")).toEqual({ feeRate: 0.03, exponent: 1 });
    expect(lookupCategoryFeeParams("bitcoin-price")).toEqual({ feeRate: 0.072, exponent: 1 });
    expect(lookupCategoryFeeParams("fed-rate")).toEqual({ feeRate: 0.03, exponent: 0.5 });
    expect(lookupCategoryFeeParams("hurricane-season")).toEqual({ feeRate: 0.025, exponent: 0.5 });
    expect(lookupCategoryFeeParams("oscar-winners")).toEqual({ feeRate: 0.05, exponent: 1 });
  });

  it("falls back to 'other' for null, empty, or unknown categories", () => {
    const other = { feeRate: 0.2, exponent: 2 };
    expect(lookupCategoryFeeParams(null)).toEqual(other);
    expect(lookupCategoryFeeParams(undefined)).toEqual(other);
    expect(lookupCategoryFeeParams("")).toEqual(other);
    expect(lookupCategoryFeeParams("   ")).toEqual(other);
    expect(lookupCategoryFeeParams("some-random-slug")).toEqual(other);
  });

  it("keeps 0% fee for negRisk markets when fee data is missing or disabled", () => {
    const zero = { feeRate: 0, exponent: 0 };
    expect(lookupCategoryFeeParams("politics", { negRisk: true })).toEqual(zero);
    expect(lookupCategoryFeeParams("sports", { negRisk: true, feesEnabled: false })).toEqual(zero);
    expect(lookupCategoryFeeParams("politics", { negRisk: true, feesEnabled: true })).toEqual(zero);
    expect(lookupCategoryFeeParams("sports", { negRisk: true })).toEqual(zero);
    expect(lookupCategoryFeeParams("crypto", { negRisk: true })).toEqual(zero);
    expect(lookupCategoryFeeParams("world-elections", { negRisk: true })).toEqual(zero);
    expect(lookupCategoryFeeParams(null, { negRisk: true })).toEqual(zero);
  });

  it("uses fee schedule for fee-enabled negRisk markets", () => {
    expect(lookupCategoryFeeParams("politics", {
      negRisk: true,
      feesEnabled: true,
      feeSchedule: { feeRate: 0.04, exponent: 1 }
    })).toEqual({ feeRate: 0.04, exponent: 1 });
  });

  it("uses category-based fee when negRisk is false or omitted", () => {
    expect(lookupCategoryFeeParams("politics", { negRisk: false })).toEqual({ feeRate: 0.04, exponent: 1 });
    expect(lookupCategoryFeeParams("sports", { negRisk: false })).toEqual({ feeRate: 0.03, exponent: 1 });
    expect(lookupCategoryFeeParams("politics")).toEqual({ feeRate: 0.04, exponent: 1 });
  });
});

describe("calculateTakerFee", () => {
  it("returns zero for geopolitics (feeRate = 0)", () => {
    const params: FeeParams = { feeRate: 0, exponent: 0 };
    expect(calculateTakerFee(100, 0.5, params)).toBe(0);
  });

  it("returns zero when shares are zero", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    expect(calculateTakerFee(0, 0.5, params)).toBe(0);
  });

  it("calculates fee correctly for politics at p=0.5", () => {
    // fee = 100 * 0.5 * 0.04 * (0.5*0.5)^1 = 100 * 0.5 * 0.04 * 0.25 = 0.5
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    expect(calculateTakerFee(100, 0.5, params)).toBeCloseTo(0.5, 6);
  });

  it("calculates fee correctly for crypto at p=0.5", () => {
    // fee = 100 * 0.5 * 0.072 * (0.25)^1 = 0.9
    const params: FeeParams = { feeRate: 0.072, exponent: 1 };
    expect(calculateTakerFee(100, 0.5, params)).toBeCloseTo(0.9, 6);
  });

  it("calculates fee correctly for economics at p=0.5 (exponent=0.5)", () => {
    // fee = 100 * 0.5 * 0.03 * (0.25)^0.5 = 100 * 0.5 * 0.03 * 0.5 = 0.75
    const params: FeeParams = { feeRate: 0.03, exponent: 0.5 };
    expect(calculateTakerFee(100, 0.5, params)).toBeCloseTo(0.75, 6);
  });

  it("computes lower fee at extreme prices (p near 0 or 1)", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    // At p=0.1: variance = 0.09, fee = 100 * 0.1 * 0.04 * 0.09 = 0.036
    expect(calculateTakerFee(100, 0.1, params)).toBeCloseTo(0.036, 6);
    // At p=0.9: variance = 0.09, fee = 100 * 0.9 * 0.04 * 0.09 = 0.324
    expect(calculateTakerFee(100, 0.9, params)).toBeCloseTo(0.324, 6);
  });
});

describe("calculateFeePct", () => {
  it("returns the fee as a fraction of notional", () => {
    // politics at p=0.5: 0.04 * 0.25 = 0.01 (1%)
    expect(calculateFeePct(0.5, { feeRate: 0.04, exponent: 1 })).toBeCloseTo(0.01, 6);
  });

  it("returns zero for geopolitics", () => {
    expect(calculateFeePct(0.5, { feeRate: 0, exponent: 0 })).toBe(0);
  });

  it("works with fractional exponent", () => {
    // economics at p=0.5: 0.03 * (0.25)^0.5 = 0.03 * 0.5 = 0.015
    expect(calculateFeePct(0.5, { feeRate: 0.03, exponent: 0.5 })).toBeCloseTo(0.015, 6);
  });
});

describe("calculateRoundTripFee", () => {
  it("sums entry and exit fees in USDC", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    // Buy 100 shares at 0.50: fee = 100 * 0.5 * 0.04 * 0.25 = 0.50
    // Sell 100 shares at 0.55: fee = 100 * 0.55 * 0.04 * (0.55*0.45) = 100 * 0.55 * 0.04 * 0.2475 = 0.5445
    const roundTrip = calculateRoundTripFee(0.5, 0.55, 100, params);
    expect(roundTrip).toBeCloseTo(0.5 + 0.5445, 4);
  });
});

describe("calculateRoundTripFeePct", () => {
  it("sums entry and exit fee percentages", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    // entry at 0.5: 0.04 * 0.25 = 0.01
    // exit at 0.5:  0.04 * 0.25 = 0.01
    expect(calculateRoundTripFeePct(0.5, 0.5, params)).toBeCloseTo(0.02, 6);
  });
});

describe("calculateNetEdge", () => {
  it("subtracts only entry fee for hold-to-settlement", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    // gross edge = 0.10, entry fee at p=0.5 = 1% -> net = 0.09
    expect(calculateNetEdge(0.10, 0.5, params, true)).toBeCloseTo(0.09, 6);
  });

  it("subtracts both entry and exit fee for round-trip", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    // gross edge = 0.10, entry+exit fee at p=0.5 = 2% -> net = 0.08
    expect(calculateNetEdge(0.10, 0.5, params, false)).toBeCloseTo(0.08, 6);
  });

  it("defaults to hold-to-settlement mode", () => {
    const params: FeeParams = { feeRate: 0.04, exponent: 1 };
    expect(calculateNetEdge(0.10, 0.5, params)).toBeCloseTo(0.09, 6);
  });

  it("returns gross edge unchanged for geopolitics (zero fee)", () => {
    const params: FeeParams = { feeRate: 0, exponent: 0 };
    expect(calculateNetEdge(0.10, 0.5, params)).toBeCloseTo(0.10, 6);
  });

  it("returns gross edge unchanged for fee-free negRisk markets", () => {
    const negRiskParams = lookupCategoryFeeParams("politics", { negRisk: true });
    expect(calculateNetEdge(0.10, 0.5, negRiskParams)).toBeCloseTo(0.10, 6);
    expect(calculateNetEdge(0.10, 0.5, negRiskParams, false)).toBeCloseTo(0.10, 6);
  });

  it("deducts fees for fee-enabled negRisk markets", () => {
    const feeEnabledNegRiskParams = lookupCategoryFeeParams("politics", {
      negRisk: true,
      feesEnabled: true,
      feeSchedule: { feeRate: 0.04, exponent: 1 }
    });
    expect(calculateNetEdge(0.10, 0.5, feeEnabledNegRiskParams)).toBeCloseTo(0.09, 6);
  });

  it("can produce negative net edge if fee exceeds gross edge", () => {
    // mentions at p=0.5: fee = 0.25 * (0.25)^2 = 0.25 * 0.0625 = 0.015625
    const params: FeeParams = { feeRate: 0.25, exponent: 2 };
    // gross edge = 0.01
    const net = calculateNetEdge(0.01, 0.5, params);
    expect(net).toBeLessThan(0);
    expect(net).toBeCloseTo(0.01 - 0.015625, 6);
  });
});

describe("peakFeePct", () => {
  it("returns the maximum fee at p=0.5", () => {
    expect(peakFeePct({ feeRate: 0.04, exponent: 1 })).toBeCloseTo(0.01, 6);
    expect(peakFeePct({ feeRate: 0.072, exponent: 1 })).toBeCloseTo(0.018, 6);
    expect(peakFeePct({ feeRate: 0.03, exponent: 1 })).toBeCloseTo(0.0075, 6);
    expect(peakFeePct({ feeRate: 0, exponent: 0 })).toBe(0);
  });

  it("computes correct peak for exponent != 1", () => {
    // economics: 0.03 * (0.25)^0.5 = 0.03 * 0.5 = 0.015
    expect(peakFeePct({ feeRate: 0.03, exponent: 0.5 })).toBeCloseTo(0.015, 6);
    // other: 0.2 * (0.25)^2 = 0.2 * 0.0625 = 0.0125
    expect(peakFeePct({ feeRate: 0.2, exponent: 2 })).toBeCloseTo(0.0125, 6);
  });
});

describe("formatEdgeWithFee", () => {
  it("formats a human-readable edge summary", () => {
    const result = formatEdgeWithFee(0.15, 0.142, 0.008);
    expect(result).toBe("Edge: +15.0% (net +14.2% after 0.8% fee)");
  });
});

describe("formatCategoryFee", () => {
  it("formats category with peak fee", () => {
    expect(formatCategoryFee("Politics", { feeRate: 0.04, exponent: 1 })).toBe(
      "Category: Politics (1.0% peak fee)"
    );
  });

  it("shows 0% for geopolitics", () => {
    expect(formatCategoryFee("Geopolitics", { feeRate: 0, exponent: 0 })).toBe(
      "Category: Geopolitics (0% fee)"
    );
  });

  it("shows Unknown for null category", () => {
    expect(formatCategoryFee(null, { feeRate: 0.2, exponent: 2 })).toBe(
      "Category: Unknown (1.3% peak fee)"
    );
  });
});

describe("verifyFeeEstimate", () => {
  it("detects no mismatch when both agree on fee presence", () => {
    const result = verifyFeeEstimate({
      tokenId: "tok-1",
      marketSlug: "some-market",
      categorySlug: "politics",
      actualBaseFee: 1000
    });
    expect(result.mismatch).toBe(false);
    expect(result.estimatedFeeRate).toBe(0.04);
  });

  it("detects mismatch when we expect free but CLOB charges", () => {
    const result = verifyFeeEstimate({
      tokenId: "tok-2",
      marketSlug: "geo-market",
      categorySlug: "geopolitics",
      actualBaseFee: 1000
    });
    expect(result.mismatch).toBe(true);
    expect(result.estimatedFeeRate).toBe(0);
    expect(result.actualBaseFee).toBe(1000);
  });

  it("detects mismatch when we expect fee but CLOB says free", () => {
    const result = verifyFeeEstimate({
      tokenId: "tok-3",
      marketSlug: "crypto-market",
      categorySlug: "crypto",
      actualBaseFee: 0
    });
    expect(result.mismatch).toBe(true);
  });

  it("reports no mismatch for negRisk market with zero CLOB fee", () => {
    const result = verifyFeeEstimate({
      tokenId: "tok-4",
      marketSlug: "rubio-2028",
      categorySlug: "world-elections",
      actualBaseFee: 0,
      negRisk: true
    });
    expect(result.mismatch).toBe(false);
    expect(result.estimatedFeeRate).toBe(0);
  });

  it("detects mismatch if negRisk market unexpectedly has a CLOB fee", () => {
    const result = verifyFeeEstimate({
      tokenId: "tok-5",
      marketSlug: "fifa-winner",
      categorySlug: "sports",
      actualBaseFee: 1000,
      negRisk: true
    });
    expect(result.mismatch).toBe(true);
    expect(result.estimatedFeeRate).toBe(0);
  });

  it("reports no mismatch for fee-enabled negRisk markets with a real schedule", () => {
    const result = verifyFeeEstimate({
      tokenId: "tok-6",
      marketSlug: "trump-ag-pick",
      categorySlug: "politics",
      actualBaseFee: 1000,
      negRisk: true,
      feesEnabled: true,
      feeSchedule: { feeRate: 0.04, exponent: 1 }
    });
    expect(result.mismatch).toBe(false);
    expect(result.estimatedFeeRate).toBe(0.04);
  });
});

describe("feeDetailsToFeeParams", () => {
  it("maps complete FeeDetails to FeeParams", () => {
    expect(feeDetailsToFeeParams({ r: 0.04, e: 1, to: true })).toEqual({
      feeRate: 0.04,
      exponent: 1
    });
  });

  it("defaults missing rate/exponent to zero (no fee)", () => {
    expect(feeDetailsToFeeParams({ to: false })).toEqual({ feeRate: 0, exponent: 0 });
    expect(feeDetailsToFeeParams({})).toEqual({ feeRate: 0, exponent: 0 });
  });

  it("returns zero-fee params for null or undefined input", () => {
    expect(feeDetailsToFeeParams(null)).toEqual({ feeRate: 0, exponent: 0 });
    expect(feeDetailsToFeeParams(undefined)).toEqual({ feeRate: 0, exponent: 0 });
  });
});

describe("fetchDynamicFeeParams", () => {
  beforeEach(() => {
    clearDynamicFeeCache();
  });

  it("returns FeeParams from a successful SDK call", async () => {
    const client = {
      getClobMarketInfo: vi.fn().mockResolvedValue({ fd: { r: 0.072, e: 1, to: true } })
    };
    const result = await fetchDynamicFeeParams(client, "0xabc");
    expect(result).toEqual({ feeRate: 0.072, exponent: 1 });
    expect(client.getClobMarketInfo).toHaveBeenCalledWith("0xabc");
  });

  it("returns null when conditionId is empty", async () => {
    const client = { getClobMarketInfo: vi.fn() };
    const result = await fetchDynamicFeeParams(client, "");
    expect(result).toBeNull();
    expect(client.getClobMarketInfo).not.toHaveBeenCalled();
  });

  it("returns null and swallows error when SDK throws", async () => {
    const client = {
      getClobMarketInfo: vi.fn().mockRejectedValue(new Error("network down"))
    };
    const result = await fetchDynamicFeeParams(client, "0xdef");
    expect(result).toBeNull();
  });

  it("returns zero-fee FeeParams when market has no fee details", async () => {
    const client = {
      getClobMarketInfo: vi.fn().mockResolvedValue({ fd: undefined })
    };
    const result = await fetchDynamicFeeParams(client, "0xnegrisk");
    expect(result).toEqual({ feeRate: 0, exponent: 0 });
  });

  it("caches the result so repeated calls hit the network only once", async () => {
    const client = {
      getClobMarketInfo: vi.fn().mockResolvedValue({ fd: { r: 0.04, e: 1, to: true } })
    };
    await fetchDynamicFeeParams(client, "0xrepeated");
    await fetchDynamicFeeParams(client, "0xrepeated");
    await fetchDynamicFeeParams(client, "0xrepeated");
    expect(client.getClobMarketInfo).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures (next call retries)", async () => {
    const client = {
      getClobMarketInfo: vi
        .fn()
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce({ fd: { r: 0.05, e: 1, to: true } })
    };
    const first = await fetchDynamicFeeParams(client, "0xretry");
    const second = await fetchDynamicFeeParams(client, "0xretry");
    expect(first).toBeNull();
    expect(second).toEqual({ feeRate: 0.05, exponent: 1 });
    expect(client.getClobMarketInfo).toHaveBeenCalledTimes(2);
  });
});
