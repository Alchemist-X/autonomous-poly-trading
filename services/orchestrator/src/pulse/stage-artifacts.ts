// Typed, machine-verifiable artifacts for the BP-aligned 7-stage forecasting pipeline.
//
// Stage 7 (conclusion + market comparison) already lives in the entry planner / risk layer;
// stages 1-6 are produced as the typed artifacts below and assembled into a
// CandidateDecisionModel that is attached per research candidate in the pulse context.
//
// Design + gap analysis: docs/diagrams/prediction-engine-stage-flow.md
//
// These are plain interfaces plus explicit validator functions (matching the orchestrator's
// existing style, e.g. stage-flow.ts) so every invariant the BP forecasting flow relies on is
// unit-testable without an LLM: arithmetic reconciliation, referential integrity across stages,
// and bounded probabilities.

import { isSpoilerSource } from "./spoiler-firewall.js";

export const PROBABILITY_TOLERANCE = 1e-6;
// Calibration guard: forbid absolute 0/1 certainty but allow near-certainty (max 0.99999).
export const CONDITIONAL_NODE_MIN = 0.00001;
export const CONDITIONAL_NODE_MAX = 0.99999;
// Stage-2 decomposition bounds — shared by the validator AND the stage-2 prompt so they cannot drift.
export const QUERY_PLAN_NODE_MIN = 2;
export const QUERY_PLAN_NODE_MAX = 5;
// Stage-5 guard: over-decomposition mechanically deflates the node product P(Yes).
export const CONDITIONAL_MODEL_MAX_NODES = 8;

export type StageValidationStatus = "valid" | "ambiguous" | "contested" | "unclarifiable";
export type EvidenceDirection = "supports-yes" | "supports-no" | "neutral" | "ambiguous";
export type SourceCategory = "official" | "mainstream" | "local" | "third-party" | "military-map" | "social";

export const VALIDATION_STATUSES: readonly StageValidationStatus[] = ["valid", "ambiguous", "contested", "unclarifiable"];
export const EVIDENCE_DIRECTIONS: readonly EvidenceDirection[] = ["supports-yes", "supports-no", "neutral", "ambiguous"];
// Canonical list — producers must import this instead of re-declaring it (drift risk).
export const SOURCE_CATEGORIES: readonly SourceCategory[] = ["official", "mainstream", "local", "third-party", "military-map", "social"];
export type EvidenceRetrievedVia = "web-search" | "polymarket-scrape" | "orderbook" | "connector";
export type ConditionalNodeType = "base" | "conditional";
export type BayesUpdateDirection = "for-yes" | "for-no";

// ---------------------------------------------------------------------------
// Stage 1 — resolution definition
// ---------------------------------------------------------------------------
export interface ResolutionBoundary {
  condition: string;
  meetsByDeadline: boolean;
  toleranceNotes?: string;
}

export interface ResolutionDefinition {
  marketSlug: string;
  eventSlug?: string;
  officialQuestion: string;
  officialResolutionRules: string;
  resolutionSource?: string;
  representativeAuthority?: string;
  yesBoundary: ResolutionBoundary;
  noBoundary: ResolutionBoundary;
  deadline?: string;
  timezone?: string;
  resolutionDate?: string;
  validationStatus: StageValidationStatus;
  gaps: string[];
  confidence: number;
  definedAtUtc: string;
}

// ---------------------------------------------------------------------------
// Stage 2 — query plan
// ---------------------------------------------------------------------------
export interface QueryPlanSourceCategory {
  category: SourceCategory;
  queries: string[];
  expectedEvidence: string[];
}

export interface QueryPlanNode {
  nodeId: string;
  label: string;
  condition: string;
  weight?: number;
  timeframe?: string;
  sourceCategories: QueryPlanSourceCategory[];
}

export interface QueryPlan {
  marketSlug: string;
  eventSlug?: string;
  generatedAtUtc: string;
  nodes: QueryPlanNode[];
  baseQueries: string[];
  totalQueriesPlanned: number;
  sourceAllowlist?: string[];
}

// ---------------------------------------------------------------------------
// Stage 3 — sources database
// ---------------------------------------------------------------------------
export interface EvidenceSourceRecord {
  recordId: string;
  sourceUrl: string;
  sourceHost: string;
  sourceCategory: SourceCategory;
  retrievedAtUtc: string;
  retrievedVia: EvidenceRetrievedVia;
  title?: string;
  author?: string;
  publishedAtUtc?: string;
  fullText?: string;
  snippet?: string;
  summary?: string;
  addressedNodeIds: string[];
}

export interface SourcesDatabaseSummary {
  totalRecords: number;
  byCategory: Partial<Record<SourceCategory, number>>;
  oldestPublishedAtUtc?: string;
  newestPublishedAtUtc?: string;
}

export interface SourcesDatabase {
  marketSlug: string;
  fetchedAtUtc: string;
  records: EvidenceSourceRecord[];
  summary: SourcesDatabaseSummary;
}

// ---------------------------------------------------------------------------
// Stage 4 — evidence ledger
// ---------------------------------------------------------------------------
export interface EvidenceLedgerRecord {
  recordId: string;
  direction: EvidenceDirection;
  strength: number;
  recencyScore: number;
  primarySource: boolean;
  corroborationCount: number;
  credibilityScore: number;
  affectedNodeIds: string[];
}

export interface EvidenceLedgerSummary {
  totalRecords: number;
  supportingYes: number;
  supportingNo: number;
  netStrength: number;
  averageRecencyDays?: number;
}

export interface EvidenceLedger {
  marketSlug: string;
  generatedAtUtc: string;
  records: EvidenceLedgerRecord[];
  summary: EvidenceLedgerSummary;
  /** Degradation markers (e.g. "scoring call failed; defaults used") — must never be silently empty-on-failure. */
  gaps?: string[];
}

// ---------------------------------------------------------------------------
// Stage 5 — conditional (structured) model: P(Yes) = P(A) x P(B|A) x P(C|A,B)
// ---------------------------------------------------------------------------
export interface ConditionalModelNode {
  nodeId: string;
  label: string;
  type: ConditionalNodeType;
  probability: number;
  precedingNodeIds: string[];
  condition: string;
  rationale: string;
  residualUncertainty?: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
}

export interface ConditionalModelFinalProbability {
  computed: number;
  reported: number;
  isAdjusted: boolean;
  adjustmentReason?: string;
}

export interface ConditionalModel {
  marketSlug: string;
  generatedAtUtc: string;
  nodes: ConditionalModelNode[];
  finalProbability: ConditionalModelFinalProbability;
  arithmeticConsistency: { isConsistent: boolean; gaps: string[] };
}

// ---------------------------------------------------------------------------
// Stage 6 — bayesian delta ledger
// ---------------------------------------------------------------------------
export interface BayesUpdate {
  order: number;
  label: string;
  evidenceIds: string[];
  direction: BayesUpdateDirection;
  deltaProbability: number;
  posteriorProbability: number;
  rationale: string;
}

export interface BayesCredibleInterval {
  low: number;
  high: number;
}

/** Second-pass LLM verifier outcome (see verifier.ts); distinct from the deterministic validators. */
export interface BayesVerifierAudit {
  consistent: boolean;
  issues: string[];
  elapsedMs?: number;
}

export interface BayesDeltaLedger {
  marketSlug: string;
  generatedAtUtc: string;
  initialAssumptions: { baseProbability: number; rationale: string };
  updates: BayesUpdate[];
  finalProbability: { value: number; credibleInterval: BayesCredibleInterval };
  outcomeLabel: string;
  marketProb: number;
  aiProb: number;
  /** Result of the DETERMINISTIC validator (validateBayesDeltaLedger), set by the producer. */
  verifiedConsistent: boolean;
  /** Result of the second-pass Opus verifier, attached by the wiring layer when it runs. */
  verifierAudit?: BayesVerifierAudit;
}

// ---------------------------------------------------------------------------
// Wrapper — the full per-candidate decision model (stages 1-6 + live hand-off)
// ---------------------------------------------------------------------------
export interface CandidateDecisionModel {
  marketSlug: string;
  eventSlug?: string;
  generatedAtUtc: string;
  resolution?: ResolutionDefinition;
  query_plan?: QueryPlan;
  sources_database?: SourcesDatabase;
  evidence_ledger?: EvidenceLedger;
  conditional_model?: ConditionalModel;
  bayes_ledger?: BayesDeltaLedger;
  // Surfaced for the live entry-planner seam (Phase 4). Mirrors bayes_ledger when present.
  outcomeLabel?: string;
  marketProb?: number;
  aiProb?: number;
}

// ===========================================================================
// Validators — explicit, machine-checkable invariants for each stage.
// Each returns { ok, errors }; callers fail-fast in recommend-only and fall
// back to legacy behaviour in live (never throw on a bad model).
// ===========================================================================
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors };
}

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isIsoDate(value: string | undefined): boolean {
  return value !== undefined && !Number.isNaN(Date.parse(value));
}

/** Returns the subset of `ids` that are NOT present in `universe` (empty = referential integrity holds). */
function danglingIds(ids: string[], universe: Set<string>): string[] {
  return ids.filter((id) => !universe.has(id));
}

function clampProbability(value: number): number {
  return Math.min(CONDITIONAL_NODE_MAX, Math.max(CONDITIONAL_NODE_MIN, value));
}

/**
 * NaN guard for reconciliation checks: `Math.abs(a-b) > tol` is ALWAYS false when either side is
 * NaN, so a non-finite value would sail through every arithmetic check below. Validators must
 * reject non-finite numerics explicitly before reconciling.
 */
function nonFiniteError(name: string, value: number): string | null {
  return Number.isFinite(value) ? null : `${name} is not a finite number (${value})`;
}

export function validateResolutionDefinition(input: ResolutionDefinition): ValidationResult {
  const errors: string[] = [];
  if (!input.marketSlug?.trim()) errors.push("marketSlug is empty");
  if (!input.yesBoundary?.condition?.trim()) errors.push("yesBoundary.condition is empty");
  if (!input.noBoundary?.condition?.trim()) errors.push("noBoundary.condition is empty");
  if (input.deadline !== undefined && !isIsoDate(input.deadline)) errors.push("deadline is not an ISO date");
  if (input.resolutionDate !== undefined && !isIsoDate(input.resolutionDate)) errors.push("resolutionDate is not an ISO date");
  if (!isIsoDate(input.definedAtUtc)) errors.push("definedAtUtc is not an ISO date");
  if (!VALIDATION_STATUSES.includes(input.validationStatus)) errors.push(`validationStatus "${input.validationStatus}" is not a known status`);
  if (!isFiniteInRange(input.confidence, 0, 1)) errors.push("confidence is out of [0,1]");
  return result(errors);
}

/** Whether a resolution definition is clear enough to drive a live trade (Phase 4 gate). */
export function isResolutionLiveReady(input: ResolutionDefinition): boolean {
  return validateResolutionDefinition(input).ok && input.validationStatus !== "unclarifiable";
}

export const QUERY_PLAN_WEIGHT_TOLERANCE = 0.01;

export function validateQueryPlan(input: QueryPlan): ValidationResult {
  const errors: string[] = [];
  if (!input.marketSlug?.trim()) errors.push("marketSlug is empty");
  if (input.nodes.length < QUERY_PLAN_NODE_MIN || input.nodes.length > QUERY_PLAN_NODE_MAX) {
    errors.push(`nodes.length must be ${QUERY_PLAN_NODE_MIN}-${QUERY_PLAN_NODE_MAX}, got ${input.nodes.length}`);
  }

  let queryCount = 0;
  let weightSum = 0;
  let weightedNodes = 0;
  const nodeIds = new Set<string>();
  for (const node of input.nodes) {
    if (nodeIds.has(node.nodeId)) errors.push(`duplicate nodeId ${node.nodeId}`);
    nodeIds.add(node.nodeId);
    const nodeQueries = node.sourceCategories.reduce((sum, sc) => sum + sc.queries.length, 0);
    if (nodeQueries < 1) errors.push(`node ${node.nodeId} has no queries`);
    queryCount += nodeQueries;
    if (node.weight !== undefined) {
      weightedNodes += 1;
      weightSum += node.weight;
      if (!isFiniteInRange(node.weight, 0, 1)) errors.push(`node ${node.nodeId} weight ${node.weight} out of [0,1]`);
    }
  }
  if (input.totalQueriesPlanned !== queryCount) {
    errors.push(`totalQueriesPlanned (${input.totalQueriesPlanned}) != sum of node queries (${queryCount})`);
  }
  // The prompt allows weights to be optional per node; only a FULLY weighted plan promises sum ~1.
  if (weightedNodes === input.nodes.length && weightedNodes > 0 && Math.abs(weightSum - 1) > QUERY_PLAN_WEIGHT_TOLERANCE) {
    errors.push(`node weights sum to ${weightSum}, expected ~1.0`);
  }
  return result(errors);
}

export function validateSourcesDatabase(input: SourcesDatabase, queryPlanNodeIds: Set<string>): ValidationResult {
  const errors: string[] = [];
  const recordIds = new Set<string>();
  for (const record of input.records) {
    if (recordIds.has(record.recordId)) errors.push(`duplicate recordId ${record.recordId}`);
    recordIds.add(record.recordId);
    if (!isIsoDate(record.retrievedAtUtc)) errors.push(`record ${record.recordId} retrievedAtUtc is not ISO`);
    if (!record.sourceUrl?.trim()) errors.push(`record ${record.recordId} has empty sourceUrl`);
    // Defense-in-depth for the independent-forecasting firewall: a stored artifact containing a
    // prediction-market / odds source must never validate, regardless of how it was produced.
    if (isSpoilerSource(record.sourceUrl) || isSpoilerSource(record.sourceHost)) {
      errors.push(`record ${record.recordId} is a blocked spoiler source (${record.sourceHost || record.sourceUrl})`);
    }
    const dangling = danglingIds(record.addressedNodeIds, queryPlanNodeIds);
    if (dangling.length) errors.push(`record ${record.recordId} addresses unknown nodes: ${dangling.join(", ")}`);
  }
  if (input.summary.totalRecords !== input.records.length) {
    errors.push(`summary.totalRecords (${input.summary.totalRecords}) != records.length (${input.records.length})`);
  }
  return result(errors);
}

export function validateEvidenceLedger(
  input: EvidenceLedger,
  sourceRecordIds: Set<string>,
  queryPlanNodeIds: Set<string>
): ValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const record of input.records) {
    if (seenIds.has(record.recordId)) errors.push(`duplicate ledger recordId ${record.recordId}`);
    seenIds.add(record.recordId);
    if (!sourceRecordIds.has(record.recordId)) {
      errors.push(`ledger record ${record.recordId} has no matching sources-database record`);
    }
    if (!EVIDENCE_DIRECTIONS.includes(record.direction)) {
      errors.push(`record ${record.recordId} direction "${record.direction}" is not a known direction`);
    }
    if (!isFiniteInRange(record.strength, 0, 1)) errors.push(`record ${record.recordId} strength out of [0,1]`);
    if (!isFiniteInRange(record.recencyScore, 0, 1)) errors.push(`record ${record.recordId} recencyScore out of [0,1]`);
    if (!isFiniteInRange(record.credibilityScore, 0, 1)) errors.push(`record ${record.recordId} credibilityScore out of [0,1]`);
    const dangling = danglingIds(record.affectedNodeIds, queryPlanNodeIds);
    if (dangling.length) errors.push(`record ${record.recordId} affects unknown nodes: ${dangling.join(", ")}`);
  }

  // Recompute the summary from the records instead of heuristic sign comparisons: a count
  // majority and a strength-weighted sum legitimately diverge (2 weak yes vs 1 strong no), so
  // the only sound check is that the summary IS the aggregate of the records.
  const expectedYes = input.records.filter((record) => record.direction === "supports-yes").length;
  const expectedNo = input.records.filter((record) => record.direction === "supports-no").length;
  const expectedNet = input.records.reduce((sum, record) => {
    if (record.direction === "supports-yes") return sum + record.strength;
    if (record.direction === "supports-no") return sum - record.strength;
    return sum;
  }, 0);
  if (input.summary.totalRecords !== input.records.length) {
    errors.push(`summary.totalRecords (${input.summary.totalRecords}) != records.length (${input.records.length})`);
  }
  if (input.summary.supportingYes !== expectedYes) {
    errors.push(`summary.supportingYes (${input.summary.supportingYes}) != counted supports-yes records (${expectedYes})`);
  }
  if (input.summary.supportingNo !== expectedNo) {
    errors.push(`summary.supportingNo (${input.summary.supportingNo}) != counted supports-no records (${expectedNo})`);
  }
  const netError = nonFiniteError("summary.netStrength", input.summary.netStrength);
  if (netError) errors.push(netError);
  else if (Math.abs(input.summary.netStrength - expectedNet) > PROBABILITY_TOLERANCE) {
    errors.push(`summary.netStrength (${input.summary.netStrength}) != sum of signed strengths (${expectedNet})`);
  }
  return result(errors);
}

export function validateConditionalModel(input: ConditionalModel, evidenceLedgerIds: Set<string>): ValidationResult {
  const errors: string[] = [];
  if (input.nodes.length === 0) {
    errors.push("conditional model has no nodes");
    return result(errors);
  }
  if (input.nodes.length > CONDITIONAL_MODEL_MAX_NODES) {
    errors.push(`conditional model has ${input.nodes.length} nodes, max ${CONDITIONAL_MODEL_MAX_NODES} (over-decomposition deflates the product)`);
  }

  const nodeIds = new Set<string>(input.nodes.map((node) => node.nodeId));
  const seenNodeIds = new Set<string>();
  let product = 1;
  for (const node of input.nodes) {
    if (seenNodeIds.has(node.nodeId)) errors.push(`duplicate nodeId ${node.nodeId}`);
    seenNodeIds.add(node.nodeId);
    if (!isFiniteInRange(node.probability, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX)) {
      errors.push(`node ${node.nodeId} probability ${node.probability} out of [${CONDITIONAL_NODE_MIN},${CONDITIONAL_NODE_MAX}]`);
    }
    product *= node.probability;
    if (node.precedingNodeIds.includes(node.nodeId)) {
      errors.push(`node ${node.nodeId} lists itself as a preceding node`);
    }
    const danglingPreceding = danglingIds(node.precedingNodeIds, nodeIds);
    if (danglingPreceding.length) errors.push(`node ${node.nodeId} references unknown preceding nodes: ${danglingPreceding.join(", ")}`);
    const dangling = danglingIds(
      [...node.supportingEvidenceIds, ...node.contradictingEvidenceIds],
      evidenceLedgerIds
    );
    if (dangling.length) errors.push(`node ${node.nodeId} references unknown evidence: ${dangling.join(", ")}`);
  }

  const computedError = nonFiniteError("finalProbability.computed", input.finalProbability.computed);
  const reportedError = nonFiniteError("finalProbability.reported", input.finalProbability.reported);
  if (computedError) errors.push(computedError);
  if (reportedError) errors.push(reportedError);
  if (!computedError && Math.abs(input.finalProbability.computed - product) > PROBABILITY_TOLERANCE) {
    errors.push(`finalProbability.computed (${input.finalProbability.computed}) != node product (${product})`);
  }
  if (!reportedError && !isFiniteInRange(input.finalProbability.reported, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX)) {
    errors.push(`finalProbability.reported (${input.finalProbability.reported}) out of [${CONDITIONAL_NODE_MIN},${CONDITIONAL_NODE_MAX}]`);
  }
  if (!computedError && !reportedError) {
    const reportedMatchesComputed = Math.abs(input.finalProbability.reported - input.finalProbability.computed) <= PROBABILITY_TOLERANCE;
    if (!reportedMatchesComputed && !input.finalProbability.isAdjusted) {
      errors.push("finalProbability.reported diverges from computed without isAdjusted=true");
    }
  }
  if (input.finalProbability.isAdjusted && !input.finalProbability.adjustmentReason?.trim()) {
    errors.push("finalProbability.isAdjusted=true requires adjustmentReason");
  }
  return result(errors);
}

export function validateBayesDeltaLedger(input: BayesDeltaLedger, evidenceLedgerIds: Set<string>): ValidationResult {
  const errors: string[] = [];
  const base = input.initialAssumptions.baseProbability;
  if (!isFiniteInRange(base, 0, 1)) errors.push("baseProbability out of [0,1]");

  let running = base;
  input.updates.forEach((update, index) => {
    if (update.order !== index + 1) {
      errors.push(`update at position ${index} has order ${update.order}, expected ${index + 1}`);
    }
    const deltaError = nonFiniteError(`update #${update.order} deltaProbability`, update.deltaProbability);
    const posteriorError = nonFiniteError(`update #${update.order} posteriorProbability`, update.posteriorProbability);
    if (deltaError) errors.push(deltaError);
    if (posteriorError) errors.push(posteriorError);
    if (!deltaError && !posteriorError) {
      if (!isFiniteInRange(update.posteriorProbability, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX)) {
        errors.push(`update #${update.order} posterior ${update.posteriorProbability} out of [${CONDITIONAL_NODE_MIN},${CONDITIONAL_NODE_MAX}]`);
      }
      if (Number.isFinite(running) && Math.abs(running + update.deltaProbability - update.posteriorProbability) > PROBABILITY_TOLERANCE) {
        errors.push(`update #${update.order} posterior (${update.posteriorProbability}) != previous (${running}) + delta (${update.deltaProbability})`);
      }
      // A delta that moves the probability up is by definition evidence for Yes (and vice versa).
      if (update.deltaProbability > PROBABILITY_TOLERANCE && update.direction !== "for-yes") {
        errors.push(`update #${update.order} has positive delta but direction "${update.direction}"`);
      }
      if (update.deltaProbability < -PROBABILITY_TOLERANCE && update.direction !== "for-no") {
        errors.push(`update #${update.order} has negative delta but direction "${update.direction}"`);
      }
    }
    // Every probability-moving update must cite evidence — an update with no surviving evidence
    // references is an unauditable assertion, not a bayesian step.
    if (update.evidenceIds.length === 0) {
      errors.push(`update #${update.order} cites no evidence`);
    }
    const dangling = danglingIds(update.evidenceIds, evidenceLedgerIds);
    if (dangling.length) errors.push(`update #${update.order} references unknown evidence: ${dangling.join(", ")}`);
    running += update.deltaProbability;
  });

  const finalValue = input.finalProbability.value;
  const finalError = nonFiniteError("finalProbability.value", finalValue);
  if (finalError) errors.push(finalError);
  const runningError = nonFiniteError("base + sum(deltas)", running);
  if (runningError) errors.push(runningError);
  if (!finalError && !runningError && Math.abs(running - finalValue) > PROBABILITY_TOLERANCE) {
    errors.push(`base + sum(deltas) (${running}) != finalProbability.value (${finalValue})`);
  }
  const ci = input.finalProbability.credibleInterval;
  if (!isFiniteInRange(ci.low, 0, 1) || !isFiniteInRange(ci.high, 0, 1)) {
    errors.push(`credibleInterval [${ci.low}, ${ci.high}] is not within [0,1]`);
  } else if (!(ci.low <= finalValue && finalValue <= ci.high)) {
    errors.push(`credibleInterval [${ci.low}, ${ci.high}] does not bracket finalProbability.value (${finalValue})`);
  }
  // marketProb is quarantined from the prompts but still part of the live hand-off — garbage here
  // would flow straight into the stage-7 edge computation.
  if (!isFiniteInRange(input.marketProb, 0, 1)) {
    errors.push(`marketProb (${input.marketProb}) out of [0,1]`);
  }
  if (!isFiniteInRange(input.aiProb, 0, 1) || input.aiProb <= 0 || input.aiProb >= 1) {
    errors.push(`aiProb (${input.aiProb}) must be in the open interval (0,1)`);
  }
  if (!finalError && Math.abs(input.aiProb - finalValue) > PROBABILITY_TOLERANCE) {
    errors.push(`aiProb (${input.aiProb}) != finalProbability.value (${finalValue})`);
  }
  return result(errors);
}

/**
 * Cross-stage referential integrity for an assembled decision model. Only validates the
 * artifacts that are present, so a partially-built model (e.g. after Phase 1) is still checkable.
 */
export function validateDecisionModelIntegrity(model: CandidateDecisionModel): ValidationResult {
  const errors: string[] = [];

  const nodeIds = new Set<string>(model.query_plan?.nodes.map((n) => n.nodeId) ?? []);
  const sourceIds = new Set<string>(model.sources_database?.records.map((r) => r.recordId) ?? []);
  const ledgerIds = new Set<string>(model.evidence_ledger?.records.map((r) => r.recordId) ?? []);

  if (model.resolution) errors.push(...validateResolutionDefinition(model.resolution).errors);
  if (model.query_plan) errors.push(...validateQueryPlan(model.query_plan).errors);
  if (model.sources_database) errors.push(...validateSourcesDatabase(model.sources_database, nodeIds).errors);
  if (model.evidence_ledger) errors.push(...validateEvidenceLedger(model.evidence_ledger, sourceIds, nodeIds).errors);
  if (model.conditional_model) errors.push(...validateConditionalModel(model.conditional_model, ledgerIds).errors);
  if (model.bayes_ledger) errors.push(...validateBayesDeltaLedger(model.bayes_ledger, ledgerIds).errors);

  // Every artifact must describe the same market as the wrapper.
  const slugged: Array<[string, string | undefined]> = [
    ["resolution", model.resolution?.marketSlug],
    ["query_plan", model.query_plan?.marketSlug],
    ["sources_database", model.sources_database?.marketSlug],
    ["evidence_ledger", model.evidence_ledger?.marketSlug],
    ["conditional_model", model.conditional_model?.marketSlug],
    ["bayes_ledger", model.bayes_ledger?.marketSlug]
  ];
  for (const [stage, slug] of slugged) {
    if (slug !== undefined && slug !== model.marketSlug) {
      errors.push(`${stage}.marketSlug ("${slug}") != wrapper.marketSlug ("${model.marketSlug}")`);
    }
  }

  // Stage 5 -> 6 linkage: the bayes chain must start from the conditional model's (clamped)
  // reported probability, exactly as the producer computes it.
  if (model.conditional_model && model.bayes_ledger) {
    const expectedBase = clampProbability(model.conditional_model.finalProbability.reported);
    if (Math.abs(model.bayes_ledger.initialAssumptions.baseProbability - expectedBase) > PROBABILITY_TOLERANCE) {
      errors.push(
        `bayes_ledger.baseProbability (${model.bayes_ledger.initialAssumptions.baseProbability}) != conditional_model reported (${expectedBase})`
      );
    }
  }

  // Live hand-off mirrors must agree with the bayes ledger when both are present.
  if (model.bayes_ledger && model.aiProb !== undefined) {
    if (Math.abs(model.aiProb - model.bayes_ledger.aiProb) > PROBABILITY_TOLERANCE) {
      errors.push("wrapper.aiProb does not mirror bayes_ledger.aiProb");
    }
  }
  if (model.bayes_ledger && model.marketProb !== undefined) {
    if (Math.abs(model.marketProb - model.bayes_ledger.marketProb) > PROBABILITY_TOLERANCE) {
      errors.push("wrapper.marketProb does not mirror bayes_ledger.marketProb");
    }
  }
  return result(errors);
}
