import { describe, expect, it } from "vitest";
import { runStageVerifier, type VerifierInput } from "./verifier.js";
import type { BayesDeltaLedger, ConditionalModel } from "./stage-artifacts.js";
import type { StageLlmCaller, StageLlmRequest } from "./stage-llm.js";

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

  it("fails open with a visible marker when the response lacks a boolean consistent", async () => {
    const caller: StageLlmCaller = async () => ({ raw: "{}", json: { issues: ["minor note"] }, elapsedMs: 1 });
    const result = await runStageVerifier(baseInput(caller));
    expect(result.consistent).toBe(true);
    expect(result.issues).toContain("minor note");
    expect(result.issues.some((issue) => issue.includes("malformed shape"))).toBe(true);
  });

  it("treats a non-boolean consistent field as malformed", async () => {
    const caller: StageLlmCaller = async () => ({ raw: "{}", json: { consistent: "yes", issues: [] }, elapsedMs: 1 });
    const result = await runStageVerifier(baseInput(caller));
    expect(result.consistent).toBe(true);
    expect(result.issues.some((issue) => issue.includes("malformed shape"))).toBe(true);
  });

  it("never leaks the market price into the verifier prompt", async () => {
    let captured = "";
    const caller: StageLlmCaller = async (request: StageLlmRequest) => {
      captured = request.prompt;
      return { raw: "{}", json: { consistent: true, issues: [] }, elapsedMs: 1 };
    };
    // distinctive marketProb value that appears nowhere else in the fixtures
    const quarantined: VerifierInput = { ...baseInput(caller), bayesLedger: { ...bayesLedger, marketProb: 0.7777 } };
    await runStageVerifier(quarantined);
    expect(captured).toContain("0.2900"); // conditional node probability IS rendered
    expect(captured).toContain("0.2200"); // bayes final IS rendered
    expect(captured).not.toContain("0.7777"); // marketProb never appears in any form
    expect(captured).not.toContain("marketProb");
  });
});
