import { pick, type ConsoleLocale } from "./research/locale";

export type PredictionEvidenceStance = "support" | "oppose" | "mixed" | "neutral";

export interface PredictionEngineRequest {
  eventText: string;
  marketPrice?: number | null;
  // Output locale for all human-readable prose (verdict, evidence, narration,
  // stage copy). English is the default to match the apex of the public site.
  locale?: ConsoleLocale;
}

export interface PredictionStage {
  id: string;
  order: number;
  title: string;
  summary: string;
  detail: string;
  durationMs: number;
}

export interface PredictionEvidence {
  id: string;
  sourceType: string;
  title: string;
  date: string;
  stance: PredictionEvidenceStance;
  weightPct: number;
  reliability: number;
  node: string;
  excerpt: string;
  url?: string;
}

export interface PredictionModelNode {
  id: string;
  label: string;
  probability: number;
  rationale: string;
}

export interface PredictionUpdate {
  label: string;
  from: number;
  to: number;
  explanation: string;
}

export interface PredictionServiceInfo {
  source: "demo" | "local" | "vps" | string;
  endpointLabel: string;
  status: "complete" | "running" | "unavailable" | string;
  note: string;
  elapsedMs?: number;
}

export interface PredictionProgressItem {
  id: string;
  stageId: string;
  order: number;
  title: string;
  detail: string;
  outcome: string;
  artifactLabel?: string;
  durationMs: number;
}

export interface PredictionEngineRun {
  id: string;
  mode: "demo_read_only" | "local_proxy" | "vps_proxy" | string;
  eventText: string;
  generatedAtUtc: string;
  service: PredictionServiceInfo;
  conclusion: {
    yesProbability: number;
    confidenceInterval: [number, number];
    marketProbability: number | null;
    edge: number | null;
    verdict: string;
  };
  stages: PredictionStage[];
  evidence: PredictionEvidence[];
  model: PredictionModelNode[];
  updates: PredictionUpdate[];
  progress: PredictionProgressItem[];
  limitations: string[];
  archiveLinks: Array<{
    label: string;
    path: string;
  }>;
  // Optional real per-stage narration (stageId -> lines). When present, the
  // replay streams these instead of synthetic progress lines — used by the
  // real-research snapshot to surface the actual pipeline (search angles, raw
  // findings, adversarial verdicts) step by step.
  progressByStage?: Record<string, string[]>;
  // Snapshot date + the event's resolution deadline (curated real-research cases
  // supply these). Surfaced prominently because the forecast is a point-in-time
  // read of a fast-moving, time-boxed event.
  asOf?: string;
  deadline?: string;
}

export const DEFAULT_PREDICTION_EVENT = "美国和伊朗能在 2026-06-30 前达成核协议吗？";

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundProbability(value: number): number {
  return Number(clamp(value, 0.02, 0.98).toFixed(4));
}

function roundDelta(value: number): number {
  return Number(value.toFixed(4));
}

function formatProbability(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "N/A";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function parseMarketPrice(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value > 1 ? roundProbability(value / 100) : roundProbability(value);
}

// Source-type category labels are authored in Chinese in the evidence data;
// this maps the finite set to English so the ledger reads in one language.
const SOURCE_TYPE_EN: Record<string, string> = {
  官方声明: "Official statement",
  官方数据: "Official data",
  官方表态: "Official remarks",
  主流媒体: "Mainstream media",
  "主流媒体（区域）": "Mainstream media (regional)",
  "第三方分析": "Third-party analysis",
  "第三方分析（智库）": "Third-party analysis (think tank)",
  "当事方媒体（伊朗官方）": "Party-side media (Iran official)",
  "当事方/本地来源": "Party-side / local source",
  预测市场: "Prediction market",
  "国际机构/官方研究": "International body / official research",
  "政治/安全动态": "Political / security development"
};

function localizeSourceType(locale: ConsoleLocale, zh: string): string {
  return locale === "zh" ? zh : SOURCE_TYPE_EN[zh] ?? zh;
}

function isIranNuclearEvent(eventText: string): boolean {
  const lower = eventText.toLowerCase();
  return (
    lower.includes("iran") ||
    lower.includes("伊朗") ||
    lower.includes("nuclear") ||
    lower.includes("核协议") ||
    lower.includes("核")
  );
}

function isFedRateCutEvent(eventText: string): boolean {
  const lower = eventText.toLowerCase();
  return (
    lower.includes("美联储") ||
    lower.includes("降息") ||
    lower.includes("基点") ||
    lower.includes("fed") ||
    lower.includes("rate cut")
  );
}

function buildFedEvidence(): PredictionEvidence[] {
  // Ordered so the Bayesian update reads sensibly: a strong official signal
  // first (lifts the baseline), then the counter-evidence (tempers it), then
  // the remaining supporting data. Node A = inflation room, B = growth/labour
  // softening, C = a ≥50bp cut actually landing before the deadline.
  // Titles + excerpts are authored in English; only the sourceType category is
  // localized at run assembly.
  return [
    {
      id: "fomc-statement-2026-06-12",
      sourceType: "官方声明",
      title: "FOMC June statement turns data-dependent, opens the door to cuts",
      date: "2026-06-12",
      stance: "support",
      weightPct: 4.0,
      reliability: 0.88,
      node: "A",
      excerpt: "The Committee dropped its tightening bias and flagged 'increased confidence' inflation is moving toward 2% — consistent with cuts, though not yet committed.",
      url: "https://www.federalreserve.gov/"
    },
    {
      id: "bls-jobs-2026-06-06",
      sourceType: "官方数据",
      title: "May payrolls beat; services inflation still sticky",
      date: "2026-06-06",
      stance: "oppose",
      weightPct: -3.6,
      reliability: 0.8,
      node: "B",
      excerpt: "A hot labour print and sticky core-services prices weaken the case for an urgent 50bp of easing this soon.",
      url: "https://www.bls.gov/"
    },
    {
      id: "fed-official-hawkish-2026-06-15",
      sourceType: "官方表态",
      title: "Fed official: 'no rush' to cut",
      date: "2026-06-15",
      stance: "oppose",
      weightPct: -2.4,
      reliability: 0.72,
      node: "C",
      excerpt: "A voting member pushed back on near-term cuts, lowering the odds of a cumulative ≥50bp before the deadline."
    },
    {
      id: "cpi-2026-06-11",
      sourceType: "官方数据",
      title: "May core CPI cools to ~2.6% YoY",
      date: "2026-06-11",
      stance: "support",
      weightPct: 4.4,
      reliability: 0.82,
      node: "A",
      excerpt: "A cooler-than-expected core CPI gives the Fed room to begin easing within the window.",
      url: "https://www.bls.gov/cpi/"
    },
    {
      id: "dot-plot-2026-06-12",
      sourceType: "第三方分析",
      title: "Updated dot plot median implies two 2026 cuts",
      date: "2026-06-12",
      stance: "support",
      weightPct: 3.2,
      reliability: 0.8,
      node: "C",
      excerpt: "If the median projection holds, two 25bp moves clear the ≥50bp bar — but timing relative to September is the live question."
    }
  ];
}

function buildStages(locale: ConsoleLocale): PredictionStage[] {
  return [
    {
      id: "definition",
      order: 1,
      title: pick(locale, "Frame the definition", "理清定义"),
      summary: pick(
        locale,
        "Pin down the Yes/No trigger, the deadline, the parties, and the official resolution criterion.",
        "确定 Yes/No 触发条件、截止时间、主体和官方认定口径。"
      ),
      detail: pick(
        locale,
        "Separate one-sided statements, ongoing talks, an interim framework, and a settleable agreement — so news buzz isn't mistaken for the event completing.",
        "把单方表态、继续谈判、临时框架和可结算协议分开，避免把新闻热度误当成事件完成。"
      ),
      durationMs: 420
    },
    {
      id: "query-design",
      order: 2,
      title: pick(locale, "Base reasoning & queries", "基础推理与 query"),
      summary: pick(
        locale,
        "Break the event into 2–5 necessary conditions and generate official, media, party-side, and third-party queries for each.",
        "拆成 2-5 个必要条件，并为每个条件生成官方、媒体、当事方和第三方 query。"
      ),
      detail: pick(
        locale,
        "This step sets downstream evidence coverage; production writes the query plan into the Pulse artifact.",
        "这一步决定后续证据覆盖面，生产版会把 query plan 写入 Pulse artifact。"
      ),
      durationMs: 360
    },
    {
      id: "evidence",
      order: 3,
      title: pick(locale, "Evidence collection", "证据收集与罗列"),
      summary: pick(
        locale,
        "Organize evidence by source type: official statements, mainstream media, party-side media, third-party analysis, political/security developments.",
        "按来源类型整理证据：官方声明、主流媒体、当事方媒体、第三方分析、政治/安全动态。"
      ),
      detail: pick(
        locale,
        "The demo shows an auditable data structure; real mode draws from Pulse web-search and page scraping.",
        "Demo 展示的是可审计的数据结构；真实模式会来自 Pulse web-search 与页面抓取。"
      ),
      durationMs: 520
    },
    {
      id: "weighting",
      order: 4,
      title: pick(locale, "Evidence weighting", "证据权重更新"),
      summary: pick(
        locale,
        "Weight each item by primary-source quality, recency, cross-corroboration, and strategic-signalling risk.",
        "按一手性、时效、交叉印证和战略性放话风险给每条证据加权。"
      ),
      detail: pick(
        locale,
        "Strong support/oppose isn't judged by headline alone — it maps to specific model nodes.",
        "强支持/强反对不会只看标题，会落到具体模型节点。"
      ),
      durationMs: 380
    },
    {
      id: "model",
      order: 5,
      title: pick(locale, "Structured model", "结构化模型"),
      summary: pick(
        locale,
        "Decompose the event into conditional probabilities: P(Yes)=P(A)×P(B|A)×P(C|A,B).",
        "把事件拆成条件概率：P(Yes)=P(A)xP(B|A)xP(C|A,B)。"
      ),
      detail: pick(
        locale,
        "Each node retains its probability, rationale, key evidence, and residual uncertainty.",
        "每个节点保留概率、理由、关键证据和残余不确定性。"
      ),
      durationMs: 460
    },
    {
      id: "bayes",
      order: 6,
      title: pick(locale, "Bayesian update", "贝叶斯式更新"),
      summary: pick(
        locale,
        "Start from a baseline probability and explain item by item how key evidence raises or lowers it.",
        "从基线概率出发，逐条说明重要证据如何上调或下调。"
      ),
      detail: pick(
        locale,
        "Outputs a point probability and an 80% subjective interval — not just likely/unlikely.",
        "输出主概率和 80% 主观置信区间，而不是只给可能/不可能。"
      ),
      durationMs: 440
    },
    {
      id: "market",
      order: 7,
      title: pick(locale, "Conclusion & market gap", "结论与市场偏差"),
      summary: pick(
        locale,
        "Give the Yes probability and interval, then compare with the market price to check for an edge.",
        "给出 Yes 概率、置信区间，并和市场价格比较是否存在 edge。"
      ),
      detail: pick(
        locale,
        "The demo never trades; real execution still passes Pulse risk controls and exchange thresholds.",
        "Demo 不会下单；真实执行仍要经过 Pulse 风控和交易所门槛。"
      ),
      durationMs: 340
    }
  ];
}

// US–Iran nuclear-deal evidence ledger — REAL research snapshot (2026-06-13),
// produced by the multi-agent deep-research workflow (6 web-search angles +
// 3 adversarial verifiers + synthesis). Live source URLs + dates below; this is
// the flagship "Skuld" case's data, not hand-mocked. Re-run the workflow to
// refresh it as the 2026-06-30 deadline approaches.
function buildIranEvidence(locale: ConsoleLocale): PredictionEvidence[] {
  const excerpts = IRAN_CONTENT[locale].excerpts;
  return [
    {
      id: "techtimes-2026-06-13",
      sourceType: "主流媒体",
      title: "Iran Peace Deal Text Agreed: 440kg Enriched Uranium Stays in Tehran During 60-Day Talks",
      date: "2026-06-13",
      stance: "oppose",
      weightPct: -14,
      reliability: 0.55,
      node: "B",
      excerpt: excerpts["techtimes-2026-06-13"]!,
      url: "https://www.techtimes.com/articles/318319/20260613/iran-peace-deal-text-agreed-440kg-enriched-uranium-stays-tehran-during-60-day-talks.htm"
    },
    {
      id: "cnn-liveblog-2026-06-12",
      sourceType: "主流媒体",
      title: "US and Iran say an agreement is close, but questions remain (live blog)",
      date: "2026-06-12",
      stance: "mixed",
      weightPct: 3,
      reliability: 0.7,
      node: "A",
      excerpt: excerpts["cnn-liveblog-2026-06-12"]!,
      url: "https://www.cnn.com/2026/06/12/world/live-news/iran-war-trump-israel"
    },
    {
      id: "isis-2026-06-04",
      sourceType: "第三方分析（智库）",
      title: "Analysis of IAEA Iran Verification and Monitoring and NPT Safeguards Reports — June 2026",
      date: "2026-06-04",
      stance: "oppose",
      weightPct: -10,
      reliability: 0.85,
      node: "C",
      excerpt: excerpts["isis-2026-06-04"]!,
      url: "https://isis-online.org/isis-reports/analysis-of-iaea-iran-verification-and-monitoring-and-npt-safeguards-reports-june-2026"
    },
    {
      id: "presstv-baghaei-2026-05-23",
      sourceType: "当事方媒体（伊朗官方）",
      title: "Iran, US moving closer to 'finalizing memorandum of understanding': Baghaei",
      date: "2026-05-23",
      stance: "oppose",
      weightPct: -9,
      reliability: 0.8,
      node: "B",
      excerpt: excerpts["presstv-baghaei-2026-05-23"]!,
      url: "https://www.presstv.ir/Detail/2026/05/23/769157/Iran-US-Baghaei-understanding-nuclear"
    },
    {
      id: "aljazeera-2026-06-12",
      sourceType: "主流媒体（区域）",
      title: "Are Iran, US really close to a breakthrough 'deal'?",
      date: "2026-06-12",
      stance: "oppose",
      weightPct: -8,
      reliability: 0.85,
      node: "B",
      excerpt: excerpts["aljazeera-2026-06-12"]!,
      url: "https://www.aljazeera.com/features/2026/6/12/are-iran-us-really-close-to-a-breakthrough-deal"
    },
    {
      id: "polymarket-by-june30-2026-06-14",
      sourceType: "预测市场",
      title: "US-Iran nuclear deal by June 30? (Polymarket)",
      date: "2026-06-14",
      stance: "support",
      weightPct: 6,
      reliability: 0.8,
      node: "C",
      excerpt: excerpts["polymarket-by-june30-2026-06-14"]!,
      url: "https://polymarket.com/event/us-iran-nuclear-deal-by-june-30"
    },
    {
      id: "ukcommons-cbp10637-2026-06-12",
      sourceType: "国际机构/官方研究",
      title: "US-Iran ceasefire and nuclear talks in 2026 (research briefing)",
      date: "2026-06-12",
      stance: "oppose",
      weightPct: -7,
      reliability: 0.75,
      node: "C",
      excerpt: excerpts["ukcommons-cbp10637-2026-06-12"]!,
      url: "https://commonslibrary.parliament.uk/research-briefings/cbp-10637/"
    },
    {
      id: "kalshi-index-2026-06-14",
      sourceType: "预测市场",
      title: "New US-Iran nuclear deal this year? (Kalshi)",
      date: "2026-06-14",
      stance: "oppose",
      weightPct: -2,
      reliability: 0.5,
      node: "C",
      excerpt: excerpts["kalshi-index-2026-06-14"]!,
      url: "https://kalshi.com/markets/kxusairanagreement"
    }
  ];
}

function buildGenericEvidence(eventText: string, hash: number): PredictionEvidence[] {
  const topic = eventText.length > 54 ? `${eventText.slice(0, 51)}...` : eventText;
  const supportWeight = Number((2.4 + (hash % 34) / 10).toFixed(1));
  const opposeWeight = Number((-2.8 - (hash % 29) / 10).toFixed(1));
  return [
    {
      id: "source-need-official",
      sourceType: "官方声明",
      title: `Need official confirmation standard for: ${topic}`,
      date: "demo",
      stance: "neutral",
      weightPct: 0,
      reliability: 0.9,
      node: "A",
      excerpt: "Production mode should first identify the body or party that can resolve the event."
    },
    {
      id: "source-need-mainstream",
      sourceType: "主流媒体",
      title: "Cross-check mainstream reporting for factual state",
      date: "demo",
      stance: "mixed",
      weightPct: supportWeight,
      reliability: 0.74,
      node: "A",
      excerpt: "Use mainstream reporting to fill factual gaps only after primary sources are checked."
    },
    {
      id: "source-need-party-local",
      sourceType: "当事方/本地来源",
      title: "Check local or party-side denials",
      date: "demo",
      stance: "oppose",
      weightPct: opposeWeight,
      reliability: 0.62,
      node: "B",
      excerpt: "Local denials often matter more than broad market chatter for event-resolution edge cases."
    },
    {
      id: "source-need-third-party",
      sourceType: "第三方分析",
      title: "Compare think-tank or specialist interpretation",
      date: "demo",
      stance: "mixed",
      weightPct: Number((supportWeight / 2).toFixed(1)),
      reliability: 0.68,
      node: "B",
      excerpt: "Third-party analysis helps interpret incentives but should not outrank primary evidence."
    },
    {
      id: "source-need-dynamics",
      sourceType: "政治/安全动态",
      title: "Track blocking events and deadline pressure",
      date: "demo",
      stance: "neutral",
      weightPct: Number((opposeWeight / 2).toFixed(1)),
      reliability: 0.64,
      node: "C",
      excerpt: "Deadline pressure can raise action odds while blocking events can sharply lower settlement-quality odds."
    }
  ];
}

function buildModel(eventText: string, hash: number, locale: ConsoleLocale): PredictionModelNode[] {
  if (isIranNuclearEvent(eventText)) {
    // Real research snapshot (2026-06-13): product ≈ 0.72×0.15×0.45 ≈ 5%,
    // calibrated up to 10% (see resolveCuratedCase) for the broad-criterion tail.
    const labels = IRAN_CONTENT[locale].modelLabels;
    const rationales = IRAN_CONTENT[locale].modelRationales;
    return [
      { id: "A", label: labels.A, probability: 0.72, rationale: rationales.A },
      { id: "B", label: labels.B, probability: 0.15, rationale: rationales.B },
      { id: "C", label: labels.C, probability: 0.45, rationale: rationales.C }
    ];
  }

  if (isFedRateCutEvent(eventText)) {
    const labels = FED_CONTENT[locale].modelLabels;
    const rationales = FED_CONTENT[locale].modelRationales;
    return [
      { id: "A", label: labels.A, probability: 0.8, rationale: rationales.A },
      { id: "B", label: labels.B, probability: 0.85, rationale: rationales.B },
      { id: "C", label: labels.C, probability: 0.84, rationale: rationales.C }
    ];
  }

  const a = roundProbability(0.42 + (hash % 2600) / 10000);
  const b = roundProbability(0.46 + ((hash >>> 4) % 3000) / 10000);
  const c = roundProbability(0.58 + ((hash >>> 8) % 2400) / 10000);
  return [
    {
      id: "A",
      label: pick(locale, "A: Event reaches an actionable stage", "A: 事件进入可执行阶段"),
      probability: a,
      rationale: pick(
        locale,
        "Estimate from the description whether the parties have moved past pure posturing.",
        "基于事件描述先估计各方是否已经越过纯表态阶段。"
      )
    },
    {
      id: "B",
      label: pick(locale, "B|A: Key constraints are satisfied", "B|A: 关键约束被满足"),
      probability: b,
      rationale: pick(
        locale,
        "Check whether legal, financial, political, technical, or military constraints still block the outcome.",
        "检查法律、资金、政治、技术或军事约束是否仍会阻断结果。"
      )
    },
    {
      id: "C",
      label: pick(locale, "C|A,B: Publicly confirmable before the deadline", "C|A,B: 截止前可被公开确认"),
      probability: c,
      rationale: pick(
        locale,
        "Short-deadline events usually hinge on the confirmation criterion, execution detail, or public disclosure.",
        "短期限事件最后通常卡在确认口径、执行细节或公开披露。"
      )
    }
  ];
}

function buildUpdates(
  baseline: number,
  finalProbability: number,
  evidence: PredictionEvidence[],
  locale: ConsoleLocale
): PredictionUpdate[] {
  const first = roundProbability(clamp(baseline + evidence[0]!.weightPct / 100, 0.02, 0.98));
  const second = roundProbability(clamp(first + evidence.slice(1, 3).reduce((sum, item) => sum + item.weightPct, 0) / 100, 0.02, 0.98));
  return [
    {
      label: pick(locale, "Baseline", "基线"),
      from: baseline,
      to: baseline,
      explanation: pick(
        locale,
        "Start from the base success rate of same-type, same-horizon events.",
        "从同类型、同期限事件的基础成功率开始。"
      )
    },
    {
      label: pick(locale, "Official / mainstream evidence", "官方/主流证据"),
      from: baseline,
      to: first,
      explanation: pick(
        locale,
        "Official signals and mainstream reporting decide whether to move off the baseline.",
        "官方信号和主流报道决定是否把概率推离基线。"
      )
    },
    {
      label: pick(locale, "Counter-evidence", "反向证据"),
      from: first,
      to: second,
      explanation: pick(
        locale,
        "Party-side denials, execution obstacles, or verification problems lower the settleable-outcome probability.",
        "当事方否认、执行障碍或验证问题会下调可结算结果概率。"
      )
    },
    {
      label: pick(locale, "Model calibration", "模型校准"),
      from: second,
      to: finalProbability,
      explanation: pick(
        locale,
        "The conditional-probability model yields the final Yes probability and interval.",
        "条件概率模型给出最终 Yes 概率和置信区间。"
      )
    }
  ];
}

function buildProgressItems(input: {
  stages: PredictionStage[];
  evidence: PredictionEvidence[];
  model: PredictionModelNode[];
  yesProbability: number;
  marketProbability: number | null;
  edge: number | null;
  locale: ConsoleLocale;
}): PredictionProgressItem[] {
  const { locale } = input;
  const evidenceCount = input.evidence.length;
  const supportCount = input.evidence.filter((item) => item.stance === "support").length;
  const opposeCount = input.evidence.filter((item) => item.stance === "oppose").length;
  const marketText =
    input.marketProbability == null
      ? pick(locale, "no market price", "未提供市场价格")
      : pick(locale, `market ${formatProbability(input.marketProbability)}`, `市场 ${formatProbability(input.marketProbability)}`);
  const edgeText =
    input.edge == null
      ? pick(locale, "edge n/a", "edge 未计算")
      : `edge ${(input.edge * 100).toFixed(1)}pp`;
  const modelIds = input.model.map((node) => node.id).join("/");
  const outcomes: Record<string, { outcome: string; artifactLabel: string }> = {
    definition: {
      outcome: pick(
        locale,
        "Locked the event's parties, deadline, Yes/No trigger boundary, and the resolution criterion needing human review.",
        "已确定事件主体、截止时间、Yes/No 触发边界和需要人工复核的结算口径。"
      ),
      artifactLabel: "resolution_definition"
    },
    "query-design": {
      outcome: pick(
        locale,
        "Decomposed the event into A/B/C condition nodes and prepared official, media, party-side, local, and third-party queries.",
        "已把事件拆成 A/B/C 条件节点，并准备官方、媒体、当事方、本地与第三方 query。"
      ),
      artifactLabel: "query_plan"
    },
    evidence: {
      outcome: pick(
        locale,
        `Compiled ${evidenceCount} evidence items — ${supportCount} supporting, ${opposeCount} opposing, the rest for boundary checks.`,
        `已整理 ${evidenceCount} 条证据，其中支持 ${supportCount} 条、反对 ${opposeCount} 条，其余用于边界校验。`
      ),
      artifactLabel: "evidence_ledger"
    },
    weighting: {
      outcome: pick(
        locale,
        "Wrote evidence weights from source primacy, recency, cross-corroboration, and strategic-signalling risk.",
        "已按来源一手性、时效、交叉印证和战略性放话风险写入证据权重。"
      ),
      artifactLabel: "evidence_weights"
    },
    model: {
      outcome: pick(
        locale,
        `Built the ${modelIds} conditional-probability model and verified its multiplicative structure.`,
        `已建立 ${modelIds} 条件概率模型，并完成乘法结构校验。`
      ),
      artifactLabel: "conditional_model"
    },
    bayes: {
      outcome: pick(
        locale,
        `Merged evidence impact into the baseline; final Yes probability ${formatProbability(input.yesProbability)}.`,
        `已将证据影响合并到基线，最终 Yes 概率为 ${formatProbability(input.yesProbability)}。`
      ),
      artifactLabel: "bayes_update"
    },
    market: {
      outcome: pick(
        locale,
        `Output the conclusion: ${formatProbability(input.yesProbability)}, ${marketText}, ${edgeText}.`,
        `已输出结论：${formatProbability(input.yesProbability)}，${marketText}，${edgeText}。`
      ),
      artifactLabel: "market_comparison"
    }
  };

  return input.stages.map((stage) => ({
    id: `progress-${stage.id}`,
    stageId: stage.id,
    order: stage.order,
    title: stage.title,
    detail: stage.detail,
    outcome: outcomes[stage.id]?.outcome ?? stage.summary,
    artifactLabel: outcomes[stage.id]?.artifactLabel,
    durationMs: stage.durationMs
  }));
}

// ── Curated real-research content, locale-keyed ─────────────────────────────
// The US–Iran case is a REAL deep-research snapshot (2026-06-13). The English
// side is a faithful translation of the authored Chinese — every number, date,
// unit, URL, and proper noun is preserved identically; only prose differs.

interface IranContent {
  verdict: string;
  excerpts: Record<string, string>;
  modelLabels: Record<"A" | "B" | "C", string>;
  modelRationales: Record<"A" | "B" | "C", string>;
  updateLabels: [string, string, string, string];
  updateExplanations: [string, string, string, string];
  limitations: string[];
  progressByStage: Record<string, string[]>;
}

const IRAN_CONTENT: Record<ConsoleLocale, IranContent> = {
  zh: {
    verdict:
      "判 NO（严格意义上的合格核协议在 2026-06-30 前达成的概率约 10%）。核心驱动：实际临近签署的 MOU 按设计就不是核协议——浓缩上限、核查机制、约 440kg 高浓铀处置全部被推迟到签署后 60 天窗口（跑到约 8 月底），而 IAEA 约 97 天零准入使任何可结算的核协议在 16 天内物理上不可能。Polymarket 的 67% 衡量的是宽泛口径（任何公开宣布的核协议），并非本题的严格判定标准。",
    excerpts: {
      "techtimes-2026-06-13":
        "在桌面上的唯一协议（Islamabad Declaration MOU）是非约束性工具，不要求交出/封顶约 440kg 60% 高浓铀，未指定核查机制，把浓缩/核查/库存谈判推到签署后才开始的 60 天窗口；截至 6/13 仍未签署，等待伊朗最高领袖批准。",
      "cnn-liveblog-2026-06-12":
        "美伊（巴基斯坦斡旋）就草案 MOU 最终文本达成一致，Trump 暗示数日内可能在欧洲签署；伊朗承诺永不获取或发展核武器，但清除高浓铀库存的技术细节未决、被推迟到下一轮技术谈判。",
      "isis-2026-06-04":
        "IAEA 自 2026-02-28 起停止对伊核保障核查；机构对 8 处设施无准入，无法核查浓缩/再处理暂停，也无法核查约 440.9kg 60% 高浓铀。结论：在恢复准入前近期核查安排存在问题，节点 C 结构性受阻。",
      "presstv-baghaei-2026-05-23":
        "外交部发言人 Baghaei 称 14 点 MOU 聚焦结束战争、停止美海军行动、释放被冻结资产，并明确现阶段不讨论核问题细节，把核/浓缩事项推迟到后续谈判——框架本身不含合格核条款。",
      "aljazeera-2026-06-12":
        "分析人士（Chatham House 的 Tabrizi、NATO Defense College 的 Weitz）称这不是最终核解决方案：伊朗方案把浓缩与导弹移出初始协议、把核细节推入 60 天窗口；敲定核细节相比重开霍尔木兹海峡极具挑战性。",
      "polymarket-by-june30-2026-06-14":
        "直接截止日匹配：约 67% YES，约 $8.8M 成交量（6/14 直取页面确认）。结算口径宽泛——只要 6/30 前公开宣布任何相互核协议即可 YES，不要求浓缩上限/核查/库存条款，因此高估严格合格协议。",
      "ukcommons-cbp10637-2026-06-12":
        "Islamabad Declaration 将在 30 天内重开霍尔木兹海峡，但把伊朗 440kg 库存留待 60 天后续谈判，不要求签署前交出、移除、销毁或封顶；IAEA 无法核查剩余高浓铀——核条款在 6/30 前不可结算。",
      "kalshi-index-2026-06-14":
        "Kalshi 市场早 6 月快照显示 7 月前仅约 23%、11 月前约 53%，显著低于 Polymarket 的 6/30 读数。实时数字因 HTTP 429 无法刷新，按陈旧下行锚点处理、已下调权重。"
    },
    modelLabels: {
      A: "A: 双方公开接受框架/MOU",
      B: "B|A: 框架含充分合格核条款（浓缩/核查/库存）",
      C: "C|A,B: 6/30 前可公开确认并可结算"
    },
    modelRationales: {
      A: "Islamabad Declaration MOU 文本约 6/12 达成、签署被吹风为临近；但截至 6/14 仍未签署，等待伊朗最高领袖批准，Baghaei 还公开反驳了 Trump 的时间表。框架获双方公开接受概率高但不确定。",
      B: "结构性致命点。CNN、Al Jazeera、ISIS、UK Commons Library 及伊美双方官员一致确认 MOU 刻意把核实质剥离：约 440kg 高浓铀留在德黑兰、无指定核查机制、浓缩时长争议未解，全部推迟到签署后 60 天窗口。该工具按设计不构成合格核协议。",
      C: "即便假设存在合格框架，IAEA 已约 97 天零准入、无法核查 440.9kg 库存，核查在窗口内物理上不可能，且 60 天时钟跑到约 8 月底。核档案的可结算性高度受限。"
    },
    updateLabels: ["基线", "官方信号/框架动能", "反向证据（核条款被推迟）", "模型校准"],
    updateExplanations: [
      "起点：16 天硬窗口内达成并可结算一份带核查的完整核协议历史上罕见，基率偏低。",
      "White House 视频、行政官员称协议导向拆解伊朗核计划、CNN 报道伊朗承诺永不发展核武器、Polymarket 宽口径约 67%——把节点 A 推高并提供少量上行。",
      "决定性反向证据：MOU 按设计把浓缩上限/核查/约 440kg 高浓铀处置推到签署后 60 天窗口；IAEA 约 97 天零准入使核查不可能；MOU 6/14 仍未签且伊朗公开拖延。节点 B 基本不满足、C 结构性受阻。",
      "条件模型 P(A)·P(B|A)·P(C|A,B)≈0.72·0.15·0.45≈0.05；考虑题目有一定概率按更宽松的市场标准结算，向上微调至 0.10，与三条验证视角 0.08–0.22 区间一致。"
    ],
    limitations: [
      "本结论是 2026-06-13 的真实联网研究快照（6 路 web 搜索 + 3 路对抗校验 + 综合）；截止 6/30 前局势可能变化，临近截止应重跑刷新。",
      "市场参考为 Polymarket 宽口径市场（任何公开核协议即 YES，约 67%），与本题严格判定标准（需含浓缩上限/核查/库存）不同，故出现约 -57pp 的大幅 edge。",
      "关键不确定性（IAEA 核查缺位、MOU 是否如期签署、60 天窗口走向）见证据账本中的来源链接。",
      "完整原始数据（6 路角度共 34 条发现 + 3 路对抗校验全文 + 综合）已存快照：apps/web/lib/research/snapshots/us-iran-nuclear-2026-06-13.json。"
    ],
    progressByStage: {
      definition: [
        "结算口径：6/30 前双方公开确认、可结算、且含核条款（浓缩上限/核查/库存）的协议；停火、模糊声明或继续谈判都不算。",
        "拆成三个必要条件：A 双方接受框架 × B 含合格核条款 × C 6/30 前可结算。"
      ],
      "query-design": [
        "并行 6 路联网检索 + 3 路对抗校验。",
        "角度：美国官方 / 伊朗官方 / IAEA·国际机构 / 西方媒体 / 区域分析 / 预测市场。"
      ],
      evidence: [
        "联网搜索得 34 条原始发现（2026 年源优先；一条 2015 旧闻、一条 2025 旧红线已剔除或标注）。",
        "美国官方：Trump 称『已有协议、伊朗永不拥核』(6/11)，但行政官员把拆解/核查放进签署后 60 天窗口、自评置信仅 80-85%。",
        "伊朗官方：发言人 Baghaei 明确『现阶段不谈核细节』；伊朗否认已同意交出浓缩铀。",
        "IAEA：约 97 天零准入、440.9kg 60% 高浓铀无法核查（ISIS 6/4、理事会 6/10 决议）。",
        "西方媒体：MOU 约 95% 完成但仍未签，核条款明确推迟到 60 天窗口（CNN/TechTimes/UK Commons）。",
        "区域分析：浓缩时长美 20 年 vs 伊 5 年僵局未解；预测市场 Polymarket 6/30 宽口径约 67%($8.8M)，Kalshi 7 月前约 23%（陈旧）。"
      ],
      weighting: [
        "按一手性 / 时效 / 交叉印证加权；去重后保留 8 条进入账本。",
        "对抗校验①时效真实性：两条 support 为真且属 2026，但只支撑『框架』弱版本；Polymarket 67% 衡量宽口径、非严格 B 节点。",
        "对抗校验②反方求证：MOU 按设计就不是核协议，核实质全在签署后 60 天窗口；16 天内达成并核查完整协议基率极低。",
        "对抗校验③市场校准：严格口径约 0.08–0.18；若按市场宽口径结算约 0.50–0.62；三视角综合区间 0.08–0.40。"
      ],
      model: ["条件概率模型：A 0.72 × B|A 0.15 × C|A,B 0.45 ≈ 模型基线 5%（再校准上调到 10%）。"],
      bayes: ["贝叶斯路径：基线 12% → 官方信号/框架动能 18% → 核条款被推迟 8% → 模型校准 10%。"],
      market: ["对比 Polymarket 宽口径 67%（任何公开核协议即 YES，口径不同）→ edge 约 -57pp。"]
    }
  },
  en: {
    verdict:
      "Verdict: NO (the probability of a strictly qualifying nuclear deal being reached before 2026-06-30 is ~10%). Core driver: the MOU actually nearing signature is by design not a nuclear deal — the enrichment cap, verification mechanism, and disposition of ~440kg of HEU are all deferred to a 60-day window that starts only after signing (running to ~end of August), while IAEA's ~97 days of zero access make any settleable nuclear deal physically impossible within 16 days. Polymarket's 67% measures a broad criterion (any publicly announced nuclear deal), not this question's strict resolution standard.",
    excerpts: {
      "techtimes-2026-06-13":
        "The only agreement on the table (the Islamabad Declaration MOU) is a non-binding instrument that does not require surrendering/capping the ~440kg of 60% HEU, specifies no verification mechanism, and pushes the enrichment/verification/stockpile negotiations into a 60-day window that begins only after signing; as of 6/13 it remains unsigned, awaiting approval by Iran's Supreme Leader.",
      "cnn-liveblog-2026-06-12":
        "The US and Iran (with Pakistan brokering) have agreed on the final text of a draft MOU, and Trump hinted at a possible signing in Europe within days; Iran pledged to never acquire or develop nuclear weapons, but the technical details of clearing the HEU stockpile remain unresolved and have been deferred to the next round of technical talks.",
      "isis-2026-06-04":
        "IAEA has halted its nuclear safeguards verification of Iran since 2026-02-28; the agency has no access to 8 facilities, cannot verify the suspension of enrichment/reprocessing, and cannot verify the ~440.9kg of 60% HEU. Conclusion: near-term verification arrangements are problematic until access is restored, leaving node C structurally blocked.",
      "presstv-baghaei-2026-05-23":
        "Foreign ministry spokesman Baghaei said the 14-point MOU focuses on ending the war, halting US naval operations, and releasing frozen assets, and stated explicitly that nuclear-issue details are not being discussed at this stage, deferring nuclear/enrichment matters to subsequent talks — the framework itself contains no qualifying nuclear clauses.",
      "aljazeera-2026-06-12":
        "Analysts (Chatham House's Tabrizi, NATO Defense College's Weitz) say this is not a final nuclear settlement: Iran's proposal moves enrichment and missiles out of the initial agreement and pushes nuclear details into the 60-day window; nailing down the nuclear details is far more challenging than reopening the Strait of Hormuz.",
      "polymarket-by-june30-2026-06-14":
        "Direct deadline match: ~67% YES, ~$8.8M volume (confirmed by pulling the page directly on 6/14). The resolution criterion is broad — YES requires only that any mutual nuclear agreement be publicly announced before 6/30, with no enrichment cap/verification/stockpile clauses required, so it overstates a strictly qualifying agreement.",
      "ukcommons-cbp10637-2026-06-12":
        "The Islamabad Declaration would reopen the Strait of Hormuz within 30 days, but leaves Iran's 440kg stockpile to 60-day follow-on talks, requiring no surrender, removal, destruction, or cap before signing; IAEA cannot verify the remaining HEU — the nuclear clauses are not settleable before 6/30.",
      "kalshi-index-2026-06-14":
        "The Kalshi market's early-June snapshot shows only ~23% before July and ~53% before November, markedly below Polymarket's 6/30 reading. The live numbers could not be refreshed due to HTTP 429, so they are treated as a stale downside anchor with reduced weight."
    },
    modelLabels: {
      A: "A: Both sides publicly accept the framework/MOU",
      B: "B|A: The framework contains sufficient qualifying nuclear clauses (enrichment/verification/stockpile)",
      C: "C|A,B: Publicly confirmable and settleable before 6/30"
    },
    modelRationales: {
      A: "The Islamabad Declaration MOU text was reached ~6/12 and signing has been spun as imminent; but as of 6/14 it remains unsigned, awaiting approval by Iran's Supreme Leader, and Baghaei has publicly rebutted Trump's timeline. The probability of both sides publicly accepting the framework is high but uncertain.",
      B: "The structural fatal point. CNN, Al Jazeera, ISIS, the UK Commons Library, and officials on both the Iranian and US sides all confirm that the MOU deliberately strips out the nuclear substance: ~440kg of HEU stays in Tehran, no verification mechanism is specified, and the enrichment-duration dispute is unresolved — all deferred to a 60-day window after signing. By design this instrument does not constitute a qualifying nuclear deal.",
      C: "Even assuming a qualifying framework exists, IAEA has had ~97 days of zero access and cannot verify the 440.9kg stockpile, making verification physically impossible within the window, and the 60-day clock runs to ~end of August. The settleability of the nuclear file is highly constrained."
    },
    updateLabels: ["Baseline", "Official signals / framework momentum", "Counter-evidence (nuclear clauses deferred)", "Model calibration"],
    updateExplanations: [
      "Starting point: reaching and settling a complete nuclear deal with verification within a hard 16-day window is historically rare, so the base rate is low.",
      "A White House video, administration officials calling the deal oriented toward dismantling Iran's nuclear program, CNN reporting Iran's pledge to never develop nuclear weapons, and Polymarket's broad-criterion ~67% — these push node A higher and provide modest upside.",
      "The decisive counter-evidence: the MOU by design pushes the enrichment cap/verification/disposition of ~440kg of HEU into a 60-day window after signing; IAEA's ~97 days of zero access make verification impossible; the MOU is still unsigned as of 6/14 and Iran is publicly stalling. Node B is essentially unmet and C is structurally blocked.",
      "Conditional model P(A)·P(B|A)·P(C|A,B)≈0.72·0.15·0.45≈0.05; allowing some probability that the question settles by the looser market standard, nudged up to 0.10, consistent with the three verification perspectives' 0.08–0.22 range."
    ],
    limitations: [
      "This conclusion is a real online-research snapshot from 2026-06-13 (6 web-search angles + 3 adversarial verifiers + synthesis); the situation may change before the 6/30 deadline, so it should be re-run to refresh as the deadline nears.",
      "The market reference is the broad-criterion Polymarket market (any publicly announced nuclear deal counts as YES, ~67%), which differs from this question's strict resolution standard (must include enrichment cap/verification/stockpile), hence the large ~-57pp edge.",
      "Key uncertainties (the IAEA verification gap, whether the MOU is signed on schedule, the trajectory of the 60-day window) are documented via the source links in the evidence ledger.",
      "The full raw data (34 findings across 6 angles + the full text of 3 adversarial verifiers + synthesis) is saved as a snapshot: apps/web/lib/research/snapshots/us-iran-nuclear-2026-06-13.json."
    ],
    progressByStage: {
      definition: [
        "Resolution criterion: an agreement that is publicly confirmed by both sides before 6/30, settleable, and contains nuclear clauses (enrichment cap/verification/stockpile); a ceasefire, a vague statement, or continued talks do not count.",
        "Decomposed into three necessary conditions: A both sides accept the framework × B contains qualifying nuclear clauses × C settleable before 6/30."
      ],
      "query-design": [
        "6 parallel online-search angles + 3 adversarial verifiers.",
        "Angles: US official / Iran official / IAEA·international bodies / Western media / regional analysis / prediction markets."
      ],
      evidence: [
        "The web search yielded 34 raw findings (2026 sources prioritized; one 2015 old item and one 2025 old red line were removed or flagged).",
        "US official: Trump said 'there's already a deal, Iran will never go nuclear' (6/11), but administration officials placed dismantlement/verification in a 60-day window after signing and self-rated confidence at only 80-85%.",
        "Iran official: spokesman Baghaei stated explicitly 'no nuclear details at this stage'; Iran denied having agreed to hand over enriched uranium.",
        "IAEA: ~97 days of zero access, the 440.9kg of 60% HEU cannot be verified (ISIS 6/4, Board of Governors 6/10 resolution).",
        "Western media: the MOU is ~95% complete but still unsigned, with nuclear clauses explicitly deferred to the 60-day window (CNN/TechTimes/UK Commons).",
        "Regional analysis: the enrichment-duration impasse (US 20 years vs Iran 5 years) is unresolved; prediction market Polymarket's 6/30 broad criterion ~67% ($8.8M), Kalshi ~23% before July (stale)."
      ],
      weighting: [
        "Weighted by primary-source quality / recency / cross-corroboration; after deduplication, 8 items were retained for the ledger.",
        "Adversarial verifier ① recency authenticity: both support items are genuine and from 2026, but only support the weak 'framework' version; Polymarket's 67% measures the broad criterion, not the strict B node.",
        "Adversarial verifier ② counter-side challenge: the MOU is by design not a nuclear deal, with all nuclear substance in the 60-day window after signing; the base rate of reaching and verifying a complete agreement within 16 days is extremely low.",
        "Adversarial verifier ③ market calibration: strict criterion ~0.08–0.18; if settled by the broad market criterion ~0.50–0.62; the three-perspective combined range is 0.08–0.40."
      ],
      model: ["Conditional probability model: A 0.72 × B|A 0.15 × C|A,B 0.45 ≈ model baseline 5% (recalibrated up to 10%)."],
      bayes: ["Bayesian path: baseline 12% → official signals/framework momentum 18% → nuclear clauses deferred 8% → model calibration 10%."],
      market: ["Compared against Polymarket's broad criterion 67% (any publicly announced nuclear deal counts as YES, different criterion) → edge ~-57pp."]
    }
  }
};

interface FedContent {
  modelLabels: Record<"A" | "B" | "C", string>;
  modelRationales: Record<"A" | "B" | "C", string>;
}

const FED_CONTENT: Record<ConsoleLocale, FedContent> = {
  zh: {
    modelLabels: {
      A: "A: 通胀回落给出降息空间",
      B: "B|A: 增长/就业走弱构成宽松理由",
      C: "C|A,B: 9 月前累计降息 ≥50bp 落地"
    },
    modelRationales: {
      A: "核心 CPI 降温、通胀预期回落，使政策转向宽松具备条件。",
      B: "劳动力市场和增长放缓通常是 Fed 真正动手的触发条件。",
      C: "两次 25bp 或一次 50bp 须在窗口内兑现；点阵图支持，但时点是关键不确定性。"
    }
  },
  en: {
    modelLabels: {
      A: "A: Cooling inflation provides room to cut",
      B: "B|A: Weakening growth/employment constitutes a reason to ease",
      C: "C|A,B: Cumulative cut of ≥50bp lands before September"
    },
    modelRationales: {
      A: "Cooling core CPI and falling inflation expectations create the conditions for a policy pivot toward easing.",
      B: "A slowing labour market and growth are typically the trigger for the Fed to actually move.",
      C: "Two 25bp moves or one 50bp move must materialize within the window; the dot plot supports it, but timing is the key uncertainty."
    }
  }
};

// Hand-curated demo cases (Iran nuclear deal, Fed rate cut). When the question
// matches one, the run uses its authored evidence + fixed probability/interval
// so the cached examples always render rich, coherent output. Anything else
// falls back to the deterministic generic generator.
interface CuratedCase {
  evidence: PredictionEvidence[];
  yesProbability: number;
  baseline: number;
  defaultMarketProbability: number;
  // Optional explicit overrides (a real research snapshot supplies these so the
  // CI can be asymmetric and the verdict / Bayesian path are authored, not
  // derived). When absent, the generic computation is used.
  intervalWidth?: number;
  confidenceInterval?: [number, number];
  verdict?: string;
  updates?: PredictionUpdate[];
  limitations?: string[];
  progressByStage?: Record<string, string[]>;
  asOf?: string;
  deadline?: string;
}

function resolveCuratedCase(eventText: string, locale: ConsoleLocale): CuratedCase | null {
  if (isIranNuclearEvent(eventText)) {
    // REAL deep-research snapshot, 2026-06-13 (6 web-search angles + 3
    // adversarial verifiers + synthesis). P(YES) 10% vs Polymarket ~67%.
    const content = IRAN_CONTENT[locale];
    const updateFromTo: Array<[number, number]> = [
      [0.12, 0.12],
      [0.12, 0.18],
      [0.18, 0.08],
      [0.08, 0.1]
    ];
    return {
      evidence: buildIranEvidence(locale),
      yesProbability: 0.1,
      baseline: 0.12,
      defaultMarketProbability: 0.67,
      asOf: "2026-06-13",
      deadline: "2026-06-30",
      confidenceInterval: [0.05, 0.2],
      verdict: content.verdict,
      updates: updateFromTo.map(([from, to], index) => ({
        label: content.updateLabels[index]!,
        from,
        to,
        explanation: content.updateExplanations[index]!
      })),
      limitations: content.limitations,
      progressByStage: content.progressByStage
    };
  }
  if (isFedRateCutEvent(eventText)) {
    return { evidence: buildFedEvidence(), yesProbability: 0.57, baseline: 0.5, intervalWidth: 0.1, defaultMarketProbability: 0.52 };
  }
  return null;
}

export function buildPredictionDemoRun(
  input: PredictionEngineRequest,
  now = new Date(),
  locale: ConsoleLocale = "en"
): PredictionEngineRun {
  const eventText = input.eventText.trim() || DEFAULT_PREDICTION_EVENT;
  const hash = hashText(eventText);
  const model = buildModel(eventText, hash, locale);
  const rawModelProbability = model.reduce((product, node) => product * node.probability, 1);
  const curated = resolveCuratedCase(eventText, locale);
  const rawEvidence = curated ? curated.evidence : buildGenericEvidence(eventText, hash);
  // Source-type categories are authored in Chinese; localize them so the ledger
  // reads in one language while keeping titles / excerpts as authored.
  const evidence = rawEvidence.map((item) => ({ ...item, sourceType: localizeSourceType(locale, item.sourceType) }));
  const evidenceDelta = evidence.reduce((sum, item) => sum + item.weightPct, 0) / 100;
  const yesProbability = curated
    ? curated.yesProbability
    : roundProbability(clamp(rawModelProbability + evidenceDelta * 0.45, 0.04, 0.86));
  const marketFallback = roundProbability(clamp(yesProbability + (((hash >>> 12) % 19) - 9) / 100, 0.04, 0.96));
  const marketProbability = parseMarketPrice(input.marketPrice, curated ? curated.defaultMarketProbability : marketFallback);
  const edge = roundDelta(yesProbability - marketProbability);
  const intervalWidth = curated?.intervalWidth ?? clamp(0.09 + ((hash >>> 16) % 9) / 100, 0.08, 0.18);
  const confidenceInterval: [number, number] = curated?.confidenceInterval ?? [
    roundProbability(yesProbability - intervalWidth),
    roundProbability(yesProbability + intervalWidth)
  ];
  const verdict =
    curated?.verdict ??
    (edge > 0.03
      ? pick(
          locale,
          "Model probability exceeds the market — a positive edge, but still needs real-source review.",
          "模型概率高于市场，存在正 edge，但仍需真实来源复核。"
        )
      : edge < -0.03
        ? pick(
            locale,
            "Model probability is below the market — currently looks overpriced; keep watching or look for No-side opportunities.",
            "模型概率低于市场，当前更像高估，适合继续观察或寻找 No 侧机会。"
          )
        : pick(
            locale,
            "Model probability is close to the market — no clear gap for now.",
            "模型概率与市场接近，暂时没有清晰偏差。"
          ));
  const stages = buildStages(locale);

  return {
    id: `demo-${hash.toString(16)}`,
    mode: "demo_read_only",
    eventText,
    generatedAtUtc: now.toISOString(),
    service: {
      source: "demo",
      endpointLabel: "in-process demo builder",
      status: "complete",
      note: pick(
        locale,
        "No local or VPS prediction service configured, so deterministic read-only demo data is used.",
        "未配置本地或 VPS 预测服务，因此使用确定性只读 demo 数据。"
      )
    },
    conclusion: {
      yesProbability,
      confidenceInterval,
      marketProbability,
      edge,
      verdict
    },
    stages,
    evidence,
    model,
    updates: curated?.updates ?? buildUpdates(curated ? curated.baseline : 0.32, yesProbability, evidence, locale),
    progress: buildProgressItems({
      stages,
      evidence,
      model,
      yesProbability,
      marketProbability,
      edge,
      locale
    }),
    limitations:
      curated?.limitations ??
      (locale === "zh"
        ? [
            "当前前端 demo 不触发真实 Pulse、实时 web-search 或真钱交易。",
            "非默认事件使用确定性示例证据结构，生产模式需替换为 Pulse recommendation.json、web_search 和 evidence ledger。",
            "市场价格比较只有在事件能映射到 Polymarket market 时才可作为真实 edge。"
          ]
        : [
            "This front-end demo does not trigger real Pulse, live web-search, or real-money trades.",
            "Non-default events use a deterministic sample evidence structure; production must replace it with Pulse recommendation.json, web_search, and the evidence ledger.",
            "The market comparison is only a real edge when the event maps to a Polymarket market."
          ]),
    archiveLinks: [
      {
        label: "Stage-flow implementation note",
        path: "docs/diagrams/prediction-engine-stage-flow.md"
      },
      {
        label: "US-Iran probability archive",
        path: "runtime-artifacts/probability-analysis/2026-06-05-us-iran-nuclear-deal/"
      }
    ],
    progressByStage: curated?.progressByStage,
    asOf: curated?.asOf,
    deadline: curated?.deadline
  };
}
