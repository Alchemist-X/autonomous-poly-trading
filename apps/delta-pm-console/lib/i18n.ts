// UI language dictionary — zh is the source of truth (every zh string is
// byte-identical to the pre-i18n console), en is a tight ops-literate
// translation. Data-carried strings (tickers, news titles, run ids, service
// error messages) are NOT translated here — they render as the API provides.
//
// `t(lang)` returns a lookup function; entries may carry `{placeholder}`
// slots filled via the optional params argument (handles zh/en word-order
// differences without splitting strings).

export type Lang = "zh" | "en";

export const LANG_STORAGE_KEY = "deltapm_lang";

export const DICT = {
  // ---- document / header ----
  docTitle: { zh: "Delta PM 控制台", en: "Delta PM Console" },
  shadowChip: { zh: "影子模式 SHADOW", en: "SHADOW MODE" },
  // Toggle shows the language you would switch TO, hence the inversion.
  langToggle: { zh: "EN", en: "中文" },
  langToggleAria: { zh: "Switch to English", en: "切换到中文" },

  // ---- page shell ----
  loading: { zh: "正在连接 Delta PM 服务…", en: "Connecting to the Delta PM service…" },
  noStateBanner: { zh: "无法获取服务状态", en: "Cannot fetch service status" },
  errSuffix: { zh: ":{err}", en: ": {err}" },
  noSnapshotHint: {
    zh: "尚无任何可展示的快照。确认 delta-pm 服务在 DELTAPM_STATUS_URL 上运行,或设置 DELTAPM_CONSOLE_MOCK=1 查看演示数据。",
    en: "No snapshot to show yet. Confirm the delta-pm service is running at DELTAPM_STATUS_URL, or set DELTAPM_CONSOLE_MOCK=1 to view demo data."
  },
  fetchFailErr: { zh: "无法连接控制台服务 (fetch failed)", en: "Cannot reach the console service (fetch failed)" },

  // ---- status strip ----
  haltedBanner: { zh: "已触发停机保护 (HALTED)", en: "Halt protection triggered (HALTED)" },
  haltedReasonSuffix: { zh: " · 原因:{reason}", en: " · reason: {reason}" },
  staleBanner: { zh: "数据可能过期 · 上次成功 {time}", en: "Data may be stale · last success {time}" },
  equityLbl: { zh: "账户净值 Equity", en: "Equity" },
  initialSub: { zh: "初始 {v}", en: "Initial {v}" },
  realizedLbl: { zh: "已实现盈亏", en: "Realized PnL" },
  unrealizedLbl: { zh: "浮动盈亏", en: "Unrealized PnL" },
  feedLbl: { zh: "新闻源", en: "News feed" },
  feedPoll: { zh: "轮询 {rel}", en: "Polled {rel}" },
  feedSub: { zh: "最新条目 {rel} · 累计 {n} 条", en: "Latest item {rel} · {n} seen" },
  marketLbl: { zh: "行情", en: "Market" },
  marketArchived: { zh: "归档 {n} 个标的", en: "{n} tickers archived" },
  marketSweep: { zh: "上次 sweep {rel}", en: "Last sweep {rel}" },

  // ---- active runs ----
  activeTitle: { zh: "进行中的分析", en: "Active runs" },
  activeEmpty: { zh: "暂无进行中的分析 — 等待新闻", en: "No active runs — waiting for news" },
  stageIngest: { zh: "接收", en: "Ingest" },
  stageGate1: { zh: "重要性", en: "Materiality" },
  stageGate2: { zh: "已定价", en: "Priced-in" },
  stageAnalysis: { zh: "影响分析", en: "Impact" },
  stageDecision: { zh: "决策", en: "Decision" },
  elapsed: { zh: "已耗时 {t}", en: "Elapsed {t}" },
  progressAria: { zh: "分析进度 {pct}%", en: "Analysis progress {pct}%" },
  runNow: { zh: "当前:", en: "Now:" },
  startedAt: { zh: "起始 {t}", en: "Started {t}" },

  // ---- positions ----
  positionsTitle: { zh: "持仓", en: "Positions" },
  positionsEmpty: { zh: "当前无持仓", en: "No open positions" },
  thTicker: { zh: "标的", en: "Ticker" },
  thSide: { zh: "方向", en: "Side" },
  thQty: { zh: "数量", en: "Qty" },
  thEntry: { zh: "开仓价", en: "Entry" },
  thMark: { zh: "现价", en: "Mark" },
  thStop: { zh: "止损价", en: "Stop" },
  thHardFloor: { zh: "硬地板 (−20%)", en: "Hard floor (−20%)" },
  hardFloorShort: { zh: "硬地板", en: "Hard floor" },
  thHorizon: { zh: "持有至", en: "Horizon" },
  dirLong: { zh: "多", en: "Long" },
  dirShort: { zh: "空", en: "Short" },

  // ---- signals ----
  signalsTitle: { zh: "最近信号", en: "Recent signals" },
  signalsEmpty: { zh: "暂无信号", en: "No signals yet" },
  piNone: { zh: "未定价", en: "Not priced in" },
  piPartial: { zh: "部分定价", en: "Partially priced" },
  piFull: { zh: "已定价", en: "Priced in" },
  piLeaked: { zh: "疑似泄露", en: "Leak suspected" },
  piReverse: { zh: "反向", en: "Reverse" },
  piAwaiting: { zh: "待行情", en: "Awaiting market" },
  piPending: { zh: "待评估", en: "Pending eval" },
  tradeableChip: { zh: "可交易", en: "Tradeable" },
  materiality: { zh: "重要性 {n}", en: "Materiality {n}" },
  pasteSummary: { zh: "补全原文", en: "Add full text" },
  pastePlaceholder: {
    zh: "粘贴这条新闻的完整原文,提交后会触发重新分析",
    en: "Paste the full original text of this news item; submitting triggers re-analysis"
  },
  submitText: { zh: "提交原文", en: "Submit text" },
  submitting: { zh: "提交中…", en: "Submitting…" },
  pasteOk: { zh: "已提交,等待重新分析", en: "Submitted; awaiting re-analysis" },
  pasteFail: { zh: "提交失败:{detail}", en: "Submit failed: {detail}" },
  noIngestToken: { zh: "未配置 DELTAPM_INGEST_TOKEN", en: "DELTAPM_INGEST_TOKEN not configured" },

  // ---- recent runs ----
  recentTitle: { zh: "最近完成", en: "Recently completed" },
  recentEmpty: { zh: "暂无已完成的分析", en: "No completed runs yet" },
  noOutcome: { zh: "(无结论)", en: "(no outcome)" },

  // ---- footer ----
  injectTitle: { zh: "手动注入新闻", en: "Inject news manually" },
  titlePlaceholder: { zh: "标题(必填)", en: "Title (required)" },
  bodyPlaceholder: { zh: "正文(必填)", en: "Body (required)" },
  urlPlaceholder: { zh: "来源链接(可选)", en: "Source URL (optional)" },
  injectBtn: { zh: "注入并分析", en: "Inject & analyze" },
  injecting: { zh: "注入中…", en: "Injecting…" },
  injectOk: { zh: "已注入,等待分析", en: "Injected; awaiting analysis" },
  injectFail: { zh: "注入失败:{detail}", en: "Inject failed: {detail}" },
  disclaimer: { zh: "Phase 0 影子模式:不下真实订单", en: "Phase 0 shadow mode: no real orders placed" }
} as const satisfies Record<string, { zh: string; en: string }>;

export type MsgKey = keyof typeof DICT;

export function t(lang: Lang) {
  return (key: MsgKey, params?: Record<string, string | number>): string => {
    let s: string = DICT[key][lang];
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  };
}
