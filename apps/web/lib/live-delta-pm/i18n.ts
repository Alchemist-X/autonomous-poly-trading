// EN/中文 toggle for /live-delta-pm. Chinese is the source of truth (the page
// shipped zh-only); every zh string here is byte-identical to the original
// hardcoded copy. English keeps the same layout slots — tight, finance-literate,
// no filler. Data-carried strings (tickers, headlines, VM payload content) are
// never translated; only UI chrome, headings, verdict labels and explanatory
// copy go through this dictionary. The lang preference persists in a cookie set
// by app/live-delta-pm/lang/route.ts.

export type Lang = "zh" | "en";

export const LANG_COOKIE_NAME = "ldp_lang";
export const LANG_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Anything that isn't exactly "en" renders Chinese — the original behavior. */
export function parseLang(value: unknown): Lang {
  return value === "en" ? "en" : "zh";
}

export function otherLang(lang: Lang): Lang {
  return lang === "zh" ? "en" : "zh";
}

/** Label on the toggle link: names the language you would switch TO. */
export const LANG_TOGGLE_LABEL: Record<Lang, string> = { zh: "EN", en: "中文" };

const STR = {
  // ---- Unlock gate --------------------------------------------------------
  title: { zh: "Delta PM 决策链审计", en: "Delta PM Decision-Chain Audit" },
  gateIntro: {
    zh: "这是美股影子交易系统的内部审计页。输入访问码解锁（与 /engine 门相同的口令）。",
    en: "Internal audit page for the US-stock shadow-trading system. Enter the access code to unlock (same passphrase as the /engine gate)."
  },
  gateUnlock: { zh: "解锁 Unlock", en: "Unlock" },
  gateError: { zh: "访问码不对，再试一次。", en: "Wrong code — try again." },

  // ---- Report header ------------------------------------------------------
  kicker: { zh: "Tokyo VM · services/delta-pm · 内部审计页", en: "Tokyo VM · services/delta-pm · internal audit" },
  headerMeta: {
    zh: "每条新闻一份 IC memo：情报台 → 重要性检查 → 定价检查 → 研究 memo → PM 台 → 执行与风控。 每个数字逐项摊开，不做抽象汇总；白话标签旁保留原始枚举值（小号等宽字），便于与账本核对。",
    en: "One IC memo per news item: news desk → importance gate → priced-in gate → research memo → PM desk → execution & risk. Every number itemized, nothing abstracted away; raw enum values stay beside the plain labels (small mono) for ledger reconciliation."
  },
  bannerShadow: {
    zh: "Phase 0 影子模式 · 只记账，不下真实订单",
    en: "Phase 0 shadow mode · book-only, no real orders"
  },
  bannerLive: { zh: "实时数据 · VM /delta-pm/audit", en: "Live data · VM /delta-pm/audit" },
  tileEquity: { zh: "总权益（反思时点）", en: "Total equity (at reflection)" },
  tileInitial: { zh: "初始本金", en: "Initial capital" },
  tileRealized: { zh: "已实现盈亏", en: "Realized PnL" },
  tileRealizedSub: { zh: "影子账本累计", en: "shadow-book cumulative" },
  tilePositions: { zh: "当前持仓", en: "Open positions" },
  tileFlat: { zh: "空仓", en: "flat" },

  // ---- Glossary -----------------------------------------------------------
  glossarySummary: {
    zh: "术语表 — 本页所有行话的白话解释（点开）",
    en: "Glossary — plain definitions for every term on this page (click to open)"
  },

  // ---- Cases section ------------------------------------------------------
  casesNote: {
    zh: "每张卡片的大标签 = 这条新闻的最终结果（不相关 / 重要性不足 / 已被市场定价 / 已分析不开仓 / 已开仓……）； 点开卡片看六站决策链，灰色站点表示流程在前站已归档、未进行。",
    en: "Each card's big label = the item's final outcome (irrelevant / below the importance bar / already priced in / analyzed, no trade / opened…); expand a card for the six-station chain — grey stations were archived upstream and never ran."
  },
  casesEmpty: { zh: "暂无案例数据。", en: "No case data yet." },
  sumExpand: { zh: "展开决策链 ▾", en: "Expand chain ▾" },

  // ---- Stations -----------------------------------------------------------
  st1Title: { zh: "情报台", en: "News desk" },
  st1Sub: { zh: "新闻接收与溯源", en: "intake & provenance" },
  st2Title: { zh: "重要性检查", en: "Importance gate" },
  st2Sub: { zh: "值得动用分析资源吗", en: "worth analyst resources?" },
  st2Tag: { zh: "原 M1 · 闸门1", en: "ex-M1 · gate 1" },
  st3Title: { zh: "定价检查", en: "Priced-in gate" },
  st3Sub: { zh: "市场是否已消化", en: "has the market digested it?" },
  st3Tag: { zh: "原 M1 · 闸门2", en: "ex-M1 · gate 2" },
  st4Title: { zh: "研究 memo", en: "Research memo" },
  st4Sub: { zh: "分析师", en: "analyst" },
  st5Title: { zh: "PM 台", en: "PM desk" },
  st5Sub: { zh: "仓位决策", en: "position decision" },
  st6Title: { zh: "执行与风控", en: "Execution & risk" },

  // ---- Timing strip -------------------------------------------------------
  timingCaption: { zh: "耗时", en: "Latency" },
  timingAria: { zh: "各阶段耗时", en: "Per-stage latency" },
  timingPublish: { zh: "发布→抓取*", en: "publish→seen*" },
  timingGates: { zh: "检查", en: "gates" },
  timingResearch: { zh: "研究", en: "research" },
  timingDecision: { zh: "决策", en: "decision" },
  timingE2E: { zh: "端到端", en: "end-to-end" },
  timingNote: {
    zh: "* 发布→抓取含 CDN 60 秒缓存节奏",
    en: "* publish→seen includes the feed's 60 s CDN cache cadence"
  },
  timingTitle: {
    zh: "含 CDN 60 秒缓存节奏——feed 每 60 秒才刷新一次，此段耗时里有固定的缓存等待",
    en: "Includes the 60 s CDN cache cadence — the feed refreshes only every 60 s, so this span carries a fixed cache wait"
  },

  // ---- Station 1: archived original + news KVs ----------------------------
  archiveTitle: { zh: "存档原文", en: "Archived original" },
  archiveFull: { zh: "粘贴全文", en: "full paste" },
  archiveTeaser: { zh: "feed 导语", en: "feed teaser" },
  archiveLink: { zh: "原文链接 ↗", en: "Source link ↗" },
  archiveEmpty: {
    zh: "该条早于原文存档功能（2026-08-23 起存档），无原文留档。",
    en: "Predates the original-text archive (kept since 2026-08-23) — no original on file."
  },
  kvPublished: { zh: "发布时间 publishedUtc", en: "Published publishedUtc" },
  kvSeen: { zh: "系统见到 seenAtUtc", en: "Seen by system seenAtUtc" },
  kvPubSeenDelta: { zh: "发布 → 见到 Δ", en: "Publish → seen Δ" },
  kvFirstSeen: { zh: "首次公开 firstSeenUtc", en: "First public firstSeenUtc" },
  kvFingerprint: { zh: "信号指纹 fingerprint", en: "Signal fingerprint" },
  kvNewsId: { zh: "新闻 id", en: "News id" },
  quoteFirstSeenBasis: { zh: "firstSeenBasis 原文（t0 依据）", en: "firstSeenBasis verbatim (t0 basis)" },

  // ---- Station 2: importance gate -----------------------------------------
  matNotRecorded: { zh: "上游未记录重要性检查结果", en: "importance-gate result not recorded upstream" },
  matVerdictMissing: { zh: "检查结论未记录", en: "Gate verdict not recorded" },
  matPass: { zh: "通过 · 进入定价检查", en: "Pass · to priced-in gate" },
  matFail: { zh: "不通过 · 归档", en: "Fail · archived" },
  matNoTicker: { zh: "无标的命中", en: "No ticker hit" },
  quoteSurprise: {
    zh: "surpriseNote 原文（超出共识基线的部分）",
    en: "surpriseNote verbatim (the beyond-consensus part)"
  },
  quoteReason: { zh: "reason 原文", en: "reason verbatim" },

  // ---- Station 3: priced-in gate ------------------------------------------
  pinNotRecorded: { zh: "上游未记录定价检查结果", en: "priced-in result not recorded upstream" },
  kvRealizedExcess: { zh: "已实现超额涨跌 realizedExcessPct", en: "Realized excess move realizedExcessPct" },
  kvBetaBench: { zh: "β（基准）", en: "β (benchmark)" },
  kvVolumeZ: { zh: "成交量 Z 分位 volumeZ", en: "Volume Z-score volumeZ" },
  kvTEval: { zh: "评估时刻 tEvalUtc", en: "Evaluated at tEvalUtc" },
  kvDeltaT: { zh: "距 t0 时长 deltaTMinutes", en: "Time since t0 deltaTMinutes" },
  quotePinNote: {
    zh: "note 原文（内含反应完成度算式）",
    en: "note verbatim (includes the reaction-completion math)"
  },

  // ---- Station 4: research memo -------------------------------------------
  thesisNotRecorded: { zh: "上游未记录研究 memo", en: "research memo not recorded upstream" },
  bigMin: { zh: "公允冲击下限 min", en: "Fair impact min" },
  bigPoint: { zh: "点估计 point", en: "Point estimate" },
  bigMax: { zh: "公允冲击上限 max", en: "Fair impact max" },
  fairMissing: { zh: "fairImpactPct 未记录", en: "fairImpactPct not recorded" },
  subImpactPath: {
    zh: "影响传导路径 impactPath（全文，不截断）",
    en: "Impact path impactPath (verbatim, no truncation)"
  },
  subEvidence: { zh: "证据 evidence", en: "Evidence" },
  subCatalysts: { zh: "催化剂 catalysts", en: "Catalysts" },
  subFalsifiers: { zh: "证伪条件 falsifiers", en: "Falsifiers" },
  subLimitations: { zh: "局限 limitations", en: "Limitations" },

  // ---- Station 5: PM desk -------------------------------------------------
  decNotRecorded: { zh: "上游未记录 PM 决策", en: "PM decision not recorded upstream" },
  subEdge: { zh: "Edge 表（%，超额口径）", en: "Edge table (%, excess basis)" },
  thConservative: { zh: "保守口径", en: "Conservative" },
  thPoint: { zh: "点估计", en: "Point" },
  thRealized: { zh: "已实现", en: "Realized" },
  thResidual: { zh: "残余 edge", en: "Residual edge" },
  edgeMissing: {
    zh: "Edge 算术未记录（决策在此之前终止）",
    en: "Edge math not recorded (the decision ended before this step)"
  },
  subThreshold: { zh: "门槛分解表", en: "Threshold breakdown" },
  thCostItem: { zh: "成本项", en: "Cost item" },
  thFormula: { zh: "算式", en: "Formula" },
  thValue: { zh: "数值", en: "Value" },
  rowTakerFee: { zh: "taker 手续费", en: "Taker fee" },
  fOneWay: { zh: "单边", en: "one way" },
  rowSlippage: { zh: "滑点", en: "Slippage" },
  fOneWayEst: { zh: "单边估计", en: "one-way estimate" },
  rowFunding: { zh: "资金费", en: "Funding" },
  fFunding: { zh: "持有期合计（下限 0）", en: "holding-period total (floored at 0)" },
  rowRoundTrip: { zh: "往返成本", en: "Round-trip cost" },
  fRoundTrip: { zh: "2×(手续费+滑点)+资金费", en: "2×(fee+slippage)+funding" },
  rowCostFloor: { zh: "成本地板", en: "Cost floor" },
  fCostFloor: { zh: "= 3 × 往返成本", en: "= 3 × round trip" },
  rowVolFloor: { zh: "波动地板", en: "Vol floor" },
  fVolFloor: { zh: "= 0.5 × 日波动 × 持有折算", en: "= 0.5 × daily vol × horizon scaling" },
  rowThreshold: { zh: "门槛", en: "Threshold" },
  fThreshold: { zh: "= max(成本地板, 波动地板)", en: "= max(cost floor, vol floor)" },
  fVolBinds: { zh: " → 波动地板生效", en: " → vol floor binds" },
  fCostBinds: { zh: " → 成本地板生效", en: " → cost floor binds" },
  verdictPass: { zh: "通过门槛", en: "Clears threshold" },
  verdictFail: { zh: "不过门槛", en: "Below threshold" },
  thresholdMissing: {
    zh: "门槛分解未记录（决策在此之前终止）",
    en: "Threshold breakdown not recorded (the decision ended before this step)"
  },
  subStopMenu: { zh: "止损菜单 stopMenu", en: "Stop menu" },
  thCandidate: { zh: "候选", en: "Candidate" },
  thPxValue: { zh: "价格 / 数值", en: "Price / value" },
  rowAtr: { zh: "ATR(20 日)", en: "ATR (20d)" },
  rowAtrStop: { zh: "ATR 止损价", en: "ATR stop px" },
  rowSwing: { zh: "摆动位", en: "Swing level" },
  rowHardFloor: { zh: "硬性红线价", en: "Hard-floor px" },
  hardFloorSuffix: { zh: "（−20% 用户红线）", en: " (user's −20% red line)" },
  rowChosenStop: { zh: "选用止损价", en: "Chosen stop px" },
  rowStopDist: { zh: "止损距离", en: "Stop distance" },
  stopMenuMissing: {
    zh: "止损菜单未记录（决策在此之前终止）",
    en: "Stop menu not recorded (the decision ended before this step)"
  },
  subSizing: { zh: "Sizing 链", en: "Sizing chain" },
  eqEquity: { zh: "权益 equityUsd", en: "Equity equityUsd" },
  eqRiskBudget: { zh: "风险预算 riskBudgetPct", en: "Risk budget riskBudgetPct" },
  eqStopDist: { zh: "止损距离 stopDistPct", en: "Stop distance stopDistPct" },
  eqIntended: { zh: "意向名义 intendedNotionalUsd", en: "Intended notional intendedNotionalUsd" },
  thGuard: { zh: "风控闸 guard", en: "Guard" },
  thCap: { zh: "上限 capUsd", en: "Cap capUsd" },
  thNotionalAfter: { zh: "过闸后名义 notionalAfterUsd", en: "Notional after notionalAfterUsd" },
  thStatus: { zh: "状态", en: "Status" },
  tagClipped: { zh: "裁剪", en: "clipped" },
  tagPass: { zh: "通过", en: "pass" },
  kvFinalNotional: { zh: "最终名义 finalNotionalUsd", en: "Final notional finalNotionalUsd" },
  kvLevCaps: {
    zh: "杠杆三帽 configCap / volCap / venueCap → chosen",
    en: "Leverage caps configCap / volCap / venueCap → chosen"
  },
  levNote: {
    zh: "当前策略：不上杠杆（chosen=1，用户 2026-08-23 拍板）",
    en: "Current policy: no leverage (chosen=1, user call 2026-08-23)"
  },
  kvLevCapsShort: { zh: "杠杆三帽", en: "Leverage caps" },
  sizingMissing: {
    zh: "Sizing 链未记录（决策在此之前终止）",
    en: "Sizing chain not recorded (the decision ended before this step)"
  },
  noAuditNote: {
    zh: "此决策无逐项审计——审计字段自 2026-08-23 起记录，早于该时点的决策仅有 reason 原文。",
    en: "No itemized audit — audit fields are recorded since 2026-08-23; earlier decisions carry only the verbatim reason."
  },
  kvSizeUsd: { zh: "下单规模 sizeUsd", en: "Order size sizeUsd" },
  kvLeverage: { zh: "杠杆 leverage", en: "Leverage" },
  kvIntendedRisk: { zh: "意向风险 intendedRiskPct", en: "Intended risk intendedRiskPct" },
  kvRealizedRisk: { zh: "实际风险 realizedRiskPct", en: "Realized risk realizedRiskPct" },
  kvResidualEdge: { zh: "残余 edge residualEdgePct", en: "Residual edge residualEdgePct" },
  kvBinding: { zh: "被裁剪于 bindingConstraint", en: "Clipped by bindingConstraint" },
  kvHorizon: { zh: "持有期限 horizonUtc", en: "Horizon horizonUtc" },
  kvTarget: { zh: "目标超额区间 targetPctExcess", en: "Target excess range targetPctExcess" },
  kvStopPair: { zh: "止损 initialPx / hardFloorPx", en: "Stop initialPx / hardFloorPx" },
  quoteStopRule: { zh: "止损规则 stop.rule 原文", en: "stop.rule verbatim" },
  quoteDecisionReason: { zh: "decision.reason 原文", en: "decision.reason verbatim" },

  // ---- Station 6: execution & risk ----------------------------------------
  postNoRecord: { zh: "无记录", en: "no record" },
  subExecution: { zh: "模拟执行 execution", en: "Paper execution" },
  kvExecType: { zh: "类型 type", en: "Type" },
  kvExecTs: { zh: "成交时间 ts", en: "Fill time ts" },
  kvDirQty: { zh: "方向 / 数量", en: "Direction / qty" },
  kvFillPx: { zh: "成交价 fillPx", en: "Fill px fillPx" },
  kvExecNotional: { zh: "名义规模 sizeUsd", en: "Notional sizeUsd" },
  kvSlippage: { zh: "滑点（fillPx vs 决策 refPx）", en: "Slippage (fillPx vs decision refPx)" },
  posGone: {
    zh: "当前账本无此仓位（可能已平仓，见下方事件；或账本已重置）。",
    en: "Not in the current book (possibly closed — see events below — or the book was reset)."
  },
  subPostEvents: { zh: "风控事件时间线 postEvents", en: "Risk-event timeline postEvents" },
  postEventsEmpty: {
    zh: "暂无 stop_loss / hard_floor_stop / paper_close 事件。",
    en: "No stop_loss / hard_floor_stop / paper_close events yet."
  },
  subPosition: { zh: "当前仓位 positionNow", en: "Current position positionNow" },
  kvTickerDir: { zh: "标的 / 方向", en: "Ticker / direction" },
  kvEntryQty: { zh: "开仓价 entryPx / 数量 qty", en: "Entry px entryPx / qty" },
  kvEntryNotional: { zh: "开仓名义 notionalUsdAtEntry", en: "Entry notional notionalUsdAtEntry" },
  kvCurMark: { zh: "当前 mark", en: "Current mark" },
  noLiveMark: { zh: "—（快照未含实时 mark）", en: "— (snapshot lacks a live mark)" },
  kvUnrealized: { zh: "浮动盈亏 unrealizedPnlUsd", en: "Unrealized PnL unrealizedPnlUsd" },
  kvStopPx: { zh: "止损价 stopPx", en: "Stop px stopPx" },
  kvHardFloorPx: { zh: "硬性红线价 hardFloorPx（−20%）", en: "Hard-floor px hardFloorPx (−20%)" },
  kvBaseline: { zh: "t0 基准价 baselinePx", en: "t0 baseline px baselinePx" },
  kvBenchBaseline: { zh: "基准指数 t0 价 benchmarkBaselinePx", en: "Benchmark t0 px benchmarkBaselinePx" },
  kvBetaTrail: { zh: "β / 追踪止损", en: "β / trailing stop" },
  trailArmed: { zh: "追踪已启动", en: "trail armed" },
  trailNot: { zh: "追踪未启动", en: "trail not armed" },
  kvHighClose: { zh: "最高收盘 highestClosePx", en: "Highest close highestClosePx" },
  kvEntryUtc: { zh: "开仓时间 entryUtc", en: "Entry time entryUtc" },

  // ---- Reflection footer --------------------------------------------------
  reflectionNoFunnel: { zh: "反思报告未含漏斗数据。", en: "The reflection carries no funnel data." }
} satisfies Record<string, { zh: string; en: string }>;

export type StrKey = keyof typeof STR;

/** t(lang) returns a lookup bound to that language: const s = t(lang); s("title"). */
export const t =
  (lang: Lang) =>
  (key: StrKey): string =>
    STR[key][lang];
