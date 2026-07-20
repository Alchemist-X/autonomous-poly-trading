import { describe, expect, it } from "vitest";
import { PAPER_SNAPSHOT } from "./snapshot";
import { deriveEquityStats, deriveOpenBookStats, deriveReportStats, deriveTradeStats } from "./stats";

describe("live-predict-raven stats", () => {
  describe("deriveTradeStats", () => {
    it("computes 4 wins / 2 losses = 66.67% on the baked closed trades", () => {
      const stats = deriveTradeStats(PAPER_SNAPSHOT.closedTrades);
      expect(stats.closedCount).toBe(6);
      expect(stats.wins).toBe(4);
      expect(stats.losses).toBe(2);
      expect(stats.winRatePct).toBeCloseTo(66.67, 1);
    });

    it("matches the book's realized PnL within per-fill rounding drift", () => {
      const stats = deriveTradeStats(PAPER_SNAPSHOT.closedTrades);
      expect(stats.realizedPnlUsd).toBeCloseTo(PAPER_SNAPSHOT.realizedPnlUsd, 0);
    });

    it("shows the loss-size problem: avg loss ~3x avg win, profit factor < 1", () => {
      const stats = deriveTradeStats(PAPER_SNAPSHOT.closedTrades);
      expect(stats.avgWinUsd).toBeCloseTo(70.35, 1);
      expect(stats.avgLossUsd).toBeCloseTo(230.09, 1);
      expect(stats.profitFactor).toBeLessThan(1);
      expect(stats.profitFactor).toBeCloseTo(0.61, 2);
    });

    it("handles an empty trade list without dividing by zero", () => {
      const stats = deriveTradeStats([]);
      expect(stats.winRatePct).toBe(0);
      expect(stats.avgWinUsd).toBe(0);
      expect(stats.avgLossUsd).toBe(0);
      expect(stats.profitFactor).toBe(Infinity);
    });
  });

  describe("deriveEquityStats", () => {
    it("reads current equity, peak, and return off the curve", () => {
      const stats = deriveEquityStats(PAPER_SNAPSHOT.equityCurve, PAPER_SNAPSHOT.bankrollUsd);
      expect(stats.currentUsd).toBe(10433.57);
      expect(stats.peakUsd).toBe(10799.24);
      expect(stats.peakDate).toBe("07-14");
      expect(stats.returnPct).toBeCloseTo(4.34, 2);
    });

    it("computes max drawdown as the worst peak-to-trough drop (7/14 -> 7/16)", () => {
      const stats = deriveEquityStats(PAPER_SNAPSHOT.equityCurve, PAPER_SNAPSHOT.bankrollUsd);
      expect(stats.maxDrawdownPct).toBeCloseTo(-3.81, 1);
    });

    it("is monotonic-safe: a flat curve has zero drawdown", () => {
      const flat = [
        { date: "d1", equityUsd: 100 },
        { date: "d2", equityUsd: 100 }
      ];
      expect(deriveEquityStats(flat, 100).maxDrawdownPct).toBe(0);
    });
  });

  describe("deriveOpenBookStats", () => {
    it("sums cost basis (~$3000) and unrealized (+$611.71) across the 6 open positions", () => {
      const stats = deriveOpenBookStats(PAPER_SNAPSHOT.openPositions, PAPER_SNAPSHOT.cashUsd);
      expect(stats.positionCount).toBe(6);
      expect(stats.costUsd).toBeCloseTo(3000, 0);
      expect(stats.unrealizedUsd).toBeCloseTo(611.71, 1);
      expect(stats.green).toBe(4);
      expect(stats.flat).toBe(1);
      expect(stats.red).toBe(1);
    });

    it("reports the cash share of marked book value (~65%)", () => {
      const stats = deriveOpenBookStats(PAPER_SNAPSHOT.openPositions, PAPER_SNAPSHOT.cashUsd);
      expect(stats.cashSharePct).toBeGreaterThan(63);
      expect(stats.cashSharePct).toBeLessThan(68);
    });
  });

  describe("deriveReportStats", () => {
    it("assembles all three sections from the snapshot", () => {
      const stats = deriveReportStats(PAPER_SNAPSHOT);
      expect(stats.trade.closedCount).toBe(6);
      expect(stats.equity.currentUsd).toBe(10433.57);
      expect(stats.openBook.positionCount).toBe(6);
    });
  });
});
