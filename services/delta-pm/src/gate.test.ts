import { describe, expect, it } from "vitest";
import type { NewsItem, UniverseEntry } from "@autopoly/delta-pm-contracts";
import { fingerprintOf, matchUniverse, reactionFraction, tokenJaccard, type Gate1Output } from "./gate.js";
import { detectContamination, scrubPriceReactions } from "./analyzer.js";

function entry(over: Partial<UniverseEntry> = {}): UniverseEntry {
  return {
    ticker: "NVDA",
    company: "NVIDIA",
    companyZh: "英伟达",
    hlSymbol: "xyz:NVDA",
    group: "mag7",
    tags: ["ai-infrastructure"],
    aliases: ["nvidia", "blackwell", "英伟达"],
    benchmark: "XYZ100",
    liquidityTier: 1,
    marginMode: "cross",
    maxLeverageOnVenue: 20,
    preIpo: false,
    nextEarningsUtc: null,
    consensusBaseline: null,
    ...over
  };
}

function news(over: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "n1",
    source: "the-information",
    kind: "briefing",
    title: "Nvidia Wins $6 Billion Order",
    teaser: "The chipmaker signed a deal.",
    fullText: null,
    url: null,
    author: null,
    publishedUtc: "2026-08-19T14:00:00.000Z",
    updatedUtc: null,
    prefix: "none",
    fetchedAtUtc: "2026-08-19T14:05:00.000Z",
    ...over
  };
}

describe("matchUniverse", () => {
  const universe = [entry(), entry({ ticker: "ARM", company: "Arm Holdings", aliases: ["arm holdings", "arm architecture"], hlSymbol: "xyz:ARM" })];

  it("matches by alias with word boundaries", () => {
    expect(matchUniverse(news(), universe).map((u) => u.ticker)).toEqual(["NVDA"]);
  });

  it("does NOT match 'arm' as a substring of unrelated words", () => {
    const items = matchUniverse(news({ title: "Pharma company warms to new drug", teaser: "harmless farm story" }), universe);
    expect(items).toHaveLength(0);
  });

  it("matches CJK aliases by containment", () => {
    expect(matchUniverse(news({ title: "英伟达发布新芯片", teaser: "" }), universe).map((u) => u.ticker)).toEqual(["NVDA"]);
  });
});

describe("fingerprint + staleness", () => {
  const base: Gate1Output = {
    tradeable: true,
    score: 80,
    eventType: "order_contract",
    factLevel: "fact",
    tickers: ["NVDA"],
    expectedDirection: "bullish",
    coarseImpactBand: "medium",
    surpriseNote: "s",
    reason: "r",
    fingerprintEntities: ["NVDA", "OpenAI"],
    fingerprintMagnitudes: ["$6B"]
  };

  it("same entities+type+magnitudes → same fingerprint regardless of order/case", () => {
    const a = fingerprintOf(base);
    const b = fingerprintOf({ ...base, fingerprintEntities: ["openai", "nvda"], fingerprintMagnitudes: ["$6b"] });
    expect(a).toBe(b);
  });

  it("different magnitude → different fingerprint (old event, new facts)", () => {
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, fingerprintMagnitudes: ["$10B"] }));
  });

  it("tokenJaccard flags near-duplicate headlines", () => {
    expect(tokenJaccard("Nvidia Wins $6 Billion OpenAI Order", "Nvidia wins $6 billion order from OpenAI")).toBeGreaterThan(0.6);
    expect(tokenJaccard("Nvidia Wins $6 Billion OpenAI Order", "Apple launches new iPhone in India")).toBeLessThan(0.2);
  });
});

describe("reactionFraction", () => {
  it("fast event classes price in ~30min, complex ones ~4h", () => {
    expect(reactionFraction("earnings_guidance", 30)).toBe(1);
    expect(reactionFraction("supply_chain", 30)).toBeCloseTo(0.125);
    expect(reactionFraction("supply_chain", 240)).toBe(1);
  });

  it("has a floor so tiny Δt never divides by ~zero expectations", () => {
    expect(reactionFraction("mna", 0.5)).toBeGreaterThanOrEqual(0.05);
  });
});

describe("M2 blindness plumbing", () => {
  it("scrubs price-reaction sentences", () => {
    const { scrubbed, removed } = scrubPriceReactions(
      "Nvidia signed the deal. Shares jumped 7% in premarket trading after the report. The contract runs through 2028."
    );
    expect(removed).toBeGreaterThan(0);
    expect(scrubbed).not.toContain("7%");
    expect(scrubbed).toContain("The contract runs through 2028");
  });

  it("detects hard contamination in analyst output", () => {
    expect(detectContamination("the stock has already moved 5% so fair value is reached")).toBe("hard");
    expect(detectContamination("EPS revision of +4% vs consensus")).toBe("none");
  });
});
