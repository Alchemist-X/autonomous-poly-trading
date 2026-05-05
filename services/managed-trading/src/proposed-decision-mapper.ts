// Pulse → ProposedDecision mapper.
//
// The orchestrator's daily-pulse run emits two parallel artefacts in
// `runtime-artifacts/pulse-live/<ts>-<runId>/recommendation.json`:
//
//   1. `decisions: TradeDecision[]` — raw AI output (ai_prob, edge,
//      confidence, thesis_md, side …)
//   2. `executablePlans: PlannedExecution[]` — same set after
//      orchestrator-side risk + exchange sizing (notionalUsd,
//      bankrollRatio, orderType, gtcLimitPrice, categorySlug, negRisk …)
//
// `ProposedDecision` (the dispatcher's input shape) takes the executable
// notional from #2 and the AI-side metadata from #1 — joined by
// `tokenId`, which uniquely identifies a market outcome on Polymarket.
//
// This module is pure: it has no IO, no SDK calls, no dependence on the
// orchestrator package (we duplicate the structural shapes inline so the
// managed-trading package stays decoupled). Concrete file loading lives
// in `scripts/managed-pulse.ts`.

import type {
  ProposedDecision,
  ProposedDecisionAction,
  ProposedDecisionConfidence,
  ProposedDecisionSide
} from "./types.js";

// Subset of `services/orchestrator` `PlannedExecution` we actually need.
// Replicated locally (with `unknown` for fields we don't read) so this
// package never imports from `@autopoly/orchestrator`.
export interface PulsePlannedExecution {
  readonly action: string;
  readonly marketSlug: string;
  readonly eventSlug: string;
  readonly tokenId: string;
  readonly side: string;
  readonly notionalUsd: number;
  readonly bankrollRatio?: number;
  readonly thesisMd?: string;
  readonly orderType?: string;
  readonly gtcLimitPrice?: number | null;
  readonly categorySlug?: string | null;
  readonly negRisk?: boolean;
}

// Subset of `@autopoly/contracts` `TradeDecision` (snake_case wire shape).
// Same locality reasoning as `PulsePlannedExecution` above.
export interface PulseTradeDecision {
  readonly action: string;
  readonly event_slug: string;
  readonly market_slug: string;
  readonly token_id: string;
  readonly side: string;
  readonly notional_usd: number;
  readonly ai_prob: number;
  readonly market_prob: number;
  readonly edge: number;
  readonly confidence: string;
  readonly thesis_md: string;
}

// What the `recommendation.json` artefact looks like. We only require the
// two arrays; everything else (overview, runId, …) is ignored here so
// changes elsewhere in the file don't ripple into this mapper.
export interface PulseRecommendationFile {
  readonly executablePlans: ReadonlyArray<PulsePlannedExecution>;
  readonly decisions: ReadonlyArray<PulseTradeDecision>;
  readonly runId?: string;
}

// Reasons that may appear on `MapperResult.unmappable` — the bridge can
// log these as `decisions_dropped:<reason>` so misjoins surface fast.
export type UnmappableReason =
  | "no_matching_decision"
  | "unsupported_action"
  | "unsupported_side"
  | "invalid_notional";

export interface UnmappablePlan {
  readonly plan: PulsePlannedExecution;
  readonly reason: UnmappableReason;
  readonly detail: string;
}

export interface MapperResult {
  readonly proposedDecisions: ReadonlyArray<ProposedDecision>;
  readonly unmappable: ReadonlyArray<UnmappablePlan>;
}

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

// `ProposedDecisionAction` is a strict subset of `TradeDecision.action`
// (excludes "skip"). We pass through "open" / "close" / "reduce" / "hold"
// and reject "skip" + anything unexpected.
//
// Note: `buildExecutionPlan` already filters skipped/hold actions out of
// `executablePlans`, but we still validate defensively because the
// recommendation artefact format is not enforced by a runtime schema.
function normalizeAction(raw: string): ProposedDecisionAction | null {
  switch (raw) {
    case "open":
    case "close":
    case "reduce":
    case "hold":
      return raw;
    default:
      return null;
  }
}

function normalizeSide(raw: string): ProposedDecisionSide | null {
  if (raw === "BUY" || raw === "SELL") {
    return raw;
  }
  return null;
}

// `TradeDecision.confidence` is `low | medium | medium-high | high`,
// while `ProposedDecision.confidence` is `low | medium | high` (no
// `medium-high`). Map the orchestrator's intermediate level to the
// dispatcher's nearest neighbour: `medium-high` → `high` (since
// medium-high decisions are closer to "ship it" than to "noise").
//
// Anything we don't recognise lands on `medium` so the dispatcher can
// still apply caps deterministically; the bridge runner will log a
// warning so we know if a new confidence level appeared upstream.
export function normalizeConfidence(raw: string): ProposedDecisionConfidence {
  switch (raw) {
    case "low":
    case "medium":
    case "high":
      return raw;
    case "medium-high":
      return "high";
    default:
      return "medium";
  }
}

// ---------------------------------------------------------------------------
// Plan-decision join
// ---------------------------------------------------------------------------

// Build a tokenId → TradeDecision lookup. If the same tokenId appears
// in both `decisions` *and* gets multiple plans (shouldn't happen — the
// orchestrator emits at most one plan per tokenId), the first decision
// for that tokenId wins.
function indexDecisionsByTokenId(
  decisions: ReadonlyArray<PulseTradeDecision>
): Map<string, PulseTradeDecision> {
  const index = new Map<string, PulseTradeDecision>();
  for (const decision of decisions) {
    if (!decision.token_id) continue;
    if (!index.has(decision.token_id)) {
      index.set(decision.token_id, decision);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

// Map a single PlannedExecution + matching TradeDecision into the
// dispatcher-shaped ProposedDecision. Returns `null` together with a
// reason when the plan can't be cleanly mapped (caller decides whether
// to drop or escalate).
export function mapSinglePlanToProposedDecision(
  plan: PulsePlannedExecution,
  decision: PulseTradeDecision | undefined
): { decision: ProposedDecision } | UnmappablePlan {
  if (decision == null) {
    return {
      plan,
      reason: "no_matching_decision",
      detail: `tokenId ${plan.tokenId} present in executablePlans but absent from decisions`
    };
  }
  const action = normalizeAction(plan.action);
  if (!action) {
    return {
      plan,
      reason: "unsupported_action",
      detail: `unknown action "${plan.action}"`
    };
  }
  const side = normalizeSide(plan.side);
  if (!side) {
    return {
      plan,
      reason: "unsupported_side",
      detail: `unknown side "${plan.side}"`
    };
  }
  if (!Number.isFinite(plan.notionalUsd) || plan.notionalUsd <= 0) {
    return {
      plan,
      reason: "invalid_notional",
      detail: `notionalUsd ${plan.notionalUsd} is not a positive finite number`
    };
  }

  const proposed: ProposedDecision = {
    action,
    eventSlug: plan.eventSlug,
    marketSlug: plan.marketSlug,
    tokenId: plan.tokenId,
    side,
    notionalUsd: plan.notionalUsd,
    aiProb: clamp01(decision.ai_prob),
    marketProb: clamp01(decision.market_prob),
    edge: Number.isFinite(decision.edge) ? decision.edge : 0,
    confidence: normalizeConfidence(decision.confidence),
    thesisMd: plan.thesisMd ?? decision.thesis_md ?? ""
  };
  return { decision: proposed };
}

// Map every plan in a `recommendation.json`-shaped artefact to a
// ProposedDecision. Plans that fail to map are returned in the
// `unmappable` array so the runner can summarise + decide whether to
// fail the whole bridge run or proceed with the mappable subset.
export function mapPulseRecommendationToProposedDecisions(
  recommendation: PulseRecommendationFile
): MapperResult {
  const decisionIndex = indexDecisionsByTokenId(recommendation.decisions ?? []);
  const proposed: ProposedDecision[] = [];
  const unmappable: UnmappablePlan[] = [];

  for (const plan of recommendation.executablePlans ?? []) {
    const result = mapSinglePlanToProposedDecision(plan, decisionIndex.get(plan.tokenId));
    if ("decision" in result) {
      proposed.push(result.decision);
    } else {
      unmappable.push(result);
    }
  }

  return {
    proposedDecisions: proposed,
    unmappable
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Polymarket probabilities are 0-1; clamp anything outside that range so
// downstream cap math (`bankrollRatio = notionalUsd / bankroll`) doesn't
// see weird values from an upstream regression.
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
