// Chrome dictionary for the Forecasting Engine console.
//
// Only the structural UI strings live here (hero, composer, buttons, stance and
// phase labels, chart titles, captions). The streamed research *content*
// (stages, evidence, verdict, narration) is localized server-side in
// prediction-engine-demo.ts / replay.ts via the `locale` threaded through the
// request. English is the default to match the apex of forecasting-agent.com.

import type { ConsoleLocale } from "./locale";
import type { PredictionEvidenceStance } from "../prediction-engine-demo";

export type ConsoleStringKey =
  | "heroTitle"
  | "heroSub"
  | "composerPlaceholder"
  | "tierRowLabel"
  | "tierAria"
  | "marketLabel"
  | "marketPlaceholder"
  | "resetBtn"
  | "runBtnIdle"
  | "runBtnBusy"
  | "examplesHint"
  | "errorPrefix"
  | "navWorldCup"
  | "langLabel"
  | "stanceSupport"
  | "stanceOppose"
  | "stanceMixed"
  | "stanceNeutral"
  | "phaseIdle"
  | "phaseRunning"
  | "phaseComplete"
  | "phaseError"
  | "machineLabel"
  | "bigProbLabel"
  | "callStrongYes"
  | "callLeanYes"
  | "callTossup"
  | "callLeanNo"
  | "callStrongNo"
  | "edgeAboveMarket"
  | "edgeBelowMarket"
  | "edgeReadBelow"
  | "edgeReadAbove"
  | "ciModelMarker"
  | "ciMarketMarker"
  | "ciInlineLabel"
  | "ciMarketOutside"
  | "ciMarketInside"
  | "snapshotPrefix"
  | "ciLabel"
  | "ciMarket"
  | "ciNote"
  | "marketImplied"
  | "edgeLabel"
  | "edgeCaveat"
  | "treeTitle"
  | "treeProduct"
  | "treeCalibratedPrefix"
  | "treeNotePre"
  | "treeNotePost"
  | "waterfallTitle"
  | "ledgerTitlePre"
  | "ledgerTitlePost"
  | "ledgerColStance"
  | "ledgerColEvidence"
  | "ledgerColImpact"
  | "ledgerColReliability"
  | "ledgerColNode"
  | "ledgerCaption"
  | "limitationsTitle";

const STRINGS: Record<ConsoleLocale, Record<ConsoleStringKey, string>> = {
  en: {
    heroTitle: "Turn a future event into a probability you can check.",
    heroSub:
      "Ask a verifiable yes/no question in plain language. The agent reasons in the open and ends with a probability, a likely range, and the evidence behind it.",
    composerPlaceholder: "e.g. Will some event happen before a given deadline?",
    tierRowLabel: "Reasoning depth",
    tierAria: "Reasoning depth",
    marketLabel: "Market-implied probability (optional)",
    marketPlaceholder: "0.30",
    resetBtn: "Restart",
    runBtnIdle: "Run research",
    runBtnBusy: "Researching…",
    examplesHint: "Cached examples · click to run",
    errorPrefix: "Research failed: ",
    navWorldCup: "World Cup forecast →",
    langLabel: "Language",
    stanceSupport: "Support",
    stanceOppose: "Oppose",
    stanceMixed: "Mixed",
    stanceNeutral: "Neutral",
    phaseIdle: "Idle",
    phaseRunning: "Running",
    phaseComplete: "Done",
    phaseError: "Error",
    machineLabel: "Progress",
    bigProbLabel: "Yes probability",
    callStrongYes: "Likely Yes",
    callLeanYes: "Leans Yes",
    callTossup: "Toss-up",
    callLeanNo: "Leans No",
    callStrongNo: "Likely No",
    edgeAboveMarket: "above market",
    edgeBelowMarket: "below market",
    edgeReadBelow: "Our estimate below market",
    edgeReadAbove: "Our estimate above market",
    ciModelMarker: "Model",
    ciMarketMarker: "Market",
    ciInlineLabel: "80% range ",
    ciMarketOutside: "The market price falls outside our likely range — a strong disagreement.",
    ciMarketInside: "The market price falls inside our likely range.",
    snapshotPrefix: "Research snapshot ",
    ciLabel: "80% range: ",
    ciMarket: "market-implied",
    ciNote:
      "There's about an 80% chance the true Yes probability sits in this range.",
    marketImplied: "Market-implied",
    edgeLabel: "Gap vs market",
    edgeCaveat:
      "Gap = our probability minus the market's. If the market's resolution rule is looser than this question, the two aren't measuring the same thing — treat the gap as indicative only, not a tradable signal.",
    treeTitle: "The steps that all have to happen",
    treeProduct: "All steps combined",
    treeCalibratedPrefix: "calibrated → ",
    treeNotePre: "Multiplying the steps gives a floor; after weighing the evidence the final Yes probability is ",
    treeNotePost: " (see the evidence step below).",
    waterfallTitle: "How the probability moved · starting estimate → final",
    ledgerTitlePre: "Evidence ledger · ",
    ledgerTitlePost: " items",
    ledgerColStance: "Stance",
    ledgerColEvidence: "Evidence",
    ledgerColImpact: "Impact",
    ledgerColReliability: "Reliability",
    ledgerColNode: "Step",
    ledgerCaption:
      "\"Impact\" shows how strongly each item pushes its step (A / B / C), in percentage points — for ranking and reading the case, not a number you add up. The final probability comes from the steps and evidence above.",
    limitationsTitle: "Boundaries & disclaimer"
  },
  zh: {
    heroTitle: "把一个未来事件，变成你能核对的概率。",
    heroSub:
      "用自然语言提一个能被验证的是 / 否问题。Agent 会公开推理，最后给出概率、可能区间和支撑证据。",
    composerPlaceholder: "例如:某事件会在某个截止日期前发生吗?",
    tierRowLabel: "推理深度",
    tierAria: "推理深度",
    marketLabel: "市场隐含概率(可选)",
    marketPlaceholder: "0.30",
    resetBtn: "重新开始",
    runBtnIdle: "开始研究",
    runBtnBusy: "研究中…",
    examplesHint: "已缓存示例 · 点击直接运行",
    errorPrefix: "研究失败:",
    navWorldCup: "世界杯预测 →",
    langLabel: "语言",
    stanceSupport: "支持",
    stanceOppose: "反对",
    stanceMixed: "中性",
    stanceNeutral: "中立",
    phaseIdle: "待命",
    phaseRunning: "运行中",
    phaseComplete: "已完成",
    phaseError: "出错",
    machineLabel: "进度",
    bigProbLabel: "Yes 概率",
    callStrongYes: "大概率会",
    callLeanYes: "略偏会",
    callTossup: "五五开",
    callLeanNo: "略偏不会",
    callStrongNo: "大概率不会",
    edgeAboveMarket: "高于市场",
    edgeBelowMarket: "低于市场",
    edgeReadBelow: "我们的估计低于市场",
    edgeReadAbove: "我们的估计高于市场",
    ciModelMarker: "模型",
    ciMarketMarker: "市场",
    ciInlineLabel: "80% 区间 ",
    ciMarketOutside: "市场价格落在我们的可能区间之外——分歧明显。",
    ciMarketInside: "市场价格落在我们的可能区间之内。",
    snapshotPrefix: "研究快照 ",
    ciLabel: "80% 区间：",
    ciMarket: "市场隐含",
    ciNote:
      "真实的 Yes 概率大约有 80% 的把握落在这个区间内。",
    marketImplied: "市场隐含",
    edgeLabel: "与市场的差距",
    edgeCaveat:
      "差距 = 我们的概率减去市场概率。若市场的结算口径比本题更宽松，两者并不在衡量同一件事，该差距仅供参考，不能直接当成可交易信号。",
    treeTitle: "需要同时发生的几个步骤",
    treeProduct: "全部步骤合起来",
    treeCalibratedPrefix: "校准后 → ",
    treeNotePre: "把各步相乘得到一个下限；综合证据后，最终 Yes 概率为 ",
    treeNotePost: "（见下方证据步骤）。",
    waterfallTitle: "概率是怎么变的 · 初始估计 → 最终",
    ledgerTitlePre: "证据账本 · ",
    ledgerTitlePost: " 条",
    ledgerColStance: "立场",
    ledgerColEvidence: "证据",
    ledgerColImpact: "影响",
    ledgerColReliability: "可信度",
    ledgerColNode: "步骤",
    ledgerCaption:
      "「影响」表示每条证据对其所属步骤（A / B / C）的推动强度（百分点），用于排序和理解，不能直接相加——最终概率以上方的步骤与证据为准。",
    limitationsTitle: "边界与免责"
  }
};

export function c(locale: ConsoleLocale, key: ConsoleStringKey): string {
  return STRINGS[locale][key];
}

const STANCE_KEY: Record<PredictionEvidenceStance, ConsoleStringKey> = {
  support: "stanceSupport",
  oppose: "stanceOppose",
  mixed: "stanceMixed",
  neutral: "stanceNeutral"
};

export function stanceLabel(locale: ConsoleLocale, stance: PredictionEvidenceStance): string {
  return c(locale, STANCE_KEY[stance]);
}
