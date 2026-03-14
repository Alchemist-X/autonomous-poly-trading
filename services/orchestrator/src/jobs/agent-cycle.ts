import { randomUUID } from "node:crypto";
import { JOBS, QUEUES, tradeDecisionSetSchema, type TradeDecisionSet } from "@autopoly/contracts";
import {
  agentDecisions,
  agentRuns,
  artifacts,
  executionEvents,
  getDb,
  getOverview,
  getPublicPositions
} from "@autopoly/db";
import { Queue } from "bullmq";
import type { OrchestratorConfig } from "../config.js";
import { applyTradeGuards } from "../lib/risk.js";
import { getSystemStatus } from "../lib/state.js";
import { generatePulseSnapshot } from "../pulse/market-pulse.js";
import type { AgentRuntime } from "../runtime/agent-runtime.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";

function sanitizeDecisionSet(decisionSet: TradeDecisionSet): TradeDecisionSet {
  return tradeDecisionSetSchema.parse(decisionSet);
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

export async function runAgentCycle(deps: {
  runtime: AgentRuntime;
  executionQueue: Queue;
  config: OrchestratorConfig;
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

  const totalExposureUsd = positions.reduce((sum, position) => sum + position.current_value_usd, 0);

  for (const decision of decisionSet.decisions) {
    if (!["open", "close", "reduce"].includes(decision.action)) {
      continue;
    }

    const guardedAmount = applyTradeGuards({
      requestedUsd: decision.notional_usd,
      bankrollUsd: overview.total_equity_usd,
      maxTradePct: deps.config.maxTradePct,
      liquidityCapUsd: decision.notional_usd,
      totalExposureUsd,
      maxTotalExposurePct: deps.config.maxTotalExposurePct,
      openPositions: overview.open_positions,
      maxPositions: deps.config.maxPositions,
      edge: decision.edge
    });

    if (guardedAmount <= 0 && decision.action === "open") {
      continue;
    }

    const queuedNotional = decision.action === "open" ? guardedAmount : decision.notional_usd;

    await deps.executionQueue.add(
      JOBS.executeTrade,
      {
        runId: decisionSet.run_id,
        decisionId: decisionIdMap.get(`${decision.market_slug}:${decision.action}`),
        decision: {
          ...decision,
          notional_usd: queuedNotional
        }
      },
      {
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    const db = getDb();
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId: decisionSet.run_id,
      decisionId: decisionIdMap.get(`${decision.market_slug}:${decision.action}`) ?? null,
      marketSlug: decision.market_slug,
      tokenId: decision.token_id,
      side: decision.side,
      status: "submitted",
      requestedNotionalUsd: String(queuedNotional),
      filledNotionalUsd: "0",
      rawResponse: {
        queued: true,
        queue: QUEUES.execution
      }
    });
  }

  return {
    skipped: false,
    runId: decisionSet.run_id,
    decisions: decisionSet.decisions.length
  };
}
