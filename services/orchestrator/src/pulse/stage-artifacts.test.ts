import { describe, expect, it } from "vitest";
import {
  PROBABILITY_TOLERANCE,
  isResolutionLiveReady,
  validateBayesDeltaLedger,
  validateConditionalModel,
  validateDecisionModelIntegrity,
  validateEvidenceLedger,
  validateQueryPlan,
  validateResolutionDefinition,
  validateSourcesDatabase,
  type BayesDeltaLedger,
  type CandidateDecisionModel,
  type ConditionalModel,
  type EvidenceLedger,
  type QueryPlan,
  type ResolutionDefinition,
  type SourcesDatabase
} from "./stage-artifacts.js";

// --- fixtures: a small, fully self-consistent Iran-style "Buy No" decision model ---

const resolution: ResolutionDefinition = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  officialQuestion: "Will the US and Iran reach a nuclear deal by June 30?",
  officialResolutionRules: "Resolves Yes if an official agreement covering nuclear terms is announced before the deadline.",
  resolutionSource: "https://polymarket.com/event/us-iran-nuclear-deal-by-june-30",
  representativeAuthority: "US State Department and Iran National Security Council",
  yesBoundary: { condition: "Signed agreement with nuclear clauses announced", meetsByDeadline: true },
  noBoundary: { condition: "No such agreement by the deadline", meetsByDeadline: true },
  deadline: "2026-06-30T23:59:59.000Z",
  timezone: "UTC",
  validationStatus: "valid",
  gaps: [],
  confidence: 0.7,
  definedAtUtc: "2026-06-05T00:00:00.000Z"
};

const queryPlan: QueryPlan = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  nodes: [
    {
      nodeId: "nodeA",
      label: "Diplomatic agreement reached",
      condition: "A formal diplomatic agreement is reached",
      weight: 0.5,
      sourceCategories: [{ category: "official", queries: ["US Iran nuclear talks statement"], expectedEvidence: ["official statement"] }]
    },
    {
      nodeId: "nodeB",
      label: "Substantively contains nuclear terms",
      condition: "The agreement substantively contains nuclear clauses",
      weight: 0.3,
      sourceCategories: [{ category: "mainstream", queries: ["Iran nuclear deal terms Reuters"], expectedEvidence: ["news report"] }]
    },
    {
      nodeId: "nodeC",
      label: "Arbiter recognises the deal",
      condition: "The market arbiter recognises the agreement",
      weight: 0.2,
      sourceCategories: [{ category: "third-party", queries: ["Polymarket resolution Iran deal"], expectedEvidence: ["resolution note"] }]
    }
  ],
  baseQueries: ["US Iran nuclear deal June 30"],
  totalQueriesPlanned: 3
};

const sourcesDatabase: SourcesDatabase = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  fetchedAtUtc: "2026-06-05T00:00:00.000Z",
  records: [
    {
      recordId: "src1",
      sourceUrl: "https://example.gov/iran-statement",
      sourceHost: "example.gov",
      sourceCategory: "official",
      retrievedAtUtc: "2026-06-05T00:00:00.000Z",
      retrievedVia: "web-search",
      publishedAtUtc: "2026-06-01T00:00:00.000Z",
      snippet: "Iran foreign ministry denies any current talks on nuclear details.",
      addressedNodeIds: ["nodeA"]
    },
    {
      recordId: "src2",
      sourceUrl: "https://example.com/missile-strike",
      sourceHost: "example.com",
      sourceCategory: "military-map",
      retrievedAtUtc: "2026-06-05T00:00:00.000Z",
      retrievedVia: "web-search",
      publishedAtUtc: "2026-06-03T00:00:00.000Z",
      snippet: "Iranian missile strike on Kuwait airport causes casualties.",
      addressedNodeIds: ["nodeA", "nodeB"]
    }
  ],
  summary: { totalRecords: 2, byCategory: { official: 1, "military-map": 1 } }
};

const evidenceLedger: EvidenceLedger = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  records: [
    { recordId: "src1", direction: "supports-no", strength: 0.6, recencyScore: 0.8, primarySource: true, corroborationCount: 1, credibilityScore: 0.9, affectedNodeIds: ["nodeA"] },
    { recordId: "src2", direction: "supports-no", strength: 0.5, recencyScore: 0.95, primarySource: false, corroborationCount: 2, credibilityScore: 0.6, affectedNodeIds: ["nodeA", "nodeB"] }
  ],
  // netStrength is the SUM of signed strengths (producer semantics): -(0.6 + 0.5) = -1.1
  summary: { totalRecords: 2, supportingYes: 0, supportingNo: 2, netStrength: -1.1 }
};

// P(A)=0.45, P(B|A)=0.65, P(C|A,B)=0.99 -> 0.289575
const conditionalModel: ConditionalModel = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  nodes: [
    { nodeId: "A", label: "Diplomatic agreement", type: "base", probability: 0.45, precedingNodeIds: [], condition: "agreement reached", rationale: "talks fragile", supportingEvidenceIds: [], contradictingEvidenceIds: ["src1"] },
    { nodeId: "B", label: "Nuclear clauses", type: "conditional", probability: 0.65, precedingNodeIds: ["A"], condition: "contains nuclear terms", rationale: "core demand", supportingEvidenceIds: [], contradictingEvidenceIds: [] },
    { nodeId: "C", label: "Arbiter recognises", type: "conditional", probability: 0.99, precedingNodeIds: ["A", "B"], condition: "recognised", rationale: "near certain if signed", supportingEvidenceIds: [], contradictingEvidenceIds: [] }
  ],
  finalProbability: { computed: 0.289575, reported: 0.289575, isAdjusted: false },
  arithmeticConsistency: { isConsistent: true, gaps: [] }
};

// Base = the conditional model's reported probability (stage 5 -> 6 linkage), chain:
// 0.289575 - 0.04 = 0.249575, + 0.02 = 0.269575, - 0.05 = 0.219575
const bayesLedger: BayesDeltaLedger = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  initialAssumptions: { baseProbability: 0.289575, rationale: "conditional model base rate" },
  updates: [
    { order: 1, label: "Missile strike escalation", evidenceIds: ["src2"], direction: "for-no", deltaProbability: -0.04, posteriorProbability: 0.249575, rationale: "military escalation poisons talks" },
    { order: 2, label: "Trump claims progress", evidenceIds: ["src1"], direction: "for-yes", deltaProbability: 0.02, posteriorProbability: 0.269575, rationale: "possibly negotiation tactic" },
    { order: 3, label: "Foreign ministry denial", evidenceIds: ["src1"], direction: "for-no", deltaProbability: -0.05, posteriorProbability: 0.219575, rationale: "denies talks exist" }
  ],
  finalProbability: { value: 0.219575, credibleInterval: { low: 0.15, high: 0.3 } },
  outcomeLabel: "Yes",
  marketProb: 0.3,
  aiProb: 0.219575,
  verifiedConsistent: true
};

function buildModel(): CandidateDecisionModel {
  return {
    marketSlug: "us-iran-nuclear-deal-by-june-30",
    generatedAtUtc: "2026-06-05T00:00:00.000Z",
    resolution,
    query_plan: queryPlan,
    sources_database: sourcesDatabase,
    evidence_ledger: evidenceLedger,
    conditional_model: conditionalModel,
    bayes_ledger: bayesLedger,
    outcomeLabel: "Yes",
    marketProb: 0.3,
    aiProb: 0.219575
  };
}

const nodeIds = new Set(queryPlan.nodes.map((n) => n.nodeId));
const sourceIds = new Set(sourcesDatabase.records.map((r) => r.recordId));
const ledgerIds = new Set(evidenceLedger.records.map((r) => r.recordId));

describe("stage 1 — resolution definition", () => {
  it("accepts a clear definition and rejects an unparsable deadline", () => {
    expect(validateResolutionDefinition(resolution).ok).toBe(true);
    expect(validateResolutionDefinition({ ...resolution, deadline: "not-a-date" }).ok).toBe(false);
    expect(validateResolutionDefinition({ ...resolution, yesBoundary: { ...resolution.yesBoundary, condition: "  " } }).ok).toBe(false);
    expect(validateResolutionDefinition({ ...resolution, confidence: 1.4 }).ok).toBe(false);
  });

  it("gates live readiness on validationStatus", () => {
    expect(isResolutionLiveReady(resolution)).toBe(true);
    expect(isResolutionLiveReady({ ...resolution, validationStatus: "unclarifiable" })).toBe(false);
  });
});

describe("stage 2 — query plan", () => {
  it("requires 2-5 nodes, >=1 query each, and a consistent total", () => {
    expect(validateQueryPlan(queryPlan).ok).toBe(true);
    expect(validateQueryPlan({ ...queryPlan, totalQueriesPlanned: 99 }).ok).toBe(false);
    expect(validateQueryPlan({ ...queryPlan, nodes: [queryPlan.nodes[0]!], totalQueriesPlanned: 1 }).ok).toBe(false);
  });

  it("rejects node weights that do not sum to ~1 when all nodes are weighted", () => {
    const skewed: QueryPlan = {
      ...queryPlan,
      nodes: queryPlan.nodes.map((n) => ({ ...n, weight: 0.1 }))
    };
    expect(validateQueryPlan(skewed).ok).toBe(false);
  });

  it("allows partially-weighted plans (the prompt makes weight optional per node)", () => {
    const partial: QueryPlan = {
      ...queryPlan,
      nodes: queryPlan.nodes.map((n, i) => (i === 0 ? { ...n, weight: 0.5 } : { ...n, weight: undefined }))
    };
    expect(validateQueryPlan(partial).ok).toBe(true);
  });

  it("rejects duplicate node ids and out-of-range weights", () => {
    const dup: QueryPlan = {
      ...queryPlan,
      nodes: queryPlan.nodes.map((n) => ({ ...n, nodeId: "same" }))
    };
    expect(validateQueryPlan(dup).ok).toBe(false);
    const negative: QueryPlan = {
      ...queryPlan,
      nodes: queryPlan.nodes.map((n, i) => ({ ...n, weight: i === 0 ? -0.5 : 0.75 }))
    };
    expect(validateQueryPlan(negative).ok).toBe(false);
  });

  it("rejects a node with zero queries", () => {
    const zeroQueries: QueryPlan = {
      ...queryPlan,
      nodes: [
        { ...queryPlan.nodes[0]!, sourceCategories: [{ category: "official", queries: [], expectedEvidence: [] }] },
        queryPlan.nodes[1]!,
        queryPlan.nodes[2]!
      ],
      totalQueriesPlanned: 2
    };
    expect(validateQueryPlan(zeroQueries).ok).toBe(false);
  });
});

describe("stage 3 — sources database (referential integrity to query plan)", () => {
  it("accepts records that address known nodes and rejects dangling node ids", () => {
    expect(validateSourcesDatabase(sourcesDatabase, nodeIds).ok).toBe(true);
    const dangling: SourcesDatabase = {
      ...sourcesDatabase,
      records: [{ ...sourcesDatabase.records[0]!, addressedNodeIds: ["ghost"] }, sourcesDatabase.records[1]!]
    };
    expect(validateSourcesDatabase(dangling, nodeIds).ok).toBe(false);
  });

  it("rejects a stored spoiler source regardless of how it was produced (firewall defense-in-depth)", () => {
    const spoiled: SourcesDatabase = {
      ...sourcesDatabase,
      records: [
        { ...sourcesDatabase.records[0]!, sourceUrl: "https://polymarket.com/event/foo", sourceHost: "polymarket.com" },
        sourcesDatabase.records[1]!
      ]
    };
    const res = validateSourcesDatabase(spoiled, nodeIds);
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("spoiler");
  });
});

describe("stage 4 — evidence ledger", () => {
  it("requires every record to map back to a sources-database record", () => {
    expect(validateEvidenceLedger(evidenceLedger, sourceIds, nodeIds).ok).toBe(true);
    const orphan: EvidenceLedger = {
      ...evidenceLedger,
      records: [{ ...evidenceLedger.records[0]!, recordId: "missing" }, evidenceLedger.records[1]!]
    };
    expect(validateEvidenceLedger(orphan, sourceIds, nodeIds).ok).toBe(false);
  });

  it("recomputes the summary from records: netStrength must be the sum of signed strengths", () => {
    const wrongNet: EvidenceLedger = { ...evidenceLedger, summary: { ...evidenceLedger.summary, netStrength: 0.4 } };
    expect(validateEvidenceLedger(wrongNet, sourceIds, nodeIds).ok).toBe(false);
  });

  it("accepts a count-majority that legitimately diverges from the strength sum (2 weak yes vs 1 strong no)", () => {
    const sources = new Set(["a", "b", "c"]);
    const mixed: EvidenceLedger = {
      ...evidenceLedger,
      records: [
        { recordId: "a", direction: "supports-yes", strength: 0.1, recencyScore: 0.5, primarySource: false, corroborationCount: 0, credibilityScore: 0.5, affectedNodeIds: ["nodeA"] },
        { recordId: "b", direction: "supports-yes", strength: 0.1, recencyScore: 0.5, primarySource: false, corroborationCount: 0, credibilityScore: 0.5, affectedNodeIds: ["nodeA"] },
        { recordId: "c", direction: "supports-no", strength: 0.9, recencyScore: 0.5, primarySource: true, corroborationCount: 0, credibilityScore: 0.8, affectedNodeIds: ["nodeA"] }
      ],
      summary: { totalRecords: 3, supportingYes: 2, supportingNo: 1, netStrength: 0.1 + 0.1 - 0.9 }
    };
    expect(validateEvidenceLedger(mixed, sources, nodeIds).ok).toBe(true);
  });

  it("rejects fabricated summary counts and duplicate record ids", () => {
    const badCounts: EvidenceLedger = { ...evidenceLedger, summary: { ...evidenceLedger.summary, supportingYes: 5 } };
    expect(validateEvidenceLedger(badCounts, sourceIds, nodeIds).ok).toBe(false);
    const badTotal: EvidenceLedger = { ...evidenceLedger, summary: { ...evidenceLedger.summary, totalRecords: 9 } };
    expect(validateEvidenceLedger(badTotal, sourceIds, nodeIds).ok).toBe(false);
    const dup: EvidenceLedger = {
      ...evidenceLedger,
      records: [evidenceLedger.records[0]!, { ...evidenceLedger.records[1]!, recordId: evidenceLedger.records[0]!.recordId }],
      summary: { totalRecords: 2, supportingYes: 0, supportingNo: 2, netStrength: -1.1 }
    };
    expect(validateEvidenceLedger(dup, sourceIds, nodeIds).ok).toBe(false);
  });

  it("rejects a non-finite netStrength (NaN must not pass reconciliation)", () => {
    const nan: EvidenceLedger = { ...evidenceLedger, summary: { ...evidenceLedger.summary, netStrength: Number.NaN } };
    expect(validateEvidenceLedger(nan, sourceIds, nodeIds).ok).toBe(false);
  });
});

describe("stage 5 — conditional model (P(A) x P(B|A) x P(C|A,B))", () => {
  it("passes when final equals the node product within tolerance", () => {
    expect(validateConditionalModel(conditionalModel, ledgerIds).ok).toBe(true);
  });

  it("fails when nodes multiply to a different value with no adjustment", () => {
    const broken: ConditionalModel = {
      ...conditionalModel,
      finalProbability: { computed: 0.5, reported: 0.5, isAdjusted: false }
    };
    expect(validateConditionalModel(broken, ledgerIds).ok).toBe(false);
  });

  it("allows a calibrated override when reported diverges with a reason", () => {
    const adjusted: ConditionalModel = {
      ...conditionalModel,
      finalProbability: { computed: 0.289575, reported: 0.24, isAdjusted: true, adjustmentReason: "calibration haircut for escalation risk" }
    };
    expect(validateConditionalModel(adjusted, ledgerIds).ok).toBe(true);
    const adjustedNoReason: ConditionalModel = {
      ...adjusted,
      finalProbability: { ...adjusted.finalProbability, adjustmentReason: "" }
    };
    expect(validateConditionalModel(adjustedNoReason, ledgerIds).ok).toBe(false);
  });

  it("accepts node probabilities up to 0.99999 but rejects absolute 0/1 certainty", () => {
    const withNode0 = (p: number): ConditionalModel => {
      const probs = [p, 0.65, 0.99];
      const product = probs.reduce((acc, x) => acc * x, 1);
      return {
        ...conditionalModel,
        nodes: conditionalModel.nodes.map((n, i) => ({ ...n, probability: probs[i]! })),
        finalProbability: { computed: product, reported: product, isAdjusted: false }
      };
    };
    expect(validateConditionalModel(withNode0(0.99999), ledgerIds).ok).toBe(true);
    expect(validateConditionalModel(withNode0(1), ledgerIds).ok).toBe(false);
    expect(validateConditionalModel(withNode0(0), ledgerIds).ok).toBe(false);
  });

  it("rejects references to evidence ids absent from the ledger", () => {
    const ghostEvidence: ConditionalModel = {
      ...conditionalModel,
      nodes: [{ ...conditionalModel.nodes[0]!, contradictingEvidenceIds: ["ghost"] }, conditionalModel.nodes[1]!, conditionalModel.nodes[2]!]
    };
    expect(validateConditionalModel(ghostEvidence, ledgerIds).ok).toBe(false);
  });

  it("rejects duplicate node ids, unknown/self preceding references, and over-decomposition", () => {
    const dup: ConditionalModel = {
      ...conditionalModel,
      nodes: conditionalModel.nodes.map((n) => ({ ...n, nodeId: "X", precedingNodeIds: [] }))
    };
    expect(validateConditionalModel(dup, ledgerIds).ok).toBe(false);

    const ghostPreceding: ConditionalModel = {
      ...conditionalModel,
      nodes: [{ ...conditionalModel.nodes[0]!, precedingNodeIds: ["nope"] }, conditionalModel.nodes[1]!, conditionalModel.nodes[2]!]
    };
    expect(validateConditionalModel(ghostPreceding, ledgerIds).ok).toBe(false);

    const selfRef: ConditionalModel = {
      ...conditionalModel,
      nodes: [{ ...conditionalModel.nodes[0]!, precedingNodeIds: ["A"] }, conditionalModel.nodes[1]!, conditionalModel.nodes[2]!]
    };
    expect(validateConditionalModel(selfRef, ledgerIds).ok).toBe(false);

    const probability = 0.9;
    const tooMany: ConditionalModel = {
      ...conditionalModel,
      nodes: Array.from({ length: 9 }, (_, i) => ({
        nodeId: `n${i}`,
        label: `n${i}`,
        type: i === 0 ? ("base" as const) : ("conditional" as const),
        probability,
        precedingNodeIds: [],
        condition: "c",
        rationale: "r",
        supportingEvidenceIds: [],
        contradictingEvidenceIds: []
      })),
      finalProbability: { computed: probability ** 9, reported: probability ** 9, isAdjusted: false }
    };
    expect(validateConditionalModel(tooMany, ledgerIds).ok).toBe(false);
  });

  it("rejects a non-finite computed value even when isAdjusted=true (NaN bypass)", () => {
    const nanComputed: ConditionalModel = {
      ...conditionalModel,
      finalProbability: { computed: Number.NaN, reported: 0.3, isAdjusted: true, adjustmentReason: "override" }
    };
    expect(validateConditionalModel(nanComputed, ledgerIds).ok).toBe(false);
  });
});

describe("stage 6 — bayes delta ledger", () => {
  it("reconciles base + signed deltas to the final value", () => {
    expect(validateBayesDeltaLedger(bayesLedger, ledgerIds).ok).toBe(true);
  });

  it("fails when deltas do not reconcile to the final value", () => {
    const broken: BayesDeltaLedger = { ...bayesLedger, finalProbability: { ...bayesLedger.finalProbability, value: 0.4 } };
    const res = validateBayesDeltaLedger(broken, ledgerIds);
    expect(res.ok).toBe(false);
  });

  it("requires the credible interval to bracket the final value", () => {
    const narrow: BayesDeltaLedger = { ...bayesLedger, finalProbability: { value: 0.219575, credibleInterval: { low: 0.25, high: 0.3 } } };
    expect(validateBayesDeltaLedger(narrow, ledgerIds).ok).toBe(false);
  });

  it("requires aiProb to equal the final value and stay in the open (0,1) interval", () => {
    expect(validateBayesDeltaLedger({ ...bayesLedger, aiProb: 0.3 }, ledgerIds).ok).toBe(false);
    expect(validateBayesDeltaLedger({ ...bayesLedger, aiProb: 1 }, ledgerIds).ok).toBe(false);
  });

  it("rejects updates that cite evidence absent from the ledger", () => {
    const ghost: BayesDeltaLedger = {
      ...bayesLedger,
      updates: [{ ...bayesLedger.updates[0]!, evidenceIds: ["ghost"] }, bayesLedger.updates[1]!, bayesLedger.updates[2]!]
    };
    expect(validateBayesDeltaLedger(ghost, ledgerIds).ok).toBe(false);
  });

  it("rejects an update that cites no evidence at all (unauditable assertion)", () => {
    const bare: BayesDeltaLedger = {
      ...bayesLedger,
      updates: [{ ...bayesLedger.updates[0]!, evidenceIds: [] }, bayesLedger.updates[1]!, bayesLedger.updates[2]!]
    };
    expect(validateBayesDeltaLedger(bare, ledgerIds).ok).toBe(false);
  });

  it("rejects NaN deltas (NaN must not slip through reconciliation)", () => {
    const nan: BayesDeltaLedger = {
      ...bayesLedger,
      updates: [{ ...bayesLedger.updates[0]!, deltaProbability: Number.NaN }, bayesLedger.updates[1]!, bayesLedger.updates[2]!]
    };
    expect(validateBayesDeltaLedger(nan, ledgerIds).ok).toBe(false);
  });

  it("validates the per-update posterior chain, order sequence, and direction-vs-delta sign", () => {
    const brokenChain: BayesDeltaLedger = {
      ...bayesLedger,
      updates: [{ ...bayesLedger.updates[0]!, posteriorProbability: 0.5 }, bayesLedger.updates[1]!, bayesLedger.updates[2]!]
    };
    expect(validateBayesDeltaLedger(brokenChain, ledgerIds).ok).toBe(false);

    const badOrder: BayesDeltaLedger = {
      ...bayesLedger,
      updates: [{ ...bayesLedger.updates[0]!, order: 7 }, bayesLedger.updates[1]!, bayesLedger.updates[2]!]
    };
    expect(validateBayesDeltaLedger(badOrder, ledgerIds).ok).toBe(false);

    const contradiction: BayesDeltaLedger = {
      ...bayesLedger,
      updates: [{ ...bayesLedger.updates[0]!, direction: "for-yes" }, bayesLedger.updates[1]!, bayesLedger.updates[2]!]
    };
    expect(validateBayesDeltaLedger(contradiction, ledgerIds).ok).toBe(false);
  });

  it("rejects a marketProb outside [0,1] (garbage would flow into the stage-7 edge computation)", () => {
    expect(validateBayesDeltaLedger({ ...bayesLedger, marketProb: Number.NaN }, ledgerIds).ok).toBe(false);
    expect(validateBayesDeltaLedger({ ...bayesLedger, marketProb: 30 }, ledgerIds).ok).toBe(false);
  });
});

describe("decision model integrity (end-to-end across stages 1->6)", () => {
  it("accepts a fully self-consistent model", () => {
    const res = validateDecisionModelIntegrity(buildModel());
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("only validates artifacts that are present (partial Phase-1 model)", () => {
    const partial: CandidateDecisionModel = {
      marketSlug: "us-iran-nuclear-deal-by-june-30",
      generatedAtUtc: "2026-06-05T00:00:00.000Z",
      resolution,
      query_plan: queryPlan
    };
    expect(validateDecisionModelIntegrity(partial).ok).toBe(true);
  });

  it("catches FK drift between stages (evidence id not in the ledger)", () => {
    const model = buildModel();
    const drifted: CandidateDecisionModel = {
      ...model,
      conditional_model: {
        ...model.conditional_model!,
        nodes: [{ ...model.conditional_model!.nodes[0]!, supportingEvidenceIds: ["does-not-exist"] }, model.conditional_model!.nodes[1]!, model.conditional_model!.nodes[2]!]
      }
    };
    expect(validateDecisionModelIntegrity(drifted).ok).toBe(false);
  });

  it("catches a wrapper aiProb that does not mirror the bayes ledger", () => {
    const model = buildModel();
    expect(validateDecisionModelIntegrity({ ...model, aiProb: 0.5 }).ok).toBe(false);
  });

  it("catches a wrapper marketProb that does not mirror the bayes ledger", () => {
    const model = buildModel();
    expect(validateDecisionModelIntegrity({ ...model, marketProb: 0.9 }).ok).toBe(false);
  });

  it("keeps the live hand-off probability identical to the bayes ledger within tolerance", () => {
    const model = buildModel();
    expect(Math.abs((model.aiProb ?? 0) - model.bayes_ledger!.aiProb)).toBeLessThanOrEqual(PROBABILITY_TOLERANCE);
  });

  it("enforces the stage-5 -> stage-6 linkage: bayes base must equal the conditional reported probability", () => {
    const model = buildModel();
    const drifted: CandidateDecisionModel = {
      ...model,
      bayes_ledger: {
        ...model.bayes_ledger!,
        initialAssumptions: { ...model.bayes_ledger!.initialAssumptions, baseProbability: 0.5 }
      }
    };
    const res = validateDecisionModelIntegrity(drifted);
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("baseProbability");
  });

  it("rejects artifacts describing a different market than the wrapper", () => {
    const model = buildModel();
    const crossed: CandidateDecisionModel = {
      ...model,
      query_plan: { ...model.query_plan!, marketSlug: "some-other-market" }
    };
    expect(validateDecisionModelIntegrity(crossed).ok).toBe(false);
  });
});
