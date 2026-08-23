import { describe, expect, it } from "vitest";
import type { NewsItem, PriorCoverage, UniverseEntry } from "@autopoly/delta-pm-contracts";
import {
  buildSignal,
  findStaleDuplicate,
  fingerprintOf,
  formatCoverageForPrompt,
  gate1Rules,
  matchUniverse,
  reactionFraction,
  tokenJaccard,
  type Gate1Output
} from "./gate.js";
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

  it("matches companies named only in pasted full text (paste-path fix)", () => {
    const pasted = news({ title: "The AI Deal Everyone Missed", teaser: "", fullText: "Deep in the story: Nvidia is the counterparty." });
    expect(matchUniverse(pasted, universe).map((u) => u.ticker)).toEqual(["NVDA"]);
  });
});

describe("gate1Rules — importance judgment (rules fallback)", () => {
  const universe = [entry()];

  it("classifies hard-news categories as tradeable when a universe name is hit", () => {
    const cases: Array<[string, Gate1Output["eventType"]]> = [
      ["Nvidia raises quarterly revenue guidance", "earnings_guidance"],
      ["Nvidia to buy AI startup in $2B takeover", "mna"],
      ["Nvidia signs supply deal with OpenAI", "order_contract"],
      ["Regulator opens antitrust probe into Nvidia", "regulatory_legal"]
    ];
    for (const [title, expected] of cases) {
      const out = gate1Rules(news({ title, teaser: "" }), universe);
      expect(out.tradeable, title).toBe(true);
      expect(out.eventType, title).toBe(expected);
    }
  });

  it("management changes classify as management", () => {
    const out = gate1Rules(news({ title: "Nvidia CFO steps down", teaser: "" }), universe);
    expect(out.eventType).toBe("management");
    expect(out.tradeable).toBe(true);
  });

  it("is NOT tradeable without a universe match, whatever the category", () => {
    const out = gate1Rules(news({ title: "Acme Corp wins $6 billion order" }), []);
    expect(out.tradeable).toBe(false);
  });

  it("untyped chatter is not tradeable", () => {
    const out = gate1Rules(news({ title: "Why Nvidia's culture fascinates Silicon Valley", teaser: "an essay" }), universe);
    expect(out.tradeable).toBe(false);
  });

  it("hedged wording downgrades factLevel to forecast", () => {
    const out = gate1Rules(news({ title: "Nvidia reportedly considering $6B order", teaser: "" }), universe);
    expect(out.factLevel).toBe("forecast");
  });

  it("reads pasted full text, not just the teaser", () => {
    const out = gate1Rules(
      news({ title: "The deal nobody saw coming", teaser: "", fullText: "Nvidia signed a supply deal worth $6 billion." }),
      universe
    );
    expect(out.tradeable).toBe(true);
    expect(out.eventType).toBe("order_contract");
  });
});

describe("findStaleDuplicate — rerun-aware staleness", () => {
  const recent = [
    { signalId: "sig-a", fingerprint: "fp1", newsId: "news-1", title: "Nvidia Wins $6 Billion OpenAI Order" },
    { signalId: "sig-b", fingerprint: "fp2", newsId: "news-2", title: "Apple launches new iPhone in India" }
  ];

  it("same fingerprint from a DIFFERENT news id → stale", () => {
    const hit = findStaleDuplicate(recent, "fp1", { id: "news-9", title: "totally different headline" });
    expect(hit?.dup.signalId).toBe("sig-a");
    expect(hit?.basis).toBe("fingerprint");
  });

  it("near-identical headline from a different news id → stale", () => {
    const hit = findStaleDuplicate(recent, "fp-new", { id: "news-9", title: "Nvidia wins $6 billion order from OpenAI" });
    expect(hit?.dup.signalId).toBe("sig-a");
    expect(hit?.basis).toBe("similar_text");
  });

  it("SAME news id never collides with its own earlier signal (paste rerun)", () => {
    const hit = findStaleDuplicate(recent, "fp1", { id: "news-1", title: "Nvidia Wins $6 Billion OpenAI Order" });
    expect(hit).toBeNull();
  });
});

describe("prior coverage → gate prompt + signal firstSeen", () => {
  const coverageHit = {
    title: "Nvidia nears $6B cloud deal",
    url: "https://reuters.com/a",
    domain: "reuters.com",
    publishedUtc: "2026-08-23T05:00:00.000Z",
    titleSimilarity: 0.71
  };

  function coverage(over: Partial<PriorCoverage> = {}): PriorCoverage {
    return {
      searched: true,
      skippedReason: null,
      error: null,
      query: "q",
      priorHitCount: 1,
      earliestPriorUtc: "2026-08-23T05:00:00.000Z",
      hits: [coverageHit],
      ...over
    };
  }

  const g1: Gate1Output = {
    tradeable: true,
    score: 80,
    eventType: "order_contract",
    factLevel: "fact",
    tickers: ["NVDA"],
    expectedDirection: "bullish",
    coarseImpactBand: "medium",
    surpriseNote: "s",
    reason: "r",
    fingerprintEntities: ["NVDA"],
    fingerprintMagnitudes: ["$6B"]
  };

  it("a skipped search reads as 'DID NOT RUN', never as 'no prior coverage'", () => {
    const text = formatCoverageForPrompt(coverage({ searched: false, skippedReason: "no key", hits: [], priorHitCount: 0, earliestPriorUtc: null }));
    expect(text).toContain("DID NOT RUN");
    expect(text).not.toContain("no other outlet");
  });

  it("hits render with date + domain + similarity for the LLM to weigh", () => {
    const text = formatCoverageForPrompt(coverage());
    expect(text).toContain("reuters.com");
    expect(text).toContain("2026-08-23T05:00:00.000Z");
    expect(text).toContain("1 hit(s) predate");
  });

  it("buildSignal uses the earliest verified prior appearance as firstSeen", () => {
    const sig = buildSignal(news({ publishedUtc: "2026-08-23T08:00:00.000Z" }), g1, "fp", null, null, coverage());
    expect(sig.firstSeenUtc).toBe("2026-08-23T05:00:00.000Z");
    expect(sig.firstSeenBasis).toContain("coverage search");
    expect(sig.priorCoverage?.priorHitCount).toBe(1);
  });

  it("'reportedly' with a clean search keeps null firstSeen but upgrades the basis", () => {
    const sig = buildSignal(
      news({ prefix: "reportedly" }),
      g1,
      "fp",
      null,
      null,
      coverage({ priorHitCount: 0, earliestPriorUtc: null, hits: [] })
    );
    expect(sig.firstSeenUtc).toBeNull();
    expect(sig.firstSeenBasis).toContain("no earlier appearance");
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
    expect(detectContamination("shares are already up 3.2% which captures most of this")).toBe("hard");
    expect(detectContamination("EPS revision of +4% vs consensus")).toBe("none");
  });

  it("product-price wording + expectations haircut is NOT contamination (live false positive #2, 2026-08-24)", () => {
    expect(
      detectContamination(
        "costs that could partially offset the price increase The 'already priced in' haircut (55-60%) is a subjective judgment given no visible consensus"
      )
    ).toBe("none");
    // The real price channel still trips.
    expect(detectContamination("the market has already priced this move")).toBe("hard");
  });

  it("expectations-channel language is NOT contamination (live false positive 2026-08-22)", () => {
    expect(
      detectContamination("Cannot cleanly separate 'genuinely incremental' from 'already priced' without the actual sell-side consensus model")
    ).toBe("none");
    expect(detectContamination("a premium is likely already priced into consensus estimates")).toBe("none");
  });
});
