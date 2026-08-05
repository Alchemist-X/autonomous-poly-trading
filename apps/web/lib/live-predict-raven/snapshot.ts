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

export interface PaperParams {
  bankrollUsd: number;
  evalTimesUtc: string[];
  entryNotionalUsd: number;
  entryEdgePp: number;
  exitEdgePp: number;
  stopLossPct: number;
  maxPositions: number;
  maxPerEvent: number;
  maxEvalsPerCycle: number;
  evalMaxRounds: number;
  evalProvider: string;
  categories: string[];
  scanMinLiquidityUsd: number;
  scanMinVolume24hUsd: number;
  scanPerCategory: number;
  hybridMarketRatio: number;
  limitTtlHours: number;
  fillCheckMinutes: number;
  saturatedHoldEnabled: boolean;
}

export interface PaperSnapshot {
  generatedAtUtc: string;
  config: PaperParams;
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

// Effective VM config as of 2026-07-25 (env values + code defaults); the live
// payload carries the current values read from the VM env each request.
export const PAPER_PARAMS_FALLBACK: PaperParams = {
  bankrollUsd: 10000,
  evalTimesUtc: ["02:00", "10:00", "18:00"],
  entryNotionalUsd: 500,
  entryEdgePp: 8,
  exitEdgePp: 0,
  stopLossPct: 0.35,
  maxPositions: 10,
  maxPerEvent: 1,
  maxEvalsPerCycle: 16,
  evalMaxRounds: 1,
  evalProvider: "claude",
  categories: ["finance", "geopolitics", "tech"],
  scanMinLiquidityUsd: 5000,
  scanMinVolume24hUsd: 2000,
  scanPerCategory: 12,
  hybridMarketRatio: 0.5,
  limitTtlHours: 8,
  fillCheckMinutes: 10,
  saturatedHoldEnabled: true
};

export const PAPER_SNAPSHOT: PaperSnapshot = {
  generatedAtUtc: "2026-08-05T06:45Z",
  config: PAPER_PARAMS_FALLBACK,
  reflectionReportUtc: "2026-08-04T18:44Z",
  lastEvalCycleUtc: "2026-08-05T02:33Z",
  startedUtc: "2026-07-03T07:17Z",
  bankrollUsd: 10000,
  cashUsd: 2890.63,
  realizedPnlUsd: -2114.37,
  equityUsd: 7974.23,
  feesUsd: 113.05,
  fills: { total: 59, buys: 28, sells: 31 },
  droppedBuyFills: 1,
  evalCycles: 101,
  saturatedHolds: 8,
  equityCurve: [
    { date: "起点", equityUsd: 10000 },
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
    { date: "07-24", equityUsd: 10420.01 },
    { date: "07-25", equityUsd: 10305.74 },
    { date: "07-26", equityUsd: 9976.81 },
    { date: "07-27", equityUsd: 9680.51 },
    { date: "07-28", equityUsd: 9378.39 },
    { date: "07-29", equityUsd: 9611.21 },
    { date: "07-30", equityUsd: 9434.13 },
    { date: "07-31", equityUsd: 9432.9 },
    { date: "08-01", equityUsd: 9125.06 },
    { date: "08-02", equityUsd: 8441.88 },
    { date: "08-03", equityUsd: 8431.65 },
    { date: "08-04", equityUsd: 8111.81 },
    { date: "现在", equityUsd: 7974.23 }
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
      shares: 632.91,
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
      shares: 808.36,
      costUsd: 500,
      pnlUsd: 94.15,
      exitReason: "negative_edge",
      note: "退出后市场以 NO 结算——反事实检验里最赚的一次常规退出（α +$594）"
    },
    {
      question: "Mojtaba Khamenei 7/15 前公开露面？",
      slug: "mojtaba-khamenei-seen-in-public-by-july-15-155",
      side: "NO",
      openedUtc: "2026-07-03T07:51Z",
      closedUtc: "2026-07-15T09:54Z",
      entryPrice: 0.8556,
      exitPrice: 0.9945,
      shares: 584.38,
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
      shares: 3453.06,
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
      shares: 6723.29,
      costUsd: 500,
      pnlUsd: -226.8,
      exitReason: "stop_loss",
      note: "止损 4 小时后原方向重新进场，再次止损；事件最终未发生"
    },
    {
      question: "美伊 7/31 前达成有效停火？（第一回合）",
      slug: "us-x-iran-effective-ceasfire-by-july-31-20260715194822045",
      side: "NO",
      openedUtc: "2026-07-25T18:43Z",
      closedUtc: "2026-07-26T17:07Z",
      entryPrice: 0.6814,
      exitPrice: 0.4375,
      shares: 733.8,
      costUsd: 500,
      pnlUsd: -178.96,
      exitReason: "stop_loss",
      note: "开仓次日止损；7/27 又在 0.466 重进同市场（第二回合 8/4 再止损）"
    },
    {
      question: "霍尔木兹海峡 7/31 前恢复正常通航？",
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-july-31",
      side: "NO",
      openedUtc: "2026-07-03T10:12Z",
      closedUtc: "2026-07-27T09:57Z",
      entryPrice: 0.7417,
      exitPrice: 0.9945,
      shares: 674.17,
      costUsd: 500,
      pnlUsd: 170.46,
      exitReason: "negative_edge",
      note: "saturated-hold 多次拦截负 edge 强卖后持有到临近结算，0.9945 清仓——修复（PR #91）上线后的代表性赢单"
    },
    {
      question: "以伊停火延续至 7/31？（第一次）",
      slug: "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243",
      side: "NO",
      openedUtc: "2026-07-26T18:34Z",
      closedUtc: "2026-07-27T18:29Z",
      entryPrice: 0.14,
      exitPrice: 0.0892,
      shares: 3571.43,
      costUsd: 500,
      pnlUsd: -181.46,
      exitReason: "stop_loss",
      note: "以伊停火系列第一次止损"
    },
    {
      question: "美国 7/31 前宣布停止对伊军事行动？",
      slug: "will-the-us-announce-an-iran-ceasefire-by-july-31-20260718000915875",
      side: "NO",
      openedUtc: "2026-07-27T18:44Z",
      closedUtc: "2026-07-27T19:57Z",
      entryPrice: 0.0765,
      exitPrice: 0.0422,
      shares: 6533.65,
      costUsd: 500,
      pnlUsd: -224.32,
      exitReason: "stop_loss",
      note: "开仓 73 分钟即止损——本轮最快的一笔"
    },
    {
      question: "以伊停火延续至 7/31？（第二次）",
      slug: "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243",
      side: "NO",
      openedUtc: "2026-07-28T02:30Z",
      closedUtc: "2026-07-28T07:47Z",
      entryPrice: 0.0725,
      exitPrice: 0.04,
      shares: 6898.03,
      costUsd: 500,
      pnlUsd: -224.08,
      exitReason: "stop_loss",
      note: "止损后 7 小时原方向重进，再止损（冷却期缺口重演）"
    },
    {
      question: "英伟达 7/31 全球市值第一？",
      slug: "will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-july-31-20260624192329841",
      side: "YES",
      openedUtc: "2026-07-28T10:49Z",
      closedUtc: "2026-07-29T08:17Z",
      entryPrice: 0.22,
      exitPrice: 0.1014,
      shares: 2045.45,
      costUsd: 495,
      pnlUsd: -287.55,
      exitReason: "stop_loss",
      note: "止损后市场最终以 YES 结算——反事实最差的一次退出（α −$1,838）；成本含 $45 入场费"
    },
    {
      question: "以伊停火延续至 7/31？（第三次）",
      slug: "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243",
      side: "NO",
      openedUtc: "2026-07-29T10:45Z",
      closedUtc: "2026-07-30T06:27Z",
      entryPrice: 0.1135,
      exitPrice: 0.0692,
      shares: 4405.04,
      costUsd: 500,
      pnlUsd: -195.29,
      exitReason: "stop_loss",
      note: "同一市场第三次进场第三次止损；三回合合计 −$601"
    },
    {
      question: "以伊停火延续至 8/15？",
      slug: "israel-x-iran-ceasefire-continues-through-august-15-20260716224448969-246-815-987-693",
      side: "NO",
      openedUtc: "2026-07-30T10:38Z",
      closedUtc: "2026-07-31T17:47Z",
      entryPrice: 0.3238,
      exitPrice: 0.1906,
      shares: 1544,
      costUsd: 500,
      pnlUsd: -205.73,
      exitReason: "stop_loss",
      note: "以伊停火题材换 8/15 到期日再进，第四次止损"
    },
    {
      question: "哈马斯 12/31 前同意解除武装？",
      slug: "will-hamas-agree-to-disarm-by-december-31",
      side: "NO",
      openedUtc: "2026-07-31T18:38Z",
      closedUtc: "2026-07-31T18:47Z",
      entryPrice: 0.1697,
      exitPrice: 0.11,
      shares: 2947.09,
      costUsd: 500,
      pnlUsd: -175.82,
      exitReason: "stop_loss",
      note: "止损卖在 0.11 后 NO 价反弹到 ~0.40（α −$869）；8/1 又在 0.36 重进同市场（现持仓中）"
    },
    {
      question: "伊朗 8/31 前领导层更替？",
      slug: "iran-leadership-change-by-august-31-669",
      side: "YES",
      openedUtc: "2026-08-01T02:42Z",
      closedUtc: "2026-08-01T10:57Z",
      entryPrice: 0.0568,
      exitPrice: 0.0327,
      shares: 8805.67,
      costUsd: 500,
      pnlUsd: -211.68,
      exitReason: "stop_loss"
    },
    {
      question: "美伊 7/31 前达成有效停火？（第二回合）",
      slug: "us-x-iran-effective-ceasfire-by-july-31-20260715194822045",
      side: "NO",
      openedUtc: "2026-07-27T10:37Z",
      closedUtc: "2026-08-04T13:27Z",
      entryPrice: 0.4662,
      exitPrice: 0.26,
      shares: 1072.57,
      costUsd: 500,
      pnlUsd: -221.13,
      exitReason: "stop_loss",
      note: "7/27 重进的第二回合，拖过到期日后 8/4 止损离场"
    }
  ],
  openPositions: [
    {
      question: "普京 2027 年前卸任俄罗斯总统？",
      slug: "putin-out-before-2027-346",
      side: "NO",
      openedUtc: "2026-07-04T02:12Z",
      shares: 555.56,
      entryPrice: 0.9,
      markPrice: 0.92,
      unrealizedUsd: 11.11,
      agentProb: 0.8429,
      flag: "contaminated"
    },
    {
      question: "美伊 9/30 前达成最终核协议？",
      slug: "us-iran-final-nuclear-deal-by-september-30-2026",
      side: "NO",
      openedUtc: "2026-07-05T02:20Z",
      shares: 704.23,
      entryPrice: 0.71,
      markPrice: 0.85,
      unrealizedUsd: 98.59,
      agentProb: 0.9869,
      flag: null
    },
    {
      question: "霍尔木兹海峡 12/31 前恢复正常通航？",
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-december-31",
      side: "NO",
      openedUtc: "2026-07-06T02:19Z",
      shares: 1785.71,
      entryPrice: 0.28,
      markPrice: 0.38,
      unrealizedUsd: 178.57,
      agentProb: 0.9884,
      flag: null
    },
    {
      question: "乌克兰 12/31 前收复克里米亚领土？",
      slug: "will-ukraine-recapture-crimean-territory-by-december-31-2026",
      side: "NO",
      openedUtc: "2026-07-07T02:25Z",
      shares: 555.56,
      entryPrice: 0.9,
      markPrice: 0.91,
      unrealizedUsd: 5.56,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "美国 2027 年前入侵伊朗？",
      slug: "will-the-us-invade-iran-before-2027",
      side: "NO",
      openedUtc: "2026-07-16T10:22Z",
      shares: 649.35,
      entryPrice: 0.77,
      markPrice: 0.83,
      unrealizedUsd: 38.96,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "霍尔木兹海峡 8/31 前恢复正常通航？",
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-august-31-20260702154212320",
      side: "NO",
      openedUtc: "2026-07-25T18:31Z",
      shares: 581.4,
      entryPrice: 0.86,
      markPrice: 0.83,
      unrealizedUsd: -17.44,
      agentProb: 0.9848,
      flag: null
    },
    {
      question: "马杜罗 2026 年底仍是委内瑞拉领导人？",
      slug: "will-nicols-maduro-be-the-leader-of-venezuela-end-of-2026",
      side: "NO",
      openedUtc: "2026-07-25T18:50Z",
      shares: 2429.22,
      entryPrice: 0.1852,
      markPrice: 0.173,
      unrealizedUsd: -29.74,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "霍尔木兹海峡 9/30 前恢复正常通航？",
      slug: "strait-of-hormuz-traffic-returns-to-normal-by-september-30-20260702154339440",
      side: "NO",
      openedUtc: "2026-07-25T18:57Z",
      shares: 652.3,
      entryPrice: 0.7665,
      markPrice: 0.69,
      unrealizedUsd: -49.91,
      agentProb: 0.99,
      flag: "saturated"
    },
    {
      question: "哈马斯 12/31 前同意解除武装？",
      slug: "will-hamas-agree-to-disarm-by-december-31",
      side: "NO",
      openedUtc: "2026-08-01T18:33Z",
      shares: 1389.75,
      entryPrice: 0.3598,
      markPrice: 0.37,
      unrealizedUsd: 14.21,
      agentProb: 0.9757,
      flag: null
    },
    {
      question: "美国 8/7 前宣布解除对伊封锁？",
      slug: "us-announces-end-of-iranian-blockade-by-august-7-2026-20260727171523690",
      side: "NO",
      openedUtc: "2026-08-04T18:44Z",
      shares: 850.73,
      entryPrice: 0.5877,
      markPrice: 0.451,
      unrealizedUsd: -116.32,
      agentProb: 0.9586,
      flag: null
    }
  ],
  exitAlpha: {
    totalUsd: -134.29,
    rows: [
      {
        question: "美伊 7/10 前举行外交会晤？",
        side: "NO",
        soldUtc: "07-04 02:06",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.9765,
        priceNow: 1,
        alphaUsd: -14.13,
        reason: "负 edge 退出"
      },
      {
        question: "NATO 与俄罗斯年底前军事冲突？",
        side: "NO",
        soldUtc: "07-05 10:08",
        exitStyle: "市价",
        avgExitPrice: 0.82,
        priceNow: 0,
        alphaUsd: 0,
        reason: "负 edge 退出+限价单超时回落"
      },
      {
        question: "美伊 7/31 前举行外交会晤？",
        side: "YES",
        soldUtc: "07-05 18:15",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.735,
        priceNow: 0,
        alphaUsd: 594.15,
        reason: "负 edge 退出"
      },
      {
        question: "Mojtaba Khamenei 7/15 前公开露面？",
        side: "NO",
        soldUtc: "07-15 02:04",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.9945,
        priceNow: 1,
        alphaUsd: -3.21,
        reason: "负 edge 退出"
      },
      {
        question: "伊朗 7/17 前宣布退出 MOU 谈判？",
        side: "YES",
        soldUtc: "07-15 14:04",
        exitStyle: "市价",
        avgExitPrice: 0.053,
        priceNow: 0,
        alphaUsd: 539.82,
        reason: "止损"
      },
      {
        question: "美伊 7/31 前达成有效停火？",
        side: "NO",
        soldUtc: "07-26 17:07",
        exitStyle: "市价",
        avgExitPrice: 0.3321,
        priceNow: 0.235,
        alphaUsd: 175.42,
        reason: "止损"
      },
      {
        question: "霍尔木兹海峡 7/31 前恢复正常通航？",
        side: "NO",
        soldUtc: "07-27 02:02",
        exitStyle: "市价+限价两腿",
        avgExitPrice: 0.9945,
        priceNow: 1,
        alphaUsd: -3.71,
        reason: "负 edge 退出"
      },
      {
        question: "以伊停火延续至 7/31？",
        side: "NO",
        soldUtc: "07-27 18:29",
        exitStyle: "市价",
        avgExitPrice: 0.0605,
        priceNow: 0,
        alphaUsd: 899.17,
        reason: "止损"
      },
      {
        question: "美国 7/31 前宣布停止对伊军事行动？",
        side: "NO",
        soldUtc: "07-27 19:57",
        exitStyle: "市价",
        avgExitPrice: 0.0422,
        priceNow: 0,
        alphaUsd: 275.68,
        reason: "止损"
      },
      {
        question: "英伟达 7/31 全球市值第一？",
        side: "YES",
        soldUtc: "07-29 08:17",
        exitStyle: "市价",
        avgExitPrice: 0.1127,
        priceNow: 1,
        alphaUsd: -1838,
        reason: "止损"
      },
      {
        question: "以伊停火延续至 8/15？",
        side: "NO",
        soldUtc: "07-31 17:47",
        exitStyle: "市价",
        avgExitPrice: 0.1906,
        priceNow: 0.155,
        alphaUsd: 54.96,
        reason: "止损"
      },
      {
        question: "哈马斯 12/31 前同意解除武装？",
        side: "NO",
        soldUtc: "07-31 18:47",
        exitStyle: "市价",
        avgExitPrice: 0.11,
        priceNow: 0.405,
        alphaUsd: -869.39,
        reason: "止损"
      },
      {
        question: "伊朗 8/31 前领导层更替？",
        side: "YES",
        soldUtc: "08-01 10:57",
        exitStyle: "市价",
        avgExitPrice: 0.0327,
        priceNow: 0.0265,
        alphaUsd: 54.97,
        reason: "止损"
      }
    ]
  },
  brier: {
    n: 12,
    agentScore: 0.3245,
    marketScore: 0.2117,
    skillScore: -0.5327,
    rows: [
      {
        question: "以伊停火延续至 7/31？",
        agentProb: 0.692,
        marketProb: 0.12,
        happened: false,
        resolvedUtc: "2026-07-30"
      },
      {
        question: "以伊停火延续至 7/31？",
        agentProb: 0.2751,
        marketProb: 0.9,
        happened: true,
        resolvedUtc: "2026-07-29"
      },
      {
        question: "WTI 原油 7 月最高价触及 $95？",
        agentProb: 0.0463,
        marketProb: 0.0505,
        happened: false,
        resolvedUtc: "2026-07-29"
      },
      {
        question: "英伟达 7/31 全球市值第一？",
        agentProb: 0.2443,
        marketProb: 0.22,
        happened: true,
        resolvedUtc: "2026-07-29"
      },
      {
        question: "英伟达 7/31 全球市值第一？",
        agentProb: 0.4753,
        marketProb: 0.215,
        happened: true,
        resolvedUtc: "2026-07-28"
      },
      {
        question: "美国 7/31 前宣布停止对伊军事行动？",
        agentProb: 0.1492,
        marketProb: 0.941,
        happened: true,
        resolvedUtc: "2026-07-27"
      },
      {
        question: "霍尔木兹海峡 7/31 前恢复正常通航？",
        agentProb: 0.989,
        marketProb: 0.994,
        happened: true,
        resolvedUtc: "2026-07-27"
      },
      {
        question: "伊朗 7/17 前宣布退出 MOU 谈判？",
        agentProb: 0.1948,
        marketProb: 0.0635,
        happened: false,
        resolvedUtc: "2026-07-15"
      },
      {
        question: "Mojtaba Khamenei 7/15 前公开露面？",
        agentProb: 0.99,
        marketProb: 0.994,
        happened: true,
        resolvedUtc: "2026-07-15"
      },
      {
        question: "中菲 2027 前军事冲突？",
        agentProb: 0.0881,
        marketProb: 0.135,
        happened: true,
        resolvedUtc: "2026-07-07"
      },
      {
        question: "美伊 7/31 前举行外交会晤？",
        agentProb: 0.669,
        marketProb: 0.73,
        happened: false,
        resolvedUtc: "2026-07-05"
      },
      {
        question: "美伊 7/10 前举行外交会晤？",
        agentProb: 0.9755,
        marketProb: 0.976,
        happened: true,
        resolvedUtc: "2026-07-04"
      }
    ]
  },
  // Ledger-count basis (same basis the live endpoint uses, so live and
  // fallback never disagree on the counting method).
  engineQuality: {
    evaluations: 672,
    saturated: 398,
    contaminated: 85,
    evalErrors: 11,
    limitOrdersPlaced: 5,
    limitFills: 13,
    limitVsMarketPp: 0.37
  }
};
