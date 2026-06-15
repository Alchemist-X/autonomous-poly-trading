import type { PublicRunDetail } from "@autopoly/contracts";
import { executionEvents, getDb, getPublicRunDetail, hasDatabaseUrl } from "@autopoly/db";
import { desc, eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { STATIC_PUBLIC_PULSE_RECOMMENDATION_EXAMPLES } from "./public-run-pulse-static";

export interface PublicRunExecutedTradeSummary {
  id: string;
  market_slug: string;
  token_id: string;
  side: "BUY" | "SELL";
  status: string;
  requested_notional_usd: number;
  filled_notional_usd: number;
  avg_price: number | null;
  order_id: string | null;
  timestamp_utc: string;
}

export interface PublicRunPulseExplainer {
  pulse_title: string;
  pulse_path: string;
  pulse_published_at_utc: string;
  pulse_excerpt_md: string;
  executed_trade_count: number;
  first_executed_trade_at_utc: string;
  last_executed_trade_at_utc: string;
  executed_trades: PublicRunExecutedTradeSummary[];
}

export interface PublicRunDetailWithPulse extends PublicRunDetail {
  pulse_explainer: PublicRunPulseExplainer | null;
}

export interface PublicPulseRecommendationTradeSummary {
  market_slug: string;
  event_slug: string;
  side: "BUY" | "SELL";
  order_id: string | null;
  filled_notional_usd: number;
  avg_price: number | null;
  timestamp_utc: string | null;
}

export interface PublicPulseRecommendationSource {
  title: string;
  url: string;
  retrieved_at_utc: string | null;
  note: string | null;
}

export interface PublicPulseRecommendationExample {
  run_id: string;
  runtime: string;
  generated_at_utc: string;
  market_slug: string;
  event_slug: string;
  recommended_notional_usd: number;
  decision_reason_md: string;
  pulse_evidence_status: "present" | "missing";
  pulse_missing_reason: string | null;
  pulse_title: string | null;
  pulse_published_at_utc: string | null;
  pulse_excerpt_md: string | null;
  pulse_markdown_path: string | null;
  pulse_json_path: string | null;
  run_summary_path: string | null;
  execution_summary_path: string | null;
  executed_trade_count: number;
  executed_trades: PublicPulseRecommendationTradeSummary[];
  market_url?: string | null;
  sources?: PublicPulseRecommendationSource[];
}

interface ArtifactRecommendationDecision {
  action?: string;
  marketSlug?: string;
  market_slug?: string;
  eventSlug?: string;
  event_slug?: string;
  notionalUsd?: number;
  notional_usd?: number;
  side?: "BUY" | "SELL";
  thesisMd?: string;
  thesis_md?: string;
  sources?: PublicPulseRecommendationSource[];
}

interface ArtifactRecommendationFile {
  runId: string;
  runtime?: string;
  generatedAtUtc?: string;
  generated_at_utc?: string;
  pulseMarkdownPath?: string;
  pulseJsonPath?: string;
  pulseMarkdownPathAbsolute?: string;
  pulseJsonPathAbsolute?: string;
  decisions?: ArtifactRecommendationDecision[];
}

interface ArtifactExecutionSummaryFile {
  runId: string;
  executed?: Array<{
    action?: string;
    marketSlug?: string;
    market_slug?: string;
    eventSlug?: string;
    event_slug?: string;
    tokenId?: string;
    token_id?: string;
    side?: string;
    orderId?: string;
    order_id?: string;
    filledNotionalUsd?: number;
    filled_notional_usd?: number;
    executionAmount?: number;
    notionalUsd?: number;
    avgPrice?: number;
    avg_price?: number;
    timestampUtc?: string;
    timestamp_utc?: string;
    status?: string;
  }>;
}

interface ArtifactPulseFile {
  generated_at_utc?: string;
  title?: string;
  locale?: string;
  provider?: string;
}

interface LoadedRecommendationExample {
  runId: string;
  runtime: string;
  generatedAtUtc: string;
  marketSlug: string;
  eventSlug: string;
  notionalUsd: number;
  thesisMd: string;
  recommendation: ArtifactRecommendationFile;
  executionSummary: ArtifactExecutionSummaryFile;
  pulseMarkdownPath: string | null;
  pulseJsonPath: string | null;
  runSummaryPath: string | null;
  executionSummaryPath: string | null;
  pulseMarkdownAbsPath: string | null;
  pulseJsonAbsPath: string | null;
  completed: boolean;
  executedCount: number;
  executedTrades: PublicPulseRecommendationTradeSummary[];
}

const TWO_DOLLAR_SAMPLE_MIN_USD = 1.75;
const TWO_DOLLAR_SAMPLE_MAX_USD = 2.25;
const PREFERRED_HISTORICAL_SAMPLE_MARKETS = [
  "us-x-iran-ceasefire-by-march-31",
  "will-gavin-newsom-win-the-2028-us-presidential-election"
] as const;

function toRepoPath(storedPath: string | null | undefined): string | null {
  if (!storedPath) {
    return null;
  }

  const marker = "runtime-artifacts/";
  const index = storedPath.indexOf(marker);
  if (index >= 0) {
    return path.join(process.cwd(), storedPath.slice(index));
  }

  if (path.isAbsolute(storedPath)) {
    return null;
  }

  return path.join(process.cwd(), storedPath);
}

function toDisplayPath(storedPath: string | null | undefined): string | null {
  if (!storedPath) {
    return null;
  }

  const marker = "runtime-artifacts/";
  const index = storedPath.indexOf(marker);
  if (index >= 0) {
    return storedPath.slice(index);
  }

  if (path.isAbsolute(storedPath)) {
    return path.relative(process.cwd(), storedPath);
  }

  return storedPath;
}

async function readJsonFile<T>(filePath: string | null): Promise<T | null> {
  if (!filePath) {
    return null;
  }

  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readTextFile(filePath: string | null): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (value == null) {
    return 0;
  }
  return Number(value);
}

function extractPulseExcerpt(content: string, maxLines = 14): string {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return lines.slice(0, maxLines).join("\n");
}

function isExecutedTrade(status: string, filledNotionalUsd: number): boolean {
  return filledNotionalUsd > 0 || ["filled", "matched"].includes(status.toLowerCase());
}

function extractDecisionReason(decision: ArtifactRecommendationDecision | null | undefined): string {
  return decision?.thesisMd ?? decision?.thesis_md ?? "";
}

function extractDecisionNotional(decision: ArtifactRecommendationDecision | null | undefined): number {
  return toNumber(decision?.notionalUsd ?? decision?.notional_usd);
}

function extractDecisionMarketSlug(decision: ArtifactRecommendationDecision | null | undefined): string {
  return decision?.marketSlug ?? decision?.market_slug ?? "";
}

function extractDecisionEventSlug(decision: ArtifactRecommendationDecision | null | undefined): string {
  return decision?.eventSlug ?? decision?.event_slug ?? extractDecisionMarketSlug(decision);
}

function extractDecisionSide(decision: ArtifactRecommendationDecision | null | undefined): "BUY" | "SELL" {
  return decision?.side === "SELL" ? "SELL" : "BUY";
}

function extractDecisionSources(decision: ArtifactRecommendationDecision | null | undefined): PublicPulseRecommendationSource[] {
  if (!Array.isArray(decision?.sources)) {
    return [];
  }

  return decision.sources
    .map((source) => ({
      title: typeof source?.title === "string" ? source.title : "Untitled source",
      url: typeof source?.url === "string" ? source.url : "",
      retrieved_at_utc: typeof source?.retrieved_at_utc === "string" ? source.retrieved_at_utc : null,
      note: typeof source?.note === "string" ? source.note : null
    }))
    .filter((source) => source.url.length > 0);
}

function extractExecutedTradeSummary(trade: NonNullable<ArtifactExecutionSummaryFile["executed"]>[number]): PublicPulseRecommendationTradeSummary {
  const filledNotionalUsd = toNumber(trade.filledNotionalUsd ?? trade.filled_notional_usd ?? trade.executionAmount ?? trade.notionalUsd);

  return {
    market_slug: trade.marketSlug ?? trade.market_slug ?? "",
    event_slug: trade.eventSlug ?? trade.event_slug ?? trade.marketSlug ?? trade.market_slug ?? "",
    side: (trade.side === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
    order_id: trade.orderId ?? trade.order_id ?? null,
    filled_notional_usd: filledNotionalUsd,
    avg_price: trade.avgPrice == null && trade.avg_price == null ? null : toNumber(trade.avgPrice ?? trade.avg_price),
    timestamp_utc: trade.timestampUtc ?? trade.timestamp_utc ?? null
  };
}

function extractPulsePreviewExcerpt(content: string, maxLines = 12): string {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return lines.slice(0, maxLines).join("\n");
}

function isApproxTwoDollarSample(notionalUsd: number): boolean {
  return notionalUsd >= TWO_DOLLAR_SAMPLE_MIN_USD && notionalUsd <= TWO_DOLLAR_SAMPLE_MAX_USD;
}

async function loadRecommendationExample(record: {
  runId: string;
  runtime: string;
  generatedAtUtc: string;
  recommendation: ArtifactRecommendationFile;
  executionSummary: ArtifactExecutionSummaryFile;
  runSummaryPath: string | null;
  executionSummaryPath: string | null;
}): Promise<PublicPulseRecommendationExample> {
  const openDecision = record.recommendation.decisions?.find((decision) => decision.action === "open" && extractDecisionNotional(decision) > 0) ?? null;
  const pulseMarkdownAbsPath = toRepoPath(record.recommendation.pulseMarkdownPath ?? record.recommendation.pulseMarkdownPathAbsolute ?? null);
  const pulseJsonAbsPath = toRepoPath(record.recommendation.pulseJsonPath ?? record.recommendation.pulseJsonPathAbsolute ?? null);
  const pulseJson = await readJsonFile<ArtifactPulseFile>(pulseJsonAbsPath);
  const pulseMarkdown = await readTextFile(pulseMarkdownAbsPath);
  const completed = (await readTextFile(record.runSummaryPath))?.includes("success (completed)") ?? false;
  const executedTrades = (record.executionSummary.executed ?? [])
    .filter((trade) => isExecutedTrade(String(trade.status ?? trade?.orderId ?? trade?.order_id ?? ""), toNumber(trade.filledNotionalUsd ?? trade.filled_notional_usd ?? trade.executionAmount ?? trade.notionalUsd)))
    .map((trade) => extractExecutedTradeSummary(trade))
    .filter((trade) => trade.market_slug.length > 0);

  const hasRealEvidence = completed && executedTrades.length > 0 && Boolean(pulseMarkdown);
  const missingReasons: string[] = [];

  if (!completed) {
    missingReasons.push("run-summary 里没有 success (completed)");
  }

  if (executedTrades.length === 0) {
    missingReasons.push("execution-summary 里没有找到 executed trade");
  }

  if (!pulseMarkdown) {
    missingReasons.push("pulse markdown 没有找到可读内容");
  }

  return {
    run_id: record.runId,
    runtime: record.runtime,
    generated_at_utc: pulseJson?.generated_at_utc ?? record.generatedAtUtc,
    market_slug: extractDecisionMarketSlug(openDecision),
    event_slug: extractDecisionEventSlug(openDecision),
    recommended_notional_usd: extractDecisionNotional(openDecision),
    decision_reason_md: extractDecisionReason(openDecision),
    pulse_evidence_status: hasRealEvidence ? "present" : "missing",
    pulse_missing_reason: hasRealEvidence ? null : missingReasons.join("；"),
    pulse_title: pulseJson?.title ?? null,
    pulse_published_at_utc: pulseJson?.generated_at_utc ?? null,
    pulse_excerpt_md: hasRealEvidence && pulseMarkdown ? extractPulsePreviewExcerpt(pulseMarkdown) : null,
    pulse_markdown_path: toDisplayPath(record.recommendation.pulseMarkdownPath ?? null),
    pulse_json_path: toDisplayPath(record.recommendation.pulseJsonPath ?? null),
    run_summary_path: toDisplayPath(record.runSummaryPath),
    execution_summary_path: toDisplayPath(record.executionSummaryPath),
    executed_trade_count: executedTrades.length,
    executed_trades: executedTrades.slice(0, 3),
    market_url: extractDecisionEventSlug(openDecision) ? `https://polymarket.com/event/${extractDecisionEventSlug(openDecision)}` : null,
    sources: extractDecisionSources(openDecision)
  };
}

async function loadRecommendationExampleRecords(): Promise<LoadedRecommendationExample[]> {
  const root = path.join(process.cwd(), "runtime-artifacts", "pulse-live");

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const runDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name))
      .sort((left, right) => right.localeCompare(left));

    const records = await Promise.all(
      runDirectories.map(async (runDir) => {
        const recommendationPath = path.join(runDir, "recommendation.json");
        const executionSummaryPath = path.join(runDir, "execution-summary.json");
        const runSummaryPath = path.join(runDir, "run-summary.md");
        const recommendation = await readJsonFile<ArtifactRecommendationFile>(recommendationPath);
        const loadedExecutionSummary = await readJsonFile<ArtifactExecutionSummaryFile>(executionSummaryPath);
        const runSummaryText = await readTextFile(runSummaryPath);
        const executionSummary =
          loadedExecutionSummary ??
          ({
            runId: recommendation?.runId ?? path.basename(runDir),
            executed: []
          } satisfies ArtifactExecutionSummaryFile);

        if (!recommendation) {
          return null;
        }

        const openDecision = recommendation.decisions?.find((decision) => decision.action === "open" && extractDecisionNotional(decision) > 0) ?? null;
        if (!openDecision) {
          return null;
        }

        const generatedAtUtc = recommendation.generatedAtUtc ?? recommendation.generated_at_utc ?? new Date().toISOString();
        const executedTrades = (executionSummary.executed ?? [])
          .filter((trade) => isExecutedTrade(String(trade.status ?? trade.orderId ?? trade.order_id ?? ""), toNumber(trade.filledNotionalUsd ?? trade.filled_notional_usd ?? trade.executionAmount ?? trade.notionalUsd)))
          .map((trade) => extractExecutedTradeSummary(trade))
          .filter((trade) => trade.market_slug.length > 0);
        const completed = runSummaryText?.includes("success (completed)") ?? false;

        return {
          runId: recommendation.runId,
          runtime: recommendation.runtime ?? "pulse-direct-runtime",
          generatedAtUtc,
          marketSlug: extractDecisionMarketSlug(openDecision),
          eventSlug: extractDecisionEventSlug(openDecision),
          notionalUsd: extractDecisionNotional(openDecision),
          thesisMd: extractDecisionReason(openDecision),
          recommendation,
          executionSummary,
          pulseMarkdownPath: recommendation.pulseMarkdownPath ?? null,
          pulseJsonPath: recommendation.pulseJsonPath ?? null,
          runSummaryPath: runSummaryText ? runSummaryPath : null,
          executionSummaryPath: loadedExecutionSummary ? executionSummaryPath : null,
          pulseMarkdownAbsPath: toRepoPath(recommendation.pulseMarkdownPath ?? recommendation.pulseMarkdownPathAbsolute ?? null),
          pulseJsonAbsPath: toRepoPath(recommendation.pulseJsonPath ?? recommendation.pulseJsonPathAbsolute ?? null),
          completed,
          executedCount: executedTrades.length,
          executedTrades
        } as LoadedRecommendationExample;
      })
    );

    return records.filter((record): record is LoadedRecommendationExample => Boolean(record));
  } catch {
    return [];
  }
}

export async function getPublicPulseRecommendationExamples(limit = 3): Promise<PublicPulseRecommendationExample[]> {
  const records = await loadRecommendationExampleRecords();
  if (records.length === 0) {
    return STATIC_PUBLIC_PULSE_RECOMMENDATION_EXAMPLES.slice(0, limit);
  }

  const twoDollarRecords = records.filter((record) => isApproxTwoDollarSample(record.notionalUsd));
  const selected: LoadedRecommendationExample[] = [];

  for (const marketSlug of PREFERRED_HISTORICAL_SAMPLE_MARKETS) {
    const record = twoDollarRecords.find((item) => item.marketSlug === marketSlug);
    if (record && !selected.some((item) => item.marketSlug === record.marketSlug)) {
      selected.push(record);
    }
  }

  for (const record of twoDollarRecords) {
    if (selected.length >= 2) {
      break;
    }
    if (!selected.some((item) => item.marketSlug === record.marketSlug)) {
      selected.push(record);
    }
  }

  const presentRecord = records.find((record) => record.executedCount > 0 && record.completed);
  if (presentRecord && !selected.some((item) => item.runId === presentRecord.runId)) {
    selected.push(presentRecord);
  }

  return Promise.all(selected.slice(0, limit).map((record) => loadRecommendationExample(record)));
}

export async function getPublicRunDetailWithPulse(runId: string): Promise<PublicRunDetailWithPulse | null> {
  const run = await getPublicRunDetail(runId);
  if (!run) {
    return null;
  }

  const pulseArtifact = [...run.artifacts]
    .filter((artifact) => artifact.kind === "pulse-report" && typeof artifact.content === "string" && artifact.content.trim().length > 0)
    .sort((left, right) => new Date(right.published_at_utc).getTime() - new Date(left.published_at_utc).getTime())[0] ?? null;

  if (!pulseArtifact || run.status !== "completed" || !hasDatabaseUrl()) {
    return {
      ...run,
      pulse_explainer: null
    };
  }

  const db = getDb();
  const tradeRows = await db
    .select({
      id: executionEvents.id,
      market_slug: executionEvents.marketSlug,
      token_id: executionEvents.tokenId,
      side: executionEvents.side,
      status: executionEvents.status,
      requested_notional_usd: executionEvents.requestedNotionalUsd,
      filled_notional_usd: executionEvents.filledNotionalUsd,
      avg_price: executionEvents.avgPrice,
      order_id: executionEvents.orderId,
      timestamp_utc: executionEvents.timestampUtc
    })
    .from(executionEvents)
    .where(eq(executionEvents.runId, runId))
    .orderBy(desc(executionEvents.timestampUtc))
    .limit(25);

  const executedTrades = tradeRows
    .map((trade) => ({
      id: trade.id,
      market_slug: trade.market_slug,
      token_id: trade.token_id,
      side: trade.side as "BUY" | "SELL",
      status: trade.status,
      requested_notional_usd: toNumber(trade.requested_notional_usd),
      filled_notional_usd: toNumber(trade.filled_notional_usd),
      avg_price: trade.avg_price == null ? null : toNumber(trade.avg_price),
      order_id: trade.order_id,
      timestamp_utc: trade.timestamp_utc.toISOString()
    }))
    .filter((trade) => isExecutedTrade(trade.status, trade.filled_notional_usd));

  if (executedTrades.length === 0) {
    return {
      ...run,
      pulse_explainer: null
    };
  }

  const latestExecutedTrade = executedTrades[0]!;
  const earliestExecutedTrade = executedTrades[executedTrades.length - 1]!;

  return {
    ...run,
    pulse_explainer: {
      pulse_title: pulseArtifact.title,
      pulse_path: pulseArtifact.path,
      pulse_published_at_utc: pulseArtifact.published_at_utc,
      pulse_excerpt_md: extractPulseExcerpt(pulseArtifact.content ?? ""),
      executed_trade_count: executedTrades.length,
      first_executed_trade_at_utc: earliestExecutedTrade.timestamp_utc,
      last_executed_trade_at_utc: latestExecutedTrade.timestamp_utc,
      executed_trades: executedTrades.slice(0, 3)
    }
  };
}

// Exported for unit testing — pure, privacy/mapping-relevant transforms.
export {
  toDisplayPath,
  extractPulseExcerpt,
  isExecutedTrade,
  extractDecisionSide,
  extractDecisionEventSlug,
  extractDecisionSources
};
