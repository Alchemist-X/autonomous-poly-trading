import { describe, expect, it } from "vitest";
import { createResearchPlan, defaultResearchPlan, validateResearchPlan } from "./research-plan";
import type { AgentRunResult, RunAgentOptions } from "./claude-agent";
import type { EventFraming } from "./types";

const frame: EventFraming = {
  normalizedQuestion: "Will the product ship by 31 December 2026?",
  resolutionCriteria: "YES only if customers can receive the product by the deadline.",
  resolutionDate: "2026-12-31",
  settlementSource: "The vendor's shipment record",
  assumptions: "Public availability counts; an announcement alone does not.",
  forecastable: true,
  clarificationNeeded: "",
  priorProbability: 0.5,
  priorRationale: "Comparable delayed products ship on time about half the time.",
  framingCaveats: "",
  framingConfidence: "high"
};

describe("Research Focus Center planning", () => {
  it("provides breadth, primary evidence, outside view, and countercase defaults", () => {
    const plan = defaultResearchPlan(frame);
    expect(plan.minimumSearchQueries).toBeGreaterThanOrEqual(6);
    expect(plan.focusAreas).toHaveLength(3);
    expect(plan.focusAreas.some((focus) => focus.id === "outside-view")).toBe(true);
    expect(plan.focusAreas.some((focus) => focus.id === "strongest-countercase")).toBe(true);
    expect(plan.sourcePriorities[0].sourceClass).toContain("Official records");
  });

  it("normalizes an agent plan without allowing a second probability", () => {
    const plan = validateResearchPlan(
      {
        archetype: "product_release",
        model_kind: "conjunction",
        model_rationale: "Several necessary release conditions must all hold.",
        decomposition: ["Product readiness", "Distribution readiness", "Customer availability"],
        focus_areas: [
          {
            id: "readiness",
            question: "Is the product ready?",
            priority: "high",
            preferred_sources: ["release notes"],
            completion_criteria: "Direct record plus cross-check"
          },
          {
            id: "distribution",
            question: "Is distribution ready?",
            priority: "high",
            preferred_sources: ["retailer records"],
            completion_criteria: "Two independent records"
          },
          {
            id: "countercase",
            question: "What could still delay it?",
            priority: "high",
            preferred_sources: ["original reporting"],
            completion_criteria: "Strongest countercase tested"
          }
        ],
        source_priorities: [
          { rank: 1, source_class: "Official shipment records", use_when: "Direct", reject_when: "No dates" }
        ],
        minimum_search_queries: 2,
        search_strategy: "Search broadly, then select direct evidence.",
        alternative_probability: 0.9
      },
      frame
    );
    expect(plan.archetype).toBe("product_release");
    expect(plan.modelKind).toBe("conjunction");
    expect(plan.minimumSearchQueries).toBe(6);
    expect(plan).not.toHaveProperty("alternativeProbability");
  });

  it("uses no research tools while creating the plan", async () => {
    let options: RunAgentOptions | undefined;
    const output = {
      archetype: "product_release",
      model_kind: "binary_bayesian",
      model_rationale: "Maintain one binary estimate.",
      decomposition: ["Settlement", "Outside view", "Countercase"],
      focus_areas: [
        { id: "settlement", question: "What directly settles it?", priority: "high" },
        { id: "outside-view", question: "What is the base rate?", priority: "high" },
        { id: "countercase", question: "What is the strongest countercase?", priority: "high" }
      ],
      source_priorities: [
        { rank: 1, source_class: "Official records", use_when: "Direct", reject_when: "Unsupported" }
      ],
      minimum_search_queries: 8,
      search_strategy: "Search broadly and cross-check decisive claims."
    };
    const runAgentFn = async (_prompt: string, opts: RunAgentOptions): Promise<AgentRunResult> => {
      options = opts;
      return {
        rawFinalText: JSON.stringify(output),
        jsonObject: output,
        jsonError: null,
        searchQueries: [],
        searchResultUrls: new Set(),
        costUsd: null,
        numTurns: 1,
        exitCode: 0,
        stderrTail: ""
      };
    };
    const plan = await createResearchPlan(frame, { runAgentFn });
    expect(options?.allowedTools).toBe("");
    expect(plan.minimumSearchQueries).toBe(8);
  });
});
