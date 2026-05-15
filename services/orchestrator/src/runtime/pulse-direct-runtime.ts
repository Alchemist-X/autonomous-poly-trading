import type { Artifact, TradeDecisionSet } from "@autopoly/contracts";
import type { OrchestratorConfig } from "../config.js";
import { buildArtifactRelativePath, writeStoredArtifact } from "../lib/artifacts.js";
import { reviewCurrentPositions } from "../review/position-review.js";
import type { AgentRuntime, RuntimeExecutionContext, RuntimeExecutionResult } from "./agent-runtime.js";
import { composePulseDirectDecisions } from "./decision-composer.js";
import { buildPulseEntryPlans } from "./pulse-entry-planner.js";

function truncate(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 24)}\n\n... truncated ...\n`;
}

function summarizeReviewActions(results: RuntimeExecutionResult["positionReviews"] = []) {
  return results.reduce(
    (counts, review) => {
      counts[review.action] += 1;
      return counts;
    },
    { hold: 0, reduce: 0, close: 0 }
  );
}

async function buildRuntimeLogArtifact(input: {
  config: OrchestratorConfig;
  context: RuntimeExecutionContext;
  decisions: TradeDecisionSet["decisions"];
  reviewCount: number;
  entryCount: number;
  skippedEntryCount: number;
  positionResearchCount: number;
}) {
  const publishedAtUtc = new Date().toISOString();
  const relativePath = buildArtifactRelativePath({
    kind: "runtime-log",
    publishedAtUtc,
    runtime: "pulse-direct",
    mode: input.context.mode,
    runId: input.context.runId,
    extension: "md"
  });
  const content = truncate(
    [
      "# Pulse 直连决策日志",
      "",
      "## 流程",
      "",
      input.context.reviewPositionsOnly
        ? "1. 使用持仓专用 Pulse 解析已有仓位概率/edge"
        : "1. 使用 Pulse Entry Planner 解析新的开仓候选",
      "2. 使用独立 Position Review 模块复审已有仓位",
      input.context.reviewPositionsOnly
        ? "3. 只输出已有仓位复审动作，不合成新开仓建议"
        : "3. 使用 Decision Composer 合并 review + entries",
      "",
      "## 统计",
      "",
      `- 市场脉冲标题：${input.context.pulse.title}`,
      `- 市场脉冲候选数：${input.context.pulse.selectedCandidates}`,
      `- 当前持仓数：${input.context.positions.length}`,
      `- 独立持仓研究数：${input.positionResearchCount}`,
      `- 已有仓位复审数：${input.reviewCount}`,
      `- 开仓限制：最多 ${input.config.pulse.entryMaxPlans} 个${input.config.pulse.entryFixedNotionalUsd != null ? `；固定每单 $${input.config.pulse.entryFixedNotionalUsd}` : ""}`,
      `- ${input.context.reviewPositionsOnly ? "持仓概率复审计划数" : "新开仓候选数"}：${input.entryCount}`,
      `- 被去重跳过的新候选：${input.skippedEntryCount}`,
      `- 最终决策数：${input.decisions.length}`,
      "",
      "## 最终决策",
      "",
      "```json",
      JSON.stringify(input.decisions, null, 2),
      "```"
    ].join("\n"),
    input.config.pulse.maxMarkdownChars
  );

  await writeStoredArtifact(input.config.artifactStorageRoot, relativePath, content);
  return {
    kind: "runtime-log",
    title: `Pulse direct runtime log ${publishedAtUtc}`,
    path: relativePath,
    content,
    published_at_utc: publishedAtUtc
  } satisfies Artifact;
}

function buildFallbackSkipDecision(context: RuntimeExecutionContext): TradeDecisionSet["decisions"][number] | null {
  const candidate = context.pulse.candidates[0];
  if (!candidate) {
    return null;
  }
  return {
    action: "skip",
    event_slug: candidate.eventSlug,
    market_slug: candidate.marketSlug,
    token_id: candidate.clobTokenIds[0] ?? candidate.marketSlug,
    side: "BUY",
    notional_usd: 0.01,
    order_type: "FOK",
    ai_prob: candidate.outcomePrices[0] ?? 0.5,
    market_prob: candidate.outcomePrices[0] ?? 0.5,
    edge: 0,
    confidence: "low",
    thesis_md: "Pulse direct runtime could not produce any executable portfolio review or entry decision from the current pulse set.",
    sources: [
      {
        title: "Pulse market source",
        url: candidate.url,
        retrieved_at_utc: context.pulse.generatedAtUtc
      }
    ],
    stop_loss_pct: 0,
    resolution_track_required: false
  };
}

export class PulseDirectRuntime implements AgentRuntime {
  readonly name = "pulse-direct-runtime";

  constructor(private readonly config: OrchestratorConfig) {}

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const entryPlans = buildPulseEntryPlans({
      context,
      positionStopLossPct: this.config.positionStopLossPct,
      maxPlans: this.config.pulse.entryMaxPlans,
      fixedNotionalUsd: this.config.pulse.entryFixedNotionalUsd
    });
    const positionReviews = reviewCurrentPositions({
      context,
      entryPlans,
      positionResearch: context.positionResearch ?? []
    });
    const composition = context.reviewPositionsOnly
      ? {
          decisions: positionReviews.map((review) => review.decision),
          skippedEntries: []
        }
      : composePulseDirectDecisions({
          reviewResults: positionReviews,
          entryPlans
        });
    const reviewActionCounts = summarizeReviewActions(positionReviews);
    const reportEntryPlans = context.reviewPositionsOnly ? [] : entryPlans;

    const decisions = composition.decisions.length > 0
      ? composition.decisions
      : (() => {
          const fallback = buildFallbackSkipDecision(context);
          return fallback ? [fallback] : [];
        })();

    const runtimeLogArtifact = await buildRuntimeLogArtifact({
      config: this.config,
      context,
      decisions,
      reviewCount: positionReviews.length,
      entryCount: entryPlans.length,
      skippedEntryCount: composition.skippedEntries.length,
      positionResearchCount: context.positionResearch?.length ?? 0
    });
    const pulseArtifact: Artifact = {
      kind: "pulse-report",
      title: context.pulse.title,
      path: context.pulse.relativeMarkdownPath,
      content: context.pulse.markdown,
      published_at_utc: context.pulse.generatedAtUtc
    };

    return {
      decisionSet: {
        run_id: context.runId,
        runtime: this.name,
        generated_at_utc: new Date().toISOString(),
        bankroll_usd: context.overview.total_equity_usd,
        mode: context.mode,
        decisions,
        artifacts: [pulseArtifact, runtimeLogArtifact]
      },
      promptSummary: context.reviewPositionsOnly
        ? "Pulse direct runtime used a position-only Pulse probability refresh and emitted existing-position review decisions only."
        : "Pulse direct runtime used a standalone Position Review module plus a Pulse Entry Planner, then merged both outputs into one decision set.",
      reasoningMd: [
        "决策策略：pulse-direct",
        context.reviewPositionsOnly
          ? "结构：Position-only Pulse + Position Review（不扫描新市场，不合成新开仓）"
          : "结构：Position Review + Pulse Entry Planner + Decision Composer",
        `市场脉冲可交易：${context.pulse.tradeable ? "是" : "否"}`,
        `独立持仓研究数：${context.positionResearch?.length ?? 0}`,
        `已有仓位复审数：${positionReviews.length}`,
        `已有仓位复审动作：hold ${reviewActionCounts.hold} / reduce ${reviewActionCounts.reduce} / close ${reviewActionCounts.close}`,
        `开仓限制：最多 ${this.config.pulse.entryMaxPlans} 个${this.config.pulse.entryFixedNotionalUsd != null ? `；固定每单 $${this.config.pulse.entryFixedNotionalUsd}` : ""}`,
        `${context.reviewPositionsOnly ? "Pulse 持仓概率复审计划数" : "Pulse 开仓候选数"}：${entryPlans.length}`,
        `被去重跳过的开仓候选数：${composition.skippedEntries.length}`,
        `最终决策数：${decisions.length}`
      ].join("\n"),
      logsMd: JSON.stringify({
        positionReviews,
        positionResearch: context.positionResearch ?? [],
        entryPlans: reportEntryPlans,
        positionReviewPulsePlans: context.reviewPositionsOnly ? entryPlans : [],
        skippedEntries: composition.skippedEntries,
        decisions
      }, null, 2),
      positionReviews,
      entryPlans: reportEntryPlans
    };
  }
}
