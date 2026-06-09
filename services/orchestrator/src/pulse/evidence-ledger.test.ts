import { describe, expect, it } from "vitest";
import { buildEvidenceLedger, type EvidenceLedgerInput } from "./evidence-ledger.js";
import { validateEvidenceLedger, type SourcesDatabase } from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";

const sourcesDatabase: SourcesDatabase = {
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  fetchedAtUtc: "2026-06-05T00:00:00.000Z",
  records: [
    { recordId: "src-1", sourceUrl: "https://reuters.com/a", sourceHost: "reuters.com", sourceCategory: "mainstream", retrievedAtUtc: "2026-06-05T00:00:00.000Z", retrievedVia: "web-search", publishedAtUtc: "2026-06-01T00:00:00.000Z", snippet: "talks fragile", addressedNodeIds: ["nodeA"] },
    { recordId: "src-2", sourceUrl: "https://apnews.com/b", sourceHost: "apnews.com", sourceCategory: "mainstream", retrievedAtUtc: "2026-06-05T00:00:00.000Z", retrievedVia: "web-search", publishedAtUtc: "2026-06-03T00:00:00.000Z", snippet: "denial issued", addressedNodeIds: ["nodeA"] }
  ],
  summary: { totalRecords: 2, byCategory: { mainstream: 2 } }
};

const sourceIds = new Set(["src-1", "src-2"]);
const nodeIds = new Set(["nodeA", "nodeB"]);

function scoringCaller(): StageLlmCaller {
  return async () => ({
    raw: "[]",
    json: [
      { direction: "supports-no", strength: 0.6, primarySource: true, credibilityScore: 0.9 },
      { direction: "supports-no", strength: 0.5, primarySource: false, credibilityScore: 0.6 }
    ],
    elapsedMs: 1
  });
}

const baseInput = (callLlm: StageLlmCaller): EvidenceLedgerInput => ({
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  sourcesDatabase,
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  nowUtc: "2026-06-05T00:00:00.000Z",
  callLlm
});

describe("stage 4 — evidence-ledger producer", () => {
  it("scores via the LLM and computes deterministic recency + corroboration", async () => {
    const ledger = await buildEvidenceLedger(baseInput(scoringCaller()));
    expect(ledger.records).toHaveLength(2);
    // newer source (src-2, 2 days old) has a higher recency score than src-1 (4 days old)
    expect(ledger.records[1]!.recencyScore).toBeGreaterThan(ledger.records[0]!.recencyScore);
    // both back "no" on the same node from distinct hosts -> corroborate each other once
    expect(ledger.records[0]!.corroborationCount).toBe(1);
    expect(ledger.summary.supportingNo).toBe(2);
    expect(ledger.summary.netStrength).toBeLessThan(0);
  });

  it("produces a referentially valid ledger with a majority-consistent net strength", async () => {
    const ledger = await buildEvidenceLedger(baseInput(scoringCaller()));
    expect(validateEvidenceLedger(ledger, sourceIds, nodeIds).ok).toBe(true);
  });

  it("degrades to neutral scores when the model call fails, staying valid", async () => {
    const failing: StageLlmCaller = async () => {
      throw new Error("opus timed out");
    };
    const ledger = await buildEvidenceLedger(baseInput(failing));
    expect(ledger.records.every((r) => r.direction === "neutral")).toBe(true);
    expect(validateEvidenceLedger(ledger, sourceIds, nodeIds).ok).toBe(true);
  });
});
