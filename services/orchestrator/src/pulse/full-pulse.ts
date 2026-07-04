import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isChineseLocale } from "../config.js";
import type { AgentRuntimeProvider, OrchestratorConfig, SkillLocale } from "../config.js";
import { writeStoredArtifact } from "../lib/artifacts.js";
import { OPENCLAW_DEFAULT_COMMAND_TEMPLATE } from "../lib/provider-command-templates.js";
import { formatRemainingTimeoutMs, readOutputSizeBytes, stripCodeFences } from "../lib/provider-output.js";
import { combineTextMetrics, formatTextMetrics, measureText, readTextMetrics } from "../lib/text-metrics.js";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import {
  assessPulseReportParseability,
  PULSE_NO_TRADE_MARKER
} from "../runtime/pulse-entry-planner.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";
import type { PulseBucketStat, PulseCandidate, PulseFetchConfig, PulseStatsBundle } from "./market-pulse.js";
import { preScreenCandidates, type PreScreenResult, type PreScreenSummary } from "./pulse-prescreen.js";
import { buildPulseStageFlowReport, type PulseStageFlowReport } from "./stage-flow.js";
import { collectPulseWebSearchEvidence, type PulseWebSearchSummary } from "./web-search.js";

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
  web_search: PulseWebSearchSummary;
  stage_flow: PulseStageFlowReport;
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

type FullPulsePurpose = "market-scan" | "position-review";
type JsonRecord = Record<string, unknown>;
const COMMAND_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS = 1200;

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

// Historical calibration feedback (the missing feedback loop): once
// `pnpm forecast:score` has backfilled resolved outcomes, the next render sees
// how its past probabilities actually performed. Best-effort — any read/parse
// problem or a too-small sample returns null and rendering proceeds without it.
const CALIBRATION_MIN_SCORED = 5;
export function loadCalibrationBrief(artifactStorageRoot: string, locale: SkillLocale): string[] | null {
  try {
    const raw = readFileSync(path.join(artifactStorageRoot, "evaluation", "calibration-summary.json"), "utf8");
    const summary = JSON.parse(raw) as {
      generatedAtUtc?: string;
      resolvedScored?: number;
      aiBrier?: number | null;
      marketBrier?: number | null;
      skillVsMarket?: number | null;
      buckets?: Array<{ range?: string; count?: number; meanForecast?: number; hitRate?: number }>;
    };
    const scored = summary.resolvedScored ?? 0;
    if (scored < CALIBRATION_MIN_SCORED || typeof summary.aiBrier !== "number") {
      return null;
    }
    const zh = isChineseLocale(locale);
    const worstBuckets = (summary.buckets ?? [])
      .filter((bucket) => (bucket.count ?? 0) >= 3 && typeof bucket.meanForecast === "number" && typeof bucket.hitRate === "number")
      .map((bucket) => ({ ...bucket, gap: (bucket.hitRate ?? 0) - (bucket.meanForecast ?? 0) }))
      .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap))
      .slice(0, 2);
    const lines = zh
      ? [
          `历史校准反馈（来自 ${scored} 条已结算的过往预测，${summary.generatedAtUtc ?? "时间未知"} 统计）：`,
          `- 历史 AI Brier ${summary.aiBrier.toFixed(3)}${typeof summary.marketBrier === "number" ? `，市场价 Brier ${summary.marketBrier.toFixed(3)}` : ""}${typeof summary.skillVsMarket === "number" ? `（${summary.skillVsMarket > 0 ? "跑赢" : "跑输"}市场 ${Math.abs(summary.skillVsMarket).toFixed(3)}）` : ""}。`
        ]
      : [
          `Historical calibration feedback (from ${scored} resolved past forecasts, computed ${summary.generatedAtUtc ?? "unknown"}):`,
          `- Historical AI Brier ${summary.aiBrier.toFixed(3)}${typeof summary.marketBrier === "number" ? `, market-price Brier ${summary.marketBrier.toFixed(3)}` : ""}${typeof summary.skillVsMarket === "number" ? ` (${summary.skillVsMarket > 0 ? "beating" : "trailing"} the market by ${Math.abs(summary.skillVsMarket).toFixed(3)})` : ""}.`
        ];
    for (const bucket of worstBuckets) {
      const gapPp = ((bucket.gap ?? 0) * 100).toFixed(0);
      lines.push(
        zh
          ? `- 你在 ${bucket.range} 档的历史命中率与报价差 ${gapPp}pp（${(bucket.gap ?? 0) < 0 ? "过度自信，下调该档概率" : "过度保守，可适当上调"}，样本 ${bucket.count}）。`
          : `- In the ${bucket.range} bucket your hit rate differs from your stated probability by ${gapPp}pp (${(bucket.gap ?? 0) < 0 ? "overconfident — pull these numbers down" : "underconfident — these can move up"}; n=${bucket.count}).`
      );
    }
    lines.push(
      zh
        ? "把这份反馈当作先验修正，不是公式：本轮每个概率都应自问是否重复了上面的系统性偏差。"
        : "Treat this as a prior correction, not a formula: for every probability this round, ask whether it repeats the systematic bias above."
    );
    return lines;
  } catch {
    return null;
  }
}

function buildFullPulsePrompt(input: {
  locale: SkillLocale;
  provider: AgentRuntimeProvider;
  paths: FullPulsePaths;
  contextJsonPath: string;
  purpose?: FullPulsePurpose;
  calibrationBrief?: string[] | null;
}): string {
  const calibrationSection = input.calibrationBrief?.length ? [...input.calibrationBrief, ""] : [];
  if (input.purpose === "position-review") {
    if (isChineseLocale(input.locale)) {
      return [
        "你是一名顶级预测市场分析师，正在为真实资金持仓做概率复审。",
        "研究上下文 JSON 中的 candidates / research_candidates 全部来自当前已有持仓；这不是新市场扫描。",
        "你复审出的概率是唯一进入交易管道的数字：下游代码只从报告中提取概率表和动作建议，并在代码层重算敞口与风控。把主要精力花在“把每个持仓的概率重新做准”上。",
        "",
        "参考文件（方法论是推理脚手架，不是硬性配方；其中的量化参数是默认值，若你有更好判断可偏离并写明理由）：",
        `- Pulse Skill: ${input.paths.pulseSkillFile}`,
        `- 输出模板: ${input.paths.outputTemplateFile}`,
        `- 分析框架: ${input.paths.analysisFrameworkFile}`,
        `- 持仓研究上下文 JSON: ${input.contextJsonPath}`,
        "",
        "研究自由度：",
        "- 已提供的上下文是起点，不是边界。当证据不足以支撑可靠复审时，主动补充检索与查证（结算规则页、官方数据源、最新新闻），并在信息源中记录 URL 和日期。",
        "- 你有 WebSearch / WebFetch 工具权限：每个持仓至少做一次针对最新事实的检索再定复审概率；若工具实际不可用，如实写明。",
        "- 必须阅读并使用 JSON 的 `web_search` 与 `stage_flow` 字段；若 web_search status=timed_out/failed/disabled，如实说明，不得写成本次未尝试。",
        "",
        "概率纪律：先写显式基准率与参考类别，再用带日期的证据调整；偏离市场价必须说明市场错在哪；对“X 在某日期前发生”类持仓写出剩余天数——必要前置条件迟迟未现本身就是压向 No 的证据；证据分不清 62% 和 65% 就放宽区间而不是凑整。",
        "",
        ...calibrationSection,
        "诚实性（不可违反）：",
        "- 上下文中没有且你未查证到的数据，明确写“未获取”，不得编造；关键事实主张附来源和日期。",
        "- 不要把 AI 概率机械设成市场概率：如果持仓一侧已无 edge，明确给出反向一侧的概率与 edge。",
        "",
        "程序接口（硬性要求——下游用正则提取，格式错误 = 该持仓复审被静默忽略）：",
        "1. 只输出最终 Markdown，不要代码块包裹，不要输出解释性前后缀；全文使用中文。",
        "2. 逐仓复审：每个已有持仓一个独立 `##` 章节，标题保留市场原问题或 market slug。",
        "3. 每个持仓章节必须包含以下可解析字段：",
        "   - 链接：Polymarket 事件 URL",
        "   - 方向：`买入 Yes` 或 `买入 No`（模型现在更支持的一侧）",
        "   - 概率评估表，必须同时含 `| Yes | 市场定价 | AI 估算 |` 与 `| No | ... |` 两行、百分比格式",
        "   - 持仓动作建议：hold / reduce / close",
        "   - `### 推理逻辑` 小节（作为该持仓动作的 thesis 存档）",
        "4. 用 `research_candidates[].market.position` 里的 heldOutcomeLabel / shares / avgCost / currentPrice / currentValueUsd / unrealizedPnlPct 说明当前持仓方向、规模和 PnL；字段存在就必须使用。",
        "5. 不要出现“Top 3 新开仓”“推荐新开仓”章节；本报告只服务已有持仓复审。",
        "",
        "写法（给人读的部分）：",
        "- 每个持仓章节第一句给出结论：动作建议 + AI 概率（区间跨越决策边界或宽于 ±5pp 时，同句给出区间）。",
        "- 每句带一个具体信息（数字/日期/来源）；用数字替代形容词；给出会推翻当前判断的观察点。",
        "- 简洁不等于自信：概率必须如实反映证据强度，禁止为了行文有力而收窄区间。",
        "",
        `当前 provider：${input.provider}`,
        "输出最终 Markdown。"
      ].join("\n");
    }

    return [
      "You are a top-tier prediction-market analyst refreshing probabilities for real-money holdings.",
      "Every candidate / research_candidate in the JSON context is an existing position; this is not a new-market scan.",
      "Your refreshed probabilities are the only numbers that enter the trading pipeline: downstream code extracts the probability table and action guidance from this report and recomputes exposure and risk in code. Spend your effort making each position's probability right.",
      "",
      "Reference files (the methodology is a reasoning scaffold, not a fixed recipe; its quantitative parameters are defaults you may deviate from with stated reasons):",
      `- Pulse Skill: ${input.paths.pulseSkillFile}`,
      `- Output Template: ${input.paths.outputTemplateFile}`,
      `- Analysis Framework: ${input.paths.analysisFrameworkFile}`,
      `- Position research context JSON: ${input.contextJsonPath}`,
      "",
      "Research freedom:",
      "- The provided context is a starting point, not a boundary. When evidence is insufficient for a reliable review, actively verify further (resolution-rule pages, official sources, latest news) and record URLs and dates in the source list.",
      "- You have WebSearch / WebFetch tool access: run at least one latest-facts search per position before settling its refreshed probability; if the tools turn out to be unavailable, say so honestly.",
      "- Read and use the `web_search` and `stage_flow` fields in the JSON. If web_search status=timed_out/failed/disabled, say so honestly; never claim no search was attempted.",
      "",
      "Probability discipline: state an explicit base rate and reference class before adjusting with dated evidence; any deviation from the market price must say where the market is wrong; for \"X by DATE\" holdings state the days remaining — a required precursor still absent is itself evidence toward No; when evidence cannot distinguish 62% from 65%, widen the interval instead of rounding.",
      "",
      ...calibrationSection,
      "Honesty (non-negotiable):",
      "- Mark data you neither have nor verified as unavailable; never invent it. Attach source + date to key factual claims.",
      "- Do not mechanically set AI probability equal to market probability: if the held side has no edge left, explicitly give the opposite side's probability and edge.",
      "",
      "Machine interface (hard requirements — downstream regex extraction; a format miss means that position's review is silently ignored):",
      "1. Output final Markdown only, no code fences, no explanatory preamble.",
      "2. Review every position: one `##` section per holding, title preserving the market question or market slug.",
      "3. Each position section must include these parseable fields:",
      "   - Link: the Polymarket event URL",
      "   - Direction: `Buy Yes` or `Buy No` (the side the model now favors)",
      "   - Probability table with BOTH `| Yes | Market | AI |` and `| No | ... |` rows in percentage format",
      "   - Position action guidance: hold / reduce / close",
      "   - A `### Reasoning` subsection (archived as the thesis for that position action)",
      "4. Use `research_candidates[].market.position` (heldOutcomeLabel / shares / avgCost / currentPrice / currentValueUsd / unrealizedPnlPct) to describe the held side, size, and PnL whenever those fields exist.",
      "5. No Top 3 / new-entry sections; this report only refreshes existing holdings.",
      "",
      "Prose (the human-facing part):",
      "- Open each position section with the conclusion: action + AI probability (include the interval in the same sentence when it straddles a decision boundary or is wider than ±5pp).",
      "- Every sentence carries a specific (number/date/source); replace adjectives with the numbers behind them; name what would flip your call.",
      "- Concision must not become overconfidence: probabilities must reflect actual evidence strength — never narrow an interval for punchier prose.",
      "",
      `Active provider: ${input.provider}`,
      "Output the final Markdown."
    ].join("\n");
  }

  if (isChineseLocale(input.locale)) {
    return [
      "你是一名顶级预测市场分析师，正在为一次真实资金的交易决策生成完整的 Polymarket 市场脉冲报告。",
      "你的概率判断是唯一进入交易管道的数字：下游代码只从报告中提取概率、方向等结构化字段，并在代码层重算 Kelly 仓位与风控裁剪。把绝大部分精力花在“把概率做准”上——文字是给人看的审计材料，数字才是交易依据。",
      "",
      "参考文件（方法论是推理脚手架，不是硬性配方；其中的量化参数——证据更新幅度、edge 分档、排序公式——是默认值，若你有更好判断可偏离并写明理由）：",
      `- Pulse Skill: ${input.paths.pulseSkillFile}`,
      `- 输出模板: ${input.paths.outputTemplateFile}（章节参考；只有下方“程序接口”列出的字段是硬性要求）`,
      `- 分析框架: ${input.paths.analysisFrameworkFile}`,
      `- 研究上下文 JSON: ${input.contextJsonPath}`,
      "",
      "研究自由度：",
      "- 已提供的研究上下文是起点，不是边界。当证据不足以支撑可靠概率时，主动补充检索与查证（结算规则页、官方数据源、最新新闻），并在信息源中记录 URL 和日期。",
      "- 你有 WebSearch / WebFetch 工具权限：对每个候选推荐市场至少各做一次针对性检索（结算规则确认 + 最新事实）；体育盘优先查博彩公司赔率（隐含概率是最强基准），数据/宏观盘优先查官方数据源。若工具实际不可用，如实写明。",
      "- 必须阅读并使用 JSON 的 `web_search` 与 `stage_flow` 字段；若 web_search status=timed_out/failed/disabled，如实说明，不得写成本次未尝试。",
      "",
      "概率纪律（怎么把数字做准）：",
      "- 先写显式基准率：说明你用的参考类别（reference class）和它的历史频率，再用带日期、带来源的证据逐步调整；每次调整标注方向与幅度。",
      "- 市场价是知情资金的强先验：偏离市场价必须回答“市场错在哪、为什么是我对”（信息更新慢、结构性偏差、流动性事件），答不出来就贴近市场价并降低 edge。",
      "- 长尾偏差：便宜的尾部（≤15¢）系统性偏贵、深度热门偏便宜；但这是需要事件级证据确认的先验，不是折价公式——每个 No 推荐都要有该事件自身的证据支撑。",
      "- 方向自检：历史推荐 94.5% 都是买 No（139:8）。如果本轮推荐再次清一色买 No，先重新检查是否只是机械套用长尾折价；Yes 侧的错价同样存在。",
      "- 时间衰减：对“X 在某日期前发生”类市场，写出剩余天数；若必要前置条件在剩余窗口内仍无迹象，本身就是压向 No 的证据。",
      "- 校准：证据分不清 62% 和 65% 时不要凑整到 65%——放宽区间、降低置信度，而不是假装精确。",
      "",
      ...calibrationSection,
      "诚实性（不可违反）：",
      "- 不要推荐任何不在研究上下文 JSON 里的市场（下游只能交易这些市场的 token）。",
      "- 缺失且未查证到的数据明确写“未获取”，不得编造；关键事实主张附来源 URL 和日期，无法溯源的主张不得作为主要证据。",
      "- 即使证据有缺口也要完成报告，在置信度和结论中如实反映缺口。",
      "",
      "程序接口（硬性要求——下游用正则提取，格式错误 = 该推荐被静默丢弃）：",
      "1. 只输出最终 Markdown，不要代码块包裹，不要输出解释性前后缀；全文使用中文。",
      "2. 每个推荐市场一个独立 `##` 章节，标题保留市场原问题（可用英文原文，程序靠标题匹配候选）。",
      "3. 每个推荐章节必须包含以下可解析字段（表格行或 `**标签：** 值` 均可）：",
      "   - 链接：https://polymarket.com/event/{event_slug}",
      "   - 方向：`买入 Yes` 或 `买入 No`",
      "   - 概率评估表，必须同时含 `| Yes | 市场定价 | AI 估算 |` 与 `| No | ... |` 两行、百分比格式（半角数字 + %）",
      "   - 置信度：高 / 中 / 低",
      "   - 建议仓位：资金百分比",
      "   - 流动性上限：$ 金额",
      "   - `### 推理逻辑` 小节（作为交易 thesis 存档）",
      "   - `### 概率评估`、`### 证据链`、`### 信息源` 小节标题（归档决策报告按这些标题摘录）；有数据缺口时用 `**数据缺口：**` 一行标注",
      "4. 推荐数量：最多 3 个。达不到你的 edge 标准就少推荐——不要为凑数纳入弱推荐。若本轮没有任何值得交易的市场，在报告开头单独一行写 `NO-TRADE` 并说明原因。",
      "",
      "报告写法（给人读的部分）：",
      "- 报告开头给出候选池概览与筛选思路（简短即可），让人能审计“为什么是这几个”。",
      "- 结论先行：每个市场章节第一句给出方向 + AI 概率（区间跨越决策边界或宽于 ±5pp 时，同句给出区间）。",
      "- 每句带一个具体信息（数字/日期/人名/来源）；用数字替代形容词；数字配基准。",
      "- 不确定性用带界限的数字表达（区间、至少/最多），不用软词堆叠；给出会推翻判断的观察点（kill condition）。",
      "- 简洁不等于自信：概率必须如实反映证据强度，禁止为了行文有力而收窄区间或抬高置信度。",
      "",
      `当前 provider：${input.provider}`,
      "输出最终 Markdown。"
    ].join("\n");
  }

  return [
    "You are a top-tier prediction-market analyst generating a full Polymarket market pulse report for a real-money trading decision.",
    "Your probability estimates are the only numbers that enter the trading pipeline: downstream code extracts probability, direction, and other structured fields from this report and recomputes Kelly sizing and risk trims in code. Spend most of your effort getting the probabilities right — the prose is the human audit trail; the numbers are what trades.",
    "",
    "Reference files (the methodology is a reasoning scaffold, not a fixed recipe; its quantitative parameters — evidence-update magnitudes, edge tiers, ranking formulas — are defaults you may deviate from with stated reasons):",
    `- Pulse Skill: ${input.paths.pulseSkillFile}`,
    `- Output Template: ${input.paths.outputTemplateFile} (section reference; only the fields under "Machine interface" below are hard requirements)`,
    `- Analysis Framework: ${input.paths.analysisFrameworkFile}`,
    `- Research Context JSON: ${input.contextJsonPath}`,
    "",
    "Research freedom:",
    "- The provided research context is a starting point, not a boundary. When evidence is insufficient for a reliable probability, actively verify further (resolution-rule pages, official sources, latest news) and record URLs and dates in the source list.",
    "- You have WebSearch / WebFetch tool access: run at least one targeted search per recommended market (resolution-rule confirmation + latest facts); for sports check bookmaker odds first (implied probabilities are the strongest baseline), for data/macro check the official data source. If the tools turn out to be unavailable, say so honestly.",
    "- Read and use the `web_search` and `stage_flow` fields in the JSON. If web_search status=timed_out/failed/disabled, say so honestly; never claim no search was attempted.",
    "",
    "Probability discipline (how to get the number right):",
    "- Start from an explicit base rate: name the reference class you are using and its historical frequency, then adjust with dated, sourced evidence — each adjustment stating direction and size.",
    "- The market price is a strong prior from informed money: any deviation must answer WHERE the market is wrong and WHY you know better (slow information updates, structural bias, liquidity events). If you cannot answer, stay near the market price and lower the edge.",
    "- Longshot bias: cheap tails (≤15¢) are systematically overpriced and deep favorites underpriced — but this is a prior that needs event-specific confirmation, not a discount formula; every No recommendation needs evidence about THIS event.",
    "- Direction self-check: 94.5% of historical recommendations were Buy No (139:8). If this round again comes out all-No, first re-examine whether you are mechanically applying the longshot haircut; Yes-side mispricings exist too.",
    "- Time decay: for \"X by DATE\" markets, state the days remaining; a required precursor still absent within the window is itself evidence toward No.",
    "- Calibration: when your evidence cannot distinguish 62% from 65%, do not round to 65% — widen the interval and lower confidence instead of faking precision.",
    "",
    ...calibrationSection,
    "Honesty (non-negotiable):",
    "- Do not recommend any market that is not present in the research context JSON (downstream can only trade those markets' tokens).",
    "- Mark data you neither have nor verified as unavailable; never invent it. Attach source URL + date to key factual claims; unverifiable claims must not carry the case.",
    "- Complete the report even when evidence has gaps, and reflect those gaps honestly in confidence and conclusions.",
    "",
    "Machine interface (hard requirements — downstream regex extraction; a format miss means that recommendation is silently dropped):",
    "1. Output final Markdown only, no code fences, no explanatory preamble.",
    "2. One `##` section per recommended market, title preserving the original market question (the program matches sections to candidates by title).",
    "3. Each recommendation section must include these parseable fields (table rows or `**Label:** value` both work):",
    "   - Link: https://polymarket.com/event/{event_slug}",
    "   - Direction: `Buy Yes` or `Buy No`",
    "   - Probability table with BOTH `| Yes | Market | AI |` and `| No | ... |` rows in percentage format (ASCII digits + %)",
    "   - Confidence: high / medium / low",
    "   - Suggested size: percent of bankroll",
    "   - Liquidity cap: $ amount",
    "   - A `### Reasoning` subsection (archived as the trade thesis)",
    "   - `### 概率评估`, `### 证据链`, `### 信息源` subsection headings (the archived decision report excerpts by these headings); mark any data gap on a `**数据缺口：**` line",
    "4. Count: at most 3 recommendations. If fewer clear your edge bar, recommend fewer — never pad with weak picks. If nothing is worth trading this round, write `NO-TRADE` on its own line at the top and explain why.",
    "",
    "Prose (the human-facing part):",
    "- Open the report with a brief candidate-pool overview and selection rationale so a human can audit why these picks.",
    "- Conclusion first: each market section opens with direction + AI probability (include the interval in the same sentence when it straddles a decision boundary or is wider than ±5pp).",
    "- Every sentence carries a specific (number/date/name/source); replace adjectives with the numbers behind them; pair numbers with baselines.",
    "- Express uncertainty as bounded numbers (intervals, at least/at most), not stacked hedge words; name the kill condition that would flip your call.",
    "- Concision must not become overconfidence: probabilities must reflect actual evidence strength — never narrow an interval or inflate confidence for punchier prose.",
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
      // WebSearch/WebFetch must be explicitly allowed in --print mode; without
      // them the prompt's "actively verify further" research instructions are a
      // dead letter and the model can only see the pre-collected DDG snippets.
      return 'cat {{prompt_file}} | claude --print --allowedTools "WebSearch WebFetch" > {{output_file}}';
    case "openclaw":
      return OPENCLAW_DEFAULT_COMMAND_TEMPLATE;
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
  purpose?: FullPulsePurpose;
  progress?: ProgressReporter;
}): Promise<string> {
  const settings = resolveProviderSkillSettings(input.config, input.provider);
  const prompt = buildFullPulsePrompt({
    locale: input.locale,
    provider: input.provider,
    paths: input.paths,
    contextJsonPath: input.contextJsonPath,
    purpose: input.purpose,
    calibrationBrief: loadCalibrationBrief(input.config.artifactStorageRoot, input.locale)
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

    // Deterministic parseability gate: the trading path only reads what the
    // entry-planner regexes extract, and a report without a single
    // machine-readable direction + probability row would otherwise trade
    // nothing SILENTLY (aiProb falls back to marketProb → edge 0 → all plans
    // dropped). Fail closed at render time instead.
    const parseability = assessPulseReportParseability(content);
    if ((input.purpose ?? "market-scan") !== "position-review") {
      if (parseability.entryReadySectionCount === 0 && !parseability.hasNoTradeMarker) {
        throw new Error(
          `Full pulse report failed the parseability gate: ${parseability.sectionCount} sections, ` +
          `${parseability.probabilityRowSectionCount} with probability rows, 0 entry-ready ` +
          `(direction + matching | Yes/No | market% | ai% | row), and no explicit ${PULSE_NO_TRADE_MARKER} marker. ` +
          `Downstream trading would silently extract nothing. Inspect the preserved render output.`
        );
      }
    } else if (parseability.probabilityRowSectionCount === 0) {
      input.progress?.info(
        "Pulse render parseability warning | position-review report has no machine-readable probability rows; " +
        "position reviews will fall back to code-level stale-hold logic."
      );
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
  purpose?: FullPulsePurpose;
  researchCandidateCount?: number;
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

  const selectedCandidates = selectResearchCandidates(
    [...researchPool],
    input.researchCandidateCount ?? input.config.pulse.reportCandidates
  );
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
  const webSearch = await collectPulseWebSearchEvidence({
    candidates: selectedCandidates.map((candidate) => candidate.market),
    config: input.config,
    progress: input.progress
  });
  const stageFlow = buildPulseStageFlowReport({
    config: input.config,
    generatedAtUtc: input.generatedAtUtc,
    purpose: input.purpose,
    selectedCandidates: selectedCandidates.length
  });

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
    web_search: webSearch,
    stage_flow: stageFlow,
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
      purpose: input.purpose,
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

  // Second, candidate-aware parseability layer. The render-time gate is
  // format-only; this one also mirrors the planner's section-to-candidate
  // binding (title/URL match) against the same candidate list stored in the
  // archive JSON, so a perfectly formatted report whose sections match no
  // candidate still fails closed instead of silently trading nothing. Runs
  // after the archive write so the offending report stays inspectable.
  if ((input.purpose ?? "market-scan") !== "position-review") {
    const bound = assessPulseReportParseability(markdown, input.candidates);
    if (bound.entryReadySectionCount === 0 && !bound.hasNoTradeMarker) {
      throw new Error(
        `Full pulse report failed the candidate-binding gate: ${bound.probabilityRowSectionCount} sections have ` +
        `probability rows but none binds to a pulse candidate with a positive-edge direction, and no ${PULSE_NO_TRADE_MARKER} ` +
        `marker is present. Downstream trading would silently extract nothing. Archived report: ${absoluteMarkdownPath}`
      );
    }
  }

  return {
    markdown,
    absoluteMarkdownPath,
    absoluteJsonPath
  };
}
