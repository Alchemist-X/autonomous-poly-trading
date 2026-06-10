// Stage 5 producer — build the structured conditional model P(Yes)=P(A)xP(B|A)xP(C|A,B) (Opus).
//
// One Opus call decomposes the event into conditional nodes with evidence links. The code then
// enforces the machine invariants: node probabilities are clamped to [0.00001, 0.99999], the final
// computed probability is set to the exact node product, and any reported divergence is marked as a
// calibrated override with a reason. Evidence references are filtered to the stage-4 ledger ids.

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampNodeProbability(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? clamp(num, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX) : 0.5;
}

function coerceNode(value: unknown, index: number, ledgerIds: Set<string>): ConditionalModelNode {
  const record = asRecord(value);
  return {
    nodeId: asText(record.nodeId) ?? `c-${index + 1}`,
    label: asText(record.label) ?? `Factor ${index + 1}`,
    type: record.type === "conditional" || index > 0 ? "conditional" : "base",
    probability: clampNodeProbability(record.probability),
    precedingNodeIds: asStringArray(record.precedingNodeIds),
    condition: asText(record.condition) ?? "",
    rationale: asText(record.rationale) ?? "",
    residualUncertainty: asText(record.residualUncertainty),
    supportingEvidenceIds: asStringArray(record.supportingEvidenceIds).filter((id) => ledgerIds.has(id)),
    contradictingEvidenceIds: asStringArray(record.contradictingEvidenceIds).filter((id) => ledgerIds.has(id))
  };
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
    '    "probability": number,  // 0.00001..0.99999',
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
  const nodes = rawNodes.map((node, index) => coerceNode(node, index, ledgerIds));
  if (nodes.length === 0) {
    nodes.push({
      nodeId: "c-1",
      label: "Overall",
      type: "base",
      probability: 0.5,
      precedingNodeIds: [],
      condition: "event resolves yes",
      rationale: "insufficient structure returned; using a flat base rate",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: []
    });
  }

  const computed = nodes.reduce((product, node) => product * node.probability, 1);
  const reportedRaw = typeof root.reportedProbability === "number" ? root.reportedProbability : computed;
  const reported = clamp(reportedRaw, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX);
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
