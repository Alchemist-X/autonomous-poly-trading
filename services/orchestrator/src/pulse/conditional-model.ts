// Stage 5 producer — build the structured conditional model P(Yes)=P(A)xP(B|A)xP(C|A,B) (Opus).
//
// One Opus call decomposes the event into conditional nodes with evidence links. The code then
// enforces the machine invariants: node probabilities are clamped to [CONDITIONAL_NODE_MIN,
// CONDITIONAL_NODE_MAX], node ids are deduplicated deterministically, precedingNodeIds are
// filtered to existing non-self nodes, the final computed probability is set to the exact node
// product, and any reported divergence is marked as a calibrated override with a reason.
// Evidence references are filtered to the stage-4 ledger ids.

import {
  CONDITIONAL_NODE_MAX,
  CONDITIONAL_NODE_MIN,
  PROBABILITY_TOLERANCE,
  validateConditionalModel,
  type ConditionalModel,
  type ConditionalModelNode,
  type EvidenceLedger,
  type QueryPlan,
  type ResolutionDefinition
} from "./stage-artifacts.js";
import { asClampedNumber, asRecord, asStringArray, asText, clamp } from "./stage-coerce.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface ConditionalModelInput {
  marketSlug: string;
  resolution?: ResolutionDefinition;
  queryPlan?: QueryPlan;
  evidenceLedger: EvidenceLedger;
  generatedAtUtc: string;
  callLlm: StageLlmCaller;
}

const FLAT_BASE_PROBABILITY = 0.5;

function coerceNode(value: unknown, index: number, ledgerIds: Set<string>): ConditionalModelNode {
  const record = asRecord(value);
  return {
    nodeId: asText(record.nodeId) ?? `c-${index + 1}`,
    label: asText(record.label) ?? `Factor ${index + 1}`,
    type: record.type === "conditional" || index > 0 ? "conditional" : "base",
    probability: asClampedNumber(record.probability, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX, FLAT_BASE_PROBABILITY),
    precedingNodeIds: asStringArray(record.precedingNodeIds),
    condition: asText(record.condition) ?? "",
    rationale: asText(record.rationale) ?? "",
    residualUncertainty: asText(record.residualUncertainty),
    supportingEvidenceIds: asStringArray(record.supportingEvidenceIds).filter((id) => ledgerIds.has(id)),
    contradictingEvidenceIds: asStringArray(record.contradictingEvidenceIds).filter((id) => ledgerIds.has(id))
  };
}

/** Single flat base node used when the LLM returns no usable node structure. */
function fallbackNode(): ConditionalModelNode {
  return {
    nodeId: "c-1",
    label: "Overall",
    type: "base",
    probability: FLAT_BASE_PROBABILITY,
    precedingNodeIds: [],
    condition: "event resolves yes",
    rationale: "insufficient structure returned; using a flat base rate",
    supportingEvidenceIds: [],
    contradictingEvidenceIds: []
  };
}

/** First id not yet taken: the candidate itself, else candidate-2, candidate-3, ... */
function firstAvailableId(candidate: string, used: ReadonlySet<string>): string {
  if (!used.has(candidate)) return candidate;
  for (let suffix = 2; ; suffix += 1) {
    const next = `${candidate}-${suffix}`;
    if (!used.has(next)) return next;
  }
}

/**
 * Deterministically deduplicate node ids so the artifact always passes the validator's duplicate
 * check: the first occurrence keeps its id, repeats are suffixed with "-2", "-3", ... (re-suffixed
 * until free, so a generated id can never collide with another id in the list). This also covers
 * the fallback id `c-${index+1}` colliding with an LLM-provided id.
 */
function withUniqueNodeIds(nodes: readonly ConditionalModelNode[]): ConditionalModelNode[] {
  const used = new Set<string>();
  return nodes.map((node) => {
    const nodeId = firstAvailableId(node.nodeId, used);
    used.add(nodeId);
    return nodeId === node.nodeId ? node : { ...node, nodeId };
  });
}

/**
 * Second pass after ids are final: keep only precedingNodeIds that reference an existing node and
 * are not the node itself (the validator rejects both dangling and self references).
 */
function withValidPrecedingIds(nodes: readonly ConditionalModelNode[]): ConditionalModelNode[] {
  const finalIds = new Set(nodes.map((node) => node.nodeId));
  return nodes.map((node) => {
    const precedingNodeIds = node.precedingNodeIds.filter((id) => id !== node.nodeId && finalIds.has(id));
    return precedingNodeIds.length === node.precedingNodeIds.length ? node : { ...node, precedingNodeIds };
  });
}

function buildConditionalPrompt(input: ConditionalModelInput): string {
  const nodes = input.queryPlan?.nodes.map((node) => `- ${node.nodeId}: ${node.label} (${node.condition})`).join("\n") ?? "(no query plan)";
  const evidence = input.evidenceLedger.records
    .map((record) => `- ${record.recordId}: ${record.direction} strength=${record.strength.toFixed(2)} credibility=${record.credibilityScore.toFixed(2)}`)
    .join("\n");
  return [
    "You are the structured-model stage of an independent forecasting pipeline.",
    "Decompose P(Yes) into a chain of conditional probabilities P(A) x P(B|A) x P(C|A,B) ...,",
    "one node per necessary condition. Do NOT reference any market price or odds.",
    "",
    `Question: ${input.resolution?.officialQuestion ?? input.marketSlug}`,
    "Necessary-condition nodes:",
    nodes,
    "Weighted evidence (id: direction strength credibility):",
    evidence,
    "",
    "Return ONLY a JSON object:",
    "{",
    '  "nodes": [ { "nodeId": string, "label": string, "type": "base"|"conditional",',
    `    "probability": number,  // ${CONDITIONAL_NODE_MIN}..${CONDITIONAL_NODE_MAX}`,
    '    "precedingNodeIds": string[], "condition": string, "rationale": string,',
    '    "residualUncertainty": string | null,',
    '    "supportingEvidenceIds": string[], "contradictingEvidenceIds": string[] } ],',
    '  "reportedProbability": number,  // your overall P(Yes); usually the node product',
    '  "adjustmentReason": string | null  // required only if you override the product'
    , "}"
  ].join("\n");
}

export async function buildConditionalModel(input: ConditionalModelInput): Promise<ConditionalModel> {
  const ledgerIds = new Set(input.evidenceLedger.records.map((record) => record.recordId));
  const response = await input.callLlm({
    prompt: buildConditionalPrompt(input),
    label: `conditional-model:${input.marketSlug}`,
    model: modelForStage("conditional_model")
  });

  const root = asRecord(response.json);
  const rawNodes = Array.isArray(root.nodes) ? root.nodes : [];
  const coerced = rawNodes.map((node, index) => coerceNode(node, index, ledgerIds));
  const nodes = withValidPrecedingIds(withUniqueNodeIds(coerced.length > 0 ? coerced : [fallbackNode()]));

  const computed = nodes.reduce((product, node) => product * node.probability, 1);
  const computedInRange = clamp(computed, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX);
  const reported = root.reportedProbability == null
    ? computedInRange
    : asClampedNumber(root.reportedProbability, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX, computedInRange);
  const isAdjusted = Math.abs(reported - computed) > PROBABILITY_TOLERANCE;
  const adjustmentReason = isAdjusted ? asText(root.adjustmentReason) ?? "calibrated override of the raw node product" : undefined;

  const draft: ConditionalModel = {
    marketSlug: input.marketSlug,
    generatedAtUtc: input.generatedAtUtc,
    nodes,
    finalProbability: { computed, reported, isAdjusted, adjustmentReason },
    arithmeticConsistency: { isConsistent: true, gaps: [] }
  };
  const validation = validateConditionalModel(draft, ledgerIds);
  return { ...draft, arithmeticConsistency: { isConsistent: validation.ok, gaps: validation.errors } };
}
