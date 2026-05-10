import type {
  PublicPosition,
  TradeDecision,
  TradeDecisionSet
} from "@autopoly/contracts";

export type EdgeAssessment = "yes" | "no";
export type PulseCoverage = "supporting" | "opposing" | "none";
export type EvidenceRefreshStatus =
  | "fresh-supporting"
  | "fresh-opposing"
  | "fresh-position-research"
  | "risk-trigger"
  | "not-refreshed";
export type PositionReviewBasis =
  | "pulse-supports-current"
  | "pulse-supports-current-weak-edge"
  | "pulse-supports-current-negative-edge"
  | "pulse-opposes-current"
  | "position-research-refreshed"
  | "position-research-adverse"
  | "stop-loss-breached"
  | "no-fresh-signal"
  | "near-stop-loss-without-fresh-signal";

export interface PositionResearchSnapshot {
  positionId: string;
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  outcomeLabel: string;
  fetchedAtUtc: string;
  marketProb: number | null;
  orderbook: {
    bestBid: number | null;
    bestAsk: number | null;
    minOrderSize: number | null;
  } | null;
  rules: {
    description: string | null;
    resolutionSource: string | null;
    endDate: string | null;
  } | null;
  marketStatus: {
    active: boolean | null;
    closed: boolean | null;
    archived: boolean | null;
  } | null;
  freshEvidence: string[];
  adverseSignals: string[];
  unresolvedData: string[];
  sources: TradeDecision["sources"];
}

export interface PositionReviewResult {
  position: PublicPosition;
  action: "hold" | "close" | "reduce";
  stillHasEdge: boolean;
  edgeAssessment: EdgeAssessment;
  edgeValue: number;
  pulseCoverage: PulseCoverage;
  evidenceRefreshStatus: EvidenceRefreshStatus;
  freshEvidence: string[];
  adverseSignals: string[];
  stopOrReduceTriggers: string[];
  pnlSnapshot: {
    currentValueUsd: number;
    avgCost: number;
    currentPrice: number;
    unrealizedPnlPct: number;
    stopLossPct: number;
  };
  humanReviewFlag: boolean;
  confidence: TradeDecision["confidence"];
  reason: string;
  reviewConclusion: string;
  suggestedExitPct: number;
  basis: PositionReviewBasis;
  decision: TradeDecision;
}

export interface PulseEntryPlan {
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  outcomeLabel: string;
  side: "BUY";
  suggestedPct: number;
  fullKellyPct: number;
  quarterKellyPct: number;
  reportedSuggestedPct: number | null;
  liquidityCapUsd: number | null;
  aiProb: number;
  marketProb: number;
  monthlyReturn: number;
  daysToResolution: number;
  resolutionSource: "market" | "estimated";
  entryFeePct: number;
  roundTripFeePct: number;
  netEdge: number;
  categorySlug: string | null;
  confidence: TradeDecision["confidence"];
  thesisMd: string;
  sources: TradeDecision["sources"];
  decision: TradeDecision;
}

export interface DecisionCompositionResult {
  decisions: TradeDecisionSet["decisions"];
  skippedEntries: Array<{
    marketSlug: string;
    tokenId: string;
    reason: string;
  }>;
}
