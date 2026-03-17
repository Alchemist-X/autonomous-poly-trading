import { randomUUID } from "node:crypto";
import { JOBS, QUEUES, tradeDecisionSetSchema, type TradeDecisionSet } from "@autopoly/contracts";
import {
  agentDecisions,
  agentRuns,
  artifacts,
  executionEvents,
  getDb,
  getOverview,
  getPublicPositions,
  trackedSources
} from "@autopoly/db";
import { Queue } from "bullmq";
import type { OrchestratorConfig } from "../config.js";
import { applyTradeGuards } from "../lib/risk.js";
import { getSystemStatus } from "../lib/state.js";
import { generatePulseSnapshot } from "../pulse/market-pulse.js";
import type { AgentRuntime } from "../runtime/agent-runtime.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";

export interface ExecutableTradePlan {
  decisionId: string | null;
  decision: TradeDecisionSet["decisions"][number];
}

export interface QueuedTradeJobSummary extends ExecutableTradePlan {
  jobId: string;
}

function sanitizeDecisionSet(decisionSet: TradeDecisionSet): TradeDecisionSet {
  return tradeDecisionSetSchema.parse(decisionSet);
}

function detectSourceKind(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("polymarket.com")) {
      return "polymarket";
    }
    return hostname.replace(/^www\./, "");
  } catch {
    return "external";
  }
}

async function persistRun(result: {
  promptSummary: string;
  reasoningMd: string;
  logsMd: string;
  decisionSet: TradeDecisionSet;
}) {
  const db = getDb();

  await db.insert(agentRuns).values({
    id: result.decisionSet.run_id,
    runtime: result.decisionSet.runtime,
    mode: result.decisionSet.mode,
    status: "completed",
    bankrollUsd: String(result.decisionSet.bankroll_usd),
    promptSummary: result.promptSummary,
    reasoningMd: result.reasoningMd,
    logsMd: result.logsMd,
    generatedAtUtc: new Date(result.decisionSet.generated_at_utc)
  });

  const decisionIdMap = new Map<string, string>();

  for (const decision of result.decisionSet.decisions) {
    const decisionId = randomUUID();
    decisionIdMap.set(`${decision.market_slug}:${decision.action}`, decisionId);

    await db.insert(agentDecisions).values({
      id: decisionId,
      runId: result.decisionSet.run_id,
      action: decision.action,
      eventSlug: decision.event_slug,
      marketSlug: decision.market_slug,
      tokenId: decision.token_id,
      side: decision.side,
      notionalUsd: String(decision.notional_usd),
      orderType: decision.order_type,
      aiProb: String(decision.ai_prob),
      marketProb: String(decision.market_prob),
      edge: String(decision.edge),
      confidence: decision.confidence,
      thesisMd: decision.thesis_md,
      sources: decision.sources,
      stopLossPct: String(decision.stop_loss_pct),
      resolutionTrackRequired: decision.resolution_track_required
    });

    for (const source of decision.sources) {
      await db.insert(trackedSources).values({
        id: randomUUID(),
        runId: result.decisionSet.run_id,
        decisionId,
        eventSlug: decision.event_slug,
        marketSlug: decision.market_slug,
        title: source.title,
        url: source.url,
        sourceKind: detectSourceKind(source.url),
        role: "decision-source",
        status: "captured",
        retrievedAtUtc: new Date(source.retrieved_at_utc),
        lastCheckedAt: new Date(source.retrieved_at_utc),
        note: source.note ?? null,
        contentHash: null,
        metadata: {}
      });
    }
  }

  for (const artifact of result.decisionSet.artifacts) {
    await db.insert(artifacts).values({
      id: randomUUID(),
      runId: result.decisionSet.run_id,
      kind: artifact.kind,
      title: artifact.title,
      path: artifact.path,
      content: artifact.content ?? null,
      publishedAtUtc: new Date(artifact.published_at_utc)
    });
  }

  return decisionIdMap;
}

export async function queueTradeExecution(input: {
  executionQueue: Queue;
  runId: string;
  decisionId: string | null;
  decision: TradeDecisionSet["decisions"][number];
}) {
  const job = await input.executionQueue.add(
    JOBS.executeTrade,
    {
      runId: input.runId,
      decisionId: input.decisionId,
      decision: input.decision
    },
    {
      removeOnComplete: true,
      removeOnFail: false
    }
  );

  const db = getDb();
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId: input.runId,
    decisionId: input.decisionId,
    marketSlug: input.decision.market_slug,
    tokenId: input.decision.token_id,
    side: input.decision.side,
    status: "submitted",
    requestedNotionalUsd: String(input.decision.notional_usd),
    filledNotionalUsd: "0",
    rawResponse: {
      queued: true,
      queue: QUEUES.execution,
      jobId: job.id
    }
  });

  return {
    decisionId: input.decisionId,
    decision: input.decision,
    jobId: String(job.id)
  } satisfies QueuedTradeJobSummary;
}

export async function runAgentCycle(deps: {
  runtime: AgentRuntime;
  executionQueue: Queue;
  config: OrchestratorConfig;
  queueStrategy?: "all" | "manual";
}) {
  const status = await getSystemStatus();
  if (status !== "running") {
    return { skipped: true, reason: `system status is ${status}` };
  }

  const [overview, positions] = await Promise.all([getOverview(), getPublicPositions()]);
  const runId = randomUUID();
  const mode = "full";
  const skillSettings = resolveProviderSkillSettings(deps.config, deps.config.runtimeProvider);
  const pulse = await generatePulseSnapshot({
    config: deps.config,
    provider: deps.config.runtimeProvider,
    locale: skillSettings.locale,
    runId,
    mode
  });
  const result = await deps.runtime.run({
    runId,
    mode,
    overview,
    positions,
    pulse
  });
  const decisionSet = sanitizeDecisionSet(result.decisionSet);
  const decisionIdMap = await persistRun({ ...result, decisionSet });
  const executableTrades: ExecutableTradePlan[] = [];
  const queuedTradeJobs: QueuedTradeJobSummary[] = [];

  let projectedTotalExposureUsd = positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  let projectedOpenPositions = overview.open_positions;
  const eventExposureUsd = new Map<string, number>();
  for (const position of positions) {
    eventExposureUsd.set(
      position.event_slug,
      (eventExposureUsd.get(position.event_slug) ?? 0) + position.current_value_usd
    );
  }

  for (const decision of decisionSet.decisions) {
    if (!["open", "close", "reduce"].includes(decision.action)) {
      continue;
    }

    const guardedAmount = applyTradeGuards({
      requestedUsd: decision.notional_usd,
      bankrollUsd: overview.total_equity_usd,
      minTradeUsd: deps.config.minTradeUsd,
      maxTradePct: deps.config.maxTradePct,
      liquidityCapUsd: decision.notional_usd,
      totalExposureUsd: projectedTotalExposureUsd,
      maxTotalExposurePct: deps.config.maxTotalExposurePct,
      eventExposureUsd: eventExposureUsd.get(decision.event_slug) ?? 0,
      maxEventExposurePct: deps.config.maxEventExposurePct,
      openPositions: projectedOpenPositions,
      maxPositions: deps.config.maxPositions,
      edge: decision.edge
    });

    if (guardedAmount <= 0 && decision.action === "open") {
      continue;
    }

    const queuedNotional = decision.action === "open" ? guardedAmount : decision.notional_usd;
    const executableTrade = {
      decisionId: decisionIdMap.get(`${decision.market_slug}:${decision.action}`) ?? null,
      decision: {
        ...decision,
        notional_usd: queuedNotional
      }
    } satisfies ExecutableTradePlan;
    executableTrades.push(executableTrade);

    if (decision.action === "open") {
      projectedTotalExposureUsd += queuedNotional;
      projectedOpenPositions += 1;
      eventExposureUsd.set(
        decision.event_slug,
        (eventExposureUsd.get(decision.event_slug) ?? 0) + queuedNotional
      );
    }

    if (deps.queueStrategy !== "manual") {
      queuedTradeJobs.push(await queueTradeExecution({
        executionQueue: deps.executionQueue,
        runId: decisionSet.run_id,
        decisionId: executableTrade.decisionId,
        decision: executableTrade.decision
      }));
    }
  }

  return {
    skipped: false,
    runId: decisionSet.run_id,
    decisions: decisionSet.decisions.length,
    executableTrades,
    queuedTradeJobs
  };
}
