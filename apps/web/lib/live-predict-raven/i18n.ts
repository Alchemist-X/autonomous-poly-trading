// Bilingual copy for the /live-predict-raven review page.
//
// zh is the source of truth and must stay byte-identical with the original
// Chinese-only page; en is a tight, finance-literate translation, not a
// reworded second edition. Static copy lives in the MESSAGES table below;
// sentences with interpolated values stay next to their markup as `lang`
// ternaries, and data-ish label maps (exit reasons, statuses, …) live with
// the component or in labels.ts.

export type Lang = "zh" | "en";

/** Cookie set by app/live-predict-raven/lang/route.ts; absent = zh. */
export const LANG_COOKIE_NAME = "lpr_lang";

export function parseLang(value: unknown): Lang {
  return value === "en" ? "en" : "zh";
}

export function otherLang(lang: Lang): Lang {
  return lang === "zh" ? "en" : "zh";
}

interface Message {
  zh: string;
  en: string;
}

const MESSAGES = {
  // The toggle shows the language you would switch TO, not the current one.
  langToggle: { zh: "EN", en: "中文" },

  // ---- header ------------------------------------------------------------
  kicker: {
    zh: "Tokyo VM · services/paper-agent · 私有复盘页",
    en: "Tokyo VM · services/paper-agent · private review"
  },
  pageTitle: { zh: "Polymarket 模拟盘复盘", en: "Polymarket Paper Book Review" },
  metaLine1: {
    zh: "$10,000 本金 · Claude evaluator（联网搜索）· 每日 UTC 02/10/18 三轮评估 · 单仓 $500 · 仅 finance / geopolitics / tech 三类市场",
    en: "$10,000 bankroll · Claude evaluator (web search) · three eval cycles daily at 02/10/18 UTC · $500 per position · finance / geopolitics / tech markets only"
  },
  liveNote: {
    zh: "实时数据（每个评估周期后自动更新）",
    en: "live data (auto-refreshed after every eval cycle)"
  },

  // ---- overview ----------------------------------------------------------
  sectionOverview: { zh: "总览", en: "Overview" },
  tileEquity: { zh: "总权益", en: "Total equity" },
  tileWinRate: { zh: "已平仓胜率", en: "Closed-trade win rate" },
  tileRealized: { zh: "已实现盈亏", en: "Realized PnL" },
  tileRealizedSub: {
    zh: "已平仓回合与结算的累计净额",
    en: "Cumulative net of closed round trips and settlements"
  },
  tileUnrealized: { zh: "浮动盈亏", en: "Unrealized PnL" },
  tileFills: { zh: "总成交", en: "Total fills" },
  tileAvgWinLoss: { zh: "平均盈 / 亏", en: "Avg win / loss" },
  tileMaxDrawdown: { zh: "最大回撤", en: "Max drawdown" },
  tileCash: { zh: "现金", en: "Cash" },

  // ---- equity curve ------------------------------------------------------
  sectionEquity: {
    zh: "权益曲线（每日反思快照 + 最新评估点）",
    en: "Equity curve (daily reflection snapshots + latest eval)"
  },
  equityTableSummary: { zh: "查看逐日数值表", en: "Daily values table" },

  // ---- cases -------------------------------------------------------------
  sectionCases: {
    zh: "四个案例：它当时到底看到了什么",
    en: "Four cases: what it actually saw at the time"
  },
  casesNote: {
    zh: "盈利最大和亏损最大的各两笔。每一笔都摊开：引擎每一轮搜了什么、找到哪条源、那条源把概率推了多少、 它当时怎么想的，以及 harness 在同一时间轴上做了什么。所有链接都是引擎当时真正引用的原文。",
    en: "The two biggest winners and two biggest losers, each laid open: what the engine searched every round, which source it found, how far that source moved the number, what it was thinking, and what the harness did on the same timeline. Every link is a source the engine actually cited."
  },

  // ---- quality -----------------------------------------------------------
  sectionQuality: { zh: "预测与执行质量", en: "Forecast and execution quality" },
  exitDetailTitle: {
    zh: "退出明细：逐次退出 vs 不卖的对照",
    en: "Exit detail: each exit vs. not selling"
  },
  exitDetailNote: {
    zh: "α = 卖出所得 −（若持有到现在/结算的价值），正数 = 卖对了。合计与上面「决策质量」一节的退出贡献同源， 这里按每次退出的方式（市价 / 限价 / 混合）展开。",
    en: "α = sale proceeds − value if held to now/settlement; positive means the sale was right. The total matches the exit contribution in Decision quality above, broken out here by exit style (market / limit / hybrid)."
  },
  engineExecTitle: { zh: "引擎与执行", en: "Engine and execution" },

  // ---- open positions ----------------------------------------------------
  openPosNote: {
    zh: "⚠ 饱和 = 引擎概率打到 99% 上限，edge 为下限值而非精确判断；⛔ 污染 = 该预测被检测到引用了市场价格，不作为开仓/退出依据。现价 = 各仓最近一次评估时的 bid mark，随每次评估周期更新。",
    en: "⚠ saturated = the engine's probability hit the 99% cap, so the edge is a floor, not a point estimate; ⛔ contaminated = the forecast was caught citing market prices and is excluded as an entry/exit basis. Mark = each position's bid at its latest eval, refreshed every cycle."
  },

  // ---- params ------------------------------------------------------------
  sectionParams: { zh: "运行参数", en: "Run parameters" },
  paramsNoteLive: {
    zh: "实时读取自 VM 环境配置（env 可调默认值，调整须经用户确认）。",
    en: "Read live from the VM env (tunable defaults; changes require the owner's confirmation)."
  },
  paramsNoteBaked: {
    zh: "留档快照值（VM 暂不可达）；参数以 VM 环境配置为准。",
    en: "Archived snapshot values (VM unreachable); the VM env is authoritative."
  },

  // ---- footer ------------------------------------------------------------
  footerDisclaimer: {
    zh: "模拟盘——无真实订单、无真实资金。费用按 CLOB 逐市场实时元数据计（多数地缘市场为 0，个别市场带真实费率，已计入回合成本）。金额合计与总权益之间存在 <$1 的取整差（报告 mark 保留两位）。",
    en: "Paper trading — no real orders, no real money. Fees follow live per-market CLOB metadata (most geopolitics markets charge 0; a few carry real fees, included in round-trip cost). Totals differ from equity by <$1 of rounding (report marks keep two decimals)."
  },

  // ---- unlock gate -------------------------------------------------------
  gateTitle: { zh: "Paper trading 复盘", en: "Paper Trading Review" },
  gateBody: {
    zh: "这是东京 VM 模拟盘的内部复盘页。输入访问码解锁（与 /engine 门相同的口令）。",
    en: "The internal review page for the Tokyo VM paper book. Enter the access code to unlock (same code as the /engine gate)."
  },
  gateSubmit: { zh: "解锁 Unlock", en: "Unlock" },
  gateError: { zh: "访问码不对，再试一次。", en: "Wrong code — try again." }
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof MESSAGES;

export function t(lang: Lang): (key: MessageKey) => string {
  return (key) => MESSAGES[key][lang];
}
