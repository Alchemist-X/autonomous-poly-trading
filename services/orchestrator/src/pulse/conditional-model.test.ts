import { describe, expect, it } from "vitest";
import { buildConditionalModel, type ConditionalModelInput } from "./conditional-model.js";
import { CONDITIONAL_NODE_MAX, CONDITIONAL_NODE_MIN, validateConditionalModel, type EvidenceLedger } from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";

const evidenceLedger: EvidenceLedger = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  records: [
    { recordId: "src-1", direction: "supports-no", strength: 0.6, recencyScore: 0.8, primarySource: true, corroborationCount: 1, credibilityScore: 0.9, affectedNodeIds: ["nodeA"] },
    { recordId: "src-2", direction: "supports-no", strength: 0.5, recencyScore: 0.95, primarySource: false, corroborationCount: 1, credibilityScore: 0.6, affectedNodeIds: ["nodeA"] }
  ],
  summary: { totalRecords: 2, supportingYes: 0, supportingNo: 2, netStrength: -1.1 }
};
const ledgerIds = new Set(["src-1", "src-2"]);

const baseInput = (callLlm: StageLlmCaller): ConditionalModelInput => ({
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  evidenceLedger,
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  callLlm
});

function caller(json: unknown): StageLlmCaller {
  return async () => ({ raw: JSON.stringify(json), json, elapsedMs: 1 });
}

const goodModel = {
  nodes: [
    { nodeId: "A", label: "Agreement", type: "base", probability: 0.45, precedingNodeIds: [], condition: "agreement", rationale: "fragile", supportingEvidenceIds: [], contradictingEvidenceIds: ["src-1"] },
    { nodeId: "B", label: "Nuclear terms", type: "conditional", probability: 0.65, precedingNodeIds: ["A"], condition: "terms", rationale: "core", supportingEvidenceIds: [], contradictingEvidenceIds: [] },
    { nodeId: "C", label: "Recognised", type: "conditional", probability: 0.99, precedingNodeIds: ["A", "B"], condition: "recognised", rationale: "near certain", supportingEvidenceIds: [], contradictingEvidenceIds: [] }
  ],
  reportedProbability: 0.289575
};

describe("stage 5 — conditional-model producer", () => {
  it("sets the computed final to the node product and validates", async () => {
    const model = await buildConditionalModel(baseInput(caller(goodModel)));
    expect(model.finalProbability.computed).toBeCloseTo(0.289575, 6);
    expect(model.finalProbability.isAdjusted).toBe(false);
    expect(model.arithmeticConsistency.isConsistent).toBe(true);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("marks a calibrated override when reported diverges from the product", async () => {
    const model = await buildConditionalModel(baseInput(caller({ ...goodModel, reportedProbability: 0.24 })));
    expect(model.finalProbability.isAdjusted).toBe(true);
    expect(model.finalProbability.adjustmentReason).toBeTruthy();
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("clamps overconfident node probabilities to <= 0.99999", async () => {
    const model = await buildConditionalModel(baseInput(caller({
      ...goodModel,
      nodes: [{ ...goodModel.nodes[0], probability: 1.5 }, goodModel.nodes[1], goodModel.nodes[2]]
    })));
    expect(model.nodes[0]!.probability).toBe(CONDITIONAL_NODE_MAX);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("drops evidence references that are not in the ledger", async () => {
    const model = await buildConditionalModel(baseInput(caller({
      ...goodModel,
      nodes: [{ ...goodModel.nodes[0], contradictingEvidenceIds: ["src-1", "ghost"] }, goodModel.nodes[1], goodModel.nodes[2]]
    })));
    expect(model.nodes[0]!.contradictingEvidenceIds).toEqual(["src-1"]);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("falls back to a single flat 0.5 base node on garbage output and still validates", async () => {
    const model = await buildConditionalModel(baseInput(caller("not even a JSON object")));
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0]).toMatchObject({ nodeId: "c-1", type: "base", probability: 0.5, precedingNodeIds: [] });
    expect(model.finalProbability.computed).toBe(0.5);
    expect(model.finalProbability.isAdjusted).toBe(false);
    expect(model.arithmeticConsistency.isConsistent).toBe(true);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("falls back to the flat base node when the nodes array is empty", async () => {
    const model = await buildConditionalModel(baseInput(caller({ nodes: [] })));
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0]!.nodeId).toBe("c-1");
    expect(model.finalProbability.reported).toBe(0.5);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("dedupes duplicate LLM node ids deterministically and validates", async () => {
    const model = await buildConditionalModel(baseInput(caller({
      ...goodModel,
      nodes: [
        { ...goodModel.nodes[0], nodeId: "A" },
        { ...goodModel.nodes[1], nodeId: "A", precedingNodeIds: ["A"] },
        { ...goodModel.nodes[2], nodeId: "A", precedingNodeIds: ["A"] }
      ]
    })));
    expect(model.nodes.map((node) => node.nodeId)).toEqual(["A", "A-2", "A-3"]);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("uniques a fallback id that collides with an LLM-provided id", async () => {
    const model = await buildConditionalModel(baseInput(caller({
      nodes: [
        { nodeId: "c-2", label: "First", type: "base", probability: 0.4, precedingNodeIds: [], condition: "first", rationale: "r" },
        { label: "Second", type: "conditional", probability: 0.6, precedingNodeIds: ["c-2"], condition: "second", rationale: "r" }
      ]
    })));
    expect(model.nodes.map((node) => node.nodeId)).toEqual(["c-2", "c-2-2"]);
    expect(model.nodes[1]!.precedingNodeIds).toEqual(["c-2"]);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("drops hallucinated precedingNodeIds that reference unknown nodes", async () => {
    const model = await buildConditionalModel(baseInput(caller({
      ...goodModel,
      nodes: [goodModel.nodes[0], { ...goodModel.nodes[1], precedingNodeIds: ["A", "ghost-node"] }, goodModel.nodes[2]]
    })));
    expect(model.nodes[1]!.precedingNodeIds).toEqual(["A"]);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("drops self-referencing precedingNodeIds", async () => {
    const model = await buildConditionalModel(baseInput(caller({
      ...goodModel,
      nodes: [goodModel.nodes[0], { ...goodModel.nodes[1], precedingNodeIds: ["B", "A"] }, goodModel.nodes[2]]
    })));
    expect(model.nodes[1]!.precedingNodeIds).toEqual(["A"]);
    expect(validateConditionalModel(model, ledgerIds).ok).toBe(true);
  });

  it("interpolates the node probability bounds into the prompt", async () => {
    const prompts: string[] = [];
    const callLlm: StageLlmCaller = async (request) => {
      prompts.push(request.prompt);
      return { raw: JSON.stringify(goodModel), json: goodModel, elapsedMs: 1 };
    };
    await buildConditionalModel(baseInput(callLlm));
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain(`${CONDITIONAL_NODE_MIN}..${CONDITIONAL_NODE_MAX}`);
  });
});
