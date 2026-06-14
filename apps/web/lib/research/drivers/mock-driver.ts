// Mock driver — the always-available default.
//
// Builds a deterministic PredictionEngineRun from the existing demo generator
// and replays it as a timed event stream. This is what drives the whole UI loop
// (input → streamed stages → final charts) with zero external dependencies, and
// what the live drivers fall back to when not yet wired.

import { getTierSpec, normalizeTier } from "@autopoly/norns";
import { buildPredictionDemoRun } from "../../prediction-engine-demo";
import { normalizeConsoleLocale, pick } from "../locale";
import { replayRun, type EmitFn } from "../replay";
import type { ResearchDriver, ResearchRequest } from "./types";

function readSpeed(): number | undefined {
  const raw = process.env.RESEARCH_MOCK_SPEED?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export const mockDriver: ResearchDriver = {
  id: "mock",
  async run(request: ResearchRequest, emit: EmitFn, signal?: AbortSignal): Promise<void> {
    const tier = normalizeTier(request.tier);
    const locale = normalizeConsoleLocale(request.locale);
    const spec = getTierSpec(tier);
    const run = buildPredictionDemoRun(
      {
        eventText: request.eventText,
        marketPrice: request.marketPrice ?? null
      },
      new Date(),
      locale
    );
    // The replayed run still carries demo metadata; mark its origin clearly. The
    // mock makes no model call, but the chosen Norns tier is surfaced so the
    // capability layer is visible even in deterministic demo mode.
    const annotated = {
      ...run,
      service: {
        ...run.service,
        source: "demo" as const,
        endpointLabel: `in-process mock driver · ${spec.label}`,
        note: pick(
          locale,
          `Deterministic read-only demo (${spec.label}): reuses the prediction-engine generator, replayed through the Forecasting Engine state machine.`,
          `确定性只读 demo（${spec.label}）：复用 prediction-engine 生成器，按 Forecasting Engine 状态机流式回放。`
        )
      }
    };
    await replayRun(annotated, emit, { driver: "mock", tier, locale, speed: readSpeed(), signal });
  }
};
