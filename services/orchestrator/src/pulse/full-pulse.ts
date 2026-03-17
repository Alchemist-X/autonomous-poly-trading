import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentRuntimeProvider, OrchestratorConfig, SkillLocale } from "../config.js";
import { writeStoredArtifact } from "../lib/artifacts.js";
import { combineTextMetrics, formatTextMetrics, measureText, readTextMetrics } from "../lib/text-metrics.js";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";
import type { PulseCandidate } from "./market-pulse.js";

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
  risk_flags: string[];
  candidates: PulseCandidate[];
  research_candidates: PulseResearchCandidate[];
}

interface FullPulsePaths {
  pulseSkillFile: string;
  outputTemplateFile: string;
  analysisFrameworkFile: string;
  apiTradeScriptsDir: string | null;
}

type JsonRecord = Record<string, unknown>;

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
        detail: input.progressDetail,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: effectiveTimeoutMs ?? undefined
      });
    }, 10000);
    const timeout = effectiveTimeoutMs == null
      ? null
      : setTimeout(() => {
          clearInterval(heartbeat);
          child.kill("SIGTERM");
          reject(new Error(`${input.command} ${input.args.join(" ")} timed out after ${effectiveTimeoutMs}ms`));
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
      reject(error);
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

  await ensureApiTradeScriptsInstalled(apiTradeScriptsDir, config.pulse.reportTimeoutSeconds * 1000, progress);

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
      timeoutMs: config.pulse.reportTimeoutSeconds * 1000,
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
        timeoutMs: config.pulse.reportTimeoutSeconds * 1000,
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
      "5. 在正式 Top 3 推荐之前，必须增加“候选池与筛选思路”章节，说明本轮候选从哪里来、筛掉了什么、为什么最终进入 Top 3。",
      "6. 必须包含：报告头部、候选池与筛选思路、前 3 个推荐市场、概率评估、证据链、四维分析、结算规则、推理逻辑、仓位建议、评论区校验、信息源、元数据。",
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
    "4. Add a candidate-pool and selection-rationale section before the Top 3 recommendations, explaining where the candidates came from, what was filtered out, and why the final Top 3 survived.",
    "5. Include: header, candidate-pool rationale, top 3 recommendations, probability evaluation, evidence chain, four-dimensional analysis, resolution rules, reasoning logic, sizing guidance, comment review, source list, metadata.",
    "6. If data is missing, explicitly mark it as unavailable instead of inventing it.",
    "7. Default to the provided research context. Only do very limited additional verification if the report would otherwise be incomplete.",
    "8. Top 3 recommendations must include direction, edge, probabilities, sizing guidance, and why each beats the remaining candidates.",
    "",
    `Active provider: ${input.provider}`,
    "Output the final Markdown."
  ].join("\n");
}

async function runCodexMarkdown(input: {
  prompt: string;
  repoRoot: string;
  outputPath: string;
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

  const result = await runCommand({
    command: "codex",
    args,
    cwd: input.repoRoot,
    timeoutMs: input.timeoutMs,
    stdin: input.prompt,
    progress: input.progress,
    progressPercent: 56,
    progressLabel: "Rendering full pulse with Codex",
    progressDetail: path.basename(input.outputPath)
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `codex exec exited with code ${result.code}`);
  }
}

async function runTemplateMarkdown(input: {
  commandTemplate: string;
  repoRoot: string;
  promptFile: string;
  outputPath: string;
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

  const result = await runCommand({
    command: "/bin/sh",
    args: ["-lc", command],
    cwd: input.repoRoot,
    timeoutMs: input.timeoutMs,
    progress: input.progress,
    progressPercent: 56,
    progressLabel: "Rendering full pulse with template provider",
    progressDetail: path.basename(input.outputPath)
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `pulse provider command exited with code ${result.code}`);
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
  const renderTimeoutMs = input.config.pulse.reportTimeoutSeconds > 0
    ? input.config.pulse.reportTimeoutSeconds * 1000
    : 0;

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
    input.progress?.info(
      `Pulse render timeout | ${renderTimeoutMs > 0 ? `${Math.round(renderTimeoutMs / 1000)}s` : "disabled"}`
    );

    if (input.provider === "codex") {
      await runCodexMarkdown({
        prompt,
        repoRoot: input.config.repoRoot,
        outputPath,
        timeoutMs: renderTimeoutMs,
        model: settings.model,
        skillRootDir: settings.skillRootDir,
        progress: input.progress
      });
    } else {
      if (!settings.command) {
        throw new Error(`No pulse report command configured for provider ${input.provider}.`);
      }
      await runTemplateMarkdown({
        commandTemplate: settings.command,
        repoRoot: input.config.repoRoot,
        promptFile: promptPath,
        outputPath,
        timeoutMs: renderTimeoutMs,
        replacements: {
          skill_root: settings.skillRootDir,
          pulse_skill_file: input.paths.pulseSkillFile,
          output_template: input.paths.outputTemplateFile,
          analysis_framework: input.paths.analysisFrameworkFile,
          context_json: input.contextJsonPath
        },
        progress: input.progress
      });
    }

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
    throw new Error(`${message}\n\nPulse render temp preserved at ${tempDir}`, { cause: error });
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
  const selectedCandidates = selectResearchCandidates(input.candidates, input.config.pulse.reportCandidates);
  input.progress?.stage({
    percent: 24,
    label: "Selected pulse research candidates",
    detail: `${selectedCandidates.length} candidates for deep research`
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
    risk_flags: input.riskFlags,
    candidates: input.candidates,
    research_candidates: researchCandidates
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
  const markdown = await renderFullPulseMarkdown({
    config: input.config,
    provider: input.provider,
    locale: input.locale,
    contextJsonPath: absoluteJsonPath,
    paths,
    progress: input.progress
  });
  const markdownMetrics = measureText(markdown);
  input.progress?.stage({
    percent: 64,
    label: "Full pulse markdown rendered",
    detail: `${input.relativeMarkdownPath} | ${formatTextMetrics(markdownMetrics)}`
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
