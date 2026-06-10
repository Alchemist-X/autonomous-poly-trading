// Stage 6 producer — bayesian delta ledger (Opus).
//
// Starts from the stage-5 conditional model's probability as the base rate, then one Opus call
// proposes ordered evidence-driven updates. The code makes the ledger reconcile exactly: each
// posterior is clamped to (0.00001, 0.99999) and the stored delta is recomputed as the clamped
// step, so base + sum(deltas) == final value by construction. The market price is QUARANTINED —
// it is stamped onto the output for the live hand-off but never appears in the prompt.

import {
  CONDITIONAL_NODE_MAX,
  CONDITIONAL_NODE_MIN,
  validateBayesDeltaLedger,
  type BayesDeltaLedger,
  type BayesUpdate,
  type ConditionalModel,
  type EvidenceLedger
} from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface BayesLedgerInput {
  marketSlug: string;
  conditionalModel: ConditionalModel;
  evidenceLedger: EvidenceLedger;
  generatedAtUtc: string;
  /** Quarantined market data — stamped onto the result, never shown to the model. */
  outcomeLabel: string;
  marketProb: number;
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

function buildBayesPrompt(input: BayesLedgerInput, base: number): string {
  const evidence = input.evidenceLedger.records
    .map((record) => `- ${record.recordId}: ${record.direction} strength=${record.strength.toFixed(2)} recency=${record.recencyScore.toFixed(2)}`)
    .join("\n");
  // NOTE: market price is intentionally absent from this prompt (independent-forecasting firewall).
  return [
    "You are the bayesian-update stage of an independent forecasting pipeline.",
    `Start from a base probability of ${base.toFixed(4)} (from the structured model).`,
    "Apply the weighted evidence as ordered updates, moving the probability up or down. Do NOT",
    "reference any market price or odds — produce your own independent estimate.",
    "",
    "Weighted evidence:",
    evidence,
    "",
    "Return ONLY a JSON object:",
    "{",
    '  "baseRationale": string,',
    '  "updates": [ { "label": string, "evidenceIds": string[], "direction": "for-yes"|"for-no",',
    '    "deltaProbability": number, "rationale": string } ],',
    '  "credibleInterval": { "low": number, "high": number } | null',
    "}"
  ].join("\n");
}

export async function buildBayesLedger(input: BayesLedgerInput): Promise<BayesDeltaLedger> {
  const ledgerIds = new Set(input.evidenceLedger.records.map((record) => record.recordId));
  const base = clamp(input.conditionalModel.finalProbability.reported, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX);

  const response = await input.callLlm({
    prompt: buildBayesPrompt(input, base),
    label: `bayes-ledger:${input.marketSlug}`,
    model: modelForStage("bayes_ledger")
  });
  const root = asRecord(response.json);
  const rawUpdates = Array.isArray(root.updates) ? root.updates : [];

  let running = base;
  const updates: BayesUpdate[] = rawUpdates.map((value, index) => {
    const record = asRecord(value);
    const rawDelta = typeof record.deltaProbability === "number" && Number.isFinite(record.deltaProbability) ? record.deltaProbability : 0;
    const posterior = clamp(running + rawDelta, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX);
    const delta = posterior - running;
    running = posterior;
    const direction = record.direction === "for-yes" || record.direction === "for-no" ? record.direction : delta >= 0 ? "for-yes" : "for-no";
    return {
      order: index + 1,
      label: asText(record.label) ?? `Update ${index + 1}`,
      evidenceIds: asStringArray(record.evidenceIds).filter((id) => ledgerIds.has(id)),
      direction,
      deltaProbability: delta,
      posteriorProbability: posterior,
      rationale: asText(record.rationale) ?? ""
    };
  });

  const value = running;
  const ci = asRecord(root.credibleInterval);
  const rawLow = typeof ci.low === "number" ? ci.low : value - 0.08;
  const rawHigh = typeof ci.high === "number" ? ci.high : value + 0.08;
  const low = clamp(Math.min(rawLow, value), CONDITIONAL_NODE_MIN, value);
  const high = clamp(Math.max(rawHigh, value), value, CONDITIONAL_NODE_MAX);

  const ledger: BayesDeltaLedger = {
    marketSlug: input.marketSlug,
    generatedAtUtc: input.generatedAtUtc,
    initialAssumptions: { baseProbability: base, rationale: asText(root.baseRationale) ?? "structured-model final probability" },
    updates,
    finalProbability: { value, credibleInterval: { low, high } },
    outcomeLabel: input.outcomeLabel,
    marketProb: input.marketProb,
    aiProb: value,
    verifiedConsistent: false
  };
  const validation = validateBayesDeltaLedger(ledger, ledgerIds);
  return { ...ledger, verifiedConsistent: validation.ok };
}
