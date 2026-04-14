import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseOrderType } from "./execution-planning.js";

beforeEach(() => {
  vi.stubEnv("ENABLE_GTC_ORDERS", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chooseOrderType", () => {
  describe("returns FOK for time-critical actions", () => {
    it("uses FOK for close actions", () => {
      const result = chooseOrderType({
        action: "close",
        side: "SELL",
        bestBid: 0.80,
        bestAsk: 0.82,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
      expect(result.gtcLimitPrice).toBeNull();
    });

    it("uses FOK for reduce actions", () => {
      const result = chooseOrderType({
        action: "reduce",
        side: "SELL",
        bestBid: 0.80,
        bestAsk: 0.82,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
    });
  });

  describe("returns FOK for fee-free markets", () => {
    it("uses FOK when negRisk is true and fees are disabled", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.80,
        bestAsk: 0.82,
        negRisk: true,
        feesEnabled: false,
        feeRate: 0
      });
      expect(result.orderType).toBe("FOK");
    });

    it("uses FOK when feeRate is 0 (geopolitics)", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.50,
        bestAsk: 0.52,
        negRisk: false,
        feeRate: 0
      });
      expect(result.orderType).toBe("FOK");
    });
  });

  describe("returns FOK for wide spreads", () => {
    it("uses FOK when spread exceeds 5%", () => {
      // spread = (0.60 - 0.50) / 0.60 = 16.7%
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.50,
        bestAsk: 0.60,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
    });
  });

  describe("returns GTC for fee-bearing open orders with reasonable spread", () => {
    it("uses GTC for fee-enabled negRisk markets", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.580,
        bestAsk: 0.585,
        negRisk: true,
        feesEnabled: true,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("GTC");
      expect(result.gtcLimitPrice).toBe(0.581);
    });

    it("uses GTC for politics market with tight spread", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.580,
        bestAsk: 0.585,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("GTC");
      // Spread ~0.85% → tight → bid + 1 tick
      expect(result.gtcLimitPrice).toBe(0.581);
    });

    it("uses GTC with mid-price for normal spread", () => {
      // spread = (0.82 - 0.78) / 0.82 = 4.9%
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.780,
        bestAsk: 0.820,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("GTC");
      // Spread ~4.9%, > 3% → bid + 30% of spread = 0.780 + 0.012 = 0.792
      expect(result.gtcLimitPrice).toBe(0.792);
    });

    it("uses GTC with mid-price for 2% spread", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.490,
        bestAsk: 0.500,
        feeRate: 0.072 // crypto
      });
      expect(result.orderType).toBe("GTC");
      // Spread 2% → mid-price = 0.495
      expect(result.gtcLimitPrice).toBe(0.495);
    });
  });

  describe("returns FOK for non-BUY sides", () => {
    it("uses FOK for SELL open actions", () => {
      const result = chooseOrderType({
        action: "open",
        side: "SELL",
        bestBid: 0.80,
        bestAsk: 0.82,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
    });
  });

  describe("handles missing book data", () => {
    it("uses FOK when bestBid is null", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: null,
        bestAsk: 0.82,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
    });

    it("uses FOK when bestAsk is null", () => {
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.80,
        bestAsk: null,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
    });
  });

  describe("disabled by default", () => {
    it("always returns FOK when ENABLE_GTC_ORDERS is not set", () => {
      vi.stubEnv("ENABLE_GTC_ORDERS", "");
      const result = chooseOrderType({
        action: "open",
        side: "BUY",
        bestBid: 0.780,
        bestAsk: 0.800,
        feeRate: 0.04
      });
      expect(result.orderType).toBe("FOK");
    });
  });
});
