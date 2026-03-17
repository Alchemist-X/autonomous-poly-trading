import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, getPublicPositions, hasDatabaseUrl, artifacts, resolutionChecks, trackedSources } from "@autopoly/db";
import { eq } from "drizzle-orm";
import type { OrchestratorConfig } from "../config.js";
import { buildArtifactRelativePath, writeStoredArtifact } from "../lib/artifacts.js";

type TrackabilityLevel = "完全" | "部分" | "手动" | "不可";
type ResolutionSourceType = "arena_leaderboard" | "generic_url" | "unknown";

interface ResolutionEventMarket {
  slug?: string;
  question?: string;
  description?: string;
  outcomes?: string[];
  outcome_prices?: number[];
  best_bid?: number;
  best_ask?: number;
  end_date?: string;
}

interface ResolutionTrackingResult {
  eventSlug: string;
  marketSlug: string;
  eventTitle: string;
  eventUrl: string;
  marketQuestion: string;
  trackStatus: string;
  trackability: TrackabilityLevel;
  sourceType: ResolutionSourceType;
  sourceUrl: string | null;
  summary: string;
  reportRelativePath: string;
  reportAbsolutePath: string;
  reportJsonRelativePath: string;
  reportJsonAbsolutePath: string;
  contentHash: string;
  snapshot: Record<string, unknown>;
  notes: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function detectSourceKind(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (hostname.includes("polymarket.com")) {
      return "polymarket";
    }
    return hostname;
  } catch {
    return "external";
  }
}

function extractUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>()"]+/g)].map((match) => match[0]!.replace(/[),.;]+$/, ""));
}

function detectResolutionSourceType(url: string | null): ResolutionSourceType {
  if (!url) {
    return "unknown";
  }
  if (/arena\.ai|lmarena\.ai/i.test(url)) {
    return "arena_leaderboard";
  }
  return "generic_url";
}

export function evaluateTrackability(input: {
  description: string;
  sourceUrl: string | null;
  sourceType: ResolutionSourceType;
}): { level: TrackabilityLevel; notes: string[] } {
  const description = input.description.toLowerCase();
  const notes: string[] = [];
  const redFlags = [
    "discretion",
    "sole judgment",
    "opinion",
    "decides",
    "may determine",
    "subjective",
    "at the discretion of",
    "uma oracle"
  ];

  for (const flag of redFlags) {
    if (!description.includes(flag)) {
      continue;
    }
    notes.push(`命中不可自动追踪关键词: ${flag}`);
  }

  if (notes.length > 0) {
    return { level: "不可", notes };
  }

  if (input.sourceUrl && input.sourceType === "arena_leaderboard") {
    notes.push("检测到公开排行榜类结算源，可通过脚本自动抓取。");
    return { level: "完全", notes };
  }

  if (input.sourceUrl) {
    notes.push("检测到公开 URL 结算源，可做脚本抓取或 HTML 快照监控。");
    return { level: "部分", notes };
  }

  notes.push("未检测到明确公开结算源 URL，只能保留手动复核。");
  return { level: "手动", notes };
}

async function runCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${input.command} ${input.args.join(" ")} timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function runJsonCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}): Promise<Record<string, unknown>> {
  const result = await runCommand(input);
  const stdout = result.stdout.trim();

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || stdout || `${input.command} exited with code ${result.code}`);
  }

  if (!stdout) {
    return {};
  }

  return JSON.parse(stdout) as Record<string, unknown>;
}

function resolveResolutionScriptsDir(config: OrchestratorConfig): string {
  return path.join(
    config.repoRoot,
    "vendor",
    "repos",
    "all-polymarket-skill",
    "poly-resolution-tracking-zh",
    "scripts"
  );
}

function summarizeResolutionData(data: Record<string, unknown> | null) {
  const record = asRecord(data);
  if (!record) {
    return null;
  }

  const mapping = asRecord(record.market_mapping);
  const leaders = mapping
    ? Object.entries(mapping)
      .map(([name, value]) => {
        const entry = asRecord(value);
        return {
          name,
          best_model: readString(entry?.best_model),
          rank: readNumber(entry?.rank),
          score: readNumber(entry?.score),
          ci: readNumber(entry?.ci)
        };
      })
      .filter((value) => value.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, 5)
    : [];

  return {
    success: record.success === true,
    method: readString(record.method),
    models_count: readNumber(record.models_count),
    leaders,
    error: readString(record.error),
    suggestion: readString(record.suggestion)
  };
}

function summarizeEvent(eventRecord: Record<string, unknown>, marketSlug: string) {
  const event = asRecord(eventRecord) ?? {};
  const markets = asArray(event.markets)
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => value !== null);
  const market = markets.find((item) => readString(item.slug) === marketSlug) ?? markets[0] ?? null;

  return {
    eventSlug: readString(event.slug) ?? marketSlug,
    eventTitle: readString(event.title) ?? marketSlug,
    eventUrl: readString(event.url) ?? `https://polymarket.com/event/${readString(event.slug) ?? marketSlug}`,
    description: readString(event.description) ?? readString(market?.description) ?? "",
    endDate: readString(event.end_date) ?? readString(market?.end_date),
    marketQuestion: readString(market?.question) ?? marketSlug,
    market: {
      best_bid: readNumber(market?.best_bid),
      best_ask: readNumber(market?.best_ask),
      end_date: readString(market?.end_date),
      outcome_prices: asArray(market?.outcome_prices).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
      outcomes: asArray(market?.outcomes).map((value) => String(value))
    }
  };
}

function buildResolutionSummary(input: {
  trackability: TrackabilityLevel;
  sourceUrl: string | null;
  sourceType: ResolutionSourceType;
  sourceSnapshot: Record<string, unknown> | null;
  contentChanged: boolean;
}): { status: string; summary: string } {
  if (input.trackability === "不可") {
    return {
      status: "untrackable",
      summary: "结算条件包含主观或不可自动抓取要素，当前仅能人工复核。"
    };
  }

  if (input.trackability === "手动") {
    return {
      status: "manual-review",
      summary: "未发现可自动抓取的明确结算源 URL，当前保留手动检查。"
    };
  }

  if (!input.sourceUrl || !input.sourceSnapshot) {
    return {
      status: "error",
      summary: "结算源存在但本次未能完成快照抓取。"
    };
  }

  if (input.contentChanged) {
    return {
      status: "changed",
      summary: `结算源快照已变化，来源类型为 ${input.sourceType}，需要复核市场定价与底层数据是否偏离。`
    };
  }

  return {
    status: "watching",
    summary: `结算源快照已检查，当前未发现新增变化，来源类型为 ${input.sourceType}。`
  };
}

function buildResolutionMarkdown(input: {
  generatedAtUtc: string;
  eventSlug: string;
  eventTitle: string;
  eventUrl: string;
  marketSlug: string;
  marketQuestion: string;
  trackability: TrackabilityLevel;
  trackStatus: string;
  sourceUrl: string | null;
  sourceType: ResolutionSourceType;
  sourceSnapshot: Record<string, unknown> | null;
  summary: string;
  notes: string[];
  contentChanged: boolean;
  previousCheckedAt: string | null;
  marketBestBid: number | null;
  marketBestAsk: number | null;
  outcomePrices: number[];
}) {
  const sourceSummary = summarizeResolutionData(input.sourceSnapshot);
  const priceLine = input.outcomePrices.length === 0 ? "未获取" : input.outcomePrices.map((value) => `${(value * 100).toFixed(1)}%`).join(" / ");

  return [
    "# 结算跟踪报告",
    "",
    `**生成时间：** ${input.generatedAtUtc}`,
    `**事件：** ${input.eventTitle}`,
    `**事件链接：** ${input.eventUrl}`,
    `**市场：** ${input.marketQuestion}`,
    `**市场标识：** ${input.marketSlug}`,
    `**追踪等级：** ${input.trackability}`,
    `**追踪状态：** ${input.trackStatus}`,
    `**结算源类型：** ${input.sourceType}`,
    `**结算源 URL：** ${input.sourceUrl ?? "未检测到"}`,
    `**上次检查时间：** ${input.previousCheckedAt ?? "首次检查"}`,
    "",
    "## 当前结论",
    "",
    `- ${input.summary}`,
    `- 市场表层报价：best bid ${input.marketBestBid == null ? "未获取" : input.marketBestBid.toFixed(3)} / best ask ${input.marketBestAsk == null ? "未获取" : input.marketBestAsk.toFixed(3)}`,
    `- Outcome 概率快照：${priceLine}`,
    `- 快照是否变化：${input.contentChanged ? "是" : "否"}`,
    "",
    "## 可追踪性说明",
    "",
    ...input.notes.map((note) => `- ${note}`),
    "",
    "## 数据源快照",
    "",
    sourceSummary == null
      ? "- 本次未抓到可结构化的外部结算源快照。"
      : `- 抓取成功：${sourceSummary.success ? "是" : "否"}`,
    sourceSummary?.method ? `- 抓取方法：${sourceSummary.method}` : "- 抓取方法：未获取",
    sourceSummary?.models_count != null ? `- 识别条目数：${sourceSummary.models_count}` : "- 识别条目数：未获取",
    sourceSummary?.error ? `- 错误：${sourceSummary.error}` : "- 错误：无",
    sourceSummary?.suggestion ? `- 建议：${sourceSummary.suggestion}` : "- 建议：无",
    "",
    "## 领先项快照",
    "",
    ...(sourceSummary?.leaders?.length
      ? [
          "| 排名 | 名称 | 分数 | 模型 | 置信区间 |",
          "| --- | --- | ---: | --- | ---: |",
          ...sourceSummary.leaders.map((entry) => `| ${entry.rank ?? "-"} | ${entry.name} | ${entry.score?.toFixed(2) ?? "-"} | ${entry.best_model ?? "未获取"} | ${entry.ci?.toFixed(2) ?? "-"} |`)
        ]
      : ["- 当前结算源未返回可映射的领先项。"]),
    "",
    "## 元数据",
    "",
    `- event_slug: ${input.eventSlug}`,
    `- market_slug: ${input.marketSlug}`,
    `- source_type: ${input.sourceType}`,
    `- source_url: ${input.sourceUrl ?? "未检测到"}`,
    `- generated_at_utc: ${input.generatedAtUtc}`
  ].join("\n");
}

async function buildResolutionSnapshot(input: {
  config: OrchestratorConfig;
  eventSlug: string;
  marketSlug: string;
  intervalMinutes: number;
}): Promise<ResolutionTrackingResult> {
  const scriptsDir = resolveResolutionScriptsDir(input.config);
  const fetchScript = path.join(scriptsDir, "fetch_event.py");
  const scrapeScript = path.join(scriptsDir, "scrape_source.py");

  if (!existsSync(fetchScript)) {
    throw new Error(`Missing resolution fetch script: ${fetchScript}`);
  }

  const generatedAtUtc = new Date().toISOString();
  const eventData = await runJsonCommand({
    command: "python3",
    args: [fetchScript, input.eventSlug],
    cwd: scriptsDir,
    timeoutMs: 90_000
  });

  const eventSummary = summarizeEvent(eventData, input.marketSlug);
  const candidateUrls = [
    ...extractUrls(eventSummary.description),
  ];
  const sourceUrl = candidateUrls[0] ?? null;
  const sourceType = detectResolutionSourceType(sourceUrl);
  const trackability = evaluateTrackability({
    description: eventSummary.description,
    sourceUrl,
    sourceType
  });

  let sourceSnapshot: Record<string, unknown> | null = null;
  if (sourceUrl && (trackability.level === "完全" || trackability.level === "部分")) {
    sourceSnapshot = await runJsonCommand({
      command: "python3",
      args: [scrapeScript, "--url", sourceUrl, "--type", sourceType === "arena_leaderboard" ? "arena_leaderboard" : "generic"],
      cwd: scriptsDir,
      timeoutMs: 120_000
    });
  }

  const snapshotPayload = {
    generated_at_utc: generatedAtUtc,
    event: {
      slug: eventSummary.eventSlug,
      title: eventSummary.eventTitle,
      url: eventSummary.eventUrl,
      description: eventSummary.description,
      end_date: eventSummary.endDate
    },
    market: {
      slug: input.marketSlug,
      question: eventSummary.marketQuestion,
      best_bid: eventSummary.market.best_bid,
      best_ask: eventSummary.market.best_ask,
      outcome_prices: eventSummary.market.outcome_prices,
      outcomes: eventSummary.market.outcomes
    },
    resolution: {
      source_url: sourceUrl,
      source_type: sourceType,
      trackability: trackability.level,
      notes: trackability.notes,
      source_snapshot: summarizeResolutionData(sourceSnapshot)
    }
  };

  const contentHash = createHash("sha256").update(JSON.stringify(snapshotPayload)).digest("hex");
  const previousCheck = hasDatabaseUrl()
    ? await getDb().query.resolutionChecks.findFirst({
        where: eq(resolutionChecks.marketSlug, input.marketSlug),
        orderBy: (table, helpers) => helpers.desc(table.lastCheckedAt)
      })
    : null;
  const previousMetadata = (previousCheck?.metadata ?? {}) as Record<string, unknown>;
  const previousHash = typeof previousMetadata.content_hash === "string" ? previousMetadata.content_hash : null;
  const contentChanged = previousHash != null && previousHash !== contentHash;
  const resolutionStatus = buildResolutionSummary({
    trackability: trackability.level,
    sourceUrl,
    sourceType,
    sourceSnapshot,
    contentChanged
  });

  const reportRelativePath = buildArtifactRelativePath({
    kind: "resolution-report",
    publishedAtUtc: generatedAtUtc,
    runtime: "resolution",
    mode: resolutionStatus.status,
    runId: input.marketSlug,
    extension: "md"
  });
  const reportJsonRelativePath = buildArtifactRelativePath({
    kind: "resolution-report",
    publishedAtUtc: generatedAtUtc,
    runtime: "resolution",
    mode: `${resolutionStatus.status}-snapshot`,
    runId: input.marketSlug,
    extension: "json"
  });
  const reportMarkdown = buildResolutionMarkdown({
    generatedAtUtc,
    eventSlug: eventSummary.eventSlug,
    eventTitle: eventSummary.eventTitle,
    eventUrl: eventSummary.eventUrl,
    marketSlug: input.marketSlug,
    marketQuestion: eventSummary.marketQuestion,
    trackability: trackability.level,
    trackStatus: resolutionStatus.status,
    sourceUrl,
    sourceType,
    sourceSnapshot,
    summary: resolutionStatus.summary,
    notes: trackability.notes,
    contentChanged,
    previousCheckedAt: previousCheck?.lastCheckedAt?.toISOString() ?? null,
    marketBestBid: eventSummary.market.best_bid,
    marketBestAsk: eventSummary.market.best_ask,
    outcomePrices: eventSummary.market.outcome_prices
  });
  const reportAbsolutePath = await writeStoredArtifact(input.config.artifactStorageRoot, reportRelativePath, reportMarkdown);
  const reportJsonAbsolutePath = await writeStoredArtifact(
    input.config.artifactStorageRoot,
    reportJsonRelativePath,
    JSON.stringify(snapshotPayload, null, 2)
  );

  return {
    eventSlug: eventSummary.eventSlug,
    marketSlug: input.marketSlug,
    eventTitle: eventSummary.eventTitle,
    eventUrl: eventSummary.eventUrl,
    marketQuestion: eventSummary.marketQuestion,
    trackStatus: resolutionStatus.status,
    trackability: trackability.level,
    sourceType,
    sourceUrl,
    summary: resolutionStatus.summary,
    reportRelativePath,
    reportAbsolutePath,
    reportJsonRelativePath,
    reportJsonAbsolutePath,
    contentHash,
    snapshot: snapshotPayload,
    notes: trackability.notes
  };
}

async function persistResolutionResult(input: {
  intervalMinutes: number;
  result: ResolutionTrackingResult;
}) {
  const db = getDb();
  const now = new Date();

  await db.insert(resolutionChecks).values({
    id: randomUUID(),
    eventSlug: input.result.eventSlug,
    marketSlug: input.result.marketSlug,
    trackStatus: input.result.trackStatus,
    intervalMinutes: input.intervalMinutes,
    nextCheckAt: new Date(now.getTime() + input.intervalMinutes * 60 * 1000),
    lastCheckedAt: now,
    summary: input.result.summary,
    metadata: {
      trackability: input.result.trackability,
      source_url: input.result.sourceUrl,
      source_type: input.result.sourceType,
      report_path: input.result.reportRelativePath,
      report_json_path: input.result.reportJsonRelativePath,
      content_hash: input.result.contentHash,
      notes: input.result.notes
    }
  });

  await db.insert(artifacts).values({
    id: randomUUID(),
    runId: null,
    kind: "resolution-report",
    title: `结算跟踪 ${input.result.marketQuestion} ${now.toISOString()}`,
    path: input.result.reportRelativePath,
    content: await readFile(input.result.reportAbsolutePath, "utf8"),
    publishedAtUtc: now
  });

  await db.insert(trackedSources).values({
    id: randomUUID(),
    runId: null,
    decisionId: null,
    eventSlug: input.result.eventSlug,
    marketSlug: input.result.marketSlug,
    title: `${input.result.eventTitle} 事件页`,
    url: input.result.eventUrl,
    sourceKind: "polymarket",
    role: "event-context",
    status: input.result.trackStatus,
    retrievedAtUtc: now,
    lastCheckedAt: now,
    note: input.result.summary,
    contentHash: input.result.contentHash,
    metadata: {
      trackability: input.result.trackability,
      report_path: input.result.reportRelativePath
    }
  });

  if (input.result.sourceUrl) {
    await db.insert(trackedSources).values({
      id: randomUUID(),
      runId: null,
      decisionId: null,
      eventSlug: input.result.eventSlug,
      marketSlug: input.result.marketSlug,
      title: `${input.result.marketQuestion} 结算源`,
      url: input.result.sourceUrl,
      sourceKind: detectSourceKind(input.result.sourceUrl),
      role: "resolution-source",
      status: input.result.trackStatus,
      retrievedAtUtc: now,
      lastCheckedAt: now,
      note: input.result.summary,
      contentHash: input.result.contentHash,
      metadata: {
        trackability: input.result.trackability,
        source_type: input.result.sourceType,
        report_path: input.result.reportRelativePath
      }
    });
  }
}

export async function runResolutionTrackingSnapshot(input: {
  config: OrchestratorConfig;
  eventSlug: string;
  marketSlug: string;
  intervalMinutes: number;
}) {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured; resolution tracking persistence requires a database.");
  }

  const result = await buildResolutionSnapshot(input);
  await persistResolutionResult({
    intervalMinutes: input.intervalMinutes,
    result
  });

  return result;
}

export async function previewResolutionTrackingSnapshot(input: {
  config: OrchestratorConfig;
  eventSlug: string;
  marketSlug: string;
  intervalMinutes: number;
}) {
  return buildResolutionSnapshot(input);
}

export async function runResolutionSweep(input: {
  config: OrchestratorConfig;
  intervalMinutes: number;
}) {
  if (!hasDatabaseUrl()) {
    return { skipped: true, reason: "DATABASE_URL is not configured." };
  }

  const positions = await getPublicPositions();
  const uniqueMarkets = new Map<string, { eventSlug: string; marketSlug: string }>();
  for (const position of positions) {
    uniqueMarkets.set(position.market_slug, {
      eventSlug: position.event_slug,
      marketSlug: position.market_slug
    });
  }

  const results: ResolutionTrackingResult[] = [];
  for (const market of uniqueMarkets.values()) {
    results.push(await runResolutionTrackingSnapshot({
      config: input.config,
      eventSlug: market.eventSlug,
      marketSlug: market.marketSlug,
      intervalMinutes: input.intervalMinutes
    }));
  }

  return {
    skipped: false,
    markets: results.length,
    statuses: results.map((result) => ({
      market_slug: result.marketSlug,
      track_status: result.trackStatus,
      trackability: result.trackability,
      source_url: result.sourceUrl
    }))
  };
}
