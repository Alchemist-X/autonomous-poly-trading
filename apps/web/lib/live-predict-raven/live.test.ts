import { describe, expect, it } from "vitest";
import { parseLivePayload } from "./live";

const validPayload = {
  generatedAtUtc: "2026-07-24T10:30:00.000Z",
  startedUtc: "2026-07-03T07:17:40.520Z",
  lastEvalCycleUtc: "2026-07-24T10:13:00.000Z",
  reflectionReportUtc: "2026-07-23T18:19:00.000Z",
  bankrollUsd: 10000,
  cashUsd: 6821.18,
  realizedPnlUsd: -178.82,
  feesUsd: 0,
  equityUsd: 10406.37,
  fills: { total: 32, buys: 13, sells: 19 },
  droppedBuyFills: 1,
  evalCycles: 66,
  saturatedHolds: 1,
  engineQuality: {
    evaluations: 377,
    saturated: 192,
    contaminated: 48,
    evalErrors: 9,
    limitOrdersPlaced: 4,
    limitFills: 12,
    limitVsMarketPp: 0.46
  },
  equityCurve: [
    { date: "起点", equityUsd: 10000 },
    { date: "07-23", equityUsd: 10440.04 },
    { date: "现在", equityUsd: 10406.37 }
  ],
  openPositions: [
    {
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-july-31",
      question: "Strait of Hormuz traffic returns to normal by July 31?",
      side: "No",
      openedUtc: "2026-07-03T10:12:00.000Z",
      shares: 674.17,
      entryPrice: 0.7417,
      markPrice: 0.992,
      unrealizedUsd: 168.77,
      agentProb: 0.99,
      lastEvalUtc: "2026-07-24T10:02:34.807Z",
      flag: "saturated",
      saturatedHold: true
    }
  ],
  closedTrades: [
    {
      slug: "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17",
      positionId: "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17:0",
      side: "Yes",
      openedUtc: "2026-07-15T10:23:17.693Z",
      closedUtc: "2026-07-15T14:04:26.466Z",
      entryPrice: 0.1448,
      exitPrice: 0.0772,
      shares: 3453.06,
      costUsd: 500,
      pnlUsd: -233.38,
      exitReason: "stop_loss"
    }
  ],
  exitAlpha: {
    totalUsd: 1076.73,
    rows: [
      {
        question: "NATO x Russia military clash by December 31, 2026?",
        side: "No",
        soldUtc: "2026-07-05T10:08:43.328Z",
        exitStyle: "market",
        avgExitPrice: 0.82,
        priceNow: 0.8,
        alphaUsd: 12.66,
        reason: "negative_edge+limit_ttl_fallback"
      }
    ]
  },
  brier: {
    n: 4,
    agentScore: 0.2175,
    marketScore: 0.1882,
    skillScore: -0.156,
    rows: [
      {
        question: "China x Philippines military clash before 2027?",
        agentProb: 0.088,
        marketProb: 0.135,
        happened: true,
        resolvedUtc: "2026-07-07"
      }
    ]
  }
};

describe("parseLivePayload", () => {
  it("decodes a valid payload and decorates with Chinese labels", () => {
    const s = parseLivePayload(validPayload);
    expect(s).not.toBeNull();
    expect(s?.equityUsd).toBe(10406.37);
    expect(s?.saturatedHolds).toBe(1);
    expect(s?.openPositions[0]?.question).toBe("霍尔木兹海峡 7/31 前恢复正常通航？");
    expect(s?.openPositions[0]?.saturatedHold).toBe(true);
    expect(s?.closedTrades[0]?.question).toBe("伊朗 7/17 前宣布退出 MOU 谈判？");
    expect(s?.closedTrades[0]?.side).toBe("YES");
    expect(s?.closedTrades[0]?.note).toContain("19.5%");
    expect(s?.exitAlpha.rows[0]?.reason).toBe("负 edge 退出+限价单超时回落");
    expect(s?.exitAlpha.rows[0]?.soldUtc).toBe("07-05 10:08");
    expect(s?.brier.rows[0]?.question).toBe("中菲 2027 前军事冲突？");
  });

  it("keeps unknown market labels readable via fallback", () => {
    const s = parseLivePayload({
      ...validPayload,
      openPositions: [
        { ...validPayload.openPositions[0], slug: "some-new-market", question: "Some new market?" }
      ]
    });
    expect(s?.openPositions[0]?.question).toBe("Some new market?");
  });

  it("rejects payloads missing headline numbers or a usable curve", () => {
    expect(parseLivePayload(null)).toBeNull();
    expect(parseLivePayload({})).toBeNull();
    expect(parseLivePayload({ ...validPayload, equityUsd: "oops" })).toBeNull();
    expect(parseLivePayload({ ...validPayload, bankrollUsd: 0 })).toBeNull();
    expect(parseLivePayload({ ...validPayload, equityCurve: [] })).toBeNull();
  });

  it("drops malformed rows instead of failing the whole payload", () => {
    const s = parseLivePayload({
      ...validPayload,
      openPositions: [...validPayload.openPositions, { slug: "broken" }],
      closedTrades: [...validPayload.closedTrades, { shares: "NaN" }]
    });
    expect(s?.openPositions).toHaveLength(1);
    expect(s?.closedTrades).toHaveLength(1);
  });

  it("tolerates a null hybrid metric", () => {
    const s = parseLivePayload({
      ...validPayload,
      engineQuality: { ...validPayload.engineQuality, limitVsMarketPp: null }
    });
    expect(s?.engineQuality.limitVsMarketPp).toBeNull();
  });
});
