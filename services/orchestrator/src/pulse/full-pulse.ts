import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentRuntimeProvider, OrchestratorConfig, SkillLocale } from "../config.js";
import { writeStoredArtifact } from "../lib/artifacts.js";
import { calculateQuarterKelly } from "../lib/risk.js";
import { combineTextMetrics, formatTextMetrics, measureText, readTextMetrics } from "../lib/text-metrics.js";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";
import type { PulseBucketStat, PulseCandidate, PulseFetchConfig, PulseStatsBundle } from "./market-pulse.js";
import { preScreenCandidates, type PreScreenResult, type PreScreenSummary } from "./pulse-prescreen.js";

interface PulseResearchOrderbook {
  outcomeLabel: string;
  tokenId: string;
  result: Record<string, unknown> | null;
}

interface PulseResearchCandidate {
  rank: number;
  priorityScore: number;
  market: PulseCandidate;
  scrapeResult: Record<string, unknown> | null;
  orderbooks: PulseResearchOrderbook[];
  errors: string[];
}

interface FullPulseContext {
  generated_at_utc: string;
  provider: AgentRuntimeProvider;
  locale: SkillLocale;
  title: string;
  total_fetched: number;
  total_filtered: number;
  selected_candidates: number;
  min_liquidity_usd: number;
  fetch_config: {
    pages_per_dimension: number;
    events_per_page: number;
    min_fetched_markets: number;
    dimensions: string[];
  };
  category_stats: {
    fetched: PulseBucketStat[];
    filtered: PulseBucketStat[];
  };
  tag_stats: {
    fetched: PulseBucketStat[];
    filtered: PulseBucketStat[];
  };
  risk_flags: string[];
  candidates: PulseCandidate[];
  research_candidates: PulseResearchCandidate[];
  pre_screen?: {
    enabled: boolean;
    results: PreScreenResult[];
    trade_count: number;
    skip_count: number;
    elapsed_ms: number;
    failed: boolean;
    failure_reason?: string;
  };
}

interface FullPulsePaths {
  pulseSkillFile: string;
  outputTemplateFile: string;
  analysisFrameworkFile: string;
  apiTradeScriptsDir: string | null;
}

type JsonRecord = Record<string, unknown>;
const COMMAND_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS = 1200;

function isChineseLocale(locale: SkillLocale): boolean {
  return locale === "zh";
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readStringValue(record: JsonRecord | null, key: string): string | null {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumberValue(record: JsonRecord | null, key: string): number | null {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function truncateText(value: string | null, maxChars: number): string | null {
  if (!value) {
    return null;
  }
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function summarizeScrapeResult(result: Record<string, unknown>, market: PulseCandidate): Record<string, unknown> | null {
  const record = asRecord(result);
  if (!record) {
    return null;
  }

  const rules = asRecord(record.rules);
  const comments = asRecord(record.comments);
  const marketContext = asRecord(record.market_context);
  const marketData = asRecord(record.market_data);
  const commentItems = asArray(comments?.items)
    .map((value) => asRecord(value))
    .filter((value): value is JsonRecord => value !== null)
    .slice(0, 5)
    .map((item, index) => ({
      rank: readNumberValue(item, "rank") ?? index + 1,
      user: readStringValue(item, "user"),
      body: truncateText(readStringValue(item, "body"), 320),
      likes: readNumberValue(item, "likes"),
      created_at: readStringValue(item, "created_at"),
      is_holder: item.is_holder === true,
      positions_count: Array.isArray(item.positions) ? item.positions.length : 0
    }));
  const annotations = asArray(marketContext?.annotations)
    .map((value) => asRecord(value))
    .filter((value): value is JsonRecord => value !== null)
    .slice(0, 5)
    .map((item) => ({
      title: readStringValue(item, "title"),
      summary: truncateText(readStringValue(item, "summary"), 400),
      date: readStringValue(item, "date"),
      hidden: item.hidden === true
    }));
  const matchedOutcomes = asArray(marketData?.outcomes)
    .map((value) => asRecord(value))
    .filter((value): value is JsonRecord => value !== null)
    .filter((item) => readStringValue(item, "question") === market.question)
    .slice(0, 1)
    .map((item) => ({
      question: readStringValue(item, "question"),
      best_bid: readNumberValue(item, "best_bid"),
      best_ask: readNumberValue(item, "best_ask")
    }));

  return {
    slug: readStringValue(record, "slug"),
    title: readStringValue(record, "title"),
    fetched_at: readStringValue(record, "fetched_at"),
    status: readStringValue(record, "status"),
    rules: {
      description: truncateText(readStringValue(rules, "description"), 2500),
      resolution_source: readStringValue(rules, "resolution_source")
    },
    market_context: {
      available: marketContext?.available === true,
      source: readStringValue(marketContext, "source"),
      annotations_count: asArray(marketContext?.annotations).length,
      annotations
    },
    comments: {
      sampled_count: commentItems.length,
      total_count: asArray(comments?.items).length,
      sampled_items: commentItems
    },
    market_data: {
      volume: readNumberValue(marketData, "volume"),
      liquidity: readNumberValue(marketData, "liquidity"),
      markets_count: readNumberValue(marketData, "markets_count"),
      matched_outcomes: matchedOutcomes
    }
  };
}

function summarizeOrderbookResult(result: Record<string, unknown>): Record<string, unknown> | null {
  const record = asRecord(result);
  if (!record) {
    return null;
  }

  const depth = asRecord(record.depth_2pct);
  const levels = asRecord(record.levels);
  const summarizeLevels = (value: unknown) =>
    asArray(value)
      .slice(0, 3)
      .map((entry) => {
        const tuple = Array.isArray(entry) ? entry : [];
        return {
          price: tuple[0] ?? null,
          size: tuple[1] ?? null
        };
      });

  return {
    status: readStringValue(record, "status"),
    best_bid: readNumberValue(record, "best_bid"),
    best_ask: readNumberValue(record, "best_ask"),
    spread: readNumberValue(record, "spread"),
    spread_pct: readNumberValue(record, "spread_pct"),
    smart_price: readNumberValue(record, "smart_price"),
    urgency: readStringValue(record, "urgency"),
    urgency_factor: readNumberValue(record, "urgency_factor"),
    depth_2pct: {
      bid_size: readNumberValue(depth, "bid_size"),
      ask_size: readNumberValue(depth, "ask_size"),
      bid_usd: readNumberValue(depth, "bid_usd"),
      ask_usd: readNumberValue(depth, "ask_usd")
    },
    top_levels: {
      bids: summarizeLevels(levels?.bids),
      asks: summarizeLevels(levels?.asks)
    }
  };
}

function resolvePulseSkillDir(config: OrchestratorConfig, locale: SkillLocale): string {
  if (config.pulse.sourceRepo === "polymarket-market-pulse") {
    return locale === "zh"
      ? path.join(config.pulse.sourceRepoDir, "polymarket-market-pulse-zh")
      : config.pulse.sourceRepoDir;
  }

  const skillDirName = locale === "zh" ? "polymarket-market-pulse-zh" : "polymarket-market-pulse";
  return path.join(config.pulse.sourceRepoDir, skillDirName);
}

function resolveFullPulsePaths(config: OrchestratorConfig, locale: SkillLocale): FullPulsePaths {
  const pulseSkillDir = resolvePulseSkillDir(config, locale);
  const outputTemplateFile = path.join(pulseSkillDir, "references", "output-template.md");
  const analysisFrameworkFile = path.join(pulseSkillDir, "references", "analysis-framework.md");
  const pulseSkillFile = path.join(pulseSkillDir, "SKILL.md");
  const apiTradeScriptsDir = path.join(
    config.repoRoot,
    "vendor",
    "repos",
    "all-polymarket-skill",
    "api-trade-polymarket",
    "scripts"
  );

  if (!existsSync(pulseSkillFile)) {
    throw new Error(`Missing pulse skill file: ${pulseSkillFile}`);
  }
  if (!existsSync(outputTemplateFile)) {
    throw new Error(`Missing pulse output template: ${outputTemplateFile}`);
  }
  if (!existsSync(analysisFrameworkFile)) {
    throw new Error(`Missing pulse analysis framework: ${analysisFrameworkFile}`);
  }

  return {
    pulseSkillFile,
    outputTemplateFile,
    analysisFrameworkFile,
    apiTradeScriptsDir: existsSync(apiTradeScriptsDir) ? apiTradeScriptsDir : null
  };
}

function computePriorityScore(candidate: PulseCandidate): number {
  const liquidityScore = Math.log10(candidate.liquidityUsd + 1);
  const volumeScore = Math.log10(candidate.volume24hUsd + 1);
  const spreadPenalty = Math.min(0.25, Math.max(candidate.spread, 0)) * 10;
  return volumeScore * 0.6 + liquidityScore * 0.4 - spreadPenalty;
}

function selectResearchCandidates(candidates: PulseCandidate[], count: number): PulseResearchCandidate[] {
  return [...candidates]
    .sort((left, right) => computePriorityScore(right) - computePriorityScore(left))
    .slice(0, Math.max(1, count))
    .map((market, index) => ({
      rank: index + 1,
      priorityScore: Number(computePriorityScore(market).toFixed(6)),
      market,
      scrapeResult: null,
      orderbooks: [],
      errors: []
    }));
}

function formatUsdMetric(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatPctMetric(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function resolvePulseRenderTimeoutMs(config: OrchestratorConfig): number {
  if (config.pulseTimeoutMode === "unbounded") {
    return 0;
  }
  if (config.pulse.reportTimeoutSeconds > 0) {
    return config.pulse.reportTimeoutSeconds * 1000;
  }
  if (config.decisionStrategy === "pulse-direct") {
    const seconds = config.pulse.directRenderTimeoutSeconds > 0
      ? config.pulse.directRenderTimeoutSeconds
      : DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS;
    return seconds * 1000;
  }
  return 0;
}

function resolvePulseResearchTimeoutMs(config: OrchestratorConfig): number {
  if (config.pulseTimeoutMode === "unbounded") {
    return 0;
  }
  return config.pulse.reportTimeoutSeconds * 1000;
}

function clampProbability(value: number): number {
  return Math.min(0.95, Math.max(0.05, value));
}

function findOutcomeIndex(candidate: PulseCandidate, label: string): number {
  return candidate.outcomes.findIndex((outcome) => outcome.toLowerCase() === label.toLowerCase());
}

function buildFallbackTradePlan(candidate: PulseResearchCandidate) {
  const yesIndex = findOutcomeIndex(candidate.market, "Yes");
  const noIndex = findOutcomeIndex(candidate.market, "No");
  if (yesIndex < 0 || noIndex < 0) {
    return null;
  }

  const yesMarketProb = candidate.market.outcomePrices[yesIndex] ?? Number.NaN;
  const noMarketProb = candidate.market.outcomePrices[noIndex] ?? Number.NaN;
  if (!(Number.isFinite(yesMarketProb) && yesMarketProb > 0 && yesMarketProb < 1)) {
    return null;
  }
  if (!(Number.isFinite(noMarketProb) && noMarketProb > 0 && noMarketProb < 1)) {
    return null;
  }

  const preferredOutcome = yesMarketProb >= noMarketProb ? "Yes" : "No";
  const preferredMarketProb = preferredOutcome === "Yes" ? yesMarketProb : noMarketProb;
  if (preferredMarketProb < 0.15 || preferredMarketProb > 0.85) {
    return null;
  }

  const preferredAiProb = clampProbability(preferredMarketProb + 0.1);
  const yesAiProb = preferredOutcome === "Yes" ? preferredAiProb : clampProbability(1 - preferredAiProb);
  const noAiProb = preferredOutcome === "No" ? preferredAiProb : clampProbability(1 - preferredAiProb);
  const preferredKelly = calculateQuarterKelly({
    aiProb: preferredAiProb,
    marketProb: preferredMarketProb,
    bankrollUsd: 1
  });
  if (!(preferredKelly.quarterKellyPct > 0)) {
    return null;
  }

  return {
    preferredOutcome,
    suggestedPct: preferredKelly.quarterKellyPct,
    confidence: candidate.market.spread <= 0.02 ? "medium" as const : "low" as const,
    yesMarketProb,
    noMarketProb,
    yesAiProb,
    noAiProb
  };
}

function buildDeterministicPulseMarkdown(context: FullPulseContext): string {
  const zh = isChineseLocale(context.locale);
  const rankedCandidates = [...context.research_candidates]
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 3);
  const fallbackOpenMarketSlug = rankedCandidates
    .map((candidate) => ({
      marketSlug: candidate.market.marketSlug,
      plan: buildFallbackTradePlan(candidate)
    }))
    .find((candidate) => candidate.plan !== null)?.marketSlug ?? null;

  const intro = zh
    ? [
        `# ${context.title}`,
        "",
        "> 本报告由本地 deterministic fallback 生成，因为 full pulse provider 在当前 live 路径下未提供可用 Markdown 输出。",
        fallbackOpenMarketSlug
          ? "> 为了让执行链路继续收敛，本 fallback 只会给一个最高优先级且满足基本条件的二元市场生成 provisional 开仓结构，其余候选仍保持摘要模式。"
          : "> 为了遵守现有风控，本 fallback 本轮未找到适合生成 provisional 开仓结构的二元市场，因此只保留候选摘要和仓位复审上下文。"
      ]
    : [
        `# ${context.title}`,
        "",
        "> This report was generated by the local deterministic fallback because the full pulse provider did not return usable Markdown on the live path.",
        fallbackOpenMarketSlug
          ? "> To keep the execution path convergent, this fallback emits a provisional open structure for only one top-ranked binary market that passes basic checks; the rest remain summary-only."
          : "> To preserve existing guardrails, this fallback did not find a suitable binary market for a provisional open structure and therefore keeps summary-only output."
      ];

  const metadata = zh
    ? [
        "## 0. 元数据",
        "",
        `- 生成时间：${context.generated_at_utc}`,
        `- Provider：${context.provider}`,
        `- 抓取市场：${context.total_fetched}`,
        `- 过滤后市场：${context.total_filtered}`,
        `- 候选池大小：${context.selected_candidates}`,
        `- 最小流动性：${formatUsdMetric(context.min_liquidity_usd)}`,
        `- 风险标记：${context.risk_flags.length > 0 ? context.risk_flags.join("；") : "无"}`
      ]
    : [
        "## 0. Metadata",
        "",
        `- Generated at: ${context.generated_at_utc}`,
        `- Provider: ${context.provider}`,
        `- Markets fetched: ${context.total_fetched}`,
        `- Markets after filter: ${context.total_filtered}`,
        `- Candidate pool size: ${context.selected_candidates}`,
        `- Minimum liquidity: ${formatUsdMetric(context.min_liquidity_usd)}`,
        `- Risk flags: ${context.risk_flags.length > 0 ? context.risk_flags.join("; ") : "none"}`
      ];

  const candidatePoolSection = zh
    ? [
        "## 候选池与筛选思路",
        "",
        "当前 live 路径优先保证执行链路可收敛，因此本地 fallback 只按流动性、24h 成交和点差做候选排序。",
        fallbackOpenMarketSlug
          ? "在没有可靠模型长文结论之前，本轮只为一个最高优先级的二元市场生成 provisional 开仓结构，并保守地沿用市场共识方向与小仓位。"
          : "在没有可靠模型长文结论之前，本轮默认不从该摘要直接生成新的开仓方向。"
      ]
    : [
        "## Candidate Pool & Selection Rationale",
        "",
        "The live path prioritizes a convergent execution flow, so this fallback ranks candidates by liquidity, 24h volume, and spread only.",
        fallbackOpenMarketSlug
          ? "Without a reliable model-produced report, this fallback emits a provisional open structure for only one top-ranked binary market, following consensus direction with conservative sizing."
          : "Without a reliable model-produced report, this summary does not directly generate new open directions."
      ];

  const candidateSections = rankedCandidates.map((candidate, index) => {
    const market = candidate.market;
    const header = `## ${index + 1}. ${market.question}`;
    const fallbackTradePlan = fallbackOpenMarketSlug === market.marketSlug
      ? buildFallbackTradePlan(candidate)
      : null;
    if (zh) {
      return [
        header,
        "",
        `**链接：** ${market.url}`,
        `**Fallback 状态：** ${fallbackTradePlan ? "本地 provisional 开仓候选" : "本地摘要，不生成新的开仓表格行"}`,
        `**置信度：** ${fallbackTradePlan?.confidence === "medium" ? "中" : "低"}`,
        "",
        `- market slug：${market.marketSlug}`,
        `- event slug：${market.eventSlug}`,
        `- 优先级分：${candidate.priorityScore.toFixed(4)}`,
        `- 流动性：${formatUsdMetric(market.liquidityUsd)}`,
        `- 24h 成交：${formatUsdMetric(market.volume24hUsd)}`,
        `- 最佳买价 / 卖价：${market.bestBid.toFixed(3)} / ${market.bestAsk.toFixed(3)}`,
        `- 点差：${formatPctMetric(market.spread)}`,
        `- 研究错误：${candidate.errors.length > 0 ? candidate.errors.join("；") : "无"}`,
        "",
        ...(fallbackTradePlan
          ? [
              "| 方向 | 买入 " + fallbackTradePlan.preferredOutcome + " |",
              `| 建议仓位 | ${(fallbackTradePlan.suggestedPct * 100).toFixed(0)}% |`,
              "",
              "| Outcome | Market | AI |",
              "| --- | --- | --- |",
              `| Yes | ${formatPctMetric(fallbackTradePlan.yesMarketProb)} | ${formatPctMetric(fallbackTradePlan.yesAiProb)} |`,
              `| No | ${formatPctMetric(fallbackTradePlan.noMarketProb)} | ${formatPctMetric(fallbackTradePlan.noAiProb)} |`,
              ""
            ]
          : []),
        "### 推理逻辑",
        fallbackTradePlan
          ? "full pulse provider 在当前 live 路径下超时，因此这里退化为 deterministic fallback。为了保持链路可执行，这里只对一个最高优先级、流动性合格且点差可接受的二元市场给出 provisional 开仓候选。"
          : "full pulse provider 未在当前 live 路径下产出可用 Markdown，因此这里只保留候选摘要，避免在缺少完整论证时直接新增开仓。",
        fallbackTradePlan
          ? "这个 provisional 候选并不是完整研究结论，而是保守的共识跟随启发式：沿用当前市场主方向、把 AI 概率只上调一个受限的固定增量，并把仓位限制在小额范围内。"
          : "后续决策仍可继续使用已有仓位复审结果，并等待更稳定的 pulse report 渲染链路。"
      ].join("\n");
    }

    return [
      header,
      "",
      `**Link:** ${market.url}`,
      `**Fallback Status:** ${fallbackTradePlan ? "local provisional open candidate" : "local summary only, no new open-trade table emitted"}`,
      `**Confidence:** ${fallbackTradePlan?.confidence === "medium" ? "medium" : "low"}`,
      "",
      `- market slug: ${market.marketSlug}`,
      `- event slug: ${market.eventSlug}`,
      `- priority score: ${candidate.priorityScore.toFixed(4)}`,
      `- liquidity: ${formatUsdMetric(market.liquidityUsd)}`,
      `- 24h volume: ${formatUsdMetric(market.volume24hUsd)}`,
      `- best bid / ask: ${market.bestBid.toFixed(3)} / ${market.bestAsk.toFixed(3)}`,
      `- spread: ${formatPctMetric(market.spread)}`,
      `- research errors: ${candidate.errors.length > 0 ? candidate.errors.join("; ") : "none"}`,
      "",
      ...(fallbackTradePlan
        ? [
            `| Direction | Buy ${fallbackTradePlan.preferredOutcome} |`,
            `| Suggested Size | ${(fallbackTradePlan.suggestedPct * 100).toFixed(0)}% |`,
            "",
            "| Outcome | Market | AI |",
            "| --- | --- | --- |",
            `| Yes | ${formatPctMetric(fallbackTradePlan.yesMarketProb)} | ${formatPctMetric(fallbackTradePlan.yesAiProb)} |`,
            `| No | ${formatPctMetric(fallbackTradePlan.noMarketProb)} | ${formatPctMetric(fallbackTradePlan.noAiProb)} |`,
            ""
          ]
        : []),
      "### Reasoning",
      fallbackTradePlan
        ? "The full pulse provider timed out on the live path, so this section falls back to a deterministic provisional open structure for one top-ranked binary market."
        : "The full pulse provider did not return usable Markdown on the live path, so this fallback keeps a candidate summary only.",
      fallbackTradePlan
        ? "This is not a full research conclusion. It is a conservative consensus-following heuristic that applies a capped fixed AI uplift and keeps sizing small so the rest of the pipeline can still execute under guardrails."
        : "Existing position review can still continue, but new opens are intentionally not derived from this fallback summary."
    ].join("\n");
  });

  return [
    ...intro,
    "",
    ...metadata,
    "",
    ...candidatePoolSection,
    "",
    ...candidateSections
  ].join("\n");
}

function readOutputSizeBytes(outputPath: string | undefined): number {
  if (!outputPath || !existsSync(outputPath)) {
    return 0;
  }
  try {
    return statSync(outputPath).size;
  } catch {
    return 0;
  }
}

function formatRemainingTimeoutMs(startedAt: number, timeoutMs: number | null): string {
  if (timeoutMs == null) {
    return "disabled";
  }
  const remainingMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
  return `${Math.ceil(remainingMs / 1000)}s`;
}

function buildCommandHeartbeatDetail(input: {
  stage: string;
  progressDetail?: string;
  startedAt: number;
  timeoutMs: number | null;
  tempDir?: string;
  outputPath?: string;
}): string {
  return [
    `stage ${input.stage}`,
    input.progressDetail,
    `elapsed ${Math.round((Date.now() - input.startedAt) / 1000)}s`,
    `temp ${input.tempDir ?? "-"}`,
    `output ${input.outputPath ?? "-"}`,
    `output bytes ${readOutputSizeBytes(input.outputPath)}`,
    `timeout remaining ${formatRemainingTimeoutMs(input.startedAt, input.timeoutMs)}`
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const lines = trimmed.split("\n");
  if (lines.length < 3) {
    return trimmed;
  }

  return lines.slice(1, -1).join("\n").trim();
}

async function runCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  stdin?: string;
  progress?: ProgressReporter;
  progressPercent?: number;
  progressLabel?: string;
  progressDetail?: string;
  heartbeatTempDir?: string;
  heartbeatOutputPath?: string;
}): Promise<{ stdout: string; stderr: string; code: number }> {
  const effectiveTimeoutMs = input.timeoutMs > 0 ? input.timeoutMs : null;
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: [input.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    const startedAt = Date.now();
    const heartbeat = setInterval(() => {
      if (!input.progress || !input.progressLabel || !input.progressPercent) {
        return;
      }
      input.progress.heartbeat({
        percent: input.progressPercent,
        label: input.progressLabel,
        detail: buildCommandHeartbeatDetail({
          stage: input.progressLabel,
          progressDetail: input.progressDetail,
          startedAt,
          timeoutMs: effectiveTimeoutMs,
          tempDir: input.heartbeatTempDir,
          outputPath: input.heartbeatOutputPath
        }),
        elapsedMs: Date.now() - startedAt,
        timeoutMs: effectiveTimeoutMs ?? undefined
      });
    }, COMMAND_HEARTBEAT_INTERVAL_MS);
    const timeout = effectiveTimeoutMs == null
      ? null
      : setTimeout(() => {
          clearInterval(heartbeat);
          child.kill("SIGTERM");
          reject(new Error(
            `${input.command} ${input.args.join(" ")} timed out after ${effectiveTimeoutMs}ms\n` +
            `${buildCommandHeartbeatDetail({
              stage: input.progressLabel ?? input.command,
              progressDetail: input.progressDetail,
              startedAt,
              timeoutMs: effectiveTimeoutMs,
              tempDir: input.heartbeatTempDir,
              outputPath: input.heartbeatOutputPath
            })}`
          ));
        }, effectiveTimeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearInterval(heartbeat);
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(new Error(
        `${error.message}\n` +
        `${buildCommandHeartbeatDetail({
          stage: input.progressLabel ?? input.command,
          progressDetail: input.progressDetail,
          startedAt,
          timeoutMs: effectiveTimeoutMs,
          tempDir: input.heartbeatTempDir,
          outputPath: input.heartbeatOutputPath
        })}`,
        { cause: error }
      ));
    });
    child.on("close", (code) => {
      clearInterval(heartbeat);
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    if (input.stdin !== undefined) {
      child.stdin?.write(input.stdin);
      child.stdin?.end();
    }
  });
}

async function runJsonCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  progress?: ProgressReporter;
  progressPercent?: number;
  progressLabel?: string;
  progressDetail?: string;
}): Promise<Record<string, unknown>> {
  const result = await runCommand(input);
  const stdout = result.stdout.trim();

  if (stdout) {
    try {
      return JSON.parse(stdout) as Record<string, unknown>;
    } catch {
      if (result.code === 0) {
        throw new Error(`Command returned non-JSON stdout: ${stdout.slice(0, 400)}`);
      }
    }
  }

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || stdout || `${input.command} exited with code ${result.code}`);
  }

  return {};
}

async function ensureApiTradeScriptsInstalled(apiTradeScriptsDir: string, timeoutMs: number, progress?: ProgressReporter) {
  const tsxBinary = path.join(apiTradeScriptsDir, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  if (existsSync(tsxBinary)) {
    return;
  }

  const result = await runCommand({
    command: "npm",
    args: ["install"],
    cwd: apiTradeScriptsDir,
    timeoutMs,
    progress,
    progressPercent: 28,
    progressLabel: "Installing api-trade-polymarket scripts",
    progressDetail: apiTradeScriptsDir
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "npm install failed for api-trade-polymarket scripts");
  }
}

async function collectResearchCandidate(
  candidate: PulseResearchCandidate,
  apiTradeScriptsDir: string | null,
  config: OrchestratorConfig,
  progress?: ProgressReporter
): Promise<PulseResearchCandidate> {
  if (!apiTradeScriptsDir) {
    candidate.errors.push("api-trade-polymarket scripts directory is unavailable");
    return candidate;
  }

  const researchTimeoutMs = resolvePulseResearchTimeoutMs(config);
  await ensureApiTradeScriptsInstalled(apiTradeScriptsDir, researchTimeoutMs, progress);

  try {
    candidate.scrapeResult = summarizeScrapeResult(await runJsonCommand({
      command: "npx",
      args: [
        "tsx",
        "scrape-market.ts",
        "--slug",
        candidate.market.eventSlug,
        "--sections",
        "context,rules,comments",
        "--comment-limit",
        String(config.pulse.reportCommentLimit),
        "--comment-sort",
        "likes"
      ],
      cwd: apiTradeScriptsDir,
      timeoutMs: researchTimeoutMs,
      progress,
      progressPercent: 32,
      progressLabel: "Scraping market context",
      progressDetail: candidate.market.marketSlug
    }), candidate.market);
  } catch (error) {
    candidate.errors.push(`scrape-market failed: ${(error as Error).message}`);
  }

  const orderbookLimit = Math.min(candidate.market.clobTokenIds.length, candidate.market.outcomes.length, 3);
  for (let index = 0; index < orderbookLimit; index += 1) {
    const tokenId = candidate.market.clobTokenIds[index]!;
    const outcomeLabel = candidate.market.outcomes[index] ?? `Outcome ${index + 1}`;

    try {
      const result = summarizeOrderbookResult(await runJsonCommand({
        command: "npx",
        args: [
          "tsx",
          "orderbook.ts",
          "--token-id",
          tokenId,
          "--side",
          "BUY",
          "--urgency",
          "medium",
          "--depth",
          "5"
        ],
        cwd: apiTradeScriptsDir,
        timeoutMs: researchTimeoutMs,
        progress,
        progressPercent: 38,
        progressLabel: "Reading orderbooks",
        progressDetail: `${candidate.market.marketSlug} / ${outcomeLabel}`
      }));
      candidate.orderbooks.push({
        outcomeLabel,
        tokenId,
        result
      });
    } catch (error) {
      candidate.errors.push(`orderbook failed for ${outcomeLabel}: ${(error as Error).message}`);
    }
  }

  return candidate;
}

function buildFullPulsePrompt(input: {
  locale: SkillLocale;
  provider: AgentRuntimeProvider;
  paths: FullPulsePaths;
  contextJsonPath: string;
}): string {
  if (isChineseLocale(input.locale)) {
    return [
      "你正在生成一份完整的 Polymarket 市场脉冲报告。",
      "这份报告将直接替代系统中当前的简化 pulse 候选快照，并作为长期归档文档保存。",
      "",
      "必须先阅读这些文件：",
      `- Pulse Skill: ${input.paths.pulseSkillFile}`,
      `- 输出模板: ${input.paths.outputTemplateFile}`,
      `- 分析框架: ${input.paths.analysisFrameworkFile}`,
      `- 研究上下文 JSON: ${input.contextJsonPath}`,
      "",
      "执行要求：",
      "1. 只输出最终 Markdown，不要输出代码块，不要输出解释。",
      "2. 全文必须使用中文。",
      "3. 报告必须尽量遵循输出模板的章节顺序和字段结构。",
      "4. 必须产出完整文档，而不是候选表摘要。",
      "5. 在正式 Top 3 推荐之前，必须增加“候选池与筛选思路”和“推荐摘要”章节，说明本轮候选从哪里来、筛掉了什么、为什么最终进入 Top 3，并先给出一张可快速浏览的摘要表。",
      "6. 必须包含：报告头部、候选池与筛选思路、推荐摘要、前 3 个推荐市场、概率评估、证据链、四维分析、结算规则、推理逻辑、仓位建议、评论区校验、信息源、元数据。",
      "7. 研究上下文 JSON 中没有的数据，必须明确写“未获取”或“数据不足”，不能编造。",
      "8. 默认只使用已提供的研究上下文完成报告；只有在完成报告所必需且上下文明显缺失时，才允许做极少量定向补充核验。",
      "9. 如果无法补齐外部证据，也必须完成完整模板，并在置信度和结论中反映证据缺口。",
      "10. Top 3 推荐必须给出明确方向、edge、概率和仓位建议，并说明它优于其余候选的原因。",
      "",
      `当前 provider：${input.provider}`,
      "输出最终 Markdown。"
    ].join("\n");
  }

  return [
    "You are generating a full Polymarket market pulse report.",
    "This report replaces the simplified pulse snapshot and must be archived as a complete document.",
    "",
    "Read these files first:",
    `- Pulse Skill: ${input.paths.pulseSkillFile}`,
    `- Output Template: ${input.paths.outputTemplateFile}`,
    `- Analysis Framework: ${input.paths.analysisFrameworkFile}`,
    `- Research Context JSON: ${input.contextJsonPath}`,
    "",
    "Requirements:",
    "1. Output final Markdown only.",
    "2. Follow the output template as closely as possible.",
    "3. Produce a complete document, not a candidate summary.",
    "4. Add both a candidate-pool/selection-rationale section and a recommendation-summary table before the Top 3 recommendations, explaining where the candidates came from, what was filtered out, and why the final Top 3 survived.",
    "5. Include: header, candidate-pool rationale, recommendation summary, top 3 recommendations, probability evaluation, evidence chain, four-dimensional analysis, resolution rules, reasoning logic, sizing guidance, comment review, source list, metadata.",
    "6. If data is missing, explicitly mark it as unavailable instead of inventing it.",
    "7. Default to the provided research context. Only do very limited additional verification if the report would otherwise be incomplete.",
    "8. Top 3 recommendations must include direction, edge, probabilities, sizing guidance, and why each beats the remaining candidates.",
    "",
    `Active provider: ${input.provider}`,
    "Output the final Markdown."
  ].join("\n");
}

/**
 * Default command templates for well-known providers.
 * Each template can use {{repo_root}}, {{prompt_file}}, {{output_file}},
 * {{model}}, {{skill_root}}, and any other replacement keys.
 * Returns null for unknown providers — they must set COMMAND explicitly.
 */
function resolveDefaultProviderCommand(provider: string): string | null {
  switch (provider) {
    case "codex":
      return 'cat {{prompt_file}} | codex exec --skip-git-repo-check -C {{repo_root}} -s read-only --color never -c \'model_reasoning_effort="low"\' -o {{output_file}} -';
    case "claude-code":
      return 'cat {{prompt_file}} | claude --print > {{output_file}}';
    case "openclaw":
      return 'cat {{prompt_file}} | openclaw run --output {{output_file}} -';
    default:
      return null;
  }
}

async function runCodexMarkdown(input: {
  prompt: string;
  repoRoot: string;
  outputPath: string;
  tempDir: string;
  timeoutMs: number;
  model: string;
  skillRootDir: string;
  progress?: ProgressReporter;
}) {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "-C",
    input.repoRoot,
    "-s",
    "read-only",
    "--color",
    "never",
    "-c",
    'model_reasoning_effort="low"',
    "-o",
    input.outputPath
  ];

  if (input.model) {
    args.push("-m", input.model);
  }

  const skillRootOutsideRepo = input.skillRootDir !== input.repoRoot
    && !input.skillRootDir.startsWith(`${input.repoRoot}${path.sep}`);
  if (skillRootOutsideRepo) {
    args.push("--add-dir", input.skillRootDir);
  }

  args.push("-");
  const commandStartedAt = Date.now();

  const result = await runCommand({
    command: "codex",
    args,
    cwd: input.repoRoot,
    timeoutMs: input.timeoutMs,
    stdin: input.prompt,
    progress: input.progress,
    progressPercent: 56,
    progressLabel: "Rendering full pulse with Codex",
    progressDetail: path.basename(input.outputPath),
    heartbeatTempDir: input.tempDir,
    heartbeatOutputPath: input.outputPath
  });

  if (result.code !== 0) {
    throw new Error(
      `${result.stderr.trim() || result.stdout.trim() || `codex exec exited with code ${result.code}`}\n` +
      `${buildCommandHeartbeatDetail({
        stage: "Rendering full pulse with Codex",
        progressDetail: path.basename(input.outputPath),
        startedAt: commandStartedAt,
        timeoutMs: input.timeoutMs > 0 ? input.timeoutMs : null,
        tempDir: input.tempDir,
        outputPath: input.outputPath
      })}`
    );
  }
}

async function runTemplateMarkdown(input: {
  commandTemplate: string;
  repoRoot: string;
  promptFile: string;
  outputPath: string;
  tempDir: string;
  timeoutMs: number;
  replacements: Record<string, string>;
  progress?: ProgressReporter;
}) {
  let command = input.commandTemplate;
  for (const [key, value] of Object.entries({
    repo_root: input.repoRoot,
    prompt_file: input.promptFile,
    output_file: input.outputPath,
    ...input.replacements
  })) {
    command = command.replaceAll(`{{${key}}}`, value);
  }
  const commandStartedAt = Date.now();

  const result = await runCommand({
    command: "/bin/sh",
    args: ["-lc", command],
    cwd: input.repoRoot,
    timeoutMs: input.timeoutMs,
    progress: input.progress,
    progressPercent: 56,
    progressLabel: "Rendering full pulse with template provider",
    progressDetail: path.basename(input.outputPath),
    heartbeatTempDir: input.tempDir,
    heartbeatOutputPath: input.outputPath
  });

  if (result.code !== 0) {
    throw new Error(
      `${result.stderr.trim() || result.stdout.trim() || `pulse provider command exited with code ${result.code}`}\n` +
      `${buildCommandHeartbeatDetail({
        stage: "Rendering full pulse with template provider",
        progressDetail: path.basename(input.outputPath),
        startedAt: commandStartedAt,
        timeoutMs: input.timeoutMs > 0 ? input.timeoutMs : null,
        tempDir: input.tempDir,
        outputPath: input.outputPath
      })}`
    );
  }
}

async function renderFullPulseMarkdown(input: {
  config: OrchestratorConfig;
  provider: AgentRuntimeProvider;
  locale: SkillLocale;
  contextJsonPath: string;
  paths: FullPulsePaths;
  progress?: ProgressReporter;
}): Promise<string> {
  const settings = resolveProviderSkillSettings(input.config, input.provider);
  const prompt = buildFullPulsePrompt({
    locale: input.locale,
    provider: input.provider,
    paths: input.paths,
    contextJsonPath: input.contextJsonPath
  });
  const tempDir = await mkdtemp(path.join(tmpdir(), `autopoly-pulse-render-${input.provider}-`));
  const promptPath = path.join(tempDir, "full-pulse-prompt.txt");
  const outputPath = path.join(tempDir, "full-pulse-report.md");
  let preserveTempDir = false;
  const renderStartedAt = Date.now();
  const renderTimeoutMs = resolvePulseRenderTimeoutMs(input.config);

  try {
    await writeFile(promptPath, prompt, "utf8");
    const [
      pulseSkillMetrics,
      outputTemplateMetrics,
      analysisFrameworkMetrics,
      contextJsonMetrics
    ] = await Promise.all([
      readTextMetrics(input.paths.pulseSkillFile),
      readTextMetrics(input.paths.outputTemplateFile),
      readTextMetrics(input.paths.analysisFrameworkFile),
      readTextMetrics(input.contextJsonPath)
    ]);
    const promptMetrics = measureText(prompt);
    const supportDocMetrics = combineTextMetrics([
      pulseSkillMetrics,
      outputTemplateMetrics,
      analysisFrameworkMetrics
    ]);
    const totalInputMetrics = combineTextMetrics([
      promptMetrics,
      supportDocMetrics,
      contextJsonMetrics
    ]);

    input.progress?.info(
      `Pulse render context | prompt ${formatTextMetrics(promptMetrics)} | research JSON ${formatTextMetrics(contextJsonMetrics)}`
    );
    input.progress?.info(
      `Pulse render inputs | support docs 3 files / ${formatTextMetrics(supportDocMetrics)} | est total ${formatTextMetrics(totalInputMetrics)}`
    );
    input.progress?.info(`Pulse render temp dir | ${tempDir}`);
    if (input.config.pulseTimeoutMode !== "unbounded" && input.config.pulse.reportTimeoutSeconds <= 0 && renderTimeoutMs > 0) {
      input.progress?.info(
        `Pulse render timeout fallback | PULSE_REPORT_TIMEOUT_SECONDS disabled, using internal ${Math.round(renderTimeoutMs / 1000)}s timeout for ${input.config.decisionStrategy}`
      );
    }
    input.progress?.info(
      `Pulse render timeout | ${renderTimeoutMs > 0 ? `${Math.round(renderTimeoutMs / 1000)}s` : "disabled"}`
    );

    const effectiveCommand = settings.command || resolveDefaultProviderCommand(input.provider);
    if (!effectiveCommand) {
      throw new Error(
        `No pulse report command configured for provider "${input.provider}". ` +
        `Set ${input.provider.toUpperCase()}_COMMAND in your .env file, or use a well-known provider (codex, claude-code, openclaw).`
      );
    }
    await runTemplateMarkdown({
      commandTemplate: effectiveCommand,
      repoRoot: input.config.repoRoot,
      promptFile: promptPath,
      outputPath,
      tempDir,
      timeoutMs: renderTimeoutMs,
      replacements: {
        skill_root: settings.skillRootDir,
        model: settings.model,
        pulse_skill_file: input.paths.pulseSkillFile,
        output_template: input.paths.outputTemplateFile,
        analysis_framework: input.paths.analysisFrameworkFile,
        context_json: input.contextJsonPath
      },
      progress: input.progress
    });

    const content = stripCodeFences(await readFile(outputPath, "utf8"));
    if (!content.trim()) {
      throw new Error("Full pulse provider returned empty markdown.");
    }
    input.progress?.info(
      `Pulse render output | ${path.basename(outputPath)} | ${formatTextMetrics(measureText(content))} | elapsed ${Math.round((Date.now() - renderStartedAt) / 1000)}s`
    );
    return content;
  } catch (error) {
    preserveTempDir = true;
    if (existsSync(outputPath)) {
      try {
        const partialOutput = await readFile(outputPath, "utf8");
        input.progress?.info(
          `Pulse render partial output | ${path.basename(outputPath)} | ${formatTextMetrics(measureText(partialOutput))}`
        );
      } catch {
        // ignore debug read failures
      }
    }
    input.progress?.fail(`Pulse render failed | temp preserved at ${tempDir}`);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\n` +
      `${buildCommandHeartbeatDetail({
        stage: "Pulse render failure",
        startedAt: renderStartedAt,
        timeoutMs: renderTimeoutMs > 0 ? renderTimeoutMs : null,
        tempDir,
        outputPath
      })}\n\nPulse render temp preserved at ${tempDir}`,
      { cause: error }
    );
  } finally {
    if (!preserveTempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

export async function buildFullPulseArchive(input: {
  config: OrchestratorConfig;
  provider: AgentRuntimeProvider;
  locale: SkillLocale;
  title: string;
  generatedAtUtc: string;
  totalFetched: number;
  totalFiltered: number;
  minLiquidityUsd: number;
  fetchConfig: PulseFetchConfig;
  categoryStats: PulseStatsBundle;
  tagStats: PulseStatsBundle;
  candidates: PulseCandidate[];
  riskFlags: string[];
  relativeJsonPath: string;
  relativeMarkdownPath: string;
  progress?: ProgressReporter;
}): Promise<{
  markdown: string;
  absoluteMarkdownPath: string;
  absoluteJsonPath: string;
}> {
  const paths = resolveFullPulsePaths(input.config, input.locale);

  // Phase C: optional AI pre-screening before deep research selection
  let preScreenSummary: PreScreenSummary | null = null;
  let researchPool: readonly PulseCandidate[] = input.candidates;

  if (input.config.pulseAiPrescreen && input.candidates.length > 0) {
    input.progress?.stage({
      percent: 21,
      label: "AI pre-screen starting",
      detail: `${input.candidates.length} candidates to classify`
    });
    preScreenSummary = await preScreenCandidates({
      candidates: input.candidates,
      provider: input.provider,
      config: input.config,
      progress: input.progress
    });

    if (!preScreenSummary.failed) {
      const tradeSlugs = new Set(
        preScreenSummary.results
          .filter((r) => r.suitable)
          .map((r) => r.marketSlug)
      );
      const filtered = input.candidates.filter((c) => tradeSlugs.has(c.marketSlug));
      // Only use filtered list if at least one candidate survives
      if (filtered.length > 0) {
        researchPool = filtered;
        input.progress?.stage({
          percent: 23,
          label: "AI pre-screen filtered candidates",
          detail: `${input.candidates.length} -> ${filtered.length} after pre-screen (${preScreenSummary.skipCount} skipped)`
        });
      } else {
        input.progress?.info(
          "AI pre-screen skipped all candidates; falling back to full candidate list"
        );
      }
    }
  }

  const selectedCandidates = selectResearchCandidates([...researchPool], input.config.pulse.reportCandidates);
  input.progress?.stage({
    percent: 24,
    label: "Selected pulse research candidates",
    detail: `${selectedCandidates.length} candidates for deep research${preScreenSummary && !preScreenSummary.failed ? ` (from ${researchPool.length} after pre-screen)` : ""}`
  });
  let completedResearch = 0;
  const researchCandidates = await Promise.all(
    selectedCandidates.map(async (candidate, index) => {
      input.progress?.stage({
        percent: 26 + Math.round((index / Math.max(selectedCandidates.length, 1)) * 18),
        label: "Researching pulse candidate",
        detail: `${index + 1}/${selectedCandidates.length} ${candidate.market.marketSlug}`
      });
      const result = await collectResearchCandidate(candidate, paths.apiTradeScriptsDir, input.config, input.progress);
      completedResearch += 1;
      input.progress?.stage({
        percent: 26 + Math.round((completedResearch / Math.max(selectedCandidates.length, 1)) * 18),
        label: "Pulse research progress",
        detail: `${completedResearch}/${selectedCandidates.length} completed`
      });
      return result;
    })
  );

  const context: FullPulseContext = {
    generated_at_utc: input.generatedAtUtc,
    provider: input.provider,
    locale: input.locale,
    title: input.title,
    total_fetched: input.totalFetched,
    total_filtered: input.totalFiltered,
    selected_candidates: input.candidates.length,
    min_liquidity_usd: input.minLiquidityUsd,
    fetch_config: {
      pages_per_dimension: input.fetchConfig.pagesPerDimension,
      events_per_page: input.fetchConfig.eventsPerPage,
      min_fetched_markets: input.fetchConfig.minFetchedMarkets,
      dimensions: input.fetchConfig.dimensions
    },
    category_stats: {
      fetched: input.categoryStats.fetched,
      filtered: input.categoryStats.filtered
    },
    tag_stats: {
      fetched: input.tagStats.fetched,
      filtered: input.tagStats.filtered
    },
    risk_flags: input.riskFlags,
    candidates: input.candidates,
    research_candidates: researchCandidates,
    ...(preScreenSummary
      ? {
          pre_screen: {
            enabled: true,
            results: preScreenSummary.results,
            trade_count: preScreenSummary.tradeCount,
            skip_count: preScreenSummary.skipCount,
            elapsed_ms: preScreenSummary.elapsedMs,
            failed: preScreenSummary.failed,
            ...(preScreenSummary.failureReason ? { failure_reason: preScreenSummary.failureReason } : {})
          }
        }
      : {})
  };

  const absoluteJsonPath = await writeStoredArtifact(
    input.config.artifactStorageRoot,
    input.relativeJsonPath,
    JSON.stringify(context, null, 2)
  );
  const contextJsonMetrics = measureText(JSON.stringify(context, null, 2));
  input.progress?.stage({
    percent: 50,
    label: "Pulse research context written",
    detail: `${input.relativeJsonPath} | ${formatTextMetrics(contextJsonMetrics)}`
  });
  let markdown: string;
  const renderStartedAtMs = Date.now();
  try {
    markdown = await renderFullPulseMarkdown({
      config: input.config,
      provider: input.provider,
      locale: input.locale,
      contextJsonPath: absoluteJsonPath,
      paths,
      progress: input.progress
    });
  } catch (error) {
    // No fallback. If the AI provider fails to render, the run fails.
    // Opening positions without proper AI analysis is worse than not trading.
    throw error;
  }
  const renderElapsedSeconds = Math.round((Date.now() - renderStartedAtMs) / 1000);
  const markdownMetrics = measureText(markdown);
  const inputTokensEstimate = Math.round(contextJsonMetrics.approxTokens);
  const outputTokensEstimate = Math.round(markdownMetrics.approxTokens);

  // Inject render stats into the top of the markdown
  const renderStatsBlock = [
    "",
    `> **Render stats** | provider: ${input.provider} | elapsed: ${renderElapsedSeconds}s | input: ~${inputTokensEstimate} tok | output: ~${outputTokensEstimate} tok | timeout: ${input.config.pulse.directRenderTimeoutSeconds}s`,
    ""
  ].join("\n");
  const firstNewline = markdown.indexOf("\n");
  markdown = firstNewline >= 0
    ? markdown.slice(0, firstNewline) + renderStatsBlock + markdown.slice(firstNewline)
    : markdown + renderStatsBlock;

  input.progress?.stage({
    percent: 64,
    label: "Full pulse markdown rendered",
    detail: `${input.relativeMarkdownPath} | ${formatTextMetrics(markdownMetrics)} | ${renderElapsedSeconds}s`
  });
  const absoluteMarkdownPath = await writeStoredArtifact(
    input.config.artifactStorageRoot,
    input.relativeMarkdownPath,
    markdown
  );

  return {
    markdown,
    absoluteMarkdownPath,
    absoluteJsonPath
  };
}
