import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type OverviewResponse,
  type PublicPosition,
  type TradeDecision,
  type TradeDecisionSet
} from "@autopoly/contracts";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { PositionReviewResult } from "./decision-metadata.js";

export type EvaluatorType =
  | "reasoning-quality"
  | "decision-quality"
  | "process-completeness"
  | "execution-feasibility"
  | "post-training-data";

export type EvaluatorScore = 1 | 2 | 3 | 4 | 5;
export type CriticalStateStatus = "verified" | "stale" | "conflict" | "missing";
export type ExecutionGateMode = "live";
export type ExecutionGateDecision = "execute" | "skip" | "blocked" | "diagnostic";

export interface AgentContextPack {
  runId: string;
  generatedAtUtc: string;
  mode: string;
  status: OverviewResponse["status"];
  bankrollUsd: number;
  openPositions: number;
  drawdownPct: number;
  pulse: {
    id: string;
    title: string;
    generatedAtUtc: string;
    selectedCandidates: number;
    tradeable: boolean;
    riskFlags: string[];
  };
  positions: Array<{
    id: string;
    marketSlug: string;
    tokenId: string;
    outcomeLabel: string;
    size: number;
    avgCost: number;
    currentPrice: number;
    currentValueUsd: number;
    unrealizedPnlPct: number;
    stopLossPct: number;
  }>;
  nextRunChecklist: string[];
}

export interface PositionReviewArtifact {
  runId: string;
  generatedAtUtc: string;
  positionsReviewed: number;
  missingPositionReviewTokenIds: string[];
  reviews: Array<{
    tokenId: string;
    marketSlug: string;
    action: PositionReviewResult["action"] | "missing";
    stillHasEdge: boolean | null;
    edgeValue: number | null;
    pulseCoverage: PositionReviewResult["pulseCoverage"] | "missing";
    reason: string;
    reviewConclusion: string;
  }>;
}

export interface SourceResolutionAudit {
  runId: string;
  generatedAtUtc: string;
  decisionsAudited: number;
  rows: Array<{
    marketSlug: string;
    tokenId: string;
    action: TradeDecision["action"];
    sourceCount: number;
    externalSourceCount: number;
    hasResolutionTracking: boolean;
    processStatus: CriticalStateStatus;
    notes: string[];
  }>;
}

export interface EvaluatorFinding {
  id: string;
  type: EvaluatorType;
  score: EvaluatorScore;
  title: string;
  detail: string;
  requiredResponse: string;
  relatedMarketSlug?: string;
  relatedTokenId?: string;
}

export interface EvaluatorReport {
  runId: string;
  generatedAtUtc: string;
  overallScore: EvaluatorScore;
  scoreCounts: Record<EvaluatorScore, number>;
  findings: EvaluatorFinding[];
  summary: string;
}

export interface FeedbackInjection {
  runId: string;
  generatedAtUtc: string;
  markdown: string;
  requiredFindingIds: string[];
}

export interface ExecutionGateResult {
  runId: string;
  generatedAtUtc: string;
  mode: ExecutionGateMode;
  decision: ExecutionGateDecision;
  hardBlockReasons: string[];
  softFeedbackCount: number;
  criticalState: Record<string, CriticalStateStatus>;
}

export interface ExecutionDispatchPlan {
  runId: string;
  generatedAtUtc: string;
  mode: ExecutionGateMode;
  readyToBroadcast: boolean;
  orders: Array<{
    marketSlug: string;
    tokenId: string;
    action: TradeDecision["action"];
    side: TradeDecision["side"];
    requestedNotionalUsd: number;
    dispatchStatus: "ready" | "skipped" | "blocked";
    blockReason: string | null;
  }>;
}

export interface LoopMetrics {
  runId: string;
  generatedAtUtc: string;
  analysisCompletenessScore: number;
  feedbackResponseScore: number;
  decisionStability: number;
  riskAlignment: number;
  positionReviewQuality: number;
  processCompletenessScore: number;
  artifactQuality: number;
  operatorInterventionNeeded: boolean;
}

export interface RavenAgentIterationArtifacts {
  contextPack: AgentContextPack;
  positionReview: PositionReviewArtifact;
  sourceResolutionAudit: SourceResolutionAudit;
  initialDecision: TradeDecisionSet;
  evaluatorReport: EvaluatorReport;
  feedbackInjection: FeedbackInjection;
  revisedDecision: TradeDecisionSet;
  executionGate: ExecutionGateResult;
  executionDispatchPlan: ExecutionDispatchPlan;
  loopMetrics: LoopMetrics;
  runSummaryMarkdown: string;
  transcriptSummaryMarkdown: string;
}

function nowIso() {
  return new Date().toISOString();
}

function clampScore(value: number): EvaluatorScore {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;
  return 5;
}

function isExternalSource(url: string) {
  return /^https?:\/\//i.test(url);
}

function finding(input: Omit<EvaluatorFinding, "id">, index: number): EvaluatorFinding {
  return {
    id: `finding-${String(index + 1).padStart(2, "0")}`,
    ...input
  };
}

export function buildAgentContextPack(input: {
  runId: string;
  mode: string;
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
  nextRunChecklist?: string[];
  generatedAtUtc?: string;
}): AgentContextPack {
  return {
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc ?? nowIso(),
    mode: input.mode,
    status: input.overview.status,
    bankrollUsd: input.overview.total_equity_usd,
    openPositions: input.overview.open_positions,
    drawdownPct: input.overview.drawdown_pct,
    pulse: {
      id: input.pulse.id,
      title: input.pulse.title,
      generatedAtUtc: input.pulse.generatedAtUtc,
      selectedCandidates: input.pulse.selectedCandidates,
      tradeable: input.pulse.tradeable,
      riskFlags: input.pulse.riskFlags
    },
    positions: input.positions.map((position) => ({
      id: position.id,
      marketSlug: position.market_slug,
      tokenId: position.token_id,
      outcomeLabel: position.outcome_label,
      size: position.size,
      avgCost: position.avg_cost,
      currentPrice: position.current_price,
      currentValueUsd: position.current_value_usd,
      unrealizedPnlPct: position.unrealized_pnl_pct,
      stopLossPct: position.stop_loss_pct
    })),
    nextRunChecklist: input.nextRunChecklist ?? []
  };
}

export function buildPositionReviewArtifact(input: {
  runId: string;
  positions: PublicPosition[];
  positionReviews?: PositionReviewResult[];
  generatedAtUtc?: string;
}): PositionReviewArtifact {
  const reviewByToken = new Map((input.positionReviews ?? []).map((review) => [review.position.token_id, review]));
  const missingPositionReviewTokenIds = input.positions
    .filter((position) => !reviewByToken.has(position.token_id))
    .map((position) => position.token_id);

  return {
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc ?? nowIso(),
    positionsReviewed: input.positionReviews?.length ?? 0,
    missingPositionReviewTokenIds,
    reviews: input.positions.map((position) => {
      const review = reviewByToken.get(position.token_id);
      if (!review) {
        return {
          tokenId: position.token_id,
          marketSlug: position.market_slug,
          action: "missing",
          stillHasEdge: null,
          edgeValue: null,
          pulseCoverage: "missing",
          reason: "No position review was produced for this open position.",
          reviewConclusion: "Raven Agent must review this position before live execution."
        };
      }
      return {
        tokenId: position.token_id,
        marketSlug: position.market_slug,
        action: review.action,
        stillHasEdge: review.stillHasEdge,
        edgeValue: review.edgeValue,
        pulseCoverage: review.pulseCoverage,
        reason: review.reason,
        reviewConclusion: review.reviewConclusion
      };
    })
  };
}

export function buildSourceResolutionAudit(input: {
  runId: string;
  decisionSet: TradeDecisionSet;
  generatedAtUtc?: string;
}): SourceResolutionAudit {
  return {
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc ?? nowIso(),
    decisionsAudited: input.decisionSet.decisions.length,
    rows: input.decisionSet.decisions.map((decision) => {
      const externalSourceCount = decision.sources.filter((source) => isExternalSource(source.url)).length;
      const notes: string[] = [];
      if (decision.sources.length === 0) {
        notes.push("No sources attached.");
      }
      if (externalSourceCount === 0) {
        notes.push("No external source attached.");
      }
      if (decision.resolution_track_required && externalSourceCount === 0) {
        notes.push("Resolution tracking is required but no external source is available.");
      }
      return {
        marketSlug: decision.market_slug,
        tokenId: decision.token_id,
        action: decision.action,
        sourceCount: decision.sources.length,
        externalSourceCount,
        hasResolutionTracking: decision.resolution_track_required,
        processStatus: notes.length > 0 ? "missing" : "verified",
        notes
      };
    })
  };
}

export function evaluateRavenAgentIteration(input: {
  contextPack: AgentContextPack;
  positionReview: PositionReviewArtifact;
  sourceResolutionAudit: SourceResolutionAudit;
  decisionSet: TradeDecisionSet;
}): EvaluatorReport {
  const findings: Array<Omit<EvaluatorFinding, "id">> = [];

  if (input.contextPack.status !== "running") {
    findings.push({
      type: "execution-feasibility",
      score: 5,
      title: "System is not running",
      detail: `System status is ${input.contextPack.status}; live-money opens must not proceed.`,
      requiredResponse: "Explain the paused/halted state and switch to diagnostic mode until the system is explicitly resumed."
    });
  }

  if (!input.contextPack.pulse.tradeable || input.contextPack.pulse.riskFlags.length > 0) {
    findings.push({
      type: "process-completeness",
      score: 5,
      title: "Pulse is not live-tradeable",
      detail: `Pulse risk flags: ${input.contextPack.pulse.riskFlags.join(", ") || "tradeable=false"}.`,
      requiredResponse: "Do not open new live positions until pulse freshness and candidate quality are verified."
    });
  }

  for (const tokenId of input.positionReview.missingPositionReviewTokenIds) {
    findings.push({
      type: "process-completeness",
      score: 4,
      title: "Open position was not reviewed",
      detail: `Open position ${tokenId} has no hold/reduce/close/wait-resolution review.`,
      requiredResponse: "Review this position with current edge, resolution source, order book, PnL, and sell rationale.",
      relatedTokenId: tokenId
    });
  }

  for (const review of input.positionReview.reviews) {
    if (review.action === "hold" && review.edgeValue != null && review.edgeValue <= 0) {
      findings.push({
        type: "decision-quality",
        score: 4,
        title: "Hold decision has no positive edge",
        detail: `${review.marketSlug} is marked hold while edge is ${review.edgeValue}.`,
        requiredResponse: "Explain why this is not reduce/close, or revise the decision.",
        relatedMarketSlug: review.marketSlug,
        relatedTokenId: review.tokenId
      });
    }
    if (review.action === "hold" && review.pulseCoverage === "none") {
      findings.push({
        type: "process-completeness",
        score: 3,
        title: "Hold decision lacks fresh pulse coverage",
        detail: `${review.marketSlug} is held without fresh pulse coverage.`,
        requiredResponse: "Find the correct resolution/source context or explain why holding is still justified.",
        relatedMarketSlug: review.marketSlug,
        relatedTokenId: review.tokenId
      });
    }
  }

  for (const row of input.sourceResolutionAudit.rows) {
    if (row.processStatus !== "verified") {
      findings.push({
        type: "process-completeness",
        score: row.hasResolutionTracking ? 4 : 3,
        title: "Source or resolution audit is incomplete",
        detail: `${row.marketSlug}: ${row.notes.join(" ")}`,
        requiredResponse: "Use Query Code or source lookup to attach a current external source, or downgrade the decision.",
        relatedMarketSlug: row.marketSlug,
        relatedTokenId: row.tokenId
      });
    }
  }

  for (const decision of input.decisionSet.decisions) {
    if (decision.thesis_md.trim().length < 80 && decision.action !== "skip") {
      findings.push({
        type: "reasoning-quality",
        score: 3,
        title: "Decision thesis is too thin",
        detail: `${decision.market_slug} thesis has only ${decision.thesis_md.trim().length} characters.`,
        requiredResponse: "Add thesis, counter-evidence, probability gap, and why the current action is better than hold.",
        relatedMarketSlug: decision.market_slug,
        relatedTokenId: decision.token_id
      });
    }
    if (
      decision.action === "open" &&
      decision.liquidity_cap_usd != null &&
      decision.notional_usd > decision.liquidity_cap_usd
    ) {
      findings.push({
        type: "execution-feasibility",
        score: 4,
        title: "Open notional exceeds liquidity cap",
        detail: `${decision.market_slug} requests $${decision.notional_usd} while cap is $${decision.liquidity_cap_usd}.`,
        requiredResponse: "Revise size below liquidity cap before execution.",
        relatedMarketSlug: decision.market_slug,
        relatedTokenId: decision.token_id
      });
    }
  }

  if (input.decisionSet.decisions.length === 0) {
    findings.push({
      type: "post-training-data",
      score: 4,
      title: "No decision output",
      detail: "Raven Agent produced no decisions, leaving no trainable decision trajectory.",
      requiredResponse: "Produce at least one hold/skip decision with reasoning and sources."
    });
  }

  const indexedFindings = findings.map((item, index) => finding(item, index));
  const scoreCounts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  } satisfies Record<EvaluatorScore, number>;
  for (const item of indexedFindings) {
    scoreCounts[item.score] += 1;
  }
  const overallScore = clampScore(Math.max(1, ...indexedFindings.map((item) => item.score)));

  return {
    runId: input.contextPack.runId,
    generatedAtUtc: nowIso(),
    overallScore,
    scoreCounts,
    findings: indexedFindings,
    summary: indexedFindings.length === 0
      ? "Evaluator passed: no findings above score 1."
      : `Evaluator produced ${indexedFindings.length} finding(s); max score ${overallScore}.`
  };
}

export function buildFeedbackInjection(input: {
  runId: string;
  evaluatorReport: EvaluatorReport;
  generatedAtUtc?: string;
}): FeedbackInjection {
  const requiredFindings = input.evaluatorReport.findings.filter((finding) => finding.score >= 3);
  const markdown = [
    "# Raven Agent Feedback Injection",
    "",
    `Run ID: ${input.runId}`,
    `Generated: ${input.generatedAtUtc ?? nowIso()}`,
    "",
    requiredFindings.length === 0
      ? "Evaluator found no item that requires a response. Continue, but keep the checklist visible."
      : "Raven Agent must respond to each item below before the revised decision is accepted.",
    "",
    ...requiredFindings.flatMap((finding) => [
      `## ${finding.id} · score ${finding.score} · ${finding.title}`,
      "",
      finding.detail,
      "",
      `Required response: ${finding.requiredResponse}`,
      ""
    ])
  ].join("\n");

  return {
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc ?? nowIso(),
    markdown,
    requiredFindingIds: requiredFindings.map((finding) => finding.id)
  };
}

export function buildExecutionGateResult(input: {
  runId: string;
  mode: ExecutionGateMode;
  contextPack: AgentContextPack;
  evaluatorReport: EvaluatorReport;
  criticalState?: Record<string, CriticalStateStatus>;
  generatedAtUtc?: string;
}): ExecutionGateResult {
  const criticalState = input.criticalState ?? {
    wallet: "verified",
    positions: "verified",
    pulse: input.contextPack.pulse.tradeable ? "verified" : "stale",
    orderBook: "verified",
    resolutionSources: input.evaluatorReport.findings.some((finding) => finding.type === "process-completeness" && finding.score >= 4)
      ? "missing"
      : "verified"
  };
  const hardBlockReasons = input.evaluatorReport.findings
    .filter((finding) => finding.score >= 5)
    .map((finding) => `${finding.id}: ${finding.title}`);
  for (const [key, status] of Object.entries(criticalState)) {
    if (status === "conflict" || status === "missing") {
      hardBlockReasons.push(`critical-state:${key}:${status}`);
    }
  }

  return {
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc ?? nowIso(),
    mode: input.mode,
    decision: hardBlockReasons.length > 0
      ? "diagnostic"
      : "execute",
    hardBlockReasons,
    softFeedbackCount: input.evaluatorReport.findings.filter((finding) => finding.score >= 2 && finding.score < 5).length,
    criticalState
  };
}

export function buildExecutionDispatchPlan(input: {
  runId: string;
  decisions: TradeDecision[];
  executionGate: ExecutionGateResult;
  generatedAtUtc?: string;
}): ExecutionDispatchPlan {
  const timestamp = input.generatedAtUtc ?? nowIso();
  const readyToBroadcast = input.executionGate.decision === "execute" && input.executionGate.hardBlockReasons.length === 0;
  return {
    runId: input.runId,
    generatedAtUtc: timestamp,
    mode: "live",
    readyToBroadcast,
    orders: input.decisions.map((decision) => {
      if (decision.action === "hold" || decision.action === "skip") {
        return {
          marketSlug: decision.market_slug,
          tokenId: decision.token_id,
          action: decision.action,
          side: decision.side,
          requestedNotionalUsd: decision.notional_usd,
          dispatchStatus: "skipped",
          blockReason: `No live order dispatch for ${decision.action}.`
        };
      }
      return {
        marketSlug: decision.market_slug,
        tokenId: decision.token_id,
        action: decision.action,
        side: decision.side,
        requestedNotionalUsd: decision.notional_usd,
        dispatchStatus: readyToBroadcast ? "ready" : "blocked",
        blockReason: readyToBroadcast ? null : input.executionGate.hardBlockReasons.join("; ") || "execution gate did not allow dispatch"
      };
    })
  };
}

export function buildLoopMetrics(input: {
  runId: string;
  evaluatorReport: EvaluatorReport;
  positionReview: PositionReviewArtifact;
  sourceResolutionAudit: SourceResolutionAudit;
  generatedAtUtc?: string;
}): LoopMetrics {
  const missingReviews = input.positionReview.missingPositionReviewTokenIds.length;
  const incompleteSources = input.sourceResolutionAudit.rows.filter((row) => row.processStatus !== "verified").length;
  const maxScore = input.evaluatorReport.overallScore;
  return {
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc ?? nowIso(),
    analysisCompletenessScore: Math.max(1, 6 - maxScore),
    feedbackResponseScore: input.evaluatorReport.findings.length === 0 ? 5 : 3,
    decisionStability: 3,
    riskAlignment: input.evaluatorReport.findings.some((finding) => finding.type === "execution-feasibility" && finding.score >= 4) ? 2 : 4,
    positionReviewQuality: missingReviews === 0 ? 5 : 2,
    processCompletenessScore: incompleteSources === 0 ? 5 : 3,
    artifactQuality: 4,
    operatorInterventionNeeded: maxScore >= 5 || missingReviews > 0
  };
}

export function buildRunSummaryMarkdown(input: {
  contextPack: AgentContextPack;
  evaluatorReport: EvaluatorReport;
  executionGate: ExecutionGateResult;
  executionDispatchPlan: ExecutionDispatchPlan;
}) {
  return [
    "# Raven Agent Run Summary",
    "",
    `- Run ID: ${input.contextPack.runId}`,
    `- Mode: ${input.executionGate.mode}`,
    `- Gate decision: ${input.executionGate.decision}`,
    `- Open positions: ${input.contextPack.openPositions}`,
    `- Evaluator max score: ${input.evaluatorReport.overallScore}`,
    `- Feedback items: ${input.evaluatorReport.findings.length}`,
    `- Dispatch-ready orders: ${input.executionDispatchPlan.orders.filter((order) => order.dispatchStatus === "ready").length}`,
    "",
    "## Hard Block Reasons",
    "",
    input.executionGate.hardBlockReasons.length > 0
      ? input.executionGate.hardBlockReasons.map((reason) => `- ${reason}`).join("\n")
      : "- none",
    "",
    "## Evaluator Findings",
    "",
    input.evaluatorReport.findings.length > 0
      ? input.evaluatorReport.findings.map((finding) => `- score ${finding.score}: ${finding.title}`).join("\n")
      : "- none"
  ].join("\n");
}

export function buildTranscriptSummaryMarkdown(input: {
  evaluatorReport: EvaluatorReport;
  feedbackInjection: FeedbackInjection;
}) {
  return [
    "# Raven Agent Transcript Summary",
    "",
    "This first implementation stores the machine-readable decision artifacts and the feedback prompt that should be injected into the Raven Agent conversation.",
    "",
    "## Feedback Required",
    "",
    input.feedbackInjection.requiredFindingIds.length > 0
      ? input.feedbackInjection.requiredFindingIds.map((id) => `- ${id}`).join("\n")
      : "- none",
    "",
    "## Evaluator Summary",
    "",
    input.evaluatorReport.summary
  ].join("\n");
}

export function buildRavenAgentIterationArtifacts(input: {
  contextPack: AgentContextPack;
  decisionSet: TradeDecisionSet;
  positions: PublicPosition[];
  positionReviews?: PositionReviewResult[];
  mode?: ExecutionGateMode;
}): RavenAgentIterationArtifacts {
  const positionReview = buildPositionReviewArtifact({
    runId: input.contextPack.runId,
    positions: input.positions,
    positionReviews: input.positionReviews
  });
  const sourceResolutionAudit = buildSourceResolutionAudit({
    runId: input.contextPack.runId,
    decisionSet: input.decisionSet
  });
  const evaluatorReport = evaluateRavenAgentIteration({
    contextPack: input.contextPack,
    positionReview,
    sourceResolutionAudit,
    decisionSet: input.decisionSet
  });
  const feedbackInjection = buildFeedbackInjection({
    runId: input.contextPack.runId,
    evaluatorReport
  });
  const revisedDecision = input.decisionSet;
  const executionGate = buildExecutionGateResult({
    runId: input.contextPack.runId,
    mode: input.mode ?? "live",
    contextPack: input.contextPack,
    evaluatorReport
  });
  const executionDispatchPlan = buildExecutionDispatchPlan({
    runId: input.contextPack.runId,
    decisions: revisedDecision.decisions,
    executionGate
  });
  const loopMetrics = buildLoopMetrics({
    runId: input.contextPack.runId,
    evaluatorReport,
    positionReview,
    sourceResolutionAudit
  });
  return {
    contextPack: input.contextPack,
    positionReview,
    sourceResolutionAudit,
    initialDecision: input.decisionSet,
    evaluatorReport,
    feedbackInjection,
    revisedDecision,
    executionGate,
    executionDispatchPlan,
    loopMetrics,
    runSummaryMarkdown: buildRunSummaryMarkdown({
      contextPack: input.contextPack,
      evaluatorReport,
      executionGate,
      executionDispatchPlan
    }),
    transcriptSummaryMarkdown: buildTranscriptSummaryMarkdown({
      evaluatorReport,
      feedbackInjection
    })
  };
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function writeRavenAgentIterationArtifacts(input: {
  archiveDir: string;
  artifacts: RavenAgentIterationArtifacts;
}) {
  await mkdir(input.archiveDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(input.archiveDir, "context-pack.json"), input.artifacts.contextPack),
    writeJson(path.join(input.archiveDir, "position-review.json"), input.artifacts.positionReview),
    writeJson(path.join(input.archiveDir, "source-resolution-audit.json"), input.artifacts.sourceResolutionAudit),
    writeJson(path.join(input.archiveDir, "initial-decision.json"), input.artifacts.initialDecision),
    writeJson(path.join(input.archiveDir, "evaluator-report.json"), input.artifacts.evaluatorReport),
    writeFile(path.join(input.archiveDir, "feedback-injection.md"), input.artifacts.feedbackInjection.markdown, "utf8"),
    writeJson(path.join(input.archiveDir, "revised-decision.json"), input.artifacts.revisedDecision),
    writeJson(path.join(input.archiveDir, "execution-gate.json"), input.artifacts.executionGate),
    writeJson(path.join(input.archiveDir, "execution-dispatch-plan.json"), input.artifacts.executionDispatchPlan),
    writeJson(path.join(input.archiveDir, "loop-metrics.json"), input.artifacts.loopMetrics),
    writeFile(path.join(input.archiveDir, "run-summary.md"), input.artifacts.runSummaryMarkdown, "utf8"),
    writeFile(path.join(input.archiveDir, "transcript-summary.md"), input.artifacts.transcriptSummaryMarkdown, "utf8")
  ]);
}
