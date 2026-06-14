export type PredictionEvidenceStance = "support" | "oppose" | "mixed" | "neutral";

export interface PredictionEngineRequest {
  eventText: string;
  marketPrice?: number | null;
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

function buildStages(): PredictionStage[] {
  return [
    {
      id: "definition",
      order: 1,
      title: "理清定义",
      summary: "确定 Yes/No 触发条件、截止时间、主体和官方认定口径。",
      detail: "把单方表态、继续谈判、临时框架和可结算协议分开，避免把新闻热度误当成事件完成。",
      durationMs: 420
    },
    {
      id: "query-design",
      order: 2,
      title: "基础推理与 query",
      summary: "拆成 2-5 个必要条件，并为每个条件生成官方、媒体、当事方和第三方 query。",
      detail: "这一步决定后续证据覆盖面，生产版会把 query plan 写入 Pulse artifact。",
      durationMs: 360
    },
    {
      id: "evidence",
      order: 3,
      title: "证据收集与罗列",
      summary: "按来源类型整理证据：官方声明、主流媒体、当事方媒体、第三方分析、政治/安全动态。",
      detail: "Demo 展示的是可审计的数据结构；真实模式会来自 Pulse web-search 与页面抓取。",
      durationMs: 520
    },
    {
      id: "weighting",
      order: 4,
      title: "证据权重更新",
      summary: "按一手性、时效、交叉印证和战略性放话风险给每条证据加权。",
      detail: "强支持/强反对不会只看标题，会落到具体模型节点。",
      durationMs: 380
    },
    {
      id: "model",
      order: 5,
      title: "结构化模型",
      summary: "把事件拆成条件概率：P(Yes)=P(A)xP(B|A)xP(C|A,B)。",
      detail: "每个节点保留概率、理由、关键证据和残余不确定性。",
      durationMs: 460
    },
    {
      id: "bayes",
      order: 6,
      title: "贝叶斯式更新",
      summary: "从基线概率出发，逐条说明重要证据如何上调或下调。",
      detail: "输出主概率和 80% 主观置信区间，而不是只给可能/不可能。",
      durationMs: 440
    },
    {
      id: "market",
      order: 7,
      title: "结论与市场偏差",
      summary: "给出 Yes 概率、置信区间，并和市场价格比较是否存在 edge。",
      detail: "Demo 不会下单；真实执行仍要经过 Pulse 风控和交易所门槛。",
      durationMs: 340
    }
  ];
}

// US–Iran nuclear-deal evidence ledger — REAL research snapshot (2026-06-13),
// produced by the multi-agent deep-research workflow (6 web-search angles +
// 3 adversarial verifiers + synthesis). Live source URLs + dates below; this is
// the flagship "Skuld" case's data, not hand-mocked. Re-run the workflow to
// refresh it as the 2026-06-30 deadline approaches.
function buildIranEvidence(): PredictionEvidence[] {
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
      excerpt:
        "在桌面上的唯一协议（Islamabad Declaration MOU）是非约束性工具，不要求交出/封顶约 440kg 60% 高浓铀，未指定核查机制，把浓缩/核查/库存谈判推到签署后才开始的 60 天窗口；截至 6/13 仍未签署，等待伊朗最高领袖批准。",
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
      excerpt:
        "美伊（巴基斯坦斡旋）就草案 MOU 最终文本达成一致，Trump 暗示数日内可能在欧洲签署；伊朗承诺永不获取或发展核武器，但清除高浓铀库存的技术细节未决、被推迟到下一轮技术谈判。",
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
      excerpt:
        "IAEA 自 2026-02-28 起停止对伊核保障核查；机构对 8 处设施无准入，无法核查浓缩/再处理暂停，也无法核查约 440.9kg 60% 高浓铀。结论：在恢复准入前近期核查安排存在问题，节点 C 结构性受阻。",
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
      excerpt:
        "外交部发言人 Baghaei 称 14 点 MOU 聚焦结束战争、停止美海军行动、释放被冻结资产，并明确现阶段不讨论核问题细节，把核/浓缩事项推迟到后续谈判——框架本身不含合格核条款。",
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
      excerpt:
        "分析人士（Chatham House 的 Tabrizi、NATO Defense College 的 Weitz）称这不是最终核解决方案：伊朗方案把浓缩与导弹移出初始协议、把核细节推入 60 天窗口；敲定核细节相比重开霍尔木兹海峡极具挑战性。",
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
      excerpt:
        "直接截止日匹配：约 67% YES，约 $8.8M 成交量（6/14 直取页面确认）。结算口径宽泛——只要 6/30 前公开宣布任何相互核协议即可 YES，不要求浓缩上限/核查/库存条款，因此高估严格合格协议。",
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
      excerpt:
        "Islamabad Declaration 将在 30 天内重开霍尔木兹海峡，但把伊朗 440kg 库存留待 60 天后续谈判，不要求签署前交出、移除、销毁或封顶；IAEA 无法核查剩余高浓铀——核条款在 6/30 前不可结算。",
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
      excerpt:
        "Kalshi 市场早 6 月快照显示 7 月前仅约 23%、11 月前约 53%，显著低于 Polymarket 的 6/30 读数。实时数字因 HTTP 429 无法刷新，按陈旧下行锚点处理、已下调权重。",
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

function buildModel(eventText: string, hash: number): PredictionModelNode[] {
  if (isIranNuclearEvent(eventText)) {
    // Real research snapshot (2026-06-13): product ≈ 0.72×0.15×0.45 ≈ 5%,
    // calibrated up to 10% (see resolveCuratedCase) for the broad-criterion tail.
    return [
      {
        id: "A",
        label: "A: 双方公开接受框架/MOU",
        probability: 0.72,
        rationale:
          "Islamabad Declaration MOU 文本约 6/12 达成、签署被吹风为临近；但截至 6/14 仍未签署，等待伊朗最高领袖批准，Baghaei 还公开反驳了 Trump 的时间表。框架获双方公开接受概率高但不确定。"
      },
      {
        id: "B",
        label: "B|A: 框架含充分合格核条款（浓缩/核查/库存）",
        probability: 0.15,
        rationale:
          "结构性致命点。CNN、Al Jazeera、ISIS、UK Commons Library 及伊美双方官员一致确认 MOU 刻意把核实质剥离：约 440kg 高浓铀留在德黑兰、无指定核查机制、浓缩时长争议未解，全部推迟到签署后 60 天窗口。该工具按设计不构成合格核协议。"
      },
      {
        id: "C",
        label: "C|A,B: 6/30 前可公开确认并可结算",
        probability: 0.45,
        rationale:
          "即便假设存在合格框架，IAEA 已约 97 天零准入、无法核查 440.9kg 库存，核查在窗口内物理上不可能，且 60 天时钟跑到约 8 月底。核档案的可结算性高度受限。"
      }
    ];
  }

  if (isFedRateCutEvent(eventText)) {
    return [
      {
        id: "A",
        label: "A: 通胀回落给出降息空间",
        probability: 0.8,
        rationale: "核心 CPI 降温、通胀预期回落，使政策转向宽松具备条件。"
      },
      {
        id: "B",
        label: "B|A: 增长/就业走弱构成宽松理由",
        probability: 0.85,
        rationale: "劳动力市场和增长放缓通常是 Fed 真正动手的触发条件。"
      },
      {
        id: "C",
        label: "C|A,B: 9 月前累计降息 ≥50bp 落地",
        probability: 0.84,
        rationale: "两次 25bp 或一次 50bp 须在窗口内兑现；点阵图支持，但时点是关键不确定性。"
      }
    ];
  }

  const a = roundProbability(0.42 + (hash % 2600) / 10000);
  const b = roundProbability(0.46 + ((hash >>> 4) % 3000) / 10000);
  const c = roundProbability(0.58 + ((hash >>> 8) % 2400) / 10000);
  return [
    {
      id: "A",
      label: "A: 事件进入可执行阶段",
      probability: a,
      rationale: "基于事件描述先估计各方是否已经越过纯表态阶段。"
    },
    {
      id: "B",
      label: "B|A: 关键约束被满足",
      probability: b,
      rationale: "检查法律、资金、政治、技术或军事约束是否仍会阻断结果。"
    },
    {
      id: "C",
      label: "C|A,B: 截止前可被公开确认",
      probability: c,
      rationale: "短期限事件最后通常卡在确认口径、执行细节或公开披露。"
    }
  ];
}

function buildUpdates(baseline: number, finalProbability: number, evidence: PredictionEvidence[]): PredictionUpdate[] {
  const first = roundProbability(clamp(baseline + evidence[0]!.weightPct / 100, 0.02, 0.98));
  const second = roundProbability(clamp(first + evidence.slice(1, 3).reduce((sum, item) => sum + item.weightPct, 0) / 100, 0.02, 0.98));
  return [
    {
      label: "基线",
      from: baseline,
      to: baseline,
      explanation: "从同类型、同期限事件的基础成功率开始。"
    },
    {
      label: "官方/主流证据",
      from: baseline,
      to: first,
      explanation: "官方信号和主流报道决定是否把概率推离基线。"
    },
    {
      label: "反向证据",
      from: first,
      to: second,
      explanation: "当事方否认、执行障碍或验证问题会下调可结算结果概率。"
    },
    {
      label: "模型校准",
      from: second,
      to: finalProbability,
      explanation: "条件概率模型给出最终 Yes 概率和置信区间。"
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
}): PredictionProgressItem[] {
  const evidenceCount = input.evidence.length;
  const supportCount = input.evidence.filter((item) => item.stance === "support").length;
  const opposeCount = input.evidence.filter((item) => item.stance === "oppose").length;
  const marketText = input.marketProbability == null ? "未提供市场价格" : `市场 ${formatProbability(input.marketProbability)}`;
  const edgeText = input.edge == null ? "edge 未计算" : `edge ${(input.edge * 100).toFixed(1)}pp`;
  const outcomes: Record<string, { outcome: string; artifactLabel: string }> = {
    definition: {
      outcome: "已确定事件主体、截止时间、Yes/No 触发边界和需要人工复核的结算口径。",
      artifactLabel: "resolution_definition"
    },
    "query-design": {
      outcome: "已把事件拆成 A/B/C 条件节点，并准备官方、媒体、当事方、本地与第三方 query。",
      artifactLabel: "query_plan"
    },
    evidence: {
      outcome: `已整理 ${evidenceCount} 条证据，其中支持 ${supportCount} 条、反对 ${opposeCount} 条，其余用于边界校验。`,
      artifactLabel: "evidence_ledger"
    },
    weighting: {
      outcome: "已按来源一手性、时效、交叉印证和战略性放话风险写入证据权重。",
      artifactLabel: "evidence_weights"
    },
    model: {
      outcome: `已建立 ${input.model.map((node) => node.id).join("/")} 条件概率模型，并完成乘法结构校验。`,
      artifactLabel: "conditional_model"
    },
    bayes: {
      outcome: `已将证据影响合并到基线，最终 Yes 概率为 ${formatProbability(input.yesProbability)}。`,
      artifactLabel: "bayes_update"
    },
    market: {
      outcome: `已输出结论：${formatProbability(input.yesProbability)}，${marketText}，${edgeText}。`,
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
}

function resolveCuratedCase(eventText: string): CuratedCase | null {
  if (isIranNuclearEvent(eventText)) {
    // REAL deep-research snapshot, 2026-06-13 (6 web-search angles + 3
    // adversarial verifiers + synthesis). P(YES) 10% vs Polymarket ~67%.
    return {
      evidence: buildIranEvidence(),
      yesProbability: 0.1,
      baseline: 0.12,
      defaultMarketProbability: 0.67,
      confidenceInterval: [0.05, 0.2],
      verdict:
        "判 NO（严格意义上的合格核协议在 2026-06-30 前达成的概率约 10%）。核心驱动：实际临近签署的 MOU 按设计就不是核协议——浓缩上限、核查机制、约 440kg 高浓铀处置全部被推迟到签署后 60 天窗口（跑到约 8 月底），而 IAEA 约 97 天零准入使任何可结算的核协议在 16 天内物理上不可能。Polymarket 的 67% 衡量的是宽泛口径（任何公开宣布的核协议），并非本题的严格判定标准。",
      updates: [
        {
          label: "基线",
          from: 0.12,
          to: 0.12,
          explanation: "起点：16 天硬窗口内达成并可结算一份带核查的完整核协议历史上罕见，基率偏低。"
        },
        {
          label: "官方信号/框架动能",
          from: 0.12,
          to: 0.18,
          explanation:
            "White House 视频、行政官员称协议导向拆解伊朗核计划、CNN 报道伊朗承诺永不发展核武器、Polymarket 宽口径约 67%——把节点 A 推高并提供少量上行。"
        },
        {
          label: "反向证据（核条款被推迟）",
          from: 0.18,
          to: 0.08,
          explanation:
            "决定性反向证据：MOU 按设计把浓缩上限/核查/约 440kg 高浓铀处置推到签署后 60 天窗口；IAEA 约 97 天零准入使核查不可能；MOU 6/14 仍未签且伊朗公开拖延。节点 B 基本不满足、C 结构性受阻。"
        },
        {
          label: "模型校准",
          from: 0.08,
          to: 0.1,
          explanation:
            "条件模型 P(A)·P(B|A)·P(C|A,B)≈0.72·0.15·0.45≈0.05；考虑题目有一定概率按更宽松的市场标准结算，向上微调至 0.10，与三条验证视角 0.08–0.22 区间一致。"
        }
      ],
      limitations: [
        "本结论是 2026-06-13 的真实联网研究快照（6 路 web 搜索 + 3 路对抗校验 + 综合）；截止 6/30 前局势可能变化，临近截止应重跑刷新。",
        "市场参考为 Polymarket 宽口径市场（任何公开核协议即 YES，约 67%），与本题严格判定标准（需含浓缩上限/核查/库存）不同，故出现约 -57pp 的大幅 edge。",
        "关键不确定性（IAEA 核查缺位、MOU 是否如期签署、60 天窗口走向）见证据账本中的来源链接。",
        "完整原始数据（6 路角度共 34 条发现 + 3 路对抗校验全文 + 综合）已存快照：apps/web/lib/research/snapshots/us-iran-nuclear-2026-06-13.json。"
      ],
      // Real per-stage narration drawn from the actual run (search angles, raw
      // findings by angle, the 3 adversarial verdicts). Replayed verbatim so the
      // streamed steps reflect the genuine pipeline, not synthetic filler.
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
        model: [
          "条件概率模型：A 0.72 × B|A 0.15 × C|A,B 0.45 ≈ 模型基线 5%（再校准上调到 10%）。"
        ],
        bayes: [
          "贝叶斯路径：基线 12% → 官方信号/框架动能 18% → 核条款被推迟 8% → 模型校准 10%。"
        ],
        market: [
          "对比 Polymarket 宽口径 67%（任何公开核协议即 YES，口径不同）→ edge 约 -57pp。"
        ]
      }
    };
  }
  if (isFedRateCutEvent(eventText)) {
    return { evidence: buildFedEvidence(), yesProbability: 0.57, baseline: 0.5, intervalWidth: 0.1, defaultMarketProbability: 0.52 };
  }
  return null;
}

export function buildPredictionDemoRun(input: PredictionEngineRequest, now = new Date()): PredictionEngineRun {
  const eventText = input.eventText.trim() || DEFAULT_PREDICTION_EVENT;
  const hash = hashText(eventText);
  const model = buildModel(eventText, hash);
  const rawModelProbability = model.reduce((product, node) => product * node.probability, 1);
  const curated = resolveCuratedCase(eventText);
  const evidence = curated ? curated.evidence : buildGenericEvidence(eventText, hash);
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
  const verdict = curated?.verdict ?? (edge > 0.03
    ? "模型概率高于市场，存在正 edge，但仍需真实来源复核。"
    : edge < -0.03
      ? "模型概率低于市场，当前更像高估，适合继续观察或寻找 No 侧机会。"
      : "模型概率与市场接近，暂时没有清晰偏差。");
  const stages = buildStages();

  return {
    id: `demo-${hash.toString(16)}`,
    mode: "demo_read_only",
    eventText,
    generatedAtUtc: now.toISOString(),
    service: {
      source: "demo",
      endpointLabel: "in-process demo builder",
      status: "complete",
      note: "未配置本地或 VPS 预测服务，因此使用确定性只读 demo 数据。"
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
    updates: curated?.updates ?? buildUpdates(curated ? curated.baseline : 0.32, yesProbability, evidence),
    progress: buildProgressItems({
      stages,
      evidence,
      model,
      yesProbability,
      marketProbability,
      edge
    }),
    limitations: curated?.limitations ?? [
      "当前前端 demo 不触发真实 Pulse、实时 web-search 或真钱交易。",
      "非默认事件使用确定性示例证据结构，生产模式需替换为 Pulse recommendation.json、web_search 和 evidence ledger。",
      "市场价格比较只有在事件能映射到 Polymarket market 时才可作为真实 edge。"
    ],
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
    progressByStage: curated?.progressByStage
  };
}
