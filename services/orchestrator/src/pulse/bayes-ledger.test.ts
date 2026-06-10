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

  it("drops update evidence ids that are not in the ledger", async () => {
    const ledger = await buildBayesLedger(baseInput(caller(updatesJson)));
    expect(ledger.updates[2]!.evidenceIds).toEqual(["src-1"]);
  });
});
