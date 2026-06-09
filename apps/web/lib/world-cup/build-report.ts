import type { PredictionEngineRun, PredictionEvidence } from "../prediction-engine-demo";
import { DISCLAIMER_FULL } from "../legal-copy";
import type {
  MatchOutcome,
  OutcomeProbability,
  ScoreboardEntry,
  WorldCupReport,
  WorldCupMatchMeta
} from "./types";

export const DISCLAIMER_VERSION = "2026-06-09";

// MVP heuristic constants (documented, defensible — not the full model).
// gamma < 1 is temperature scaling that flattens the market distribution,
// correcting the well-documented favourite-longshot bias; drawBoost lifts the
// draw, which retail/markets persistently underweight. The real Elo +
// Dixon-Coles + Monte Carlo engine replaces this in Phase 1.
const FAVOURITE_LONGSHOT_GAMMA = 0.9;
const DRAW_INFLATION_BOOST = 0.05;

export interface MatchPriceInput {
  readonly matchId: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly group?: string;
  readonly stage?: string;
  readonly kickoffUtc?: string | null;
  readonly polymarketUrl?: string;
  // Raw Polymarket "Will X win?" yes prices (include overround). 0-1.
  readonly homeYesPrice: number;
  readonly drawYesPrice: number;
  readonly awayYesPrice: number;
  // Optional Kimi-published probability for this match's headline outcome, for
  // the three-way scoreboard. Must be sourced/attributed, never fabricated.
  readonly kimiHeadlineProbability?: number | null;
}

interface Triple {
  readonly home: number;
  readonly draw: number;
  readonly away: number;
}

function clampProb(value: number): number {
  return Math.min(0.98, Math.max(0.02, value));
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

// Strip the bookmaker overround so the three yes-prices become a proper
// probability distribution summing to 1.
function normaliseMarket(input: MatchPriceInput): Triple {
  const home = clampProb(input.homeYesPrice);
  const draw = clampProb(input.drawYesPrice);
  const away = clampProb(input.awayYesPrice);
  const sum = home + draw + away;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

function applyMvpHeuristic(market: Triple): Triple {
  const raw = {
    home: Math.pow(market.home, FAVOURITE_LONGSHOT_GAMMA),
    draw: Math.pow(market.draw, FAVOURITE_LONGSHOT_GAMMA) * (1 + DRAW_INFLATION_BOOST),
    away: Math.pow(market.away, FAVOURITE_LONGSHOT_GAMMA)
  };
  const sum = raw.home + raw.draw + raw.away;
  return { home: raw.home / sum, draw: raw.draw / sum, away: raw.away / sum };
}

function outcomeLabel(outcome: MatchOutcome, input: MatchPriceInput): string {
  if (outcome === "home") return `${input.homeTeam} 胜`;
  if (outcome === "away") return `${input.awayTeam} 胜`;
  return "平局";
}

function pickHeadline(model: Triple): MatchOutcome {
  const entries: ReadonlyArray<[MatchOutcome, number]> = [
    ["home", model.home],
    ["draw", model.draw],
    ["away", model.away]
  ];
  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

function confidenceTier(maxProb: number): WorldCupReport["confidenceTier"] {
  if (maxProb >= 0.6) return "high";
  if (maxProb >= 0.45) return "medium";
  return "low";
}

function intervalWidthFor(tier: WorldCupReport["confidenceTier"]): number {
  if (tier === "high") return 0.07;
  if (tier === "medium") return 0.1;
  return 0.14;
}

function buildOutcomes(market: Triple, model: Triple, input: MatchPriceInput): OutcomeProbability[] {
  const outcomes: MatchOutcome[] = ["home", "draw", "away"];
  const marketByOutcome: Record<MatchOutcome, number> = market;
  const modelByOutcome: Record<MatchOutcome, number> = model;
  return outcomes.map((outcome) => ({
    outcome,
    label: outcomeLabel(outcome, input),
    modelProbability: round(modelByOutcome[outcome]),
    marketProbability: round(marketByOutcome[outcome]),
    edge: round(modelByOutcome[outcome] - marketByOutcome[outcome])
  }));
}

function buildEvidence(input: MatchPriceInput, headline: MatchOutcome, edge: number): PredictionEvidence[] {
  const favourite = headline === "away" ? input.awayTeam : input.homeTeam;
  return [
    {
      id: "mvp-market-baseline",
      sourceType: "市场基线",
      title: `Polymarket 隐含 1X2（去 overround 后）`,
      date: "live",
      stance: "neutral",
      weightPct: 0,
      reliability: 0.8,
      node: "A",
      excerpt: "市场价格作为“共识偏差研究变量”，是我们的起点而非结论。"
    },
    {
      id: "mvp-favourite-longshot",
      sourceType: "统计修正",
      title: "favourite-longshot 偏差修正",
      date: "MVP",
      stance: edge >= 0 ? "support" : "oppose",
      weightPct: round(edge * 100, 1),
      reliability: 0.6,
      node: "B",
      excerpt: "市场长期轻微高估大热、低估冷门与平局；本 MVP 用温度缩放做了温和修正。"
    },
    {
      id: "phase1-elo-pending",
      sourceType: "待接入 (Phase 1)",
      title: `Elo / xG / Dixon-Coles 强度模型`,
      date: "pending",
      stance: "neutral",
      weightPct: 0,
      reliability: 0.9,
      node: "B",
      excerpt: `${favourite} 等队的真实强度评估将在 Phase 1 由统计引擎给出，替换当前启发式。`
    },
    {
      id: "phase1-lineups-pending",
      sourceType: "待接入 (Phase 1)",
      title: "伤停 / 首发 / 赛程 / 天气",
      date: "pending",
      stance: "neutral",
      weightPct: 0,
      reliability: 0.85,
      node: "C",
      excerpt: "LLM 将在统计先验之上做有界调整（伤停、轮换、海拔高温），无证据不动概率。"
    }
  ];
}

function buildRun(input: MatchPriceInput, outcomes: OutcomeProbability[], headline: MatchOutcome, ci: readonly [number, number], generatedAtUtc: string): PredictionEngineRun {
  const headlineOutcome = outcomes.find((o) => o.outcome === headline)!;
  const evidence = buildEvidence(input, headline, headlineOutcome.edge ?? 0);
  return {
    id: `wc-${input.matchId}`,
    mode: "demo_read_only",
    eventText: `${input.homeTeam} vs ${input.awayTeam} — 1X2`,
    generatedAtUtc,
    service: {
      source: "demo",
      endpointLabel: "world-cup MVP builder",
      status: "complete",
      note: "MVP：仅市场 + 启发式修正；Phase 1 接入 Elo/xG/Dixon-Coles/Monte Carlo 统计引擎。"
    },
    conclusion: {
      yesProbability: headlineOutcome.modelProbability,
      confidenceInterval: [round(ci[0]), round(ci[1])],
      marketProbability: headlineOutcome.marketProbability,
      edge: headlineOutcome.edge,
      verdict:
        (headlineOutcome.edge ?? 0) > 0.03
          ? `模型对「${headlineOutcome.label}」高于市场，存在正向研究偏差信号，仍需 Phase 1 统计模型与真实来源复核。`
          : `模型与市场接近，暂无清晰偏差信号。`
    },
    stages: [
      { id: "definition", order: 1, title: "理清结算口径", summary: "确认 1X2 三选一、90 分钟法定时间、Polymarket 结算规则。", detail: "区分常规时间与加时/点球；小组赛按 90 分钟结算。", durationMs: 320 },
      { id: "necessary", order: 2, title: "拆解必要条件", summary: "把胜/平/负拆成强度、状态、阵容、场地条件四类驱动。", detail: "Phase 1 会把每类落到具体特征（Elo 差、xG、伤停、海拔/高温）。", durationMs: 300 },
      { id: "evidence", order: 3, title: "证据收集", summary: "市场盘口 + 启发式修正；统计与情境证据 Phase 1 接入。", detail: "证据按来源类型与可信度分层，可审计。", durationMs: 360 },
      { id: "weighting", order: 4, title: "证据权重", summary: "市场作为基线，启发式做温和修正。", detail: "Phase 1 用历史校准给每路权重。", durationMs: 280 },
      { id: "model", order: 5, title: "结构化模型", summary: "输出胜/平/负三路概率（和为 1）。", detail: "Phase 1 用 Dixon-Coles 双泊松产出比分矩阵再聚合到 1X2。", durationMs: 420 },
      { id: "calibrate", order: 6, title: "校准与区间", summary: "给出主概率与置信区间、置信度分档。", detail: "对外用 Brier 公开记分，输错照记。", durationMs: 320 },
      { id: "market", order: 7, title: "结论与市场偏差", summary: "对比 Polymarket，给出 research signal（非投注 edge）。", detail: "不下单；仅作研究对比。", durationMs: 300 }
    ],
    evidence,
    model: outcomes.map((o, index) => ({
      id: ["A", "B", "C"][index] ?? `N${index}`,
      label: o.label,
      probability: o.modelProbability,
      rationale: `市场 ${(((o.marketProbability ?? 0) * 100)).toFixed(1)}% → 模型 ${((o.modelProbability) * 100).toFixed(1)}%（启发式修正）。`
    })),
    updates: [
      { label: "市场基线", from: headlineOutcome.marketProbability ?? 0, to: headlineOutcome.marketProbability ?? 0, explanation: "从去 overround 的市场隐含概率开始。" },
      { label: "启发式修正", from: headlineOutcome.marketProbability ?? 0, to: headlineOutcome.modelProbability, explanation: "favourite-longshot + 平局上调。" }
    ],
    progress: [],
    limitations: [
      "MVP 仅使用市场盘口 + 启发式修正，统计引擎（Elo/xG/Dixon-Coles/Monte Carlo）将在 Phase 1 接入。",
      "当前 edge 为研究偏差信号，不构成投注建议。",
      "球队伤停、首发、天气、海拔等情境因素尚未纳入（Phase 1 由 LLM 有界调整）。"
    ],
    archiveLinks: [
      { label: "World Cup special plan", path: "docs/internal/plan/2026-06-09-world-cup-special-plan.md" }
    ]
  };
}

function buildScoreboard(headlineOutcome: OutcomeProbability, input: MatchPriceInput): ScoreboardEntry[] {
  return [
    { source: "us", label: "我们 (MVP)", probabilityForActual: null, brier: null, note: "赛后按实际结果回填 Brier。" },
    {
      source: "kimi",
      label: "Kimi 公布",
      probabilityForActual: null,
      brier: null,
      note: input.kimiHeadlineProbability == null ? "未对照（需注明出处）" : `Kimi 公布约 ${(input.kimiHeadlineProbability * 100).toFixed(1)}%`
    },
    { source: "market", label: "Polymarket 市场", probabilityForActual: null, brier: null, note: `共识偏差研究变量：${((headlineOutcome.marketProbability ?? 0) * 100).toFixed(1)}%` }
  ];
}

export function buildWorldCupMatchReport(input: MatchPriceInput, generatedAtUtc: string): WorldCupReport {
  const market = normaliseMarket(input);
  const model = applyMvpHeuristic(market);
  const outcomes = buildOutcomes(market, model, input);
  const headline = pickHeadline(model);
  const headlineOutcome = outcomes.find((o) => o.outcome === headline)!;
  const tier = confidenceTier(headlineOutcome.modelProbability);
  const width = intervalWidthFor(tier);
  const ci: [number, number] = [
    clampProb(headlineOutcome.modelProbability - width),
    clampProb(headlineOutcome.modelProbability + width)
  ];

  const meta: WorldCupMatchMeta = {
    matchId: input.matchId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    group: input.group,
    stage: input.stage ?? "小组赛",
    kickoffUtc: input.kickoffUtc ?? null,
    polymarketUrl: input.polymarketUrl
  };

  return {
    schemaVersion: 1,
    meta,
    kind: "match",
    generatedAtUtc,
    outcomes,
    headlineOutcome: headline,
    confidenceTier: tier,
    confidenceInterval: [round(ci[0]), round(ci[1])],
    modelSource: { statistical: false, llm: true, market: true },
    scoreboard: buildScoreboard(headlineOutcome, input),
    run: buildRun(input, outcomes, headline, ci, generatedAtUtc),
    resolvedOutcome: null,
    disclaimerVersion: DISCLAIMER_VERSION
  };
}

export const __test = { normaliseMarket, applyMvpHeuristic, DISCLAIMER_FULL };
