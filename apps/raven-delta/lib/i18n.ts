"use client";

// Lightweight en/zh locale layer, following apps/raven's pattern (no deps,
// localStorage persistence). One dictionary per string, en first.

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export type UiLocale = "en" | "zh";

const STORAGE_KEY = "raven-delta-locale";

export const DICT = {
  brand: ["Raven Delta", "Raven Delta"],
  navEngine: ["Forecasting Engine", "Forecasting Engine"],
  heroKicker: ["Raven Labs · News Impact Engine", "Raven Labs · 新闻冲击引擎"],
  heroTitle: ["News in. Delta out.", "新闻进来，增量出去。"],
  heroSub: [
    "Feed it a headline from a credible source. The agent decides whether it deserves attention, maps 0-5 impacted US stocks with reasoning and evidence, recommends an action, and pushes the same report over email and WebSocket.",
    "输入一条可信来源的新闻。Agent 判断它是否值得关注，在维护的股票池上映射 0-5 只受影响美股，给出推理、证据与推荐操作，并把同一份报告通过邮件和 WebSocket 推送。"
  ],
  metricUniverse: ["Universe", "股票池"],
  metricFocus: ["Focus", "关注点"],
  metricFocusValue: ["The increment, not the level", "只做增量，不做静态估值"],
  metricPush: ["Push", "推送"],
  metricPushValue: ["Email + WebSocket", "邮件 + WebSocket"],
  formTitle: ["News intake", "新闻输入"],
  headlineLabel: ["Headline", "新闻标题"],
  headlineHelp: ["The first reliable headline or alert from your feed.", "信息流里第一条可靠的标题或快讯。"],
  bodyLabel: ["Context (optional)", "正文补充（可选）"],
  bodyHelp: ["Details, quotes, numbers, affected geographies from the article.", "文章中的细节、引语、数字、涉及地区。"],
  sourceLabel: ["Source", "来源"],
  sourcePlaceholder: ["Reuters, company filing, @DeItaone...", "Reuters、公司公告、@DeItaone..."],
  urlLabel: ["URL (optional)", "URL（可选）"],
  emailsLabel: ["Email recipients (optional)", "邮件收件人（可选）"],
  emailsHelp: [
    "Comma-separated. Anonymous callers can only reach the operator allowlist; real sending needs Resend or a webhook, otherwise the receipt says simulated.",
    "逗号分隔。匿名调用只能发给白名单；真实发送需要 Resend 或 webhook，否则回执标记 simulated。"
  ],
  topicLabel: ["WebSocket topic", "WebSocket topic"],
  sampleButton: ["Load sample", "填入示例"],
  analyzeButton: ["Analyze & push", "分析并推送"],
  analyzingButton: ["Analyzing…", "分析中…"],
  analyzingHint: [
    "The agent is reading the news and mapping exposure — LLM runs take up to a minute or two.",
    "Agent 正在读新闻并映射受影响面——LLM 运行可能需要一两分钟。"
  ],
  errorPrefix: ["Run failed:", "运行失败："],
  emptyTitle: ["Paste a headline to see the delta", "粘贴一条新闻，看它带来的增量"],
  emptyCopy: [
    "You'll get: an attention verdict, the market mechanism, 0-5 impacted stocks with reasoning, evidence and actions, plus delivery receipts.",
    "你会得到：关注度判定、市场传导机制、0-5 只受影响股票（含推理、证据、操作建议），以及推送回执。"
  ],
  attentionYes: ["Worth attention", "值得关注"],
  attentionNo: ["Not actionable", "无需行动"],
  attentionScore: ["attention", "关注度"],
  newsTypeLabel: ["Catalyst", "催化类型"],
  credibilityLabel: ["Credibility", "可信度"],
  mechanismTitle: ["Market mechanism", "市场传导机制"],
  impactedTitle: ["Impacted stocks", "受影响股票"],
  impactedNone: ["No stock rises to an actionable impact from this headline — that is the call.", "这条新闻没有把任何股票推到可操作的影响级别——这本身就是结论。"],
  directionLabel: ["Direction", "方向"],
  magnitudeLabel: ["Magnitude", "幅度"],
  expectedMoveLabel: ["Expected move", "预期波动"],
  confidenceLabel: ["Confidence", "置信度"],
  horizonLabel: ["Horizon", "时间窗口"],
  actionLabel: ["Action", "操作"],
  reasoningLabel: ["Reasoning", "推理"],
  evidenceLabel: ["Evidence", "证据"],
  risksLabel: ["Risks", "风险"],
  outOfUniverse: ["out of universe", "池外股票"],
  planTitle: ["Trading plan", "操作计划"],
  limitationsTitle: ["Limitations", "局限性"],
  deliveryTitle: ["Delivery receipts", "推送回执"],
  engineLabel: ["engine", "引擎"],
  engineFallbackNote: ["LLM engine unavailable — deterministic rules fallback was used:", "LLM 引擎不可用——已降级为确定性规则引擎："],
  wsTitle: ["Live WebSocket feed", "WebSocket 实时推送"],
  wsUrlLabel: ["Hub URL", "Hub 地址"],
  wsHelp: ["Start the hub with `pnpm delta:ws`, connect, then run an analysis to see the push land here.", "先 `pnpm delta:ws` 启动 hub，连接后运行分析即可看到推送落地。"],
  wsConnect: ["Connect", "连接"],
  wsDisconnect: ["Disconnect", "断开"],
  wsIdle: ["Idle", "未连接"],
  wsConnecting: ["Connecting", "连接中"],
  wsConnected: ["Connected", "已连接"],
  wsClosed: ["Closed", "已断开"],
  wsError: ["Connection error", "连接错误"],
  wsNoMessages: ["No message received yet.", "还没有收到推送。"],
  runsTitle: ["Recent runs", "最近运行"],
  demoBadge: ["demo · read-only", "演示 · 只读"],
  footerNote: [
    "Raven Delta is a Raven Labs product built on the Forecasting Engine. Demo mode: no live prices, no orders, not investment advice.",
    "Raven Delta 是 Raven Labs 基于 Forecasting Engine 的产品。演示模式：无实时价格、不下单、不构成投资建议。"
  ],
  langToggle: ["中文", "EN"],
  directionValues: { bullish: ["Bullish", "利多"], bearish: ["Bearish", "利空"], mixed: ["Mixed", "混合"] },
  magnitudeValues: { small: ["Small", "小"], medium: ["Medium", "中"], large: ["Large", "大"] },
  confidenceValues: { high: ["High", "高"], medium: ["Medium", "中"], low: ["Low", "低"] },
  actionValues: {
    buy: ["Buy", "买入"],
    add: ["Add", "加仓"],
    watch: ["Watch", "观察"],
    trim: ["Trim", "减仓"],
    sell: ["Sell", "卖出"],
    hedge: ["Hedge", "对冲"],
    avoid: ["Avoid chasing", "避免追价"]
  }
} as const;

type Dict = typeof DICT;
type PlainKeys = { [K in keyof Dict]: Dict[K] extends readonly [string, string] ? K : never }[keyof Dict];

const LocaleContext = createContext<{ locale: UiLocale; setLocale: (locale: UiLocale) => void }>({
  locale: "en",
  setLocale: () => undefined
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<UiLocale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") setLocale(stored);
  }, []);
  const set = (next: UiLocale) => {
    setLocale(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };
  return createElement(LocaleContext.Provider, { value: { locale, setLocale: set } }, children);
}

export function useLocale(): { locale: UiLocale; setLocale: (locale: UiLocale) => void } {
  return useContext(LocaleContext);
}

export function useT(): (key: PlainKeys) => string {
  const { locale } = useLocale();
  return (key: PlainKeys) => {
    const entry = DICT[key] as readonly [string, string];
    return locale === "zh" ? entry[1] : entry[0];
  };
}

export function valueLabel(
  locale: UiLocale,
  group: "directionValues" | "magnitudeValues" | "confidenceValues" | "actionValues",
  value: string
): string {
  const table = DICT[group] as Readonly<Record<string, readonly [string, string]>>;
  const entry = table[value];
  if (!entry) return value;
  return locale === "zh" ? entry[1] : entry[0];
}
