import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./polymarket", () => ({
  fetchMarket: vi.fn(),
  fetchBook: vi.fn(),
  fetchPriceHistory: vi.fn()
}));
vi.mock("./store", () => ({
  readLedger: vi.fn(),
  reportsDir: vi.fn(() => "/tmp/paper-agent-reports")
}));
vi.mock("./portfolio", () => ({
  loadPortfolio: vi.fn()
}));

import { fetchBook, fetchMarket, fetchPriceHistory, type MarketInfo } from "./polymarket";
import { loadPortfolio, type PaperPosition, type Portfolio } from "./portfolio";
import { readLedger } from "./store";
import { buildReflection, renderReflectionMd } from "./reflect";

type LedgerRow = Record<string, unknown>;

const market = (over: Partial<MarketInfo> = {}): MarketInfo => ({
  slug: "m",
  conditionId: "c",
  question: "Q?",
  description: "",
  endDateIso: null,
  closed: false,
  negRisk: false,
  outcomes: ["Yes", "No"],
  tokenIds: ["t0", "t1"],
  outcomePrices: null,
  resolvedOutcomeIndex: null,
  resolution: "open",
  eventSlug: "m",
  eventId: null,
  category: null,
  tags: [],
  ...over
});

const portfolio = (over: Partial<Portfolio> = {}): Portfolio => ({
  createdAtUtc: "2026-07-01T00:00:00.000Z",
  bankrollUsd: 10000,
  cashUsd: 10000,
  positions: [],
  restingLimits: [],
  realizedPnlUsd: 0,
  totalFeesUsd: 0,
  ...over
});

const position = (over: Partial<PaperPosition> = {}): PaperPosition => ({
  id: "m:1",
  slug: "m",
  eventSlug: "m",
  conditionId: "c",
  question: "Will X happen?",
  outcomeIndex: 1,
  outcomeLabel: "No",
  tokenId: "t1",
  shares: 100,
  avgEntryPrice: 0.8,
  entryFeePerShare: 0,
  openedAtUtc: "2026-07-01T00:00:00.000Z",
  fees: { takerBps: 0, makerBps: 0, tickSize: 0.01, feeRate: 0, category: null, rateSource: "clob_fee_free" },
  ...over
});

// Two resolved position units + one resolved watchlist unit (see brier test).
const calibrationLedger: LedgerRow[] = [
  {
    ts: "2026-07-01T00:00:00.000Z",
    type: "evaluation",
    positionId: "m-a:1",
    slug: "m-a",
    outcome: "No",
    agentProbOutcome: 0.9,
    probYes: 0.1,
    bestBid: 0.8,
    saturatedAt: "ceil"
  },
  {
    ts: "2026-07-01T01:00:00.000Z",
    type: "evaluation",
    positionId: "m-b:0",
    slug: "m-b",
    outcome: "Yes",
    agentProbOutcome: 0.7,
    probYes: 0.7,
    bestBid: 0.6
  },
  {
    ts: "2026-07-01T02:00:00.000Z",
    type: "watchlist_eval",
    slug: "m-c",
    probYes: 0.2,
    marketProbYes: 0.3,
    outcomeIndex: 1,
    enter: false
  },
  { ts: "2026-07-02T00:00:00.000Z", type: "resolution", positionId: "m-a:1", slug: "m-a", kind: "won" },
  { ts: "2026-07-02T00:00:00.000Z", type: "resolution", positionId: "m-b:0", slug: "m-b", kind: "lost" }
];

// One hybrid exit: market half + limit half + a ttl-fallback leg on the SAME
// position, plus a lone (unpaired) limit fill on another position.
const hybridLedger: LedgerRow[] = [
  {
    ts: "2026-07-04T02:06:00.000Z",
    type: "limit_placed",
    positionId: "p:1",
    slug: "p",
    limitId: "L1",
    shares: 300,
    limitPrice: 0.977,
    reason: "negative_edge"
  },
  {
    ts: "2026-07-04T02:06:00.000Z",
    type: "trade",
    side: "sell",
    style: "market",
    positionId: "p:1",
    slug: "p",
    outcome: "No",
    shares: 300,
    avgPrice: 0.976,
    feeUsd: 0,
    reason: "negative_edge"
  },
  {
    ts: "2026-07-04T02:28:00.000Z",
    type: "trade",
    side: "sell",
    style: "limit",
    positionId: "p:1",
    slug: "p",
    outcome: "No",
    shares: 300,
    avgPrice: 0.977,
    feeUsd: 0,
    reason: "negative_edge"
  },
  {
    ts: "2026-07-04T10:06:00.000Z",
    type: "trade",
    side: "sell",
    style: "market",
    positionId: "p:1",
    slug: "p",
    outcome: "No",
    shares: 100,
    avgPrice: 0.96,
    feeUsd: 0,
    reason: "negative_edge:limit_ttl_fallback"
  },
  {
    ts: "2026-07-04T12:00:00.000Z",
    type: "trade",
    side: "sell",
    style: "limit",
    positionId: "q:0",
    slug: "q",
    outcome: "Yes",
    shares: 50,
    avgPrice: 0.5,
    feeUsd: 0,
    reason: "negative_edge"
  }
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readLedger).mockReturnValue([]);
  vi.mocked(loadPortfolio).mockReturnValue(portfolio());
  vi.mocked(fetchMarket).mockImplementation(async (slug: string) => market({ slug, question: `Q:${slug}` }));
  vi.mocked(fetchBook).mockResolvedValue({ bids: [], asks: [] });
  vi.mocked(fetchPriceHistory).mockResolvedValue([]);
});

describe("engineFlags saturated holds", () => {
  it("counts clamp-vetoed holds separately from plain saturation and renders them", async () => {
    vi.mocked(readLedger).mockReturnValue([
      ...calibrationLedger,
      {
        ts: "2026-07-01T03:00:00.000Z",
        type: "evaluation",
        positionId: "m-d:1",
        slug: "m-d",
        outcome: "No",
        agentProbOutcome: 0.99,
        probYes: 0.01,
        bestBid: 0.994,
        saturatedAt: "floor",
        saturatedHold: true,
        action: "hold"
      }
    ]);
    vi.mocked(fetchMarket).mockImplementation(async (slug: string) => market({ slug, question: `Q:${slug}` }));

    const r = await buildReflection();
    expect(r.engineFlags.saturatedHolds).toBe(1);
    expect(r.engineFlags.saturated).toBe(2); // m-a (ceil) + m-d (floor)
    expect(renderReflectionMd(r)).toContain("1 次饱和持有");
  });
});

describe("calibration (Brier skill score vs market)", () => {
  it("scores every resolved unit: ledgered positions + fetched watchlist", async () => {
    vi.mocked(readLedger).mockReturnValue(calibrationLedger);
    vi.mocked(fetchMarket).mockImplementation(async (slug: string) => {
      if (slug === "m-c") {
        return market({ slug, closed: true, resolution: "resolved", resolvedOutcomeIndex: 1, question: "Q:m-c" });
      }
      return market({ slug, question: `Q:${slug}` });
    });

    const r = await buildReflection();

    // Hand-computed:
    //  m-a:1 held NO, kind won → outcome 1: agent (0.9−1)²=0.01, market (0.8−1)²=0.04
    //  m-b:0 held YES, kind lost → outcome 0: agent 0.7²=0.49, market 0.6²=0.36
    //  wl:m-c scored on YES, winner idx 1 → outcome 0: agent 0.2²=0.04, market 0.3²=0.09
    expect(r.calibration.n).toBe(3);
    expect(r.calibration.brierAgent).toBeCloseTo(0.54 / 3, 10);
    expect(r.calibration.brierMarket).toBeCloseTo(0.49 / 3, 10);
    expect(r.calibration.skill).toBeCloseTo(1 - 0.54 / 0.49, 10);
    // Rows are most recent first and labelled with the market question.
    expect(r.calibration.rows).toHaveLength(3);
    expect(r.calibration.rows[0]).toMatchObject({ label: "Q:m-c", agentProb: 0.2, marketProb: 0.3, outcome: 0 });
  });

  it("excludes a unit without a market prob from BOTH means (paired)", async () => {
    vi.mocked(readLedger).mockReturnValue([
      {
        ts: "2026-07-01T00:00:00.000Z",
        type: "evaluation",
        positionId: "m-a:1",
        slug: "m-a",
        agentProbOutcome: 0.9,
        bestBid: 0.8
      },
      // Old-format watchlist eval: no marketProbYes → not scoreable even
      // though the market has resolved.
      { ts: "2026-07-01T01:00:00.000Z", type: "watchlist_eval", slug: "m-x", probYes: 0.4, outcomeIndex: 0, enter: false },
      { ts: "2026-07-02T00:00:00.000Z", type: "resolution", positionId: "m-a:1", slug: "m-a", kind: "won" }
    ]);
    vi.mocked(fetchMarket).mockImplementation(async (slug: string) =>
      market({ slug, closed: true, resolution: "resolved", resolvedOutcomeIndex: 0, question: `Q:${slug}` })
    );

    const r = await buildReflection();

    expect(r.calibration.n).toBe(1);
    expect(r.calibration.brierAgent).toBeCloseTo(0.01, 10);
    expect(r.calibration.brierMarket).toBeCloseTo(0.04, 10);
    expect(r.calibration.skill).toBeCloseTo(0.75, 10);
  });

  it("skips a unit whose market lookup fails instead of failing the report", async () => {
    vi.mocked(readLedger).mockReturnValue([
      { ts: "2026-07-01T00:00:00.000Z", type: "watchlist_eval", slug: "m-dead", probYes: 0.4, marketProbYes: 0.5, outcomeIndex: 0, enter: false }
    ]);
    vi.mocked(fetchMarket).mockRejectedValue(new Error("gone"));

    const r = await buildReflection();

    expect(r.calibration.n).toBe(0);
    expect(r.calibration.brierAgent).toBeNull();
  });
});

describe("hybrid execution (same-exit pairing)", () => {
  it("pairs limit vs market on the SAME position; ttl-fallback is not a limit fill", async () => {
    vi.mocked(readLedger).mockReturnValue(hybridLedger);

    const r = await buildReflection();

    // Pair on p:1 only: limit 300 @ 0.977 vs market 300 @ 0.976 → +0.1pp.
    // The 0.96 ttl-fallback leg and the unpaired q:0 fill contribute nothing.
    expect(r.hybrid.limitImprovementPp).toBeCloseTo(0.1, 6);
    expect(r.hybrid.avgLimitPrice).toBeCloseTo(0.977, 10);
    expect(r.hybrid.avgMarketPrice).toBeCloseTo(0.976, 10);
    expect(r.hybrid.limitPlaced).toBe(1);
    expect(r.hybrid.limitFilled).toBe(2); // fill events, as before
  });

  it("merges the market+limit halves of one exit episode into a single row", async () => {
    vi.mocked(readLedger).mockReturnValue(hybridLedger);

    const r = await buildReflection();

    const merged = r.exits.find((e) => e.positionId === "p:1");
    expect(r.exits).toHaveLength(2); // p:1 episode + q:0 episode
    expect(merged).toMatchObject({
      style: "market+limit",
      legs: 3,
      direction: "NO",
      reason: "negative_edge+limit_ttl_fallback",
      question: "Q:p"
    });
    expect(merged?.shares).toBeCloseTo(700, 10);
    // Share-weighted avg exit: (300×0.976 + 300×0.977 + 100×0.96) / 700
    expect(merged?.exitPrice).toBeCloseTo(681.9 / 700, 10);
  });
});

describe("renderReflectionMd", () => {
  it("renders skill line, positions snapshot flags, merged exits and engine quality", async () => {
    vi.mocked(readLedger).mockReturnValue([...calibrationLedger, ...hybridLedger]);
    vi.mocked(fetchMarket).mockImplementation(async (slug: string) => {
      if (slug === "m-c") {
        return market({ slug, closed: true, resolution: "resolved", resolvedOutcomeIndex: 1, question: "Q:m-c" });
      }
      return market({ slug, question: `Q:${slug}` });
    });
    vi.mocked(loadPortfolio).mockReturnValue(
      portfolio({
        cashUsd: 7700.2,
        positions: [
          position({
            lastEval: {
              ts: "2026-07-06T10:00:00.000Z",
              agentProb: 0.99,
              mark: 0.85,
              netEdgePp: 14.0,
              decision: "hold",
              forecastId: "f1",
              saturatedAt: "ceil"
            }
          })
        ]
      })
    );

    const md = renderReflectionMd(await buildReflection());

    expect(md).toContain("## 校准 Calibration (Brier)");
    expect(md).toContain("skill score");
    expect(md).toContain("（>0 = 跑赢市场）");
    expect(md).toContain("⚠饱和");
    expect(md).toContain("Will X happen?");
    expect(md).toContain("+$5.00"); // 100 × (0.85 − 0.80) unrealized
    expect(md).toContain("market+limit 两腿");
    expect(md).toContain("负edge退出+限价单超时回落");
    expect(md).toContain("引擎质量：3 次评估中 1 次饱和、0 次检测到市场价格污染");
    expect(md).toContain("_模拟盘——无真实订单。费用按仓库校准的分类费率模型计。_");
  });

  it("renders the honest n=0 line on an empty book", async () => {
    const md = renderReflectionMd(await buildReflection());

    expect(md).toContain("尚无已结算市场，Brier 暂不可计。");
    expect(md).toContain("当前无持仓。");
    expect(md).toContain("尚无退出。");
    expect(md).not.toContain("引擎质量"); // no evals, no flag fields
  });
});
