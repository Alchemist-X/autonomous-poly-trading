import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RunMode } from "@autopoly/contracts";
import type { AgentRuntimeProvider, OrchestratorConfig, SkillLocale } from "../config.js";
import { buildArtifactRelativePath, writeStoredArtifact } from "../lib/artifacts.js";

interface RawPulseMarket {
  question: string;
  event_slug: string;
  slug: string;
  url: string;
  liquidity: number;
  volume_24hr: number;
  outcomes: string[];
  outcome_prices: number[];
  clob_token_ids: string[];
  end_date: string;
  best_bid: number;
  best_ask: number;
  spread: number;
}

interface RawPulseOutput {
  fetched_at: string;
  total_fetched: number;
  total_filtered: number;
  min_liquidity: number;
  markets: RawPulseMarket[];
}

export interface PulseCandidate {
  question: string;
  eventSlug: string;
  marketSlug: string;
  url: string;
  liquidityUsd: number;
  volume24hUsd: number;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
  endDate: string;
  bestBid: number;
  bestAsk: number;
  spread: number;
}

export interface PulseSnapshot {
  id: string;
  generatedAtUtc: string;
  title: string;
  relativeMarkdownPath: string;
  absoluteMarkdownPath: string;
  relativeJsonPath: string;
  absoluteJsonPath: string;
  markdown: string;
  totalFetched: number;
  totalFiltered: number;
  selectedCandidates: number;
  minLiquidityUsd: number;
  candidates: PulseCandidate[];
  riskFlags: string[];
  tradeable: boolean;
}

function isChineseLocale(locale: SkillLocale): boolean {
  return locale === "zh";
}

function toPulseCandidate(market: RawPulseMarket): PulseCandidate {
  return {
    question: market.question,
    eventSlug: market.event_slug,
    marketSlug: market.slug,
    url: market.url,
    liquidityUsd: Number(market.liquidity),
    volume24hUsd: Number(market.volume_24hr),
    outcomes: Array.isArray(market.outcomes) ? market.outcomes : [],
    outcomePrices: Array.isArray(market.outcome_prices) ? market.outcome_prices.map((value) => Number(value)) : [],
    clobTokenIds: Array.isArray(market.clob_token_ids) ? market.clob_token_ids.map((value) => String(value)) : [],
    endDate: market.end_date,
    bestBid: Number(market.best_bid ?? 0),
    bestAsk: Number(market.best_ask ?? 0),
    spread: Number(market.spread ?? 0)
  };
}

function resolvePulseScriptsDir(config: OrchestratorConfig, locale: SkillLocale): string {
  if (config.pulse.sourceRepo === "polymarket-market-pulse") {
    const repoDir = config.pulse.sourceRepoDir;
    return locale === "zh"
      ? path.join(repoDir, "polymarket-market-pulse-zh", "scripts")
      : path.join(repoDir, "scripts");
  }

  const skillDir = locale === "zh" ? "polymarket-market-pulse-zh" : "polymarket-market-pulse";
  return path.join(config.pulse.sourceRepoDir, skillDir, "scripts");
}

function buildPulseTitle(generatedAtUtc: string, provider: AgentRuntimeProvider, locale: SkillLocale): string {
  const date = new Date(generatedAtUtc);
  const formatted = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
  const time = [
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    "UTC"
  ].join(":").replace(":UTC", " UTC");
  return isChineseLocale(locale)
    ? `市场脉冲 ${formatted} ${time} [${provider}]`
    : `Pulse ${formatted} ${time} [${provider}]`;
}

function truncateMarkdown(markdown: string, maxChars: number): string {
  if (markdown.length <= maxChars) {
    return markdown;
  }
  return `${markdown.slice(0, maxChars - 32)}\n\n... truncated by pulse storage guard.\n`;
}

export function evaluatePulseRiskFlags(snapshot: {
  generatedAtUtc: string;
  candidates: PulseCandidate[];
}, config: OrchestratorConfig, locale: SkillLocale = "en"): string[] {
  const flags: string[] = [];
  const ageMinutes = (Date.now() - new Date(snapshot.generatedAtUtc).getTime()) / 60000;
  const zh = isChineseLocale(locale);

  if (snapshot.candidates.length < config.pulse.minTradeableCandidates) {
    flags.push(
      zh
        ? `可交易候选数量低于阈值（${snapshot.candidates.length}/${config.pulse.minTradeableCandidates}）`
        : `tradeable candidates below minimum threshold (${snapshot.candidates.length}/${config.pulse.minTradeableCandidates})`
    );
  }

  if (ageMinutes > config.pulse.maxAgeMinutes) {
    flags.push(
      zh
        ? `市场脉冲快照已过期（${ageMinutes.toFixed(1)} 分钟 > ${config.pulse.maxAgeMinutes} 分钟）`
        : `pulse snapshot is stale (${ageMinutes.toFixed(1)}m > ${config.pulse.maxAgeMinutes}m)`
    );
  }

  if (snapshot.candidates.some((candidate) => candidate.clobTokenIds.length === 0)) {
    flags.push(
      zh
        ? "一个或多个市场脉冲候选缺少 CLOB token id"
        : "one or more pulse candidates are missing CLOB token ids"
    );
  }

  return flags;
}

function buildPulseMarkdown(snapshot: {
  generatedAtUtc: string;
  provider: AgentRuntimeProvider;
  locale: SkillLocale;
  totalFetched: number;
  totalFiltered: number;
  minLiquidityUsd: number;
  candidates: PulseCandidate[];
  riskFlags: string[];
}): string {
  const zh = isChineseLocale(snapshot.locale);
  const lines = [
    zh ? "# 市场脉冲" : "# Market Pulse",
    "",
    zh ? `生成时间：${snapshot.generatedAtUtc}` : `Generated at ${snapshot.generatedAtUtc}`,
    zh ? `目标 provider：${snapshot.provider}` : `Provider target: ${snapshot.provider}`,
    zh ? `抓取市场数：${snapshot.totalFetched}` : `Fetched markets: ${snapshot.totalFetched}`,
    zh ? `过滤后市场数：${snapshot.totalFiltered}` : `Filtered markets: ${snapshot.totalFiltered}`,
    zh ? `最小流动性阈值：$${snapshot.minLiquidityUsd.toFixed(0)}` : `Min liquidity threshold: $${snapshot.minLiquidityUsd.toFixed(0)}`,
    ""
  ];

  if (snapshot.riskFlags.length === 0) {
    lines.push(
      zh ? "## 风险控制" : "## Risk Controls",
      "",
      zh ? "- 本次市场脉冲未触发额外风险标记。" : "- No pulse-specific risk flags were raised.",
      ""
    );
  } else {
    lines.push(zh ? "## 风险控制" : "## Risk Controls", "", ...snapshot.riskFlags.map((flag) => `- ${flag}`), "");
  }

  lines.push(zh ? "## 候选市场" : "## Top Candidates", "");

  if (snapshot.candidates.length === 0) {
    lines.push(
      zh
        ? "当前没有候选市场通过抓取与过滤规则。"
        : "No tradeable candidates passed the current fetch and filter rules."
    );
    return lines.join("\n");
  }

  lines.push(
    zh
      ? "| 排名 | 问题 | 流动性 | 24 小时成交量 | 价格 | Tokens | 链接 |"
      : "| Rank | Question | Liquidity | 24h Volume | Prices | Tokens | URL |"
  );
  lines.push("| --- | --- | ---: | ---: | --- | --- | --- |");

  snapshot.candidates.forEach((candidate, index) => {
    const prices = candidate.outcomePrices.map((value) => value.toFixed(3)).join(" / ");
    const tokens = candidate.clobTokenIds.slice(0, 2).join(" / ");
    lines.push(
      `| ${index + 1} | ${candidate.question.replaceAll("|", "/")} | $${candidate.liquidityUsd.toFixed(0)} | $${candidate.volume24hUsd.toFixed(0)} | ${prices} | ${tokens} | ${candidate.url} |`
    );
  });

  return lines.join("\n");
}

async function runPulseFetch(scriptPath: string, config: OrchestratorConfig): Promise<RawPulseOutput> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "autopoly-pulse-"));
  const outputPath = path.join(tempDir, "pulse.json");

  try {
    const args = [
      scriptPath,
      "--pages",
      String(config.pulse.pages),
      "--events-per-page",
      String(config.pulse.eventsPerPage),
      "--min-liquidity",
      String(config.pulse.minLiquidityUsd),
      "--output",
      outputPath
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn("python3", args, {
        cwd: path.dirname(scriptPath),
        stdio: ["ignore", "pipe", "pipe"]
      });
      const timeoutMs = config.pulseFetchTimeoutSeconds * 1000;

      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`fetch_markets.py timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr || `fetch_markets.py exited with code ${code}`));
      });
    });

    const content = await readFile(outputPath, "utf8");
    return JSON.parse(content) as RawPulseOutput;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function generatePulseSnapshot(input: {
  config: OrchestratorConfig;
  provider: AgentRuntimeProvider;
  locale: SkillLocale;
  runId: string;
  mode: RunMode;
}): Promise<PulseSnapshot> {
  const generatedAtUtc = new Date().toISOString();
  const scriptDir = resolvePulseScriptsDir(input.config, input.locale);
  const scriptPath = path.join(scriptDir, "fetch_markets.py");
  const raw = await runPulseFetch(scriptPath, input.config);
  const candidates = raw.markets
    .map(toPulseCandidate)
    .filter((candidate) => candidate.clobTokenIds.length > 0)
    .slice(0, input.config.pulse.maxCandidates);
  const baseFlags = evaluatePulseRiskFlags({ generatedAtUtc, candidates }, input.config, input.locale);
  const title = buildPulseTitle(generatedAtUtc, input.provider, input.locale);
  const relativeMarkdownPath = buildArtifactRelativePath({
    kind: "pulse-report",
    publishedAtUtc: generatedAtUtc,
    runtime: input.provider,
    mode: input.mode,
    runId: input.runId,
    extension: "md"
  });
  const relativeJsonPath = buildArtifactRelativePath({
    kind: "pulse-report",
    publishedAtUtc: generatedAtUtc,
    runtime: input.provider,
    mode: input.mode,
    runId: input.runId,
    extension: "json"
  });

  const markdown = truncateMarkdown(
    buildPulseMarkdown({
      generatedAtUtc,
      provider: input.provider,
      locale: input.locale,
      totalFetched: raw.total_fetched,
      totalFiltered: raw.total_filtered,
      minLiquidityUsd: raw.min_liquidity,
      candidates,
      riskFlags: baseFlags
    }),
    input.config.pulse.maxMarkdownChars
  );
  const absoluteMarkdownPath = await writeStoredArtifact(input.config.artifactStorageRoot, relativeMarkdownPath, markdown);
  const absoluteJsonPath = await writeStoredArtifact(
    input.config.artifactStorageRoot,
    relativeJsonPath,
    JSON.stringify(
      {
        id: randomUUID(),
        generated_at_utc: generatedAtUtc,
        provider: input.provider,
        mode: input.mode,
        total_fetched: raw.total_fetched,
        total_filtered: raw.total_filtered,
        selected_candidates: candidates.length,
        min_liquidity_usd: raw.min_liquidity,
        risk_flags: baseFlags,
        candidates
      },
      null,
      2
    )
  );

  return {
    id: randomUUID(),
    generatedAtUtc,
    title,
    relativeMarkdownPath,
    absoluteMarkdownPath,
    relativeJsonPath,
    absoluteJsonPath,
    markdown,
    totalFetched: raw.total_fetched,
    totalFiltered: raw.total_filtered,
    selectedCandidates: candidates.length,
    minLiquidityUsd: raw.min_liquidity,
    candidates,
    riskFlags: baseFlags,
    tradeable: baseFlags.length === 0
  };
}
