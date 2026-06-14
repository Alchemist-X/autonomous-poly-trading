// Deep Research state machine.
//
// A single pure reducer folds the event stream (see `events.ts`) into the
// state the UI renders. Nothing here touches the network or the DOM, so the
// exact same transitions run on the server (for tests / SSR snapshots) and in
// the browser hook.
//
// Two nested state machines live here:
//
//   RUN PHASE      idle ──run.accepted──▶ running ──run.complete──▶ complete
//                    └────────────────── run.error ──────────────▶ error
//
//   STAGE STATUS   pending ──stage.enter──▶ active ──stage.exit──▶ complete
//
// Every stage starts `pending`. `stage.enter` promotes exactly one stage to
// `active` (and demotes the previously active one to `complete` defensively).
// Artifacts (evidence / model nodes / bayes updates) accumulate as they arrive.

import type { NornTier } from "@autopoly/norns";
import type {
  PredictionEvidence,
  PredictionModelNode,
  PredictionUpdate,
  PredictionEngineRun
} from "../prediction-engine-demo";
import type { ResearchConclusion, ResearchDriverId, ResearchEvent, ResearchStageMeta } from "./events";

export type ResearchPhase = "idle" | "running" | "complete" | "error";
export type StageStatus = "pending" | "active" | "complete";

export interface ResearchStageState {
  id: string;
  order: number;
  title: string;
  summary: string;
  status: StageStatus;
  progressLines: string[];
  outcome?: string;
  artifactLabel?: string;
  durationMs?: number;
}

export interface ResearchNotice {
  level: "info" | "warn";
  message: string;
}

export interface ResearchState {
  phase: ResearchPhase;
  runId?: string;
  eventText?: string;
  driver?: ResearchDriverId;
  tier?: NornTier;
  marketProbability: number | null;
  stages: ResearchStageState[];
  activeStageId?: string;
  evidence: PredictionEvidence[];
  model: PredictionModelNode[];
  updates: PredictionUpdate[];
  conclusion?: ResearchConclusion;
  finalRun?: PredictionEngineRun;
  notices: ResearchNotice[];
  error?: string;
}

export function initialResearchState(): ResearchState {
  return {
    phase: "idle",
    marketProbability: null,
    stages: [],
    evidence: [],
    model: [],
    updates: [],
    notices: []
  };
}

function toStageState(meta: ResearchStageMeta): ResearchStageState {
  return {
    id: meta.id,
    order: meta.order,
    title: meta.title,
    summary: meta.summary,
    status: "pending",
    progressLines: []
  };
}

// Immutable map over stages: returns a new array with `id`'s entry transformed.
function patchStage(
  stages: ResearchStageState[],
  id: string,
  patch: (stage: ResearchStageState) => ResearchStageState
): ResearchStageState[] {
  return stages.map((stage) => (stage.id === id ? patch(stage) : stage));
}

export function researchReducer(state: ResearchState, event: ResearchEvent): ResearchState {
  switch (event.type) {
    case "run.accepted":
      return {
        ...initialResearchState(),
        phase: "running",
        runId: event.runId,
        eventText: event.eventText,
        driver: event.driver,
        tier: event.tier,
        marketProbability: event.marketProbability,
        stages: [...event.stages].sort((a, b) => a.order - b.order).map(toStageState)
      };

    case "stage.enter": {
      // Promote the entered stage to active; demote any other lingering active
      // stage to complete so only one stage is ever highlighted at a time.
      const stages = state.stages.map((stage) => {
        if (stage.id === event.stageId) {
          return { ...stage, status: "active" as StageStatus };
        }
        if (stage.status === "active") {
          return { ...stage, status: "complete" as StageStatus };
        }
        return stage;
      });
      return { ...state, stages, activeStageId: event.stageId };
    }

    case "stage.progress":
      return {
        ...state,
        stages: patchStage(state.stages, event.stageId, (stage) => ({
          ...stage,
          progressLines: [...stage.progressLines, event.text]
        }))
      };

    case "evidence.add":
      return { ...state, evidence: [...state.evidence, event.evidence] };

    case "model.add":
      return { ...state, model: [...state.model, event.node] };

    case "update.add":
      return { ...state, updates: [...state.updates, event.update] };

    case "stage.exit":
      return {
        ...state,
        activeStageId: state.activeStageId === event.stageId ? undefined : state.activeStageId,
        stages: patchStage(state.stages, event.stageId, (stage) => ({
          ...stage,
          status: "complete",
          outcome: event.outcome,
          artifactLabel: event.artifactLabel,
          durationMs: event.durationMs
        }))
      };

    case "run.conclusion":
      return { ...state, conclusion: event.conclusion };

    case "run.complete":
      return {
        ...state,
        phase: "complete",
        activeStageId: undefined,
        finalRun: event.run,
        conclusion: state.conclusion ?? event.run.conclusion,
        // Backfill anything the streamed artifacts missed from the final run so
        // the charts always have a complete dataset.
        evidence: state.evidence.length > 0 ? state.evidence : event.run.evidence,
        model: state.model.length > 0 ? state.model : event.run.model,
        updates: state.updates.length > 0 ? state.updates : event.run.updates,
        stages: state.stages.map((stage) => ({ ...stage, status: "complete" as StageStatus }))
      };

    case "run.notice":
      return { ...state, notices: [...state.notices, { level: event.level, message: event.message }] };

    case "run.error":
      return { ...state, phase: "error", activeStageId: undefined, error: event.message };

    default:
      return state;
  }
}

// Derived helpers for the UI — kept here so the "what does the machine mean"
// logic stays next to the machine itself.

export function stageProgressRatio(state: ResearchState): number {
  if (state.stages.length === 0) {
    return state.phase === "complete" ? 1 : 0;
  }
  const done = state.stages.filter((stage) => stage.status === "complete").length;
  return done / state.stages.length;
}

export function isTerminal(phase: ResearchPhase): boolean {
  return phase === "complete" || phase === "error";
}
