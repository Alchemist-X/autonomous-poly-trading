import { describe, expect, it } from "vitest";
import { modelForStage, PULSE_STAGE_MODEL, STAGE_MODEL_IDS, tierForStage } from "./stage-models.js";

describe("per-stage model assignment", () => {
  it("uses Sonnet for the information-gathering stages (1-3)", () => {
    expect(tierForStage("resolution")).toBe("sonnet");
    expect(tierForStage("query_plan")).toBe("sonnet");
    expect(tierForStage("sources")).toBe("sonnet");
    expect(modelForStage("query_plan")).toBe("claude-sonnet-4-6");
  });

  it("uses Opus for the judgment stages (4-6 + verifier)", () => {
    expect(tierForStage("evidence_ledger")).toBe("opus");
    expect(tierForStage("conditional_model")).toBe("opus");
    expect(tierForStage("bayes_ledger")).toBe("opus");
    expect(tierForStage("verifier")).toBe("opus");
    expect(modelForStage("evidence_ledger")).toBe("claude-opus-4-8");
  });

  it("covers every declared stage with a known model id", () => {
    for (const stage of Object.keys(PULSE_STAGE_MODEL) as Array<keyof typeof PULSE_STAGE_MODEL>) {
      expect(Object.values(STAGE_MODEL_IDS)).toContain(modelForStage(stage));
    }
  });
});
