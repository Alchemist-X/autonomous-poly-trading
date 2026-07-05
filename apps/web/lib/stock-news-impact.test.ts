import { describe, expect, it } from "vitest";
import { buildStockNewsImpactRun } from "./stock-news-impact";

const NOW = new Date("2026-07-05T12:00:00.000Z");

describe("buildStockNewsImpactRun", () => {
  it("maps AI capacity news to semis and cloud winners", () => {
    const run = buildStockNewsImpactRun({
      headline: "OpenAI signs a $40B GPU and data center capacity agreement with Microsoft, Nvidia and Oracle",
      body: "Management says Blackwell demand is running ahead of plan and cloud compute is the constraint.",
      watchlist: ["NVDA", "MSFT", "ORCL", "AMD", "AAPL"],
      locale: "en"
    }, NOW);

    expect(run.mode).toBe("demo_read_only");
    expect(run.signals.map((signal) => signal.id)).toContain("ai-capex");
    expect(new Set(run.summary.topTickers.slice(0, 3))).toEqual(new Set(["NVDA", "MSFT", "ORCL"]));
    expect(run.affectedStocks[0]?.direction).toBe("bullish");
    expect(run.affectedStocks[0]?.action).toBe("add");
  });

  it("treats direct antitrust news as bearish for the named stock", () => {
    const run = buildStockNewsImpactRun({
      headline: "DOJ files antitrust lawsuit against Apple over App Store rules",
      body: "Regulators allege Apple restricted competition and may seek conduct remedies.",
      watchlist: ["AAPL", "GOOGL", "META", "MSFT"],
      locale: "en"
    }, NOW);

    const apple = run.affectedStocks.find((stock) => stock.ticker === "AAPL");
    expect(apple).toBeDefined();
    expect(apple?.direction).toBe("bearish");
    expect(apple?.action).toBe("trim");
    expect(apple?.expectedMovePct).toBeLessThan(0);
  });

  it("falls back to a cautious watchlist report when no catalyst is recognized", () => {
    const run = buildStockNewsImpactRun({
      headline: "A small industry conference opens with no new product announcements",
      watchlist: ["NVDA", "AAPL", "JPM"],
      locale: "en"
    }, NOW);

    expect(run.signals).toHaveLength(0);
    expect(run.affectedStocks).toHaveLength(3);
    expect(run.affectedStocks.every((stock) => stock.direction === "mixed")).toBe(true);
    expect(run.affectedStocks.every((stock) => stock.action === "avoid")).toBe(true);
  });

  it("localizes generated recommendation labels", () => {
    const run = buildStockNewsImpactRun({
      headline: "OpenAI 宣布与 Microsoft、Nvidia、Oracle 签署多年 GPU 数据中心协议",
      watchlist: ["NVDA", "MSFT", "ORCL"],
      locale: "zh"
    }, NOW);

    expect(run.summary.title).toBe("新闻增量影响报告");
    expect(run.affectedStocks[0]?.directionLabel).toBe("利多");
    expect(run.affectedStocks[0]?.actionLabel).toContain("加仓");
  });
});
