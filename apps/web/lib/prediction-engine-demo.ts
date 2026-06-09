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

function buildIranEvidence(): PredictionEvidence[] {
  return [
    {
      id: "official-whitehouse-2026-06-03",
      sourceType: "官方声明",
      title: "White House: Trump discusses Iran negotiations",
      date: "2026-06-03",
      stance: "support",
      weightPct: 4.5,
      reliability: 0.82,
      node: "A",
      excerpt: "US-side urgency and public framing support a framework deal, but do not prove mutual nuclear terms.",
      url: "https://www.whitehouse.gov/"
    },
    {
      id: "ap-2026-05-29",
      sourceType: "主流媒体",
      title: "AP: talks remain tentative and undecided",
      date: "2026-05-29",
      stance: "mixed",
      weightPct: -1.8,
      reliability: 0.78,
      node: "A",
      excerpt: "Tentative progress exists, while final approval and nuclear details remain unresolved.",
      url: "https://apnews.com/"
    },
    {
      id: "iaea-2026-06-04",
      sourceType: "官方/国际机构",
      title: "IAEA monitoring constraints remain material",
      date: "2026-06-04",
      stance: "oppose",
      weightPct: -5.6,
      reliability: 0.84,
      node: "B",
      excerpt: "Verification and stockpile uncertainty make a resolution-qualified nuclear agreement harder.",
      url: "https://www.iaea.org/"
    },
    {
      id: "party-local-iran-denial",
      sourceType: "当事方媒体",
      title: "Iran-linked reporting denies final nuclear-material commitment",
      date: "2026-05-24",
      stance: "oppose",
      weightPct: -4.1,
      reliability: 0.66,
      node: "B",
      excerpt: "Party-side denials reduce confidence that a preliminary package contains qualifying nuclear terms."
    },
    {
      id: "political-pressure",
      sourceType: "政治动态",
      title: "Domestic pressure favors de-escalation",
      date: "2026-06-03",
      stance: "support",
      weightPct: 2.2,
      reliability: 0.7,
      node: "C",
      excerpt: "Congressional and regional pressure can raise odds of a public agreement, but may favor a narrower ceasefire."
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
    return [
      {
        id: "A",
        label: "A: 双方接受公开框架/MOU",
        probability: 0.52,
        rationale: "谈判接近、双方有降温动机，但领导层最终批准仍不稳定。"
      },
      {
        id: "B",
        label: "B|A: 框架包含足够核条款",
        probability: 0.58,
        rationale: "美方推动核语言，但伊朗侧来源否认初稿包含核材料承诺。"
      },
      {
        id: "C",
        label: "C|A,B: 双方公开确认同一核协议",
        probability: 0.78,
        rationale: "若核条款成立，通常需要公开框架；但伊朗可能只确认较窄事项。"
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

export function buildPredictionDemoRun(input: PredictionEngineRequest, now = new Date()): PredictionEngineRun {
  const eventText = input.eventText.trim() || DEFAULT_PREDICTION_EVENT;
  const hash = hashText(eventText);
  const model = buildModel(eventText, hash);
  const rawModelProbability = model.reduce((product, node) => product * node.probability, 1);
  const iranEvent = isIranNuclearEvent(eventText);
  const evidence = iranEvent ? buildIranEvidence() : buildGenericEvidence(eventText, hash);
  const evidenceDelta = evidence.reduce((sum, item) => sum + item.weightPct, 0) / 100;
  const yesProbability = iranEvent
    ? 0.24
    : roundProbability(clamp(rawModelProbability + evidenceDelta * 0.45, 0.04, 0.86));
  const marketFallback = roundProbability(clamp(yesProbability + (((hash >>> 12) % 19) - 9) / 100, 0.04, 0.96));
  const marketProbability = parseMarketPrice(input.marketPrice, iranEvent ? 0.3 : marketFallback);
  const edge = roundDelta(yesProbability - marketProbability);
  const intervalWidth = iranEvent ? 0.11 : clamp(0.09 + ((hash >>> 16) % 9) / 100, 0.08, 0.18);
  const confidenceInterval: [number, number] = [
    roundProbability(yesProbability - intervalWidth),
    roundProbability(yesProbability + intervalWidth)
  ];
  const verdict = edge > 0.03
    ? "模型概率高于市场，存在正 edge，但仍需真实来源复核。"
    : edge < -0.03
      ? "模型概率低于市场，当前更像高估，适合继续观察或寻找 No 侧机会。"
      : "模型概率与市场接近，暂时没有清晰偏差。";
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
    updates: buildUpdates(iranEvent ? 0.25 : 0.32, yesProbability, evidence),
    progress: buildProgressItems({
      stages,
      evidence,
      model,
      yesProbability,
      marketProbability,
      edge
    }),
    limitations: [
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
    ]
  };
}
