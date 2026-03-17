import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tradeDecisionSetSchema, type Artifact, type TradeDecisionSet } from "@autopoly/contracts";
import type { AgentRuntimeProvider, OrchestratorConfig, SkillLocale } from "../config.js";
import { buildArtifactRelativePath, writeStoredArtifact } from "../lib/artifacts.js";
import { combineTextMetrics, formatTextMetrics, measureText, readTextMetrics } from "../lib/text-metrics.js";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { AgentRuntime, RuntimeExecutionContext, RuntimeExecutionResult } from "./agent-runtime.js";
import { resolveProviderSkillSettings, type ResolvedProviderSkillSettings } from "./skill-settings.js";

function isChineseLocale(locale: ResolvedProviderSkillSettings["locale"]): boolean {
  return locale === "zh";
}

function formatPulseTradeable(value: boolean, locale: ResolvedProviderSkillSettings["locale"]): string {
  if (isChineseLocale(locale)) {
    return value ? "是" : "否";
  }
  return value ? "yes" : "no";
}

function formatPulseRiskFlags(flags: string[], locale: ResolvedProviderSkillSettings["locale"], separator = " | "): string {
  if (flags.length === 0) {
    return isChineseLocale(locale) ? "无" : "none";
  }
  return flags.join(separator);
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 24)}\n\n... truncated ...\n`;
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

function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "about:blank";
  }
  try {
    return new URL(trimmed).href;
  } catch {
    const absolutePath = path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(process.cwd(), trimmed);
    return pathToFileURL(absolutePath).href;
  }
}

function normalizeDecisionSetLike(value: unknown): unknown {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== "object") {
    return value;
  }

  const normalizeCore = (candidate: Record<string, unknown>) => {
    const decisions = Array.isArray(candidate.decisions) ? candidate.decisions : null;
    if (!decisions) {
      return candidate;
    }
    return {
      ...candidate,
      decisions: decisions.map((decision) => {
        const decisionRecord = decision as Record<string, unknown> | null;
        if (!decisionRecord || typeof decisionRecord !== "object") {
          return decision;
        }
        const sources = Array.isArray(decisionRecord.sources) ? decisionRecord.sources : null;
        if (!sources) {
          return decisionRecord;
        }
        return {
          ...decisionRecord,
          sources: sources.map((source) => {
            const sourceRecord = source as Record<string, unknown> | null;
            if (!sourceRecord || typeof sourceRecord !== "object" || typeof sourceRecord.url !== "string") {
              return source;
            }
            return {
              ...sourceRecord,
              url: normalizeSourceUrl(sourceRecord.url)
            };
          })
        };
      })
    };
  };

  const normalized = normalizeCore(record);
  for (const key of ["decisionSet", "tradeDecisionSet", "result", "output", "payload", "final"]) {
    const nested = normalized[key] as Record<string, unknown> | undefined;
    if (nested && typeof nested === "object") {
      normalized[key] = normalizeCore(nested);
    }
  }
  return normalized;
}

function parseDecisionSetValue(value: unknown): TradeDecisionSet {
  const normalizedValue = normalizeDecisionSetLike(value);
  const direct = tradeDecisionSetSchema.safeParse(normalizedValue);
  if (direct.success) {
    return direct.data;
  }

  const record = normalizedValue as Record<string, unknown> | null;
  if (!record || typeof record !== "object") {
    throw new Error("Provider output did not contain a TradeDecisionSet object.");
  }

  for (const key of ["decisionSet", "tradeDecisionSet", "result", "output", "payload", "final"]) {
    if (!(key in record)) {
      continue;
    }
    const nested = tradeDecisionSetSchema.safeParse(record[key]);
    if (nested.success) {
      return nested.data;
    }
  }

  throw new Error(
    `Provider output JSON did not match TradeDecisionSet or a supported wrapper key.\n` +
    `${JSON.stringify(direct.error.issues, null, 2)}`
  );
}

function extractJsonPayload(text: string): TradeDecisionSet {
  const candidates = [
    text.trim(),
    stripCodeFences(text),
  ];

  for (const candidate of candidates) {
    try {
      return parseDecisionSetValue(JSON.parse(candidate));
    } catch {
      continue;
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return parseDecisionSetValue(JSON.parse(text.slice(firstBrace, lastBrace + 1)));
  }

  throw new Error("Provider output did not contain a valid TradeDecisionSet JSON payload.");
}

function buildTradeDecisionSetSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "run_id",
      "runtime",
      "generated_at_utc",
      "bankroll_usd",
      "mode",
      "decisions",
      "artifacts"
    ],
    properties: {
      run_id: { type: "string", minLength: 1 },
      runtime: { type: "string", minLength: 1 },
      generated_at_utc: { type: "string" },
      bankroll_usd: { type: "number", minimum: 0 },
      mode: {
        type: "string",
        enum: ["review", "scan", "full"]
      },
      decisions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "action",
            "event_slug",
            "market_slug",
            "token_id",
            "side",
            "notional_usd",
            "order_type",
            "ai_prob",
            "market_prob",
            "edge",
            "confidence",
            "thesis_md",
            "sources",
            "stop_loss_pct",
            "resolution_track_required"
          ],
          properties: {
            action: { type: "string", enum: ["open", "close", "reduce", "hold", "skip"] },
            event_slug: { type: "string", minLength: 1 },
            market_slug: { type: "string", minLength: 1 },
            token_id: { type: "string", minLength: 1 },
            side: { type: "string", enum: ["BUY", "SELL"] },
            notional_usd: { type: "number", exclusiveMinimum: 0 },
            order_type: { type: "string", const: "FOK" },
            ai_prob: { type: "number", minimum: 0, maximum: 1 },
            market_prob: { type: "number", minimum: 0, maximum: 1 },
            edge: { type: "number" },
            confidence: { type: "string", enum: ["low", "medium", "medium-high", "high"] },
            thesis_md: { type: "string", minLength: 1 },
            sources: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "url", "retrieved_at_utc"],
                properties: {
                  title: { type: "string", minLength: 1 },
                  url: { type: "string", minLength: 1 },
                  retrieved_at_utc: { type: "string" }
                }
              }
            },
            stop_loss_pct: { type: "number", minimum: 0, maximum: 1 },
            resolution_track_required: { type: "boolean" }
          }
        }
      },
      artifacts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "path", "published_at_utc"],
          properties: {
            kind: {
              type: "string",
              enum: ["pulse-report", "review-report", "resolution-report", "backtest-report", "runtime-log"]
            },
            title: { type: "string", minLength: 1 },
            path: { type: "string", minLength: 1 },
            published_at_utc: { type: "string" }
          }
        }
      }
    }
  };
}

function buildPrompt(context: RuntimeExecutionContext, settings: ResolvedProviderSkillSettings, riskDocPath: string): string {
  const skillLines = settings.skills.map((skill) => `- ${skill.id}: ${skill.skillFile}`);
  const riskFlags = context.pulse.riskFlags.length === 0
    ? (settings.locale === "zh" ? ["- 无"] : ["- none"])
    : context.pulse.riskFlags.map((flag) => `- ${flag}`);
  const localeIsChinese = settings.locale === "zh";

  if (localeIsChinese) {
    return [
      "你是 Polymarket 自主交易系统的决策运行时。",
      `当前 provider：${settings.provider}`,
      "必须先阅读这些 skill 文件，再做决策：",
      ...skillLines,
      "",
      "必须先阅读这份风险控制文档：",
      `- ${riskDocPath}`,
      "",
      "只允许阅读上面列出的 skill 文件、这份风险文档、pulse 输入文件和下面给出的结构化上下文。",
      "不要扫描无关仓库文件，不要运行测试，不要做代码修改。",
      "",
      "输入文件：",
      `- Pulse JSON: ${context.pulse.absoluteJsonPath}`,
      `- Pulse Markdown: ${context.pulse.absoluteMarkdownPath}`,
      "",
      "组合概览：",
      JSON.stringify(context.overview),
      "",
      "当前持仓：",
      JSON.stringify(context.positions),
      "",
      "Pulse 风险标记：",
      ...riskFlags,
      "",
      "硬规则：",
      "1. 只能输出合法 JSON，不要输出 markdown 代码块。",
      "2. artifacts 必须返回空数组，系统会自动注入 pulse artifact 和 runtime log artifact。",
      "3. 若 pulse 有风险标记，则禁止任何 open 动作；只能给 hold/skip/close/reduce。",
      "4. open 动作的 token_id 必须来自 pulse candidates 的 clobTokenIds。",
	      "5. hold/close/reduce 动作的 token_id 必须来自当前持仓。",
	      "6. 绝不生成超出 bankroll_usd 的 notional_usd。",
	      "7. decisions 不能为空。",
	      "8. 如果你决定今天不开任何新仓，必须输出带 thesis_md 的 skip 决策，明确说明为什么放弃这些候选。",
	      "9. 如果当前有持仓，必须对每个持仓输出 hold/close/reduce 之一，并写明原因。",
	      "10. 如果没有任何可执行交易，至少输出 1 条 skip 决策；优先覆盖你认为最值得讨论的 pulse 候选。",
	      "",
      "输出字段必须匹配 TradeDecisionSet：",
      `- run_id 必须使用 ${context.runId}`,
      `- runtime 必须写 ${settings.provider}-skill-runtime`,
      `- generated_at_utc 使用当前 ISO 时间`,
      `- mode 必须写 ${context.mode}`,
      `- bankroll_usd 必须写 ${context.overview.total_equity_usd}`,
      "只输出最终 JSON。"
    ].join("\n");
  }

  return [
    "You are the trading decision runtime for a Polymarket autonomous trading system.",
    `Active provider: ${settings.provider}`,
    "Read these selected skill files before deciding:",
    ...skillLines,
    "",
    "Read this risk control document before deciding:",
    `- ${riskDocPath}`,
    "",
    "Only inspect the listed skill files, this risk document, the pulse input files, and the structured context below.",
    "Do not scan unrelated repository files, do not run tests, and do not modify code.",
    "",
    "Input files:",
    `- Pulse JSON: ${context.pulse.absoluteJsonPath}`,
    `- Pulse Markdown: ${context.pulse.absoluteMarkdownPath}`,
    "",
    "Portfolio overview:",
    JSON.stringify(context.overview),
    "",
    "Current positions:",
    JSON.stringify(context.positions),
    "",
    "Pulse risk flags:",
    ...riskFlags,
    "",
    "Hard rules:",
    "1. Output valid JSON only. Do not wrap it in markdown fences.",
    "2. Return artifacts as an empty array. The service will inject pulse and runtime-log artifacts.",
    "3. If pulse has risk flags, no open actions are allowed.",
	    "4. Any open decision token_id must come from pulse candidate clobTokenIds.",
	    "5. Any hold/close/reduce token_id must come from current open positions.",
	    "6. Never emit notional_usd above bankroll_usd.",
	    "7. decisions must not be empty.",
	    "8. If you do not open any new trades, you must emit skip decisions with thesis_md explaining why each candidate was rejected.",
	    "9. If there are current positions, you must emit one of hold/close/reduce for each position and explain why.",
	    "10. If nothing is executable, still emit at least one skip decision covering the most relevant pulse candidate.",
	    "",
    "The output must match TradeDecisionSet exactly:",
    `- run_id must be ${context.runId}`,
    `- runtime must be ${settings.provider}-skill-runtime`,
    `- mode must be ${context.mode}`,
    `- bankroll_usd must be ${context.overview.total_equity_usd}`,
    "Output final JSON only."
  ].join("\n");
}

async function runCodex(
  prompt: string,
  settings: ResolvedProviderSkillSettings,
  repoRoot: string,
  outputPath: string,
  schemaPath: string,
  timeoutMs: number,
  progress?: RuntimeExecutionContext["progress"]
) {
  const effectiveTimeoutMs = timeoutMs > 0 ? timeoutMs : null;
  const args = [
    "exec",
    "--skip-git-repo-check",
    "-C",
    repoRoot,
    "-s",
    "read-only",
    "--output-schema",
    schemaPath,
    "-o",
    outputPath,
    "--color",
    "never"
  ];

  if (settings.model) {
    args.push("-m", settings.model);
  }

  const skillRootOutsideRepo = settings.skillRootDir !== repoRoot
    && !settings.skillRootDir.startsWith(`${repoRoot}${path.sep}`);

  if (skillRootOutsideRepo) {
    args.push("--add-dir", settings.skillRootDir);
  }

  args.push("-");

  await new Promise<void>((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    const startedAt = Date.now();
    const heartbeat = setInterval(() => {
      progress?.heartbeat({
        percent: 80,
        label: "Decision runtime is running",
        detail: `${settings.provider} provider`,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: effectiveTimeoutMs ?? undefined
      });
    }, 10000);
    const timeout = effectiveTimeoutMs == null
      ? null
      : setTimeout(() => {
          clearInterval(heartbeat);
          child.kill("SIGTERM");
          reject(new Error(`codex exec timed out after ${effectiveTimeoutMs}ms`));
        }, effectiveTimeoutMs);
    child.stderr.on("data", (chunk) => {
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
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `codex exec exited with code ${code}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function applyTemplate(command: string, replacements: Record<string, string>): string {
  let result = command;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function runTemplateCommand(template: string, replacements: Record<string, string>, timeoutMs: number) {
  return runTemplateCommandWithProgress(template, replacements, timeoutMs);
}

async function runTemplateCommandWithProgress(
  template: string,
  replacements: Record<string, string>,
  timeoutMs: number,
  progress?: RuntimeExecutionContext["progress"]
) {
  const effectiveTimeoutMs = timeoutMs > 0 ? timeoutMs : null;
  const command = applyTemplate(template, replacements);
  await new Promise<void>((resolve, reject) => {
    const child = spawn("/bin/sh", ["-lc", command], {
      cwd: replacements.repo_root,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    const startedAt = Date.now();
    const heartbeat = setInterval(() => {
      progress?.heartbeat({
        percent: 80,
        label: "Decision runtime is running",
        detail: "template provider",
        elapsedMs: Date.now() - startedAt,
        timeoutMs: effectiveTimeoutMs ?? undefined
      });
    }, 10000);
    const timeout = effectiveTimeoutMs == null
      ? null
      : setTimeout(() => {
          clearInterval(heartbeat);
          child.kill("SIGTERM");
          reject(new Error(`provider command timed out after ${effectiveTimeoutMs}ms`));
        }, effectiveTimeoutMs);
    child.stderr.on("data", (chunk) => {
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
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `provider command exited with code ${code}`));
    });
  });
}

function filterDecisions(decisionSet: TradeDecisionSet, pulse: PulseSnapshot, positions: RuntimeExecutionContext["positions"]) {
  const pulseTokens = new Set(pulse.candidates.flatMap((candidate) => candidate.clobTokenIds));
  const positionTokens = new Set(positions.map((position) => position.token_id));

  return decisionSet.decisions.filter((decision) => {
    if (decision.action === "open") {
      return pulse.tradeable && pulseTokens.has(decision.token_id);
    }
    if (decision.action === "hold" || decision.action === "close" || decision.action === "reduce") {
      return positionTokens.has(decision.token_id);
    }
    return decision.action === "skip";
  });
}

function ensureExplanatoryDecisions(
  decisions: TradeDecisionSet["decisions"],
  context: RuntimeExecutionContext,
  locale: SkillLocale
) {
  if (decisions.length > 0) {
    return;
  }

  const zh = locale === "zh";
  const hasPulseCandidates = context.pulse.candidates.length > 0;
  const hasPositions = context.positions.length > 0;

  if (!hasPulseCandidates && !hasPositions) {
    return;
  }

  throw new Error(
    zh
      ? "决策输出不能为空。若不下单，必须至少输出一条带原因的 skip/hold 决策。"
      : "Decision output must not be empty. Emit at least one explanatory skip/hold decision when no trade is taken."
  );
}

async function buildRuntimeLogArtifact(
  config: OrchestratorConfig,
  context: RuntimeExecutionContext,
  provider: AgentRuntimeProvider,
  rawOutput: string,
  settings: ResolvedProviderSkillSettings
): Promise<Artifact> {
  const publishedAtUtc = new Date().toISOString();
  const relativePath = buildArtifactRelativePath({
    kind: "runtime-log",
    publishedAtUtc,
    runtime: provider,
    mode: context.mode,
    runId: context.runId,
    extension: "md"
  });
  const zh = isChineseLocale(settings.locale);
  const content = truncate(
    [
      zh ? "# 运行日志" : "# Runtime Log",
      "",
      zh ? `Provider：${provider}` : `Provider: ${provider}`,
      zh ? `Locale：${settings.locale}` : `Locale: ${settings.locale}`,
      zh ? `Skills：${settings.skills.map((skill) => skill.id).join(", ")}` : `Skills: ${settings.skills.map((skill) => skill.id).join(", ")}`,
      zh ? `市场脉冲可交易：${formatPulseTradeable(context.pulse.tradeable, settings.locale)}` : `Pulse tradeable: ${context.pulse.tradeable}`,
      zh ? `市场脉冲风险标记：${formatPulseRiskFlags(context.pulse.riskFlags, settings.locale)}` : `Pulse risk flags: ${formatPulseRiskFlags(context.pulse.riskFlags, settings.locale)}`,
      "",
      zh ? "## Provider 原始输出" : "## Raw Provider Output",
      "",
      "```json",
      rawOutput.trim(),
      "```"
    ].join("\n"),
    config.pulse.maxMarkdownChars
  );
  await writeStoredArtifact(config.artifactStorageRoot, relativePath, content);
  return {
    kind: "runtime-log",
    title: zh ? `运行日志 ${provider} ${publishedAtUtc}` : `Runtime log ${provider} ${publishedAtUtc}`,
    path: relativePath,
    content,
    published_at_utc: publishedAtUtc
  };
}

async function finalizeRuntimeExecution(input: {
  config: OrchestratorConfig;
  context: RuntimeExecutionContext;
  provider: AgentRuntimeProvider;
  settings: ResolvedProviderSkillSettings;
  rawOutput: string;
}): Promise<RuntimeExecutionResult> {
  let parsed: TradeDecisionSet;
  try {
    parsed = extractJsonPayload(input.rawOutput);
  } catch (error) {
    throw new Error(
      `Provider output could not be parsed as TradeDecisionSet.\n\n${truncate(input.rawOutput, 1600)}`,
      { cause: error }
    );
  }
  const runtimeLogArtifact = await buildRuntimeLogArtifact(
    input.config,
    input.context,
    input.provider,
    input.rawOutput,
    input.settings
  );
  const decisions = filterDecisions(parsed, input.context.pulse, input.context.positions);
  const canonicalPulseArtifact: Artifact = {
    kind: "pulse-report",
    title: input.context.pulse.title,
    path: input.context.pulse.relativeMarkdownPath,
    content: input.context.pulse.markdown,
    published_at_utc: input.context.pulse.generatedAtUtc
  };
  const removedDecisionCount = parsed.decisions.length - decisions.length;
  const zh = isChineseLocale(input.settings.locale);
  ensureExplanatoryDecisions(decisions, input.context, input.settings.locale);

  return {
    decisionSet: {
      ...parsed,
      run_id: input.context.runId,
      runtime: `${input.provider}-skill-runtime`,
      generated_at_utc: new Date().toISOString(),
      bankroll_usd: input.context.overview.total_equity_usd,
      mode: input.context.mode,
      decisions,
      artifacts: [canonicalPulseArtifact, runtimeLogArtifact]
    },
    promptSummary: zh
      ? `${input.provider} 运行时已执行，载入 ${input.settings.skills.length} 个 skill，市场脉冲候选数为 ${input.context.pulse.selectedCandidates}。`
      : `${input.provider} runtime executed with ${input.settings.skills.length} configured skills and ${input.context.pulse.selectedCandidates} pulse candidates.`,
    reasoningMd: zh
      ? [
          `Provider：${input.provider}`,
          `市场脉冲可交易：${formatPulseTradeable(input.context.pulse.tradeable, input.settings.locale)}`,
          `市场脉冲风险标记：${formatPulseRiskFlags(input.context.pulse.riskFlags, input.settings.locale, "；")}`,
          `通过风控后保留的决策数：${decisions.length}`,
          `被风控移除的决策数：${removedDecisionCount}`
        ].join("\n")
      : [
          `Provider: ${input.provider}`,
          `Tradeable pulse: ${input.context.pulse.tradeable}`,
          `Pulse risk flags: ${formatPulseRiskFlags(input.context.pulse.riskFlags, input.settings.locale, "; ")}`,
          `Decisions kept after guardrails: ${decisions.length}`,
          `Decisions removed by guardrails: ${removedDecisionCount}`
        ].join("\n"),
    logsMd: truncate(input.rawOutput, input.config.pulse.maxMarkdownChars)
  };
}

export async function resumeRuntimeExecutionFromOutputFile(input: {
  config: OrchestratorConfig;
  provider: AgentRuntimeProvider;
  context: RuntimeExecutionContext;
  outputPath: string;
}): Promise<RuntimeExecutionResult> {
  const settings = resolveProviderSkillSettings(input.config, input.provider);
  const rawOutput = await readFile(input.outputPath, "utf8");
  return finalizeRuntimeExecution({
    config: input.config,
    context: input.context,
    provider: input.provider,
    settings,
    rawOutput
  });
}

export class ProviderRuntime implements AgentRuntime {
  readonly name: string;

  constructor(
    private readonly config: OrchestratorConfig,
    private readonly provider: AgentRuntimeProvider
  ) {
    this.name = `${provider}-skill-runtime`;
  }

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const settings = resolveProviderSkillSettings(this.config, this.provider);
    const riskDocPath = path.resolve(
      this.config.repoRoot,
      settings.locale === "zh" ? "risk-controls.md" : "risk-controls.en.md"
    );
    const prompt = buildPrompt(context, settings, riskDocPath);
    context.progress?.stage({
      percent: 74,
      label: "Preparing decision runtime",
      detail: `${settings.provider} | ${settings.skills.length} skills`
    });
    const tempDir = await mkdtemp(path.join(tmpdir(), `autopoly-${this.provider}-`));
    const outputPath = path.join(tempDir, "provider-output.json");
    const promptPath = path.join(tempDir, "provider-prompt.txt");
    const schemaPath = path.join(tempDir, "trade-decision-set.schema.json");
    let preserveTempDir = false;
    const runtimeStartedAt = Date.now();

    try {
      await writeFile(promptPath, prompt, "utf8");
      const schemaContent = JSON.stringify(buildTradeDecisionSetSchema(), null, 2);
      await writeFile(schemaPath, schemaContent, "utf8");
      const timeoutMs = this.config.providerTimeoutSeconds * 1000;
      const effectiveTimeoutMs = timeoutMs > 0 ? timeoutMs : null;
      const [
        pulseJsonMetrics,
        pulseMarkdownMetrics,
        riskDocMetrics,
        ...skillMetrics
      ] = await Promise.all([
        readTextMetrics(context.pulse.absoluteJsonPath),
        readTextMetrics(context.pulse.absoluteMarkdownPath),
        readTextMetrics(riskDocPath),
        ...settings.skills.map((skill) => readTextMetrics(skill.skillFile))
      ]);
      const promptMetrics = measureText(prompt);
      const schemaMetrics = measureText(schemaContent);
      const pulseInputMetrics = combineTextMetrics([pulseJsonMetrics, pulseMarkdownMetrics]);
      const skillInputMetrics = combineTextMetrics(skillMetrics);
      const totalInputMetrics = combineTextMetrics([
        promptMetrics,
        schemaMetrics,
        pulseInputMetrics,
        riskDocMetrics,
        skillInputMetrics
      ]);

      context.progress?.info(
        `Decision runtime context | prompt ${formatTextMetrics(promptMetrics)} | schema ${formatTextMetrics(schemaMetrics)}`
      );
      context.progress?.info(
        `Decision runtime inputs | pulse files ${formatTextMetrics(pulseInputMetrics)} | skills ${settings.skills.length} files / ${formatTextMetrics(skillInputMetrics)} | risk ${formatTextMetrics(riskDocMetrics)} | est total ${formatTextMetrics(totalInputMetrics)}`
      );
      context.progress?.info(
        `Decision runtime temp dir | ${tempDir}`
      );
      context.progress?.info(
        `Decision runtime timeout | ${effectiveTimeoutMs == null ? "disabled" : `${Math.round(effectiveTimeoutMs / 1000)}s`}`
      );

      if (this.provider === "codex" && !settings.command) {
        await runCodex(prompt, settings, this.config.repoRoot, outputPath, schemaPath, timeoutMs, context.progress);
      } else {
        const commandTemplate = settings.command;
        if (!commandTemplate) {
          throw new Error(`No command configured for provider ${this.provider}.`);
        }
        await runTemplateCommandWithProgress(commandTemplate, {
          repo_root: this.config.repoRoot,
          prompt_file: promptPath,
          output_file: outputPath,
          schema_file: schemaPath,
          skill_root: settings.skillRootDir,
          pulse_json: context.pulse.absoluteJsonPath,
          pulse_markdown: context.pulse.absoluteMarkdownPath,
          risk_doc: riskDocPath
        }, timeoutMs, context.progress);
      }

      const rawOutput = await readFile(outputPath, "utf8");
      const outputMetrics = measureText(rawOutput);
      context.progress?.stage({
        percent: 88,
        label: "Decision runtime output captured",
        detail: `${path.basename(outputPath)} | ${formatTextMetrics(outputMetrics)} | elapsed ${Math.round((Date.now() - runtimeStartedAt) / 1000)}s`
      });
      return finalizeRuntimeExecution({
        config: this.config,
        context,
        provider: this.provider,
        settings,
        rawOutput
      });
    } catch (error) {
      preserveTempDir = true;
      if (existsSync(outputPath)) {
        try {
          const partialOutput = await readFile(outputPath, "utf8");
          context.progress?.info(
            `Decision runtime partial output | ${path.basename(outputPath)} | ${formatTextMetrics(measureText(partialOutput))}`
          );
        } catch {
          // ignore debug read failures
        }
      }
      context.progress?.fail(`Decision runtime failed | temp preserved at ${tempDir}`);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}\n\nDecision runtime temp preserved at ${tempDir}`, { cause: error });
    } finally {
      if (!preserveTempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }
}
