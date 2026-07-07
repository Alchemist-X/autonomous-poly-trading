import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMarket } from "./polymarket";

// Gamma renamed a live market's slug in place (2026-07-07: putin-out-before-2027
// → putin-out-before-2027-346, same conditionId). A held position must fall
// back to its immutable conditionId or it can never be re-evaluated or settled.

const RENAMED = {
  slug: "putin-out-before-2027-346",
  conditionId: "0x6bd5",
  question: "Putin out as President of Russia by December 31, 2026?",
  closed: false,
  outcomes: '["Yes","No"]',
  clobTokenIds: '["11","22"]',
  outcomePrices: '["0.1","0.9"]',
  events: [{ slug: "putin-out-before-2027" }]
};

function stubFetch(handler: (url: string) => unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => handler(String(url))
    }))
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchMarket conditionId fallback", () => {
  it("falls back to condition_ids when both slug lookups miss", async () => {
    stubFetch((url) => (url.includes("condition_ids=") ? [RENAMED] : []));
    const m = await fetchMarket("putin-out-before-2027", "0x6bd5");
    expect(m.slug).toBe("putin-out-before-2027-346");
    expect(m.conditionId).toBe("0x6bd5");
    expect(m.resolution).toBe("open");
  });

  it("does not hit the fallback when the slug still resolves", async () => {
    stubFetch((url) => {
      if (url.includes("condition_ids=")) throw new Error("fallback must not be queried");
      return url.includes("closed=true") ? [] : [RENAMED];
    });
    const m = await fetchMarket("putin-out-before-2027-346", "0x6bd5");
    expect(m.slug).toBe("putin-out-before-2027-346");
  });

  it("reports that the fallback was tried when everything misses", async () => {
    stubFetch(() => []);
    await expect(fetchMarket("gone-market", "0xdead")).rejects.toThrow(/conditionId fallback tried/);
  });

  it("keeps the plain two-step error when no conditionId is available", async () => {
    stubFetch(() => []);
    await expect(fetchMarket("gone-market")).rejects.toThrow(/open or closed\)/);
  });
});
