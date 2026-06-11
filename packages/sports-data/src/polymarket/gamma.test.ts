import { describe, expect, it } from "vitest";
import { normalizeMarket } from "./gamma.js";

// A realistic Gamma row (JSON-encoded string fields, as the live API returns).
const RAW = {
  id: 558934,
  conditionId: "0xcond",
  questionID: "0xq",
  question: "Will Spain win the 2026 FIFA World Cup?",
  slug: "will-spain-win-the-2026-fifa-world-cup-963",
  outcomes: '["Yes", "No"]',
  outcomePrices: '["0.1595", "0.8405"]',
  clobTokenIds: '["4394372887385518214471608448209527405727552777602031099972143344338178308080", "112680630004798425069810935278212000865453267506345451433803052322987302357330"]',
  negRisk: true,
  active: true,
  closed: false,
  archived: false,
  bestBid: 0.158,
  bestAsk: 0.16,
  lastTradePrice: 0.159,
  liquidityNum: 12345.6,
  volumeNum: 98765.4,
  endDate: "2026-07-20T00:00:00Z",
  events: [{ slug: "world-cup-winner", title: "World Cup Winner " }]
};

describe("normalizeMarket", () => {
  it("parses JSON-string array fields into real arrays", () => {
    const m = normalizeMarket(RAW, 102232)!;
    expect(m.outcomes).toEqual(["Yes", "No"]);
    expect(m.outcomePrices).toEqual([0.1595, 0.8405]);
    expect(m.clobTokenIds).toHaveLength(2);
    expect(m.clobTokenIds[0]).toBe("4394372887385518214471608448209527405727552777602031099972143344338178308080");
  });

  it("maps ids, event, category, and numeric fields", () => {
    const m = normalizeMarket(RAW, 102232)!;
    expect(m.id).toBe("558934");
    expect(m.conditionId).toBe("0xcond");
    expect(m.questionId).toBe("0xq");
    expect(m.eventSlug).toBe("world-cup-winner");
    expect(m.eventTitle).toBe("World Cup Winner");
    expect(m.category).toBe("champion");
    expect(m.subtype).toBe("tournament_winner");
    expect(m.liquidity).toBeCloseTo(12345.6, 1);
    expect(m.negRisk).toBe(true);
    expect(m.url).toContain("/event/world-cup-winner");
    expect(m.tagIds).toEqual([102232]);
  });

  it("returns null when id or slug is missing", () => {
    expect(normalizeMarket({ ...RAW, id: undefined }, 1)).toBeNull();
    expect(normalizeMarket({ ...RAW, slug: undefined }, 1)).toBeNull();
  });

  it("tolerates malformed JSON-string fields", () => {
    const m = normalizeMarket({ ...RAW, clobTokenIds: "not-json", outcomes: undefined }, 1)!;
    expect(m.clobTokenIds).toEqual([]);
    expect(m.outcomes).toEqual([]);
  });
});
