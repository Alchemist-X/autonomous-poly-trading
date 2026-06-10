import { describe, expect, it } from "vitest";
import { buildBayesLedger, type BayesLedgerInput } from "./bayes-ledger.js";
import { validateBayesDeltaLedger, type ConditionalModel, type EvidenceLedger } from "./stage-artifacts.js";
import type { StageLlmCaller, StageLlmRequest } from "./stage-llm.js";

const conditionalModel: ConditionalModel = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  nodes: [{ nodeId: "A", label: "All", type: "base", probability: 0.29, precedingNodeIds: [], condition: "yes", rationale: "r", supportingEvidenceIds: [], contradictingEvidenceIds: [] }],
  finalProbability: { computed: 0.29, reported: 0.29, isAdjusted: false },
  arithmeticConsistency: { isConsistent: true, gaps: [] }
};

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

function caller(json: unknown, capture?: (request: StageLlmRequest) => void): StageLlmCaller {
  return async (request) => {
    capture?.(request);
    return { raw: JSON.stringify(json), json, elapsedMs: 1 };
  };
}

const updatesJson = {
  baseRationale: "structured base",
  updates: [
    { label: "Missile strike", evidenceIds: ["src-2"], direction: "for-no", deltaProbability: -0.04, rationale: "escalation" },
    { label: "Progress claim", evidenceIds: ["src-1"], direction: "for-yes", deltaProbability: 0.02, rationale: "tactic" },
    { label: "Denial", evidenceIds: ["src-1", "ghost"], direction: "for-no", deltaProbability: -0.05, rationale: "denies talks" }
  ],
  credibleInterval: { low: 0.15, high: 0.3 }
};

const baseInput = (callLlm: StageLlmCaller): BayesLedgerInput => ({
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  conditionalModel,
  evidenceLedger,
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  outcomeLabel: "Yes",
  marketProb: 0.3,
  callLlm
});

describe("stage 6 — bayes-ledger producer", () => {
  it("reconciles base + deltas to the final value and validates", async () => {
    const ledger = await buildBayesLedger(baseInput(caller(updatesJson)));
    expect(ledger.finalProbability.value).toBeCloseTo(0.22, 6);
    expect(ledger.aiProb).toBeCloseTo(0.22, 6);
    expect(ledger.verifiedConsistent).toBe(true);
    expect(validateBayesDeltaLedger(ledger, ledgerIds).ok).toBe(true);
  });

  it("stamps the quarantined market data without exposing it to the model", async () => {
    let prompt = "";
    const ledger = await buildBayesLedger(baseInput(caller(updatesJson, (req) => { prompt = req.prompt; })));
    expect(ledger.marketProb).toBe(0.3);
    expect(ledger.outcomeLabel).toBe("Yes");
    // the market price must not leak into the reasoning prompt
    expect(prompt).not.toContain("0.3");
    expect(prompt.toLowerCase()).toContain("do not");
  });

  it("keeps no trace of marketProb or outcomeLabel in the prompt (distinctive values)", async () => {
    let prompt = "";
    const input: BayesLedgerInput = {
      ...baseInput(caller(updatesJson, (req) => { prompt = req.prompt; })),
      marketProb: 0.123456,
      outcomeLabel: "ZephyrOutcome"
    };
    const ledger = await buildBayesLedger(input);
    expect(prompt).not.toContain("0.123456");
    expect(prompt).not.toContain("ZephyrOutcome");
    // the base probability IS allowed in the prompt — it comes from the structured model
    expect(prompt).toContain("0.2900");
    // the quarantined values are still stamped on the artifact for the live hand-off
    expect(ledger.marketProb).toBe(0.123456);
    expect(ledger.outcomeLabel).toBe("ZephyrOutcome");
  });

  it("drops update evidence ids that are not in the ledger", async () => {
    const ledger = await buildBayesLedger(baseInput(caller(updatesJson)));
    expect(ledger.updates[2]!.evidenceIds).toEqual(["src-1"]);
  });

  it("drops an update whose evidence ids are all hallucinated and renumbers the chain", async () => {
    const json = {
      baseRationale: "b",
      updates: [
        { label: "Real one", evidenceIds: ["src-1"], direction: "for-no", deltaProbability: -0.04, rationale: "r1" },
        { label: "Hallucinated", evidenceIds: ["ghost-1", "ghost-2"], direction: "for-yes", deltaProbability: 0.3, rationale: "made up" },
        { label: "Real two", evidenceIds: ["src-2"], direction: "for-yes", deltaProbability: 0.02, rationale: "r2" }
      ],
      credibleInterval: { low: 0.1, high: 0.5 }
    };
    const ledger = await buildBayesLedger(baseInput(caller(json)));
    // the hallucinated update's +0.3 delta must NOT be applied: no evidence = no movement
    expect(ledger.updates).toHaveLength(2);
    expect(ledger.updates.map((u) => u.label)).toEqual(["Real one", "Real two"]);
    expect(ledger.updates.map((u) => u.order)).toEqual([1, 2]);
    expect(ledger.finalProbability.value).toBeCloseTo(0.27, 6);
    expect(ledger.verifiedConsistent).toBe(true);
    expect(validateBayesDeltaLedger(ledger, ledgerIds).ok).toBe(true);
  });

  it("normalizes an LLM direction that contradicts the delta sign", async () => {
    const json = {
      baseRationale: "b",
      updates: [
        { label: "Contradicting", evidenceIds: ["src-1"], direction: "for-no", deltaProbability: 0.05, rationale: "positive move mislabelled" }
      ],
      credibleInterval: { low: 0.2, high: 0.5 }
    };
    const ledger = await buildBayesLedger(baseInput(caller(json)));
    expect(ledger.updates[0]!.direction).toBe("for-yes");
    expect(ledger.verifiedConsistent).toBe(true);
  });

  it("keeps the LLM direction when the delta is within tolerance", async () => {
    const json = {
      baseRationale: "b",
      updates: [
        { label: "Flat", evidenceIds: ["src-1"], direction: "for-no", deltaProbability: 0, rationale: "no net move" }
      ],
      credibleInterval: { low: 0.2, high: 0.5 }
    };
    const ledger = await buildBayesLedger(baseInput(caller(json)));
    expect(ledger.updates[0]!.direction).toBe("for-no");
    expect(ledger.verifiedConsistent).toBe(true);
  });

  it("clamps a runaway posterior and recomputes the delta so the chain still reconciles", async () => {
    const highBaseModel: ConditionalModel = {
      ...conditionalModel,
      finalProbability: { computed: 0.999, reported: 0.999, isAdjusted: false }
    };
    const json = {
      baseRationale: "b",
      updates: [
        { label: "Huge jump", evidenceIds: ["src-1"], direction: "for-yes", deltaProbability: 0.5, rationale: "overshoot" }
      ],
      credibleInterval: null
    };
    const ledger = await buildBayesLedger({ ...baseInput(caller(json)), conditionalModel: highBaseModel });
    expect(ledger.updates[0]!.posteriorProbability).toBeCloseTo(0.99999, 8);
    expect(ledger.updates[0]!.deltaProbability).toBeCloseTo(0.00099, 8);
    expect(ledger.finalProbability.value).toBeCloseTo(0.99999, 8);
    expect(ledger.verifiedConsistent).toBe(true);
    expect(validateBayesDeltaLedger(ledger, ledgerIds).ok).toBe(true);
  });

  it("falls back to a fabricated credible interval that brackets the final value", async () => {
    const json = {
      baseRationale: "b",
      updates: [
        { label: "Down", evidenceIds: ["src-2"], direction: "for-no", deltaProbability: -0.04, rationale: "r" }
      ],
      credibleInterval: null
    };
    const ledger = await buildBayesLedger(baseInput(caller(json)));
    const { value, credibleInterval } = ledger.finalProbability;
    expect(value).toBeCloseTo(0.25, 6);
    expect(credibleInterval.low).toBeCloseTo(0.17, 6);
    expect(credibleInterval.high).toBeCloseTo(0.33, 6);
    expect(credibleInterval.low).toBeLessThanOrEqual(value);
    expect(credibleInterval.high).toBeGreaterThanOrEqual(value);
    expect(ledger.verifiedConsistent).toBe(true);
  });

  it("throws fast on a NaN marketProb (programmer error, not a degraded artifact)", async () => {
    let called = false;
    const input = { ...baseInput(caller(updatesJson, () => { called = true; })), marketProb: Number.NaN };
    await expect(buildBayesLedger(input)).rejects.toThrow(/marketProb/);
    expect(called).toBe(false);
  });

  it("throws fast on an out-of-range marketProb", async () => {
    await expect(buildBayesLedger({ ...baseInput(caller(updatesJson)), marketProb: 1.2 })).rejects.toThrow(/marketProb/);
    await expect(buildBayesLedger({ ...baseInput(caller(updatesJson)), marketProb: -0.01 })).rejects.toThrow(/marketProb/);
  });
});
