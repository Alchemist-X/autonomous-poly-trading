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

export const PROBABILITY_TOLERANCE = 1e-6;
// Calibration guard: forbid absolute 0/1 certainty but allow near-certainty (max 0.99999).
export const CONDITIONAL_NODE_MIN = 0.00001;
export const CONDITIONAL_NODE_MAX = 0.99999;

export type StageValidationStatus = "valid" | "ambiguous" | "contested" | "unclarifiable";
export type EvidenceDirection = "supports-yes" | "supports-no" | "neutral" | "ambiguous";
export type SourceCategory = "official" | "mainstream" | "local" | "third-party" | "military-map" | "social";
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

export interface BayesDeltaLedger {
  marketSlug: string;
  generatedAtUtc: string;
  initialAssumptions: { baseProbability: number; rationale: string };
  updates: BayesUpdate[];
  finalProbability: { value: number; credibleInterval: BayesCredibleInterval };
  outcomeLabel: string;
  marketProb: number;
  aiProb: number;
  verifiedConsistent: boolean;
  verifierElapsedMs?: number;
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

function ok(): ValidationResult {
  return { ok: true, errors: [] };
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

export function validateResolutionDefinition(input: ResolutionDefinition): ValidationResult {
  const errors: string[] = [];
  if (!input.marketSlug?.trim()) errors.push("marketSlug is empty");
  if (!input.yesBoundary?.condition?.trim()) errors.push("yesBoundary.condition is empty");
  if (!input.noBoundary?.condition?.trim()) errors.push("noBoundary.condition is empty");
  if (input.deadline !== undefined && !isIsoDate(input.deadline)) errors.push("deadline is not an ISO date");
  if (input.resolutionDate !== undefined && !isIsoDate(input.resolutionDate)) errors.push("resolutionDate is not an ISO date");
  if (!isFiniteInRange(input.confidence, 0, 1)) errors.push("confidence is out of [0,1]");
  return result(errors);
}

/** Whether a resolution definition is clear enough to drive a live trade (Phase 4 gate). */
export function isResolutionLiveReady(input: ResolutionDefinition): boolean {
  return validateResolutionDefinition(input).ok && input.validationStatus !== "unclarifiable";
}

export function validateQueryPlan(input: QueryPlan): ValidationResult {
  const errors: string[] = [];
  if (!input.marketSlug?.trim()) errors.push("marketSlug is empty");
  if (input.nodes.length < 2 || input.nodes.length > 5) {
    errors.push(`nodes.length must be 2-5, got ${input.nodes.length}`);
  }

  let queryCount = 0;
  let weightSum = 0;
  let anyWeight = false;
  const nodeIds = new Set<string>();
  for (const node of input.nodes) {
    if (nodeIds.has(node.nodeId)) errors.push(`duplicate nodeId ${node.nodeId}`);
    nodeIds.add(node.nodeId);
    const nodeQueries = node.sourceCategories.reduce((sum, sc) => sum + sc.queries.length, 0);
    if (nodeQueries < 1) errors.push(`node ${node.nodeId} has no queries`);
    queryCount += nodeQueries;
    if (node.weight !== undefined) {
      anyWeight = true;
      weightSum += node.weight;
    }
  }
  if (input.totalQueriesPlanned !== queryCount) {
    errors.push(`totalQueriesPlanned (${input.totalQueriesPlanned}) != sum of node queries (${queryCount})`);
  }
  if (anyWeight && Math.abs(weightSum - 1) > 0.01) {
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
  for (const record of input.records) {
    if (!sourceRecordIds.has(record.recordId)) {
      errors.push(`ledger record ${record.recordId} has no matching sources-database record`);
    }
    if (!isFiniteInRange(record.strength, 0, 1)) errors.push(`record ${record.recordId} strength out of [0,1]`);
    if (!isFiniteInRange(record.recencyScore, 0, 1)) errors.push(`record ${record.recordId} recencyScore out of [0,1]`);
    if (!isFiniteInRange(record.credibilityScore, 0, 1)) errors.push(`record ${record.recordId} credibilityScore out of [0,1]`);
    const dangling = danglingIds(record.affectedNodeIds, queryPlanNodeIds);
    if (dangling.length) errors.push(`record ${record.recordId} affects unknown nodes: ${dangling.join(", ")}`);
  }
  const majority = input.summary.supportingYes - input.summary.supportingNo;
  if (majority !== 0 && Math.sign(input.summary.netStrength) !== Math.sign(majority)) {
    errors.push("summary.netStrength sign does not match supporting majority");
  }
  return result(errors);
}

export function validateConditionalModel(input: ConditionalModel, evidenceLedgerIds: Set<string>): ValidationResult {
  const errors: string[] = [];
  if (input.nodes.length === 0) {
    errors.push("conditional model has no nodes");
    return result(errors);
  }

  let product = 1;
  for (const node of input.nodes) {
    if (!isFiniteInRange(node.probability, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX)) {
      errors.push(`node ${node.nodeId} probability ${node.probability} out of [${CONDITIONAL_NODE_MIN},${CONDITIONAL_NODE_MAX}]`);
    }
    product *= node.probability;
    const dangling = danglingIds(
      [...node.supportingEvidenceIds, ...node.contradictingEvidenceIds],
      evidenceLedgerIds
    );
    if (dangling.length) errors.push(`node ${node.nodeId} references unknown evidence: ${dangling.join(", ")}`);
  }

  if (Math.abs(input.finalProbability.computed - product) > PROBABILITY_TOLERANCE) {
    errors.push(`finalProbability.computed (${input.finalProbability.computed}) != node product (${product})`);
  }
  const reportedMatchesComputed = Math.abs(input.finalProbability.reported - input.finalProbability.computed) <= PROBABILITY_TOLERANCE;
  if (!reportedMatchesComputed && !input.finalProbability.isAdjusted) {
    errors.push("finalProbability.reported diverges from computed without isAdjusted=true");
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
  for (const update of input.updates) {
    running += update.deltaProbability;
    const dangling = danglingIds(update.evidenceIds, evidenceLedgerIds);
    if (dangling.length) errors.push(`update #${update.order} references unknown evidence: ${dangling.join(", ")}`);
  }

  const finalValue = input.finalProbability.value;
  if (Math.abs(running - finalValue) > PROBABILITY_TOLERANCE) {
    errors.push(`base + sum(deltas) (${running}) != finalProbability.value (${finalValue})`);
  }
  const ci = input.finalProbability.credibleInterval;
  if (!(ci.low <= finalValue && finalValue <= ci.high)) {
    errors.push(`credibleInterval [${ci.low}, ${ci.high}] does not bracket finalProbability.value (${finalValue})`);
  }
  if (!isFiniteInRange(input.aiProb, 0, 1) || input.aiProb <= 0 || input.aiProb >= 1) {
    errors.push(`aiProb (${input.aiProb}) must be in the open interval (0,1)`);
  }
  if (Math.abs(input.aiProb - finalValue) > PROBABILITY_TOLERANCE) {
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

  // Live hand-off mirror must agree with the bayes ledger when both are present.
  if (model.bayes_ledger && model.aiProb !== undefined) {
    if (Math.abs(model.aiProb - model.bayes_ledger.aiProb) > PROBABILITY_TOLERANCE) {
      errors.push("wrapper.aiProb does not mirror bayes_ledger.aiProb");
    }
  }
  return result(errors);
}

export { ok as okResult };
