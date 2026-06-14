import { describe, expect, it } from "vitest";
import { buildPredictionDemoRun } from "../prediction-engine-demo";
import { initialResearchState, researchReducer, stageProgressRatio } from "./state-machine";
import type { ResearchEvent, ResearchStageMeta } from "./events";

// Drive the reducer with a representative event sequence and assert the two
// nested machines (run phase + per-stage status) transition correctly. This
// doubles as executable documentation of the protocol in `events.ts`.

const STAGES: ResearchStageMeta[] = [
  { id: "definition", order: 1, title: "理清定义", summary: "s1" },
  { id: "evidence", order: 3, title: "证据收集", summary: "s3" },
  { id: "market", order: 7, title: "结论与市场", summary: "s7" }
];

function fold(events: ResearchEvent[]) {
  return events.reduce(researchReducer, initialResearchState());
}

describe("researchReducer", () => {
  it("starts idle with empty collections", () => {
    const state = initialResearchState();
    expect(state.phase).toBe("idle");
    expect(state.stages).toHaveLength(0);
    expect(stageProgressRatio(state)).toBe(0);
  });

  it("run.accepted moves idle → running and seeds pending stages in order", () => {
    const state = fold([
      { type: "run.accepted", runId: "r1", eventText: "Q", driver: "mock", marketProbability: 0.3, stages: [STAGES[2]!, STAGES[0]!, STAGES[1]!] }
    ]);
    expect(state.phase).toBe("running");
    expect(state.stages.map((s) => s.id)).toEqual(["definition", "evidence", "market"]);
    expect(state.stages.every((s) => s.status === "pending")).toBe(true);
  });

  it("keeps exactly one stage active and demotes the previous one on re-enter", () => {
    const state = fold([
      { type: "run.accepted", runId: "r1", eventText: "Q", driver: "mock", marketProbability: null, stages: STAGES },
      { type: "stage.enter", stageId: "definition", order: 1 },
      { type: "stage.progress", stageId: "definition", text: "line" },
      { type: "stage.enter", stageId: "evidence", order: 3 }
    ]);
    const active = state.stages.filter((s) => s.status === "active");
    expect(active.map((s) => s.id)).toEqual(["evidence"]);
    expect(state.stages.find((s) => s.id === "definition")!.status).toBe("complete");
    expect(state.activeStageId).toBe("evidence");
  });

  it("accumulates streamed artifacts and records stage outcomes", () => {
    const evidence = buildPredictionDemoRun({ eventText: "美国和伊朗核协议" }).evidence;
    const state = fold([
      { type: "run.accepted", runId: "r1", eventText: "Q", driver: "mock", marketProbability: null, stages: STAGES },
      { type: "stage.enter", stageId: "evidence", order: 3 },
      ...evidence.map((e): ResearchEvent => ({ type: "evidence.add", stageId: "evidence", evidence: e })),
      { type: "stage.exit", stageId: "evidence", outcome: "done", artifactLabel: "evidence_ledger", durationMs: 520 }
    ]);
    expect(state.evidence).toHaveLength(evidence.length);
    const stage = state.stages.find((s) => s.id === "evidence")!;
    expect(stage.status).toBe("complete");
    expect(stage.outcome).toBe("done");
    expect(stage.durationMs).toBe(520);
  });

  it("run.complete marks every stage complete and backfills missing data from the final run", () => {
    const run = buildPredictionDemoRun({ eventText: "generic event without iran" });
    const state = fold([
      { type: "run.accepted", runId: run.id, eventText: run.eventText, driver: "mock", marketProbability: null, stages: STAGES },
      { type: "run.complete", run }
    ]);
    expect(state.phase).toBe("complete");
    expect(state.stages.every((s) => s.status === "complete")).toBe(true);
    expect(stageProgressRatio(state)).toBe(1);
    // Nothing streamed → charts backfilled from the final run.
    expect(state.evidence).toEqual(run.evidence);
    expect(state.model).toEqual(run.model);
    expect(state.conclusion).toEqual(run.conclusion);
  });

  it("run.error terminates into the error phase and clears the active stage", () => {
    const state = fold([
      { type: "run.accepted", runId: "r1", eventText: "Q", driver: "vps", marketProbability: null, stages: STAGES },
      { type: "stage.enter", stageId: "definition", order: 1 },
      { type: "run.error", message: "boom" }
    ]);
    expect(state.phase).toBe("error");
    expect(state.error).toBe("boom");
    expect(state.activeStageId).toBeUndefined();
  });

  it("collects notices without changing phase (driver fallback path)", () => {
    const state = fold([
      { type: "run.accepted", runId: "r1", eventText: "Q", driver: "mock", marketProbability: null, stages: STAGES },
      { type: "run.notice", level: "warn", message: "vps not configured, using mock" }
    ]);
    expect(state.phase).toBe("running");
    expect(state.notices).toEqual([{ level: "warn", message: "vps not configured, using mock" }]);
  });
});
