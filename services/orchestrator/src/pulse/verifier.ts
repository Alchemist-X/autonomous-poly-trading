// Stage-6 second pass — independent Opus verifier.
//
// A separate Opus call that re-reads the structured model + bayes ledger and judges whether the
// arithmetic and evidence use are sound. This is an EXTRA opinion on top of the deterministic
// validators (which remain the hard gate). It must not see market pricing. Best-effort: if the
// verifier call fails we do not block — the deterministic validators already guarantee internal
// consistency.

import type { BayesDeltaLedger, BayesUpdateDirection, ConditionalModel } from "./stage-artifacts.js";
import { asRecord, asStringArray } from "./stage-coerce.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface VerifierInput {
  marketSlug: string;
  conditionalModel: ConditionalModel;
  bayesLedger: BayesDeltaLedger;
  callLlm: StageLlmCaller;
}

export interface VerifierResult {
  consistent: boolean;
  issues: string[];
}

const MALFORMED_SHAPE_ISSUE =
  "verifier returned malformed shape; treating as pass — deterministic validators remain the gate";

/**
 * The narrow, price-free projection of the decision artifacts that the verifier prompt is allowed
 * to render. By construction this type carries no marketProb / aiProb, so the prompt builder
 * cannot leak market pricing even by accident — the quarantine is enforced at the type level.
 */
interface VerifierPromptView {
  conditionalNodes: ReadonlyArray<{ label: string; probability: number }>;
  conditionalFinal: { computed: number; reported: number };
  bayesBaseProbability: number;
  bayesUpdates: ReadonlyArray<{
    label: string;
    direction: BayesUpdateDirection;
    deltaProbability: number;
    posteriorProbability: number;
  }>;
  bayesFinalValue: number;
}

function toVerifierPromptView(conditionalModel: ConditionalModel, bayesLedger: BayesDeltaLedger): VerifierPromptView {
  // market price intentionally excluded — this projection is the ONLY data path into the prompt.
  return {
    conditionalNodes: conditionalModel.nodes.map((node) => ({ label: node.label, probability: node.probability })),
    conditionalFinal: {
      computed: conditionalModel.finalProbability.computed,
      reported: conditionalModel.finalProbability.reported
    },
    bayesBaseProbability: bayesLedger.initialAssumptions.baseProbability,
    bayesUpdates: bayesLedger.updates.map((update) => ({
      label: update.label,
      direction: update.direction,
      deltaProbability: update.deltaProbability,
      posteriorProbability: update.posteriorProbability
    })),
    bayesFinalValue: bayesLedger.finalProbability.value
  };
}

function buildVerifierPrompt(view: VerifierPromptView): string {
  const nodes = view.conditionalNodes.map((node) => `- ${node.label}: P=${node.probability.toFixed(4)}`).join("\n");
  const updates = view.bayesUpdates
    .map((update) => `- ${update.label}: ${update.direction} delta=${update.deltaProbability.toFixed(4)} -> ${update.posteriorProbability.toFixed(4)}`)
    .join("\n");
  return [
    "You are an independent verifier for a forecasting decision. Check internal consistency only.",
    "Do NOT reference any market price.",
    "",
    "Conditional model nodes:",
    nodes,
    `Conditional model final: computed=${view.conditionalFinal.computed.toFixed(4)} reported=${view.conditionalFinal.reported.toFixed(4)}`,
    "",
    `Bayes base: ${view.bayesBaseProbability.toFixed(4)}`,
    "Bayes updates:",
    updates,
    `Bayes final: ${view.bayesFinalValue.toFixed(4)}`,
    "",
    "Judge whether the node product, the updates, and the evidence use are internally consistent.",
    'Return ONLY: { "consistent": boolean, "issues": string[] }'
  ].join("\n");
}

export async function runStageVerifier(input: VerifierInput): Promise<VerifierResult> {
  try {
    const response = await input.callLlm({
      prompt: buildVerifierPrompt(toVerifierPromptView(input.conditionalModel, input.bayesLedger)),
      label: `verifier:${input.marketSlug}`,
      model: modelForStage("verifier")
    });
    const record = asRecord(response.json);
    const issues = asStringArray(record.issues);
    if (typeof record.consistent !== "boolean") {
      // Fail-open like the catch branch, but make the malformed response VISIBLE downstream.
      return { consistent: true, issues: [...issues, MALFORMED_SHAPE_ISSUE] };
    }
    return { consistent: record.consistent, issues };
  } catch {
    return { consistent: true, issues: ["verifier call failed; relying on deterministic validators"] };
  }
}
