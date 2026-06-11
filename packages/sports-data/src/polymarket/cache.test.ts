import { describe, expect, it } from "vitest";
import { buildSnapshot, buildIndex, diffSnapshots, allTokenIds, unionPreservingDropped } from "./cache.js";
import type { WcMarket } from "./types.js";

function mkt(over: Partial<WcMarket> & Pick<WcMarket, "id">): WcMarket {
  return {
    id: over.id, conditionId: over.conditionId ?? `c-${over.id}`, questionId: `q-${over.id}`,
    question: over.question ?? `Q ${over.id}`, marketSlug: over.marketSlug ?? `m-${over.id}`,
    eventSlug: over.eventSlug ?? "ev", eventTitle: "Ev", category: over.category ?? "match",
    subtype: over.subtype ?? "moneyline_1x2", groupItem: null,
    outcomes: over.outcomes ?? ["Yes", "No"], outcomePrices: over.outcomePrices ?? [0.5, 0.5],
    clobTokenIds: over.clobTokenIds ?? [`t-${over.id}-a`, `t-${over.id}-b`],
    negRisk: false, negRiskMarketId: null, enableOrderBook: true, acceptingOrders: true,
    active: over.active ?? true, closed: over.closed ?? false, archived: false,
    bestBid: null, bestAsk: null, lastTradePrice: null, spread: null, oneDayPriceChange: null,
    liquidity: 0, volume: 0, volume24hr: 0, startDate: null, endDate: null,
    url: "u", tagIds: [102232], updatedAt: null
  };
}

describe("buildIndex", () => {
  it("indexes by event/condition/slug/token", () => {
    const snap = buildSnapshot([mkt({ id: "1" }), mkt({ id: "2", eventSlug: "ev" })], [102232], "t0");
    const idx = buildIndex(snap, "t0");
    expect(idx.byEventSlug.ev).toEqual(["1", "2"]);
    expect(idx.byConditionId["c-1"]).toBe("1");
    expect(idx.byMarketSlug["m-2"]).toBe("2");
    expect(idx.byTokenId["t-1-a"]).toEqual({ marketId: "1", conditionId: "c-1", marketSlug: "m-1", outcome: "Yes", outcomeIndex: 0 });
    expect(allTokenIds(snap)).toHaveLength(4);
  });
});

describe("diffSnapshots", () => {
  it("detects added / removed / status / price changes", () => {
    const oldSnap = buildSnapshot([
      mkt({ id: "1", outcomePrices: [0.5, 0.5] }),
      mkt({ id: "2", active: true, closed: false }),
      mkt({ id: "3" })
    ], [102232], "t0");
    const newSnap = buildSnapshot([
      mkt({ id: "1", outcomePrices: [0.62, 0.38] }), // price moved
      mkt({ id: "2", active: false, closed: true }), // status changed
      mkt({ id: "4" }) // added; id 3 removed
    ], [102232], "t1");
    const d = diffSnapshots(oldSnap, newSnap);
    expect(d.summary.addedCount).toBe(1);
    expect(d.added[0]!.id).toBe("4");
    expect(d.summary.removedCount).toBe(1);
    expect(d.removed[0]!.id).toBe("3");
    expect(d.summary.statusChangedCount).toBe(1);
    expect(d.statusChanged[0]).toMatchObject({ id: "2", from: "active", to: "closed" });
    expect(d.summary.priceChangedCount).toBe(1);
    expect(d.priceChanged[0]!.maxDelta).toBeCloseTo(0.12, 4);
  });

  it("counts unchanged when nothing moves", () => {
    const a = buildSnapshot([mkt({ id: "1" })], [1], "t0");
    const b = buildSnapshot([mkt({ id: "1" })], [1], "t1");
    expect(diffSnapshots(a, b).summary.unchanged).toBe(1);
  });

  it("does not report an already-inactive dropped market as removed", () => {
    const oldSnap = buildSnapshot([mkt({ id: "1", active: false })], [1], "t0");
    const newSnap = buildSnapshot([mkt({ id: "2" })], [1], "t1");
    const d = diffSnapshots(oldSnap, newSnap);
    expect(d.summary.removedCount).toBe(0); // id 1 was inactive → not "removed"
    expect(d.summary.addedCount).toBe(1);
  });

  it("a malformed (NaN) price does not suppress a real move on another outcome", () => {
    const oldSnap = buildSnapshot([mkt({ id: "1", outcomePrices: [0.5, 0.5] })], [1], "t0");
    const newSnap = buildSnapshot([mkt({ id: "1", outcomePrices: [Number.NaN, 0.7] })], [1], "t1");
    const d = diffSnapshots(oldSnap, newSnap);
    expect(d.summary.priceChangedCount).toBe(1); // 0.5→0.7 still detected
  });
});

describe("unionPreservingDropped", () => {
  it("carries dropped cached markets forward as inactive; fresh wins on overlap", () => {
    const fresh = [mkt({ id: "1", active: true })];
    const cached = [mkt({ id: "1", active: false }), mkt({ id: "9", active: true })];
    const merged = unionPreservingDropped(fresh, cached);
    const ids = merged.map((m) => m.id).sort();
    expect(ids).toEqual(["1", "9"]);
    expect(merged.find((m) => m.id === "1")!.active).toBe(true); // fresh wins
    expect(merged.find((m) => m.id === "9")!.active).toBe(false); // carried, forced inactive
  });
});
