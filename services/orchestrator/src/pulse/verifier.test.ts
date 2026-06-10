import { describe, expect, it } from "vitest";
import { runStageVerifier, type VerifierInput } from "./verifier.js";
import type { BayesDeltaLedger, ConditionalModel } from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";

const conditionalModel: ConditionalModel = {
  marketSlug: "m",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  nodes: [{ nodeId: "A", label: "All", type: "base", probability: 0.29, precedingNodeIds: [], condition: "c", rationale: "r", supportingEvidenceIds: [], contradictingEvidenceIds: [] }],
  finalProbability: { computed: 0.29, reported: 0.29, isAdjusted: false },
  arithmeticConsistency: { isConsistent: true, gaps: [] }
};

const bayesLedger: BayesDeltaLedger = {
  marketSlug: "m",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  initialAssumptions: { baseProbability: 0.29, rationale: "r" },
  updates: [{ order: 1, label: "u", evidenceIds: [], direction: "for-no", deltaProbability: -0.07, posteriorProbability: 0.22, rationale: "r" }],
  finalProbability: { value: 0.22, credibleInterval: { low: 0.15, high: 0.3 } },
  outcomeLabel: "Yes",
  marketProb: 0.3,
  aiProb: 0.22,
  verifiedConsistent: true
};

const baseInput = (callLlm: StageLlmCaller): VerifierInput => ({ marketSlug: "m", conditionalModel, bayesLedger, callLlm });

describe("stage-6 verifier", () => {
  it("returns the model's consistency verdict", async () => {
    const caller: StageLlmCaller = async () => ({ raw: "{}", json: { consistent: true, issues: [] }, elapsedMs: 1 });
    expect(await runStageVerifier(baseInput(caller))).toEqual({ consistent: true, issues: [] });
  });

  it("surfaces flagged issues", async () => {
    const caller: StageLlmCaller = async () => ({ raw: "{}", json: { consistent: false, issues: ["arithmetic mismatch"] }, elapsedMs: 1 });
    const result = await runStageVerifier(baseInput(caller));
    expect(result.consistent).toBe(false);
    expect(result.issues).toContain("arithmetic mismatch");
  });

  it("does not block when the verifier call fails", async () => {
    const caller: StageLlmCaller = async () => {
      throw new Error("timeout");
    };
    const result = await runStageVerifier(baseInput(caller));
    expect(result.consistent).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
