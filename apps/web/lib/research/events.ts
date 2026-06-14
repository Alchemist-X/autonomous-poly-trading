// Wire protocol for the Deep Research stream.
//
// The backend (any driver) emits a linear sequence of these events over
// Server-Sent Events; the client reducer in `state-machine.ts` folds them into
// the visualised run state. Keeping the protocol in one tiny file means the
// driver authors, the route handler, and the UI all agree on the same shape —
// this file IS the contract between chain A / chain B / mock and the frontend.

import type { NornTier } from "@autopoly/norns";
import type {
  PredictionEvidence,
  PredictionModelNode,
  PredictionUpdate,
  PredictionEngineRun
} from "../prediction-engine-demo";

// Which driver produced the stream. Surfaced in the UI so a viewer always knows
// whether they are looking at deterministic demo data or a live backend.
export type ResearchDriverId = "mock" | "api" | "vps";

// Compact stage descriptor sent up-front so the UI can render the full skeleton
// (all 7 stages, dimmed) before any of them start.
export interface ResearchStageMeta {
  id: string;
  order: number;
  title: string;
  summary: string;
}

export interface ResearchConclusion {
  yesProbability: number;
  confidenceInterval: [number, number];
  marketProbability: number | null;
  edge: number | null;
  verdict: string;
}

// Discriminated union — every event carries a `type` tag. Ordering guarantees
// the reducer relies on:
//   run.accepted → (stage.enter → stage.progress* / *.add* → stage.exit)* →
//   run.conclusion → run.complete
// `run.notice` may appear at any point; `run.error` terminates the stream.
export type ResearchEvent =
  | {
      type: "run.accepted";
      runId: string;
      eventText: string;
      driver: ResearchDriverId;
      // Norns capability tier the run was dispatched at (optional: a VPS that
      // predates the field simply omits it and the UI falls back to default).
      tier?: NornTier;
      marketProbability: number | null;
      stages: ResearchStageMeta[];
    }
  | { type: "stage.enter"; stageId: string; order: number }
  | { type: "stage.progress"; stageId: string; text: string }
  | { type: "evidence.add"; stageId: string; evidence: PredictionEvidence }
  | { type: "model.add"; stageId: string; node: PredictionModelNode }
  | { type: "update.add"; stageId: string; update: PredictionUpdate }
  | {
      type: "stage.exit";
      stageId: string;
      outcome: string;
      artifactLabel?: string;
      durationMs: number;
    }
  | { type: "run.conclusion"; conclusion: ResearchConclusion }
  | { type: "run.complete"; run: PredictionEngineRun }
  | { type: "run.notice"; level: "info" | "warn"; message: string }
  | { type: "run.error"; message: string; code?: string };

export type ResearchEventType = ResearchEvent["type"];

// SSE framing helpers. We send one JSON object per `data:` line and tag the
// event name so a raw `curl -N` is still readable while debugging.
export function encodeResearchEvent(event: ResearchEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function parseResearchEvent(data: string): ResearchEvent | null {
  try {
    const parsed = JSON.parse(data) as ResearchEvent;
    return parsed && typeof parsed === "object" && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}
