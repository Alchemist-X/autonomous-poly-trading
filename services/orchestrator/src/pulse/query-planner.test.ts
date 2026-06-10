import { describe, expect, it } from "vitest";
import { buildQueryPlan, type QueryPlanInput } from "./query-planner.js";
import { QUERY_PLAN_NODE_MAX, QUERY_PLAN_NODE_MIN, validateQueryPlan } from "./stage-artifacts.js";
import type { StageLlmCaller, StageLlmRequest } from "./stage-llm.js";

function mockCaller(json: unknown, capture?: (request: StageLlmRequest) => void): StageLlmCaller {
  return async (request) => {
    capture?.(request);
    return { raw: JSON.stringify(json), json, elapsedMs: 1 };
  };
}

const baseInput = (callLlm: StageLlmCaller): QueryPlanInput => ({
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  eventSlug: "us-iran-nuclear-deal",
  question: "Will the US and Iran reach a nuclear deal by June 30?",
  categoryLabel: "Geopolitics",
  tags: ["iran", "nuclear"],
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  callLlm
});

// node 1 + base queries deliberately include spoiler queries that must be stripped in code.
const planJson = {
  nodes: [
    {
      nodeId: "nodeA",
      label: "Diplomatic agreement reached",
      condition: "A formal diplomatic agreement is reached",
      weight: 0.5,
      sourceCategories: [
        { category: "official", queries: ["US Iran nuclear talks official statement", "polymarket odds us iran deal"], expectedEvidence: ["official statement"] }
      ]
    },
    {
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
      sourceCategories: [{ category: "third-party", queries: ["Iran deal analysis think tank"], expectedEvidence: ["analysis"] }]
    }
  ],
  baseQueries: ["US Iran nuclear deal June 30", "kalshi iran deal price"]
};

describe("stage 2 — query-planner producer", () => {
  it("strips spoiler queries in code and recomputes the planned total", async () => {
    const plan = await buildQueryPlan(baseInput(mockCaller(planJson)));
    expect(plan.nodes).toHaveLength(3);
    // the polymarket query is gone; node A keeps only its legitimate query
    expect(plan.nodes[0]!.sourceCategories[0]!.queries).toEqual(["US Iran nuclear talks official statement"]);
    expect(plan.totalQueriesPlanned).toBe(3);
    expect(plan.baseQueries).toEqual(["US Iran nuclear deal June 30"]);
  });

  it("produces a structurally valid plan (2-5 nodes, >=1 query each, weights ~1)", async () => {
    const plan = await buildQueryPlan(baseInput(mockCaller(planJson)));
    expect(validateQueryPlan(plan).ok).toBe(true);
  });

  it("assigns a stable nodeId when the model omits one, and takes identity from the input", async () => {
    const plan = await buildQueryPlan(baseInput(mockCaller(planJson)));
    expect(plan.nodes[1]!.nodeId).toBe("node-2");
    expect(plan.marketSlug).toBe("us-iran-nuclear-deal-by-june-30");
  });

  it("instructs the model to stay independent of market pricing", async () => {
    let captured = "";
    await buildQueryPlan(baseInput(mockCaller(planJson, (req) => { captured = req.prompt; })));
    expect(captured).toContain("MUST NOT generate any");
    expect(captured).toContain("Polymarket");
    expect(captured).toContain("independent of market pricing");
  });

  it("spec in the prompt mentions timeframe and interpolates the node bounds", async () => {
    let captured = "";
    await buildQueryPlan(baseInput(mockCaller(planJson, (req) => { captured = req.prompt; })));
    expect(captured).toContain('"timeframe": string | null');
    expect(captured).toContain(`${QUERY_PLAN_NODE_MIN} to ${QUERY_PLAN_NODE_MAX} necessary-condition nodes`);
    expect(captured).toContain(`Use ${QUERY_PLAN_NODE_MIN}-${QUERY_PLAN_NODE_MAX} nodes`);
  });

  it("records validator findings in gaps instead of throwing on a structurally bad plan", async () => {
    const oneNodeJson = { nodes: [planJson.nodes[0]], baseQueries: ["US Iran nuclear deal June 30"] };
    const plan = await buildQueryPlan(baseInput(mockCaller(oneNodeJson)));
    expect(plan.nodes).toHaveLength(1);
    expect(plan.gaps).toBeDefined();
    expect(plan.gaps!.length).toBeGreaterThan(0);
    expect(plan.gaps!.some((gap) => gap.includes("nodes.length"))).toBe(true);
  });

  it("omits gaps entirely on a clean plan", async () => {
    const plan = await buildQueryPlan(baseInput(mockCaller(planJson)));
    expect(plan.gaps).toBeUndefined();
  });
});
