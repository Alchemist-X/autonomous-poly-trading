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
    heroTitle: "Turn a future event into an auditable probability.",
    heroSub:
      "Pose a verifiable binary question in plain language. The research agent opens its reasoning in seven steps: frame the definition · decompose conditions · collect and weight evidence · build a conditional-probability model · run a Bayesian update · conclude with a confidence interval.",
    composerPlaceholder: "e.g. Will some event happen before a given deadline?",
    tierRowLabel: "Reasoning depth",
    tierAria: "Reasoning-depth tier (Norns)",
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
    stanceNeutral: "Boundary",
    phaseIdle: "IDLE",
    phaseRunning: "RUNNING",
    phaseComplete: "COMPLETE",
    phaseError: "ERROR",
    machineLabel: "Forecasting Engine state machine",
    bigProbLabel: "Yes probability",
    callStrongYes: "Likely Yes",
    callLeanYes: "Leans Yes",
    callTossup: "Toss-up",
    callLeanNo: "Leans No",
    callStrongNo: "Likely No",
    edgeAboveMarket: "above market",
    edgeBelowMarket: "below market",
    edgeReadBelow: "Model below market",
    edgeReadAbove: "Model above market",
    ciModelMarker: "Model",
    ciMarketMarker: "Market",
    ciInlineLabel: "80% CI ",
    ciMarketOutside: "The market sits outside the model's 80% interval — a high-conviction gap.",
    ciMarketInside: "The market sits inside the model's 80% interval.",
    snapshotPrefix: "Research snapshot ",
    ciLabel: "80% subjective credible interval: ",
    ciMarket: "market-implied",
    ciNote:
      "Subjective credible interval: ~80% confidence the Yes probability falls in this range (a Bayesian judgment, not a frequentist confidence interval).",
    marketImplied: "Market-implied",
    edgeLabel: "Edge",
    edgeCaveat:
      "edge = model − market. If the market's resolution criterion is looser than this question's (e.g. \"any publicly announced nuclear deal counts\"), the two are not the same standard — this edge is indicative only and is not a directly tradable signal.",
    treeTitle: "Conditional-probability model · P(A) × P(B|A) × P(C|A,B)",
    treeProduct: "Conditional product",
    treeCalibratedPrefix: "calibrated → ",
    treeNotePre: "The conditional product is a structured lower bound; the final Yes probability is calibrated to ",
    treeNotePost: " (see the \"model calibration\" step of the Bayesian path below).",
    waterfallTitle: "Bayesian update path · prior → posterior",
    ledgerTitlePre: "Evidence ledger · ",
    ledgerTitlePost: " items",
    ledgerColStance: "Stance",
    ledgerColEvidence: "Evidence",
    ledgerColImpact: "Impact",
    ledgerColReliability: "Reliability",
    ledgerColNode: "Node",
    ledgerCaption:
      "\"Impact\" is each item's directed strength on its node (A / B / C), on a percentage-point scale, used for ordering and qualitative read — not an additive contribution to the final probability. The final probability comes from the conditional-probability model and Bayesian path above.",
    limitationsTitle: "Boundaries & disclaimer"
  },
  zh: {
    heroTitle: "把一个未来事件,变成可审计的概率。",
    heroSub:
      "用自然语言提出一个可被验证的二元问题。研究 agent 会分七步公开它的推理:理清定义 · 条件拆解 · 证据收集与权重 · 条件概率模型 · 贝叶斯更新 · 结论与置信区间。",
    composerPlaceholder: "例如:某事件会在某个截止日期前发生吗?",
    tierRowLabel: "推理深度",
    tierAria: "推理深度档位 (Norns)",
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
    stanceNeutral: "边界",
    phaseIdle: "待命 IDLE",
    phaseRunning: "运行中 RUNNING",
    phaseComplete: "已完成 COMPLETE",
    phaseError: "出错 ERROR",
    machineLabel: "Forecasting Engine 状态机",
    bigProbLabel: "Yes 概率",
    callStrongYes: "大概率会",
    callLeanYes: "略偏会",
    callTossup: "五五开",
    callLeanNo: "略偏不会",
    callStrongNo: "大概率不会",
    edgeAboveMarket: "高于市场",
    edgeBelowMarket: "低于市场",
    edgeReadBelow: "模型低于市场",
    edgeReadAbove: "模型高于市场",
    ciModelMarker: "模型",
    ciMarketMarker: "市场",
    ciInlineLabel: "80% 可信区间 ",
    ciMarketOutside: "市场落在模型 80% 区间之外——高把握的分歧。",
    ciMarketInside: "市场落在模型 80% 区间之内。",
    snapshotPrefix: "研究快照 ",
    ciLabel: "80% 主观可信区间：",
    ciMarket: "市场隐含",
    ciNote:
      "主观可信区间：对 Yes 概率有约 80% 把握落在此范围(贝叶斯式判断,非数据频率意义上的置信区间)。",
    marketImplied: "市场隐含",
    edgeLabel: "Edge",
    edgeCaveat:
      "edge = 模型 − 市场。若市场的结算口径比本题更宽松(如\"任何公开核协议即算\"),两者并非同一判定标准,该 edge 仅供参考、不可直接当成可交易信号。",
    treeTitle: "条件概率模型 · P(A) × P(B|A) × P(C|A,B)",
    treeProduct: "条件乘积",
    treeCalibratedPrefix: "校准后 → ",
    treeNotePre: "条件乘积是结构化下界;最终 Yes 概率经校准为 ",
    treeNotePost: "(见下方贝叶斯路径的\"模型校准\"步)。",
    waterfallTitle: "贝叶斯更新路径 · 先验 → 后验",
    ledgerTitlePre: "证据账本 · ",
    ledgerTitlePost: " 条",
    ledgerColStance: "立场",
    ledgerColEvidence: "证据",
    ledgerColImpact: "影响",
    ledgerColReliability: "可信度",
    ledgerColNode: "节点",
    ledgerCaption:
      "\"影响\"为每条证据对其所属节点(A / B / C)的有向强度(百分点量级),用于排序与定性,并非对最终概率的可加贡献——最终概率以上方条件概率模型与贝叶斯路径为准。",
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
