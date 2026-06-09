import { describe, expect, it } from "vitest";
import { buildResolutionDefinition, type ResolutionDefinitionInput } from "./resolution-definition.js";
import type { StageLlmCaller, StageLlmRequest } from "./stage-llm.js";

function mockCaller(json: unknown, capture?: (request: StageLlmRequest) => void): StageLlmCaller {
  return async (request) => {
    capture?.(request);
    return { raw: JSON.stringify(json), json, elapsedMs: 1 };
  };
}

const baseInput = (callLlm: StageLlmCaller): ResolutionDefinitionInput => ({
  marketSlug: "us-iran-nuclear-deal-by-june-30",
  eventSlug: "us-iran-nuclear-deal",
  question: "Will the US and Iran reach a nuclear deal by June 30?",
  rulesText: "Resolves Yes if an official agreement covering nuclear terms is announced before the deadline.",
  resolutionSource: "https://polymarket.com/event/us-iran-nuclear-deal-by-june-30",
  endDateUtc: "2026-06-30T23:59:59.000Z",
  generatedAtUtc: "2026-06-05T00:00:00.000Z",
  callLlm
});

const goodJson = {
  officialQuestion: "Will the US and Iran reach a nuclear deal by June 30?",
  officialResolutionRules: "Resolves Yes if an official agreement covering nuclear terms is announced before the deadline.",
  resolutionSource: "https://example.gov/resolution",
  representativeAuthority: "US State Department and Iran National Security Council",
  yesBoundary: { condition: "Signed agreement with nuclear clauses announced", meetsByDeadline: true },
  noBoundary: { condition: "No such agreement by the deadline", meetsByDeadline: true },
  deadline: "2026-06-30T23:59:59.000Z",
  timezone: "UTC",
  validationStatus: "valid",
  gaps: [],
  confidence: 0.7
};

describe("stage 1 — resolution-definition producer", () => {
  it("maps a well-formed LLM response into a typed definition", async () => {
    const def = await buildResolutionDefinition(baseInput(mockCaller(goodJson)));
    expect(def.validationStatus).toBe("valid");
    expect(def.yesBoundary.condition).toBe("Signed agreement with nuclear clauses announced");
    expect(def.representativeAuthority).toContain("State Department");
    expect(def.confidence).toBe(0.7);
  });

  it("takes identity and timestamp from the input, not the model", async () => {
    const tampered = { ...goodJson, marketSlug: "WRONG", definedAtUtc: "1999-01-01" };
    const def = await buildResolutionDefinition(baseInput(mockCaller(tampered)));
    expect(def.marketSlug).toBe("us-iran-nuclear-deal-by-june-30");
    expect(def.definedAtUtc).toBe("2026-06-05T00:00:00.000Z");
  });

  it("never throws on missing fields — records gaps and downgrades status", async () => {
    const incomplete = { ...goodJson, yesBoundary: { condition: "", meetsByDeadline: false }, validationStatus: "valid" };
    const def = await buildResolutionDefinition(baseInput(mockCaller(incomplete)));
    expect(def.validationStatus).toBe("ambiguous");
    expect(def.gaps.length).toBeGreaterThan(0);
  });

  it("clamps an out-of-range confidence", async () => {
    const def = await buildResolutionDefinition(baseInput(mockCaller({ ...goodJson, confidence: 1.5 })));
    expect(def.confidence).toBe(1);
  });

  it("never feeds market pricing into the prompt and keeps the stage independent", async () => {
    let captured = "";
    await buildResolutionDefinition(baseInput(mockCaller(goodJson, (req) => { captured = req.prompt; })));
    expect(captured).toContain("Will the US and Iran reach a nuclear deal");
    expect(captured).toContain("Resolves Yes if an official agreement");
    expect(captured.toLowerCase()).toContain("not given any market");
    expect(captured.toLowerCase()).not.toMatch(/best ?bid|best ?ask|outcomeprices|current price/);
  });
});
