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
  PROBABILITY_TOLERANCE,
  validateBayesDeltaLedger,
  type BayesDeltaLedger,
  type BayesUpdate,
  type BayesUpdateDirection,
  type ConditionalModel,
  type EvidenceLedger
} from "./stage-artifacts.js";
import { asEnumValue, asRecord, asStringArray, asText, clamp } from "./stage-coerce.js";
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

const BAYES_DIRECTIONS: readonly BayesUpdateDirection[] = ["for-yes", "for-no"];

/**
 * Fabricated fallback half-width for the credible interval when the model omits one. This is NOT
 * a statistically derived spread — it only guarantees a non-degenerate interval that brackets the
 * point estimate so downstream consumers never see a zero-width or missing CI.
 */
const DEFAULT_CREDIBLE_HALF_WIDTH = 0.08;

/**
 * Type-level price quarantine: the prompt builder deliberately accepts ONLY the base probability
 * and the evidence ledger, so the quarantined market data (marketProb / outcomeLabel) cannot leak
 * into the prompt by construction — the values are simply not in scope here.
 */
interface BayesPromptInput {
  base: number;
  evidenceLedger: EvidenceLedger;
}

function buildBayesPrompt({ base, evidenceLedger }: BayesPromptInput): string {
  const evidence = evidenceLedger.records
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

interface ChainState {
  running: number;
  updates: BayesUpdate[];
}

export async function buildBayesLedger(input: BayesLedgerInput): Promise<BayesDeltaLedger> {
  // marketProb is caller-provided (not LLM output): a bad value here is a programmer error in the
  // wiring layer, not a degraded artifact, so fail fast before spending an LLM call.
  if (typeof input.marketProb !== "number" || !Number.isFinite(input.marketProb) || input.marketProb < 0 || input.marketProb > 1) {
    throw new Error(`bayes-ledger: marketProb must be a finite number in [0,1], got ${String(input.marketProb)}`);
  }

  const ledgerIds = new Set(input.evidenceLedger.records.map((record) => record.recordId));
  const base = clamp(input.conditionalModel.finalProbability.reported, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX);

  const response = await input.callLlm({
    prompt: buildBayesPrompt({ base, evidenceLedger: input.evidenceLedger }),
    label: `bayes-ledger:${input.marketSlug}`,
    model: modelForStage("bayes_ledger")
  });
  const root = asRecord(response.json);
  const rawUpdates = Array.isArray(root.updates) ? root.updates : [];

  // Drop updates whose cited evidence is entirely hallucinated: once every evidenceId is filtered
  // out the update cites nothing, and "no evidence = no probability movement" — applying its delta
  // would smuggle unauditable probability mass into the chain (the validator rejects empty
  // evidenceIds for the same reason). The posterior chain is recomputed over the survivors and
  // their orders renumbered 1..n.
  const citedUpdates = rawUpdates
    .map((value) => asRecord(value))
    .map((record) => ({ record, evidenceIds: asStringArray(record.evidenceIds).filter((id) => ledgerIds.has(id)) }))
    .filter(({ evidenceIds }) => evidenceIds.length > 0);

  const chain = citedUpdates.reduce<ChainState>(
    (state, { record, evidenceIds }, index) => {
      const rawDelta = typeof record.deltaProbability === "number" && Number.isFinite(record.deltaProbability) ? record.deltaProbability : 0;
      const posterior = clamp(state.running + rawDelta, CONDITIONAL_NODE_MIN, CONDITIONAL_NODE_MAX);
      const delta = posterior - state.running;
      // Direction is derived from the recomputed delta, never trusted from the LLM when it
      // contradicts the sign (the validator rejects that). Within tolerance the LLM direction is
      // kept as a label-only hint, defaulting to "for-yes".
      const llmDirection = asEnumValue(record.direction, BAYES_DIRECTIONS);
      const direction: BayesUpdateDirection =
        delta >= PROBABILITY_TOLERANCE ? "for-yes" : delta <= -PROBABILITY_TOLERANCE ? "for-no" : (llmDirection ?? "for-yes");
      const update: BayesUpdate = {
        order: index + 1,
        label: asText(record.label) ?? `Update ${index + 1}`,
        evidenceIds,
        direction,
        deltaProbability: delta,
        posteriorProbability: posterior,
        rationale: asText(record.rationale) ?? ""
      };
      return { running: posterior, updates: [...state.updates, update] };
    },
    { running: base, updates: [] }
  );

  const value = chain.running;
  const ci = asRecord(root.credibleInterval);
  const rawLow = typeof ci.low === "number" && Number.isFinite(ci.low) ? ci.low : value - DEFAULT_CREDIBLE_HALF_WIDTH;
  const rawHigh = typeof ci.high === "number" && Number.isFinite(ci.high) ? ci.high : value + DEFAULT_CREDIBLE_HALF_WIDTH;
  const low = clamp(Math.min(rawLow, value), CONDITIONAL_NODE_MIN, value);
  const high = clamp(Math.max(rawHigh, value), value, CONDITIONAL_NODE_MAX);

  const ledger: BayesDeltaLedger = {
    marketSlug: input.marketSlug,
    generatedAtUtc: input.generatedAtUtc,
    initialAssumptions: { baseProbability: base, rationale: asText(root.baseRationale) ?? "structured-model final probability" },
    updates: chain.updates,
    finalProbability: { value, credibleInterval: { low, high } },
    outcomeLabel: input.outcomeLabel,
    marketProb: input.marketProb,
    aiProb: value,
    verifiedConsistent: false
  };
  const validation = validateBayesDeltaLedger(ledger, ledgerIds);
  return { ...ledger, verifiedConsistent: validation.ok };
}
