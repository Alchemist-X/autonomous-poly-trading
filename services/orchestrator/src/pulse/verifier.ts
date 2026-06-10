// Stage-6 second pass — independent Opus verifier.
//
// A separate Opus call that re-reads the structured model + bayes ledger and judges whether the
// arithmetic and evidence use are sound. This is an EXTRA opinion on top of the deterministic
// validators (which remain the hard gate). It must not see market pricing. Best-effort: if the
// verifier call fails we do not block — the deterministic validators already guarantee internal
// consistency.

import type { BayesDeltaLedger, ConditionalModel } from "./stage-artifacts.js";
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function buildVerifierPrompt(input: VerifierInput): string {
  const nodes = input.conditionalModel.nodes
    .map((node) => `- ${node.label}: P=${node.probability.toFixed(4)}`)
    .join("\n");
  const updates = input.bayesLedger.updates
    .map((update) => `- ${update.label}: ${update.direction} delta=${update.deltaProbability.toFixed(4)} -> ${update.posteriorProbability.toFixed(4)}`)
    .join("\n");
  // market price intentionally excluded.
  return [
    "You are an independent verifier for a forecasting decision. Check internal consistency only.",
    "Do NOT reference any market price.",
    "",
    "Conditional model nodes:",
    nodes,
    `Conditional model final: computed=${input.conditionalModel.finalProbability.computed.toFixed(4)} reported=${input.conditionalModel.finalProbability.reported.toFixed(4)}`,
    "",
    `Bayes base: ${input.bayesLedger.initialAssumptions.baseProbability.toFixed(4)}`,
    "Bayes updates:",
    updates,
    `Bayes final: ${input.bayesLedger.finalProbability.value.toFixed(4)}`,
    "",
    "Judge whether the node product, the updates, and the evidence use are internally consistent.",
    'Return ONLY: { "consistent": boolean, "issues": string[] }'
  ].join("\n");
}

export async function runStageVerifier(input: VerifierInput): Promise<VerifierResult> {
  try {
    const response = await input.callLlm({
      prompt: buildVerifierPrompt(input),
      label: `verifier:${input.marketSlug}`,
      model: modelForStage("verifier")
    });
    const record = asRecord(response.json);
    return {
      consistent: typeof record.consistent === "boolean" ? record.consistent : true,
      issues: asStringArray(record.issues)
    };
  } catch {
    return { consistent: true, issues: ["verifier call failed; relying on deterministic validators"] };
  }
}
