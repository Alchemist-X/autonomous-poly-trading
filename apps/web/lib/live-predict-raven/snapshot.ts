// Baked snapshot of the Tokyo-VM paper-trading book (services/paper-agent).
// Source of truth: container /app/runtime-artifacts/paper-agent/{portfolio.json,
// ledger.jsonl} plus the daily reflection reports. This page is a review
// snapshot, not a live feed — refresh by re-pulling the VM artifacts and
// updating this file (see docs/agent-handoff.md for the SSH one-liners).

export interface EquityPoint {
  /** Short label, e.g. "07-14" (UTC reflection date) */
  date: string;
  equityUsd: number;
}

export type ExitReasonKind =
  | "negative_edge"
  | "stop_loss"
  | "settled_won"
  | "settled_lost"
  | "settled_voided";

export interface ClosedTrade {
  question: string;
  slug: string;
  side: "YES" | "NO";
  openedUtc: string;
  closedUtc: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  costUsd: number;
  pnlUsd: number;
  exitReason: ExitReasonKind;
  note?: string;
}

export interface OpenPosition {
  question: string;
  slug: string;
  side: "YES" | "NO";
  openedUtc: string;
  shares: number;
  entryPrice: number;
  markPrice: number;
  unrealizedUsd: number;
  agentProb: number;
  flag: "saturated" | "contaminated" | null;
  /** True when the saturated-hold guard vetoed a clamp-induced exit (PR #91). */
  saturatedHold?: boolean;
}

export interface ExitAlphaRow {
  question: string;
  side: "YES" | "NO";
  soldUtc: string;
  exitStyle: string;
  avgExitPrice: number;
  priceNow: number;
  alphaUsd: number;
  reason: string;
}

export interface BrierRow {
  question: string;
  agentProb: number;
  marketProb: number;
  happened: boolean;
  resolvedUtc: string;
}

export interface PaperSnapshot {
  generatedAtUtc: string;
  reflectionReportUtc: string;
  lastEvalCycleUtc: string;
  startedUtc: string;
  bankrollUsd: number;
  cashUsd: number;
  realizedPnlUsd: number;
  equityUsd: number;
  feesUsd: number;
  /** Ledger fill counts (one hybrid exit produces many partial fills). */
  fills: { total: number; buys: number; sells: number };
  /** One buy fill was dropped by the 2026-07-03 book-lock race (cash restored). */
  droppedBuyFills: number;
  evalCycles: number;
  /** Count of clamp-induced exits vetoed by the saturated-hold guard. */
  saturatedHolds: number;
  equityCurve: readonly EquityPoint[];
  closedTrades: readonly ClosedTrade[];
  openPositions: readonly OpenPosition[];
  exitAlpha: { totalUsd: number; rows: readonly ExitAlphaRow[] };
  brier: {
    n: number;
    agentScore: number;
    marketScore: number;
    skillScore: number;
    rows: readonly BrierRow[];
  };
  engineQuality: {
    evaluations: number;
    saturated: number;
    contaminated: number;
    evalErrors: number;
    limitOrdersPlaced: number;
    limitFills: number;
    limitVsMarketPp: number | null;
  };
}

export const PAPER_SNAPSHOT: PaperSnapshot = {
  generatedAtUtc: "2026-07-24T11:15Z",
  reflectionReportUtc: "2026-07-23T18:19Z",
  lastEvalCycleUtc: "2026-07-24T10:13Z",
  startedUtc: "2026-07-03T07:17Z",
  bankrollUsd: 10000,
  cashUsd: 6821.18,
  realizedPnlUsd: -178.82,
  equityUsd: 10406.37,
  feesUsd: 0,
  fills: { total: 32, buys: 13, sells: 19 },
  droppedBuyFills: 1,
  evalCycles: 66,
  saturatedHolds: 1,
  equityCurve: [
    { date: "07-03开盘", equityUsd: 10000 },
    { date: "07-03", equityUsd: 9995.28 },
    { date: "07-04", equityUsd: 10272.05 },
    { date: "07-05", equityUsd: 10268.78 },
    { date: "07-06", equityUsd: 10419.51 },
    { date: "07-07", equityUsd: 10512.92 },
    { date: "07-08", equityUsd: 10705.4 },
    { date: "07-09", equityUsd: 10658.26 },
    { date: "07-10", equityUsd: 10621.37 },
    { date: "07-11", equityUsd: 10502.2 },
    { date: "07-12", equityUsd: 10610.1 },
    { date: "07-13", equityUsd: 10746.49 },
    { date: "07-14", equityUsd: 10799.24 },
    { date: "07-15", equityUsd: 10448.66 },
    { date: "07-16", equityUsd: 10387.81 },
    { date: "07-17", equityUsd: 10450.87 },
    { date: "07-18", equityUsd: 10401.49 },
    { date: "07-19", equityUsd: 10433.57 },
    { date: "07-20", equityUsd: 10379.58 },
    { date: "07-21", equityUsd: 10374.44 },
    { date: "07-22", equityUsd: 10417.31 },
    { date: "07-23", equityUsd: 10440.04 },
    { date: "07-24", equityUsd: 10406.37 }
  ],
  closedTrades: [
    {
      question: "美伊 7/10 前举行外交会晤？",
      slug: "us-x-iran-diplomatic-meeting-by-july-10-2026-20260622191708360",
      side: "NO",
      openedUtc: "2026-07-03T18:16Z",
      closedUtc: "2026-07-04T02:28Z",
      entryPrice: 0.8317,
      exitPrice: 0.9765,
      shares: 601.2,
      costUsd: 500,
      pnlUsd: 87.07,
      exitReason: "negative_edge"
    },
    {
      question: "NATO 与俄罗斯年底前军事冲突？",
      slug: "nato-x-russia-military-clash-by-december-31-2026-244",
      side: "NO",
      openedUtc: "2026-07-03T18:20Z",
      closedUtc: "2026-07-05T18:18Z",
      entryPrice: 0.79,
      exitPrice: 0.82,
      shares: 632.9,
      costUsd: 500,
      pnlUsd: 18.99,
      exitReason: "negative_edge"
    },
    {
      question: "美伊 7/31 前举行外交会晤？",
      slug: "us-x-iran-diplomatic-meeting-by-july-31-2026-20260622191708361",
      side: "YES",
      openedUtc: "2026-07-04T10:21Z",
      closedUtc: "2026-07-05T22:28Z",
      entryPrice: 0.6185,
      exitPrice: 0.735,
      shares: 808.4,
      costUsd: 500,
      pnlUsd: 94.15,
      exitReason: "negative_edge",
      note: "退出后价格跌到 0.065 — 反事实检验里最赚的一次退出（α +$542）"
    },
    {
      question: "Mojtaba Khamenei 7/15 前公开露面？",
      slug: "mojtaba-khamenei-seen-in-public-by-july-15-155",
      side: "NO",
      openedUtc: "2026-07-03T07:51Z",
      closedUtc: "2026-07-15T09:54Z",
      entryPrice: 0.8556,
      exitPrice: 0.9945,
      shares: 584.4,
      costUsd: 500,
      pnlUsd: 81.17,
      exitReason: "negative_edge",
      note: "持有 12 天到临近结算；这次 0.994 卖出正是 99% 钳位强制的（saturated-hold 修复的起因）"
    },
    {
      question: "伊朗 7/17 前宣布退出 MOU 谈判？（第一次）",
      slug: "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17",
      side: "YES",
      openedUtc: "2026-07-15T10:23Z",
      closedUtc: "2026-07-15T14:04Z",
      entryPrice: 0.1448,
      exitPrice: 0.0772,
      shares: 3453.1,
      costUsd: 500,
      pnlUsd: -233.38,
      exitReason: "stop_loss",
      note: "agent 估 19.5% vs 市场 6.4%，4 小时后止损"
    },
    {
      question: "伊朗 7/17 前宣布退出 MOU 谈判？（第二次）",
      slug: "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17",
      side: "YES",
      openedUtc: "2026-07-15T18:19Z",
      closedUtc: "2026-07-16T00:14Z",
      entryPrice: 0.0744,
      exitPrice: 0.0406,
      shares: 6723.3,
      costUsd: 500,
      pnlUsd: -226.8,
      exitReason: "stop_loss",
      note: "止损 4 小时后原方向重新进场，再次止损；事件最终未发生"
    }
  ],
  openPositions: [
    {
      question: "霍尔木兹海峡 7/31 前恢复正常通航？",
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-july-31",
      side: "NO",
      openedUtc: "2026-07-03T10:12Z",
      shares: 674.2,
      entryPrice: 0.742,
      markPrice: 0.992,
      unrealizedUsd: 168.55,
      agentProb: 0.99,
      flag: "saturated",
      saturatedHold: true
    },
    {
      question: "普京 2027 年前卸任俄罗斯总统？",
      slug: "putin-out-before-2027",
      side: "NO",
      openedUtc: "2026-07-04T02:12Z",
      shares: 555.6,
      entryPrice: 0.9,
      markPrice: 0.91,
      unrealizedUsd: 5.56,
      agentProb: 0.986,
      flag: "contaminated"
    },
    {
      question: "美伊 9/30 前达成最终核协议？",
      slug: "us-iran-final-nuclear-deal-by-september-30-2026",
      side: "NO",
      openedUtc: "2026-07-05T02:20Z",
      shares: 704.2,
      entryPrice: 0.71,
      markPrice: 0.86,
      unrealizedUsd: 105.63,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "霍尔木兹海峡 12/31 前恢复正常通航？",
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-december-31",
      side: "NO",
      openedUtc: "2026-07-06T02:19Z",
      shares: 1785.7,
      entryPrice: 0.28,
      markPrice: 0.48,
      unrealizedUsd: 357.14,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "乌克兰 12/31 前收复克里米亚领土？",
      slug: "will-ukraine-recapture-crimean-territory-by-december-31-2026",
      side: "NO",
      openedUtc: "2026-07-07T02:25Z",
      shares: 555.6,
      entryPrice: 0.9,
      markPrice: 0.9,
      unrealizedUsd: 0,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "美国 2027 年前入侵伊朗？",
      slug: "will-the-us-invade-iran-before-2027",
      side: "NO",
      openedUtc: "2026-07-16T10:22Z",
      shares: 649.4,
      entryPrice: 0.77,
      markPrice: 0.69,
      unrealizedUsd: -51.95,
      agentProb: 0.93,
      flag: null
    }
  ],
  exitAlpha: {
    totalUsd: 1076.73,
    rows: [
      {
        question: "美伊 7/10 前外交会晤？",
        side: "NO",
        soldUtc: "07-04 02:06",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.977,
        priceNow: 1,
        alphaUsd: -14.13,
        reason: "负 edge 退出"
      },
      {
        question: "NATO×俄罗斯年底前冲突？",
        side: "NO",
        soldUtc: "07-05 10:08",
        exitStyle: "市价（限价超时回落）",
        avgExitPrice: 0.82,
        priceNow: 0.8,
        alphaUsd: 12.66,
        reason: "负 edge 退出+限价单超时回落"
      },
      {
        question: "美伊 7/31 前外交会晤？",
        side: "YES",
        soldUtc: "07-05 18:15",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.735,
        priceNow: 0.065,
        alphaUsd: 541.6,
        reason: "负 edge 退出"
      },
      {
        question: "Mojtaba Khamenei 7/15 前露面？",
        side: "NO",
        soldUtc: "07-15 02:04",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.995,
        priceNow: 1,
        alphaUsd: -3.21,
        reason: "负 edge 退出"
      },
      {
        question: "伊朗 7/17 前退出 MOU 谈判？（两回合合并）",
        side: "YES",
        soldUtc: "07-15 14:04",
        exitStyle: "市价",
        avgExitPrice: 0.053,
        priceNow: 0,
        alphaUsd: 539.82,
        reason: "止损"
      }
    ]
  },
  brier: {
    n: 4,
    agentScore: 0.2175,
    marketScore: 0.1882,
    skillScore: -0.16,
    rows: [
      {
        question: "伊朗 7/17 前退出 MOU 谈判？",
        agentProb: 0.195,
        marketProb: 0.064,
        happened: false,
        resolvedUtc: "2026-07-15"
      },
      {
        question: "Mojtaba Khamenei 7/15 前露面？",
        agentProb: 0.99,
        marketProb: 0.994,
        happened: true,
        resolvedUtc: "2026-07-15"
      },
      {
        question: "中菲 2027 前军事冲突？",
        agentProb: 0.088,
        marketProb: 0.135,
        happened: true,
        resolvedUtc: "2026-07-07"
      },
      {
        question: "美伊 7/10 前外交会晤？",
        agentProb: 0.976,
        marketProb: 0.976,
        happened: true,
        resolvedUtc: "2026-07-04"
      }
    ]
  },
  // Ledger-count basis (same basis the live endpoint uses, so live and
  // fallback never disagree on the counting method).
  engineQuality: {
    evaluations: 351,
    saturated: 200,
    contaminated: 50,
    evalErrors: 9,
    limitOrdersPlaced: 4,
    limitFills: 12,
    limitVsMarketPp: 0.46
  }
};
