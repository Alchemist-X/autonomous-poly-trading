import { describe, expect, it } from "vitest";
import { PAPER_SNAPSHOT } from "./snapshot";
import { deriveEquityStats, deriveOpenBookStats, deriveReportStats, deriveTradeStats } from "./stats";

describe("live-predict-raven stats", () => {
  describe("deriveTradeStats", () => {
    it("computes 5 wins / 12 losses = 29.41% on the baked closed trades", () => {
      const stats = deriveTradeStats(PAPER_SNAPSHOT.closedTrades);
      expect(stats.closedCount).toBe(17);
      expect(stats.wins).toBe(5);
      expect(stats.losses).toBe(12);
      expect(stats.winRatePct).toBeCloseTo(29.41, 1);
    });

    it("matches the book's realized PnL within per-fill rounding drift", () => {
      const stats = deriveTradeStats(PAPER_SNAPSHOT.closedTrades);
      expect(stats.realizedPnlUsd).toBeCloseTo(PAPER_SNAPSHOT.realizedPnlUsd, 0);
    });

    it("shows the loss-size problem: avg loss ~2.4x avg win, profit factor far below 1", () => {
      const stats = deriveTradeStats(PAPER_SNAPSHOT.closedTrades);
      expect(stats.avgWinUsd).toBeCloseTo(90.37, 1);
      expect(stats.avgLossUsd).toBeCloseTo(213.85, 1);
      expect(stats.profitFactor).toBeLessThan(1);
      expect(stats.profitFactor).toBeCloseTo(0.18, 2);
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
      expect(stats.currentUsd).toBe(7974.23);
      expect(stats.peakUsd).toBe(10799.24);
      expect(stats.peakDate).toBe("07-14");
      expect(stats.returnPct).toBeCloseTo(-20.26, 2);
    });

    it("computes max drawdown as the worst peak-to-trough drop (7/14 peak -> now)", () => {
      const stats = deriveEquityStats(PAPER_SNAPSHOT.equityCurve, PAPER_SNAPSHOT.bankrollUsd);
      expect(stats.maxDrawdownPct).toBeCloseTo(-26.16, 1);
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
    it("sums cost basis (~$4950) and unrealized (+$133.59) across the 10 open positions", () => {
      const stats = deriveOpenBookStats(PAPER_SNAPSHOT.openPositions, PAPER_SNAPSHOT.cashUsd);
      expect(stats.positionCount).toBe(10);
      expect(stats.costUsd).toBeCloseTo(4950, 0);
      expect(stats.unrealizedUsd).toBeCloseTo(133.59, 1);
      expect(stats.green).toBe(6);
      expect(stats.flat).toBe(0);
      expect(stats.red).toBe(4);
    });

    it("reports the cash share of marked book value (~36%)", () => {
      const stats = deriveOpenBookStats(PAPER_SNAPSHOT.openPositions, PAPER_SNAPSHOT.cashUsd);
      expect(stats.cashSharePct).toBeGreaterThan(34);
      expect(stats.cashSharePct).toBeLessThan(39);
    });
  });

  describe("deriveReportStats", () => {
    it("assembles all three sections from the snapshot", () => {
      const stats = deriveReportStats(PAPER_SNAPSHOT);
      expect(stats.trade.closedCount).toBe(17);
      expect(stats.equity.currentUsd).toBe(7974.23);
      expect(stats.openBook.positionCount).toBe(10);
    });
  });
});
