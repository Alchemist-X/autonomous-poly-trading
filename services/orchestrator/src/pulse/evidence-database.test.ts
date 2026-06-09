import { describe, expect, it } from "vitest";
import { buildSourcesDatabase, type RawSearchResult, type SourcesDatabaseInput, type StageSearchRunner } from "./evidence-database.js";
import { validateSourcesDatabase, type QueryPlan } from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";

const queryPlan: QueryPlan = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  nodes: [
    { nodeId: "nodeA", label: "Agreement", condition: "agreement", sourceCategories: [{ category: "mainstream", queries: ["iran deal reuters"], expectedEvidence: [] }] },
    { nodeId: "nodeB", label: "Nuclear terms", condition: "nuclear", sourceCategories: [{ category: "mainstream", queries: ["iran nuclear terms"], expectedEvidence: [] }] }
  ],
  baseQueries: [],
  totalQueriesPlanned: 2
};

const searchResults: Record<string, RawSearchResult[]> = {
  nodeA: [
    { url: "https://reuters.com/a", host: "reuters.com", title: "Talks update", snippet: "talks", publishedAtUtc: "2026-06-01T00:00:00.000Z" },
    { url: "https://reuters.com/a", host: "reuters.com", title: "dup", snippet: "dup" }, // duplicate url -> deduped
    { url: "https://polymarket.com/event/x", host: "polymarket.com", title: "odds", snippet: "spoiler" } // firewall -> dropped
  ],
  nodeB: [{ url: "https://apnews.com/b", host: "apnews.com", title: "Nuclear clause", snippet: "clause", publishedAtUtc: "2026-06-03T00:00:00.000Z" }]
};

const runSearch: StageSearchRunner = async ({ nodeId }) => searchResults[nodeId] ?? [];

function enrichmentCaller(): StageLlmCaller {
  return async () => ({
    raw: "[]",
    json: [
      { sourceCategory: "mainstream", summary: "Reuters: talks ongoing", addressedNodeIds: ["nodeA"] },
      { sourceCategory: "mainstream", summary: "AP: nuclear clause", addressedNodeIds: ["nodeB"] }
    ],
    elapsedMs: 1
  });
}

const baseInput = (callLlm: StageLlmCaller): SourcesDatabaseInput => ({
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  queryPlan,
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  runSearch,
  callLlm
});

describe("stage 3 — sources-database producer", () => {
  it("firewalls spoiler hosts, dedups by url, and enriches via the LLM", async () => {
    const db = await buildSourcesDatabase(baseInput(enrichmentCaller()));
    expect(db.records).toHaveLength(2); // polymarket dropped, duplicate reuters merged
    expect(db.records.map((r) => r.sourceHost)).toEqual(["reuters.com", "apnews.com"]);
    expect(db.records[0]!.summary).toBe("Reuters: talks ongoing");
    expect(db.records.every((r) => r.retrievedAtUtc === "2026-06-05T00:00:00.000Z")).toBe(true);
    expect(db.summary.totalRecords).toBe(2);
    expect(db.summary.byCategory.mainstream).toBe(2);
  });

  it("produces a referentially valid database (record nodes are query-plan nodes)", async () => {
    const db = await buildSourcesDatabase(baseInput(enrichmentCaller()));
    const nodeIds = new Set(queryPlan.nodes.map((n) => n.nodeId));
    expect(validateSourcesDatabase(db, nodeIds).ok).toBe(true);
  });

  it("still builds deterministic records when enrichment fails", async () => {
    const failing: StageLlmCaller = async () => {
      throw new Error("model timed out");
    };
    const db = await buildSourcesDatabase(baseInput(failing));
    expect(db.records).toHaveLength(2);
    // falls back to the node's search category and the node it was searched under
    expect(db.records[0]!.sourceCategory).toBe("mainstream");
    expect(db.records[0]!.addressedNodeIds).toEqual(["nodeA"]);
  });
});
