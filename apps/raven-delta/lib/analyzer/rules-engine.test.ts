import { describe, expect, it } from "vitest";
import { deltaAnalysisSchema, newsInputSchema, type DeltaAnalysis, type NewsInput } from "./schema";
import { findStock } from "./universe";
import {
  actionFor,
  attentionScore,
  confidenceFor,
  detectSignals,
  directionFor,
  expectedMoveRange,
  magnitudeFor,
  normalizeText,
  runRulesAnalysis,
  scoreStock
} from "./rules-engine";

const NOW_ISO = "2026-07-05T12:00:00.000Z";

function makeNews(input: Partial<NewsInput> & { headline: string }): NewsInput {
  return newsInputSchema.parse(input);
}

function expectParses(analysis: DeltaAnalysis): void {
  expect(() => deltaAnalysisSchema.parse(analysis)).not.toThrow();
}

describe("runRulesAnalysis", () => {
  it("maps an AI-capex headline to semis and cloud winners", () => {
    const news = makeNews({
      headline: "OpenAI signs a $40B GPU and data center capacity agreement with Microsoft, Nvidia and Oracle",
      body: "Management says Blackwell demand is running ahead of plan and cloud compute is the constraint."
    });
    const analysis = runRulesAnalysis(news, NOW_ISO);
    expectParses(analysis);

    const text = normalizeText(`${news.headline} ${news.body}`);
    const signalIds = detectSignals(text, "en").map((signal) => signal.id);
    expect(signalIds).toContain("ai-capex");

    expect(analysis.attention.worthAttention).toBe(true);
    expect(analysis.impactedStocks.length).toBeLessThanOrEqual(5);
    const nvda = analysis.impactedStocks.find((stock) => stock.ticker === "NVDA");
    expect(nvda).toBeDefined();
    expect(nvda?.direction).toBe("bullish");
    expect(nvda?.action).toBe("add");
    expect(nvda?.inUniverse).toBe(true);
  });

  it("treats direct antitrust news as bearish trim for the named stock", () => {
    const analysis = runRulesAnalysis(
      makeNews({
        headline: "DOJ files antitrust lawsuit against Apple over App Store rules",
        body: "Regulators allege Apple restricted competition and may seek conduct remedies."
      }),
      NOW_ISO
    );
    expectParses(analysis);

    const apple = analysis.impactedStocks.find((stock) => stock.ticker === "AAPL");
    expect(apple).toBeDefined();
    expect(apple?.direction).toBe("bearish");
    expect(apple?.action).toBe("trim");
    expect(apple?.expectedMovePct.min).toBeLessThan(0);
    expect(apple?.expectedMovePct.max).toBeLessThan(0);
    expect(apple?.expectedMovePct.min).toBeLessThanOrEqual(apple?.expectedMovePct.max ?? 0);
  });

  it("returns an honest empty result when no catalyst is recognized (#31)", () => {
    const analysis = runRulesAnalysis(
      makeNews({ headline: "A small industry conference opens with no new product announcements" }),
      NOW_ISO
    );
    expectParses(analysis);

    expect(analysis.impactedStocks).toEqual([]);
    expect(analysis.attention.worthAttention).toBe(false);
    expect(analysis.attention.score).toBe(0);
    expect(analysis.attention.verdict).toContain("No recognized catalyst");
    expect(analysis.attention.verdict).not.toContain("highest-impact");
  });

  it("localizes all human-readable strings for zh locale", () => {
    const analysis = runRulesAnalysis(
      makeNews({
        headline: "OpenAI 宣布与 Microsoft、Nvidia、Oracle 签署多年 GPU 数据中心协议",
        locale: "zh"
      }),
      NOW_ISO
    );
    expectParses(analysis);

    expect(analysis.attention.newsType).toBe("AI 资本开支需求");
    expect(analysis.attention.verdict).toContain("利多");
    expect(analysis.attention.credibilityNote).toContain("未核实");
    const nvda = analysis.impactedStocks.find((stock) => stock.ticker === "NVDA");
    expect(nvda).toBeDefined();
    expect(nvda?.company).toBe("英伟达");
    expect(nvda?.horizon).toBe("1-5 个交易日");
    expect(nvda?.reasoning).toContain("利多");
  });

  it("fires only hawkish-rates on a hot-CPI headline, banks not bearish (#7)", () => {
    const news = makeNews({
      headline: "美国 CPI 数据显示通胀超预期，美联储或再度加息",
      locale: "zh"
    });
    const text = normalizeText(news.headline);
    const signals = detectSignals(text, "zh");
    expect(signals.map((signal) => signal.id)).toEqual(["hawkish-rates"]);

    const jpm = findStock("JPM");
    const bac = findStock("BAC");
    expect(jpm).not.toBeNull();
    expect(bac).not.toBeNull();
    if (!jpm || !bac) return;
    const jpmScored = scoreStock(text, signals, jpm);
    const bacScored = scoreStock(text, signals, bac);
    expect(jpmScored.score).toBeGreaterThan(0);
    expect(bacScored.score).toBeGreaterThan(0);
    expect(["bullish", "mixed"]).toContain(directionFor(jpmScored.score));
    expect(["bullish", "mixed"]).toContain(directionFor(bacScored.score));

    const analysis = runRulesAnalysis(news, NOW_ISO);
    expectParses(analysis);
    const banks = analysis.impactedStocks.filter((stock) => ["JPM", "BAC"].includes(stock.ticker));
    expect(banks.every((stock) => stock.direction !== "bearish")).toBe(true);
    expect(analysis.impactedStocks.every((stock) => !stock.evidence.some((entry) => entry.point.includes("盈利预期上修")))).toBe(
      true
    );
  });

  it("marks oil names as sector exposure without direct-mention evidence (#12)", () => {
    const news = makeNews({ headline: "Oil supply shock as OPEC cuts output" });
    const analysis = runRulesAnalysis(news, NOW_ISO);
    expectParses(analysis);

    const xom = analysis.impactedStocks.find((stock) => stock.ticker === "XOM");
    const cvx = analysis.impactedStocks.find((stock) => stock.ticker === "CVX");
    expect(xom).toBeDefined();
    expect(cvx).toBeDefined();
    expect(xom?.direction).toBe("bullish");
    expect(cvx?.direction).toBe("bullish");
    for (const stock of [xom, cvx]) {
      expect(stock?.evidence.some((entry) => entry.point.includes("Direct mention"))).toBe(false);
      expect(stock?.evidence.some((entry) => entry.point.includes("Sector exposure only"))).toBe(true);
    }

    const text = normalizeText(news.headline);
    const signals = detectSignals(text, "en");
    const exxon = findStock("XOM");
    expect(exxon).not.toBeNull();
    if (!exxon) return;
    expect(scoreStock(text, signals, exxon).directHits).toEqual([]);
  });

  it("produces a Chinese identity direct hit via universe aliases (#35)", () => {
    const analysis = runRulesAnalysis(
      makeNews({ headline: "监管机构对苹果公司发起反垄断调查", locale: "zh" }),
      NOW_ISO
    );
    expectParses(analysis);

    const apple = analysis.impactedStocks.find((stock) => stock.ticker === "AAPL");
    expect(apple).toBeDefined();
    expect(apple?.direction).toBe("bearish");
    const directEvidence = apple?.evidence.find((entry) => entry.point.includes("直接命中"));
    expect(directEvidence).toBeDefined();
    expect(directEvidence?.point).toContain("苹果");
  });
});

describe("threshold helpers (#36)", () => {
  it("classifies direction at the +/-0.45 boundary", () => {
    expect(directionFor(0.45)).toBe("bullish");
    expect(directionFor(0.44)).toBe("mixed");
    expect(directionFor(0)).toBe("mixed");
    expect(directionFor(-0.44)).toBe("mixed");
    expect(directionFor(-0.45)).toBe("bearish");
  });

  it("walks the action ladder thresholds", () => {
    expect(actionFor(3.1, false)).toBe("add");
    expect(actionFor(3.09, false)).toBe("watch");
    expect(actionFor(0.65, false)).toBe("watch");
    expect(actionFor(0.64, false)).toBe("avoid");
    expect(actionFor(-0.99, false)).toBe("avoid");
    expect(actionFor(-1.0, false)).toBe("hedge");
    expect(actionFor(-3.1, true)).toBe("trim");
    expect(actionFor(-3.1, false)).toBe("hedge");
  });

  it("classifies magnitude bands", () => {
    expect(magnitudeFor(3)).toBe("large");
    expect(magnitudeFor(-3)).toBe("large");
    expect(magnitudeFor(2.99)).toBe("medium");
    expect(magnitudeFor(1.2)).toBe("medium");
    expect(magnitudeFor(1.19)).toBe("small");
  });

  it("classifies confidence from score, signal count, and direct hits", () => {
    expect(confidenceFor(3, 2, false)).toBe("high");
    expect(confidenceFor(-3, 2, false)).toBe("high");
    expect(confidenceFor(3, 1, false)).toBe("medium");
    expect(confidenceFor(0.5, 1, true)).toBe("medium");
    expect(confidenceFor(0.5, 1, false)).toBe("low");
  });

  it("derives the expected-move range around the clamped point estimate", () => {
    expect(expectedMoveRange(2)).toEqual({ min: 1.4, max: 3.2 });
    expect(expectedMoveRange(-2)).toEqual({ min: -3.2, max: -1.4 });
    expect(expectedMoveRange(10)).toEqual({ min: 5.4, max: 12.6 });
    expect(expectedMoveRange(-10)).toEqual({ min: -12.6, max: -5.4 });
    expect(expectedMoveRange(0)).toEqual({ min: 0, max: 0 });
  });

  it("clamps the attention score to 0-100", () => {
    expect(attentionScore(0, 0)).toBe(0);
    expect(attentionScore(2, 1)).toBe(44);
    expect(attentionScore(8, 3)).toBe(100);
  });
});
