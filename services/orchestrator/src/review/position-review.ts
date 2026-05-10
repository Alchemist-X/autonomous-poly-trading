import type {
  PublicPosition,
  TradeDecision
} from "@autopoly/contracts";
import { inferPaperSellAmount } from "@autopoly/contracts";
import type { RuntimeExecutionContext } from "../runtime/agent-runtime.js";
import type {
  PositionResearchSnapshot,
  PositionReviewResult,
  PulseEntryPlan
} from "../runtime/decision-metadata.js";

const STRONG_EDGE_THRESHOLD = 0.05;
const NEGATIVE_EDGE_CLOSE_THRESHOLD = -0.05;
const NEAR_STOP_LOSS_RATIO = 0.7;

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function roundExecutionAmount(value: number): number {
  return Number(value.toFixed(6));
}

function clampNotional(value: number, max: number): number {
  return Math.max(0.01, Math.min(max, roundCurrency(value)));
}

function buildPositionSource(position: PublicPosition): TradeDecision["sources"][number] {
  return {
    title: "Current position context",
    url: `runtime-context://positions/${position.id}`,
    retrieved_at_utc: new Date().toISOString()
  };
}

function buildPositionPnlSnapshot(position: PublicPosition): PositionReviewResult["pnlSnapshot"] {
  return {
    currentValueUsd: roundCurrency(position.current_value_usd),
    avgCost: roundCurrency(position.avg_cost),
    currentPrice: roundCurrency(position.current_price),
    unrealizedPnlPct: roundCurrency(position.unrealized_pnl_pct),
    stopLossPct: roundCurrency(position.stop_loss_pct)
  };
}

function buildPnlEvidenceLine(position: PublicPosition): string {
  return `Fresh mark snapshot: current price ${position.current_price.toFixed(4)}, average cost ${position.avg_cost.toFixed(4)}, unrealized PnL ${(position.unrealized_pnl_pct * 100).toFixed(2)}%, marked value $${position.current_value_usd.toFixed(2)}.`;
}

function buildDefaultStopOrReduceTriggers(position: PublicPosition): string[] {
  return [
    `Close if unrealized PnL breaches configured stop-loss (${(position.stop_loss_pct * 100).toFixed(1)}%).`,
    `Reduce if unrealized PnL reaches ${(position.stop_loss_pct * NEAR_STOP_LOSS_RATIO * 100).toFixed(1)}% drawdown without fresh supporting evidence.`,
    "Require a fresh evidence refresh before upgrading this position back to active edge."
  ];
}

function buildResearchEvidence(position: PublicPosition, research: PositionResearchSnapshot): string[] {
  return [
    buildPnlEvidenceLine(position),
    ...research.freshEvidence,
    ...(research.unresolvedData.length > 0
      ? [`Research gaps: ${research.unresolvedData.join("; ")}`]
      : [])
  ];
}

function buildResearchSources(
  position: PublicPosition,
  research: PositionResearchSnapshot | null
): TradeDecision["sources"] {
  if (!research) {
    return [buildPositionSource(position)];
  }
  const sources = [buildPositionSource(position)];
  for (const source of research.sources) {
    if (!sources.some((item) => item.title === source.title && item.url === source.url)) {
      sources.push(source);
    }
  }
  return sources;
}

function buildHeldOutcomeProbabilities(position: PublicPosition, plan: PulseEntryPlan | null) {
  if (!plan) {
    return {
      aiProb: position.current_price,
      marketProb: position.current_price
    };
  }

  const sameOutcome = plan.outcomeLabel.toLowerCase() === position.outcome_label.toLowerCase();
  return sameOutcome
    ? {
        aiProb: plan.aiProb,
        marketProb: plan.marketProb
      }
    : {
        aiProb: 1 - plan.aiProb,
        marketProb: 1 - plan.marketProb
      };
}

function buildDecision(input: {
  position: PublicPosition;
  action: PositionReviewResult["action"];
  side: TradeDecision["side"];
  aiProb: number;
  marketProb: number;
  confidence: TradeDecision["confidence"];
  thesisMd: string;
  sources: TradeDecision["sources"];
  notionalUsd?: number;
}): TradeDecision {
  const positionValueUsd = roundCurrency(input.position.current_value_usd);
  const notionalUsd = clampNotional(input.notionalUsd ?? input.position.current_value_usd, input.position.current_value_usd);
  const executionAmount = inferPaperSellAmount(input.position, {
    action: input.action,
    notional_usd: notionalUsd
  });
  const shouldDescribeExecution = input.side === "SELL" && input.action !== "hold";

  return {
    action: input.action,
    event_slug: input.position.event_slug,
    market_slug: input.position.market_slug,
    token_id: input.position.token_id,
    outcome_label: input.position.outcome_label,
    side: input.side,
    notional_usd: notionalUsd,
    order_type: "FOK",
    ai_prob: input.aiProb,
    market_prob: input.marketProb,
    edge: roundCurrency(input.aiProb - input.marketProb),
    confidence: input.confidence,
    thesis_md: input.thesisMd,
    sources: input.sources,
    position_value_usd: shouldDescribeExecution ? positionValueUsd : undefined,
    execution_amount: shouldDescribeExecution && executionAmount > 0 ? roundExecutionAmount(executionAmount) : undefined,
    execution_unit: shouldDescribeExecution && executionAmount > 0 ? "shares" : undefined,
    stop_loss_pct: input.position.stop_loss_pct,
    resolution_track_required: true
  };
}

function findRelevantPulsePlan(position: PublicPosition, plans: PulseEntryPlan[]) {
  const relevant = plans.filter(
    (plan) => plan.marketSlug === position.market_slug || plan.eventSlug === position.event_slug
  );
  const matching = relevant.find((plan) => plan.tokenId === position.token_id);
  const opposing = relevant.find((plan) => plan.tokenId !== position.token_id);
  return {
    matching: matching ?? null,
    opposing: opposing ?? null
  };
}

function findPositionResearch(
  position: PublicPosition,
  research: PositionResearchSnapshot[]
): PositionResearchSnapshot | null {
  return research.find((item) => item.tokenId === position.token_id)
    ?? research.find((item) =>
      item.marketSlug === position.market_slug &&
      item.outcomeLabel.toLowerCase() === position.outcome_label.toLowerCase()
    )
    ?? research.find((item) => item.eventSlug === position.event_slug)
    ?? null;
}

function calculateReduceNotional(position: PublicPosition): number {
  return clampNotional(Math.max(position.current_value_usd / 2, 0.01), position.current_value_usd);
}

function classifyMatchingPlan(input: {
  position: PublicPosition;
  matching: PulseEntryPlan;
}): Pick<
  PositionReviewResult,
  | "action"
  | "stillHasEdge"
  | "edgeAssessment"
  | "edgeValue"
  | "pulseCoverage"
  | "evidenceRefreshStatus"
  | "freshEvidence"
  | "adverseSignals"
  | "stopOrReduceTriggers"
  | "pnlSnapshot"
  | "humanReviewFlag"
  | "confidence"
  | "reason"
  | "reviewConclusion"
  | "suggestedExitPct"
  | "basis"
> & {
  aiProb: number;
  marketProb: number;
  thesisMd: string;
  sources: TradeDecision["sources"];
  side: TradeDecision["side"];
  notionalUsd?: number;
} {
  const heldOutcome = buildHeldOutcomeProbabilities(input.position, input.matching);
  const edgeValue = roundCurrency(heldOutcome.aiProb - heldOutcome.marketProb);
  const refreshedEvidence = [
    buildPnlEvidenceLine(input.position),
    `Pulse refreshed the held ${input.position.outcome_label} outcome: AI probability ${heldOutcome.aiProb.toFixed(4)} vs market ${heldOutcome.marketProb.toFixed(4)}.`
  ];
  const defaultTriggers = buildDefaultStopOrReduceTriggers(input.position);

  if (edgeValue <= NEGATIVE_EDGE_CLOSE_THRESHOLD) {
    return {
      action: "close",
      stillHasEdge: false,
      edgeAssessment: "no",
      edgeValue,
      pulseCoverage: "supporting",
      evidenceRefreshStatus: "fresh-supporting",
      freshEvidence: refreshedEvidence,
      adverseSignals: [
        `Refreshed edge is materially negative (${edgeValue.toFixed(4)}), below close threshold ${NEGATIVE_EDGE_CLOSE_THRESHOLD.toFixed(4)}.`
      ],
      stopOrReduceTriggers: ["Close now because refreshed edge is below the negative-edge close threshold."],
      pnlSnapshot: buildPositionPnlSnapshot(input.position),
      humanReviewFlag: true,
      confidence: input.matching.confidence,
      reason: `Pulse still covers the current ${input.position.outcome_label} side, but the refreshed edge turned materially negative (${edgeValue.toFixed(4)}).`,
      reviewConclusion: `Close the position because the refreshed Pulse view no longer justifies paying the current market price for ${input.position.outcome_label}.`,
      suggestedExitPct: 1,
      basis: "pulse-supports-current-negative-edge",
      aiProb: heldOutcome.aiProb,
      marketProb: heldOutcome.marketProb,
      thesisMd: `Pulse still references the current ${input.position.outcome_label} thesis, but the refreshed probability no longer clears market pricing. Exit instead of carrying a negative edge. ${input.matching.thesisMd}`,
      sources: [buildPositionSource(input.position), ...input.matching.sources],
      side: "SELL"
    };
  }

  if (edgeValue < 0) {
    return {
      action: "reduce",
      stillHasEdge: false,
      edgeAssessment: "no",
      edgeValue,
      pulseCoverage: "supporting",
      evidenceRefreshStatus: "fresh-supporting",
      freshEvidence: refreshedEvidence,
      adverseSignals: [
        `Refreshed edge is slightly negative (${edgeValue.toFixed(4)}), so full size is no longer justified.`
      ],
      stopOrReduceTriggers: [
        "Reduce now because refreshed edge is below zero.",
        ...defaultTriggers
      ],
      pnlSnapshot: buildPositionPnlSnapshot(input.position),
      humanReviewFlag: true,
      confidence: input.matching.confidence,
      reason: `Pulse still references the same side, but the refreshed edge is slightly negative (${edgeValue.toFixed(4)}), so the position should be trimmed rather than left unchanged.`,
      reviewConclusion: "Reduce the position because the thesis is not fully broken, but the edge is no longer good enough to justify full size.",
      suggestedExitPct: 0.5,
      basis: "pulse-supports-current-negative-edge",
      aiProb: heldOutcome.aiProb,
      marketProb: heldOutcome.marketProb,
      thesisMd: `Pulse still supports the current ${input.position.outcome_label} direction, but only weakly. Trim size and keep the remainder under review. ${input.matching.thesisMd}`,
      sources: [buildPositionSource(input.position), ...input.matching.sources],
      side: "SELL",
      notionalUsd: calculateReduceNotional(input.position)
    };
  }

  if (edgeValue < STRONG_EDGE_THRESHOLD) {
    return {
      action: "hold",
      stillHasEdge: true,
      edgeAssessment: "yes",
      edgeValue,
      pulseCoverage: "supporting",
      evidenceRefreshStatus: "fresh-supporting",
      freshEvidence: refreshedEvidence,
      adverseSignals: [
        `Residual edge is weak (${edgeValue.toFixed(4)}), below strong-edge threshold ${STRONG_EDGE_THRESHOLD.toFixed(4)}.`
      ],
      stopOrReduceTriggers: defaultTriggers,
      pnlSnapshot: buildPositionPnlSnapshot(input.position),
      humanReviewFlag: true,
      confidence: input.matching.confidence,
      reason: `Pulse still supports the current ${input.position.outcome_label} thesis, but the refreshed edge is only ${edgeValue.toFixed(4)} and should be watched.`,
      reviewConclusion: "Keep the position for now, but flag it for human review because the edge has become weak.",
      suggestedExitPct: 0,
      basis: "pulse-supports-current-weak-edge",
      aiProb: heldOutcome.aiProb,
      marketProb: heldOutcome.marketProb,
      thesisMd: `Pulse still supports the current ${input.position.outcome_label} thesis, but only with a weak residual edge. Hold for now and review sizing manually. ${input.matching.thesisMd}`,
      sources: [buildPositionSource(input.position), ...input.matching.sources],
      side: input.position.side
    };
  }

  return {
    action: "hold",
    stillHasEdge: true,
    edgeAssessment: "yes",
    edgeValue,
    pulseCoverage: "supporting",
    evidenceRefreshStatus: "fresh-supporting",
    freshEvidence: refreshedEvidence,
    adverseSignals: [],
    stopOrReduceTriggers: defaultTriggers,
    pnlSnapshot: buildPositionPnlSnapshot(input.position),
    humanReviewFlag: false,
    confidence: input.matching.confidence,
    reason: `Pulse still supports the current ${input.position.outcome_label} thesis with a positive refreshed edge (${edgeValue.toFixed(4)}).`,
    reviewConclusion: "Keep the position because Pulse still defends the held side and the refreshed edge remains positive.",
    suggestedExitPct: 0,
    basis: "pulse-supports-current",
    aiProb: heldOutcome.aiProb,
    marketProb: heldOutcome.marketProb,
    thesisMd: `Pulse still supports the current ${input.position.outcome_label} thesis for this position. ${input.matching.thesisMd}`,
    sources: [buildPositionSource(input.position), ...input.matching.sources],
    side: input.position.side
  };
}

export function reviewCurrentPositions(input: {
  context: RuntimeExecutionContext;
  entryPlans: PulseEntryPlan[];
  positionResearch?: PositionResearchSnapshot[];
}): PositionReviewResult[] {
  const results: PositionReviewResult[] = [];

  for (const position of input.context.positions) {
    const { matching, opposing } = findRelevantPulsePlan(position, input.entryPlans);
    const research = findPositionResearch(position, input.positionResearch ?? input.context.positionResearch ?? []);

    if (position.unrealized_pnl_pct <= -position.stop_loss_pct) {
      const aiProb = Math.max(0, position.current_price - Math.abs(position.unrealized_pnl_pct));
      const decision = buildDecision({
        position,
        action: "close",
        side: "SELL",
        aiProb,
        marketProb: position.current_price,
        confidence: "medium",
        thesisMd: `This position breached the configured stop-loss threshold (${(position.stop_loss_pct * 100).toFixed(1)}%), so the portfolio review exits it even without waiting for a fresh pulse contradiction.`,
        sources: buildResearchSources(position, research)
      });
      results.push({
        position,
        action: "close",
        stillHasEdge: false,
        edgeAssessment: "no",
        edgeValue: roundCurrency(aiProb - position.current_price),
        pulseCoverage: "none",
        evidenceRefreshStatus: "risk-trigger",
        freshEvidence: research ? buildResearchEvidence(position, research) : [buildPnlEvidenceLine(position)],
        adverseSignals: [
          `Unrealized PnL ${(position.unrealized_pnl_pct * 100).toFixed(2)}% breached stop-loss ${(position.stop_loss_pct * 100).toFixed(1)}%.`
        ],
        stopOrReduceTriggers: ["Close now because the configured stop-loss has already been breached."],
        pnlSnapshot: buildPositionPnlSnapshot(position),
        humanReviewFlag: false,
        confidence: "medium",
        reason: "Position breached the configured stop-loss threshold.",
        reviewConclusion: "Close the position because it already breached the configured stop-loss threshold.",
        suggestedExitPct: 1,
        basis: "stop-loss-breached",
        decision
      });
      continue;
    }

    if (matching) {
      const classification = classifyMatchingPlan({ position, matching });
      const decision = buildDecision({
        position,
        action: classification.action,
        side: classification.side,
        aiProb: classification.aiProb,
        marketProb: classification.marketProb,
        confidence: classification.confidence,
        thesisMd: classification.thesisMd,
        sources: classification.sources,
        notionalUsd: classification.notionalUsd
      });
      results.push({
        position,
        action: classification.action,
        stillHasEdge: classification.stillHasEdge,
        edgeAssessment: classification.edgeAssessment,
        edgeValue: classification.edgeValue,
        pulseCoverage: classification.pulseCoverage,
        evidenceRefreshStatus: classification.evidenceRefreshStatus,
        freshEvidence: classification.freshEvidence,
        adverseSignals: classification.adverseSignals,
        stopOrReduceTriggers: classification.stopOrReduceTriggers,
        pnlSnapshot: classification.pnlSnapshot,
        humanReviewFlag: classification.humanReviewFlag,
        confidence: classification.confidence,
        reason: classification.reason,
        reviewConclusion: classification.reviewConclusion,
        suggestedExitPct: classification.suggestedExitPct,
        basis: classification.basis,
        decision
      });
      continue;
    }

    if (opposing) {
      const heldOutcome = buildHeldOutcomeProbabilities(position, opposing);
      const decision = buildDecision({
        position,
        action: "close",
        side: "SELL",
        aiProb: heldOutcome.aiProb,
        marketProb: heldOutcome.marketProb,
        confidence: opposing.confidence,
        thesisMd: `Pulse now favors the opposite outcome for this market, so the existing ${position.outcome_label} position no longer has a defended edge. ${opposing.thesisMd}`,
        sources: [buildPositionSource(position), ...opposing.sources]
      });
      results.push({
        position,
        action: "close",
        stillHasEdge: false,
        edgeAssessment: "no",
        edgeValue: roundCurrency(heldOutcome.aiProb - heldOutcome.marketProb),
        pulseCoverage: "opposing",
        evidenceRefreshStatus: "fresh-opposing",
        freshEvidence: [
          buildPnlEvidenceLine(position),
          `Pulse refreshed the opposite ${opposing.outcomeLabel} outcome for this market: AI probability ${opposing.aiProb.toFixed(4)} vs market ${opposing.marketProb.toFixed(4)}.`
        ],
        adverseSignals: [
          `Current ${position.outcome_label} holding is contradicted by a same-market Pulse plan favoring ${opposing.outcomeLabel}.`
        ],
        stopOrReduceTriggers: ["Close now because fresh Pulse coverage favors the opposite outcome."],
        pnlSnapshot: buildPositionPnlSnapshot(position),
        humanReviewFlag: true,
        confidence: opposing.confidence,
        reason: `Pulse now favors the opposite outcome (${opposing.outcomeLabel}) for this market.`,
        reviewConclusion: `Close the position because Pulse now prefers the opposite outcome (${opposing.outcomeLabel}) for the same market.`,
        suggestedExitPct: 1,
        basis: "pulse-opposes-current",
        decision
      });
      continue;
    }

    const nearStopLoss = position.unrealized_pnl_pct <= -(position.stop_loss_pct * NEAR_STOP_LOSS_RATIO);
    if (nearStopLoss) {
      const marketProb = research?.marketProb ?? position.current_price;
      const decision = buildDecision({
        position,
        action: "reduce",
        side: "SELL",
        aiProb: marketProb,
        marketProb,
        confidence: "low",
        thesisMd: research
          ? "Dedicated position research refreshed this holding, but it is already approaching the configured stop-loss threshold. Reduce size and keep the remainder under human review."
          : "No fresh Pulse coverage was produced for this position, and it is already approaching the configured stop-loss threshold. Reduce size and flag the remainder for human review.",
        sources: buildResearchSources(position, research),
        notionalUsd: calculateReduceNotional(position)
      });
      results.push({
        position,
        action: "reduce",
        stillHasEdge: false,
        edgeAssessment: "no",
        edgeValue: 0,
        pulseCoverage: "none",
        evidenceRefreshStatus: research ? "fresh-position-research" : "not-refreshed",
        freshEvidence: research
          ? buildResearchEvidence(position, research)
          : [
              buildPnlEvidenceLine(position),
              "No fresh Pulse research covered this held token in the current run."
            ],
        adverseSignals: [
          ...(research?.adverseSignals ?? []),
          `Position is near stop-loss: unrealized PnL ${(position.unrealized_pnl_pct * 100).toFixed(2)}% vs stop-loss ${(position.stop_loss_pct * 100).toFixed(1)}%.`
        ],
        stopOrReduceTriggers: [
          "Reduce now because the position is near stop-loss without fresh support.",
          ...buildDefaultStopOrReduceTriggers(position)
        ],
        pnlSnapshot: buildPositionPnlSnapshot(position),
        humanReviewFlag: true,
        confidence: "low",
        reason: research
          ? "Dedicated position research refreshed this holding, but the position is already near its stop-loss threshold."
          : "No fresh Pulse support was found and the position is already near its stop-loss threshold.",
        reviewConclusion: research
          ? "Trim the position because the fresh position-specific review does not remove the stop-loss pressure."
          : "Trim the position because there is no fresh Pulse defense and the downside buffer is already thin.",
        suggestedExitPct: 0.5,
        basis: research ? "position-research-adverse" : "near-stop-loss-without-fresh-signal",
        decision
      });
      continue;
    }

    if (research) {
      const marketProb = research.marketProb ?? position.current_price;
      const decision = buildDecision({
        position,
        action: "hold",
        side: position.side,
        aiProb: marketProb,
        marketProb,
        confidence: research.adverseSignals.length > 0 ? "low" : "medium",
        thesisMd: research.adverseSignals.length > 0
          ? "Dedicated position research refreshed this holding and found watch items. Keep it unchanged for now because no model-level opposing probability was produced, but require human review before counting it as active edge."
          : "Dedicated position research refreshed this holding without producing a same-market opposing Pulse plan. Keep it unchanged while treating the position as reviewed, not stale.",
        sources: buildResearchSources(position, research)
      });
      results.push({
        position,
        action: "hold",
        stillHasEdge: false,
        edgeAssessment: "no",
        edgeValue: 0,
        pulseCoverage: "none",
        evidenceRefreshStatus: "fresh-position-research",
        freshEvidence: buildResearchEvidence(position, research),
        adverseSignals: research.adverseSignals,
        stopOrReduceTriggers: buildDefaultStopOrReduceTriggers(position),
        pnlSnapshot: buildPositionPnlSnapshot(position),
        humanReviewFlag: true,
        confidence: research.adverseSignals.length > 0 ? "low" : "medium",
        reason: research.adverseSignals.length > 0
          ? "Dedicated position research refreshed this holding and found watch items, but no direct opposing probability was produced."
          : "Dedicated position research refreshed this holding independently of the random pulse candidate set.",
        reviewConclusion: research.adverseSignals.length > 0
          ? "Reviewed hold: keep the position unchanged for now, but escalate the fresh watch items for human review."
          : "Reviewed hold: keep the position unchanged because the dedicated position refresh found no direct sell trigger.",
        suggestedExitPct: 0,
        basis: research.adverseSignals.length > 0 ? "position-research-adverse" : "position-research-refreshed",
        decision
      });
      continue;
    }

    const decision = buildDecision({
      position,
      action: "hold",
      side: position.side,
      aiProb: position.current_price,
      marketProb: position.current_price,
      confidence: "low",
      thesisMd: "No contradictory pulse recommendation was produced for this existing position. Keep it unchanged for now, but flag it for human review because no fresh edge refresh was found in the current pulse set.",
      sources: [buildPositionSource(position)]
    });
    results.push({
      position,
      action: "hold",
      stillHasEdge: false,
      edgeAssessment: "no",
      edgeValue: 0,
      pulseCoverage: "none",
      evidenceRefreshStatus: "not-refreshed",
      freshEvidence: [
        buildPnlEvidenceLine(position),
        "No fresh Pulse research covered this held token in the current run."
      ],
      adverseSignals: [
        "No direct opposing Pulse signal was found, but the position also has no refreshed external evidence in this run."
      ],
      stopOrReduceTriggers: buildDefaultStopOrReduceTriggers(position),
      pnlSnapshot: buildPositionPnlSnapshot(position),
      humanReviewFlag: true,
      confidence: "low",
      reason: "No contradictory pulse signal was found, but there was also no fresh dedicated pulse support.",
      reviewConclusion: "Stale hold: keep the position unchanged for now, but do not count it as active edge until fresh evidence is produced.",
      suggestedExitPct: 0,
      basis: "no-fresh-signal",
      decision
    });
  }

  return results;
}
