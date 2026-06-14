// Replay engine: turn a fully-formed PredictionEngineRun into a timed stream of
// research events. This is the shared backbone for every driver — the mock
// driver builds its run deterministically, the VPS driver may receive a run as
// JSON, and the API driver uses it as the structured scaffold while overlaying
// live narrative. Centralising the "run → event sequence" mapping keeps the
// streamed shape identical no matter where the data came from.

import type { NornTier } from "@autopoly/norns";
import type { PredictionEngineRun, PredictionStage } from "../prediction-engine-demo";
import type { ResearchDriverId, ResearchEvent, ResearchStageMeta } from "./events";

export type EmitFn = (event: ResearchEvent) => void | Promise<void>;

export interface ReplayOptions {
  driver: ResearchDriverId;
  // Norns capability tier this run was dispatched at, surfaced in run.accepted.
  tier?: NornTier;
  // Wall-clock pacing multiplier. Higher = slower / more readable. Default 0.9
  // gives a deliberate ~12-14s walk-through so a viewer can read each step;
  // RESEARCH_MOCK_SPEED can dial it anywhere in [0.1, 3].
  speed?: number;
  // Cancellation: the route aborts this when the client disconnects.
  signal?: AbortSignal;
  // Optional hook to inject extra progress lines per stage (used by the API
  // driver to stream live model tokens into the structured replay).
  extraProgress?: (stageId: string) => string[];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function toStageMeta(stage: PredictionStage): ResearchStageMeta {
  return { id: stage.id, order: stage.order, title: stage.title, summary: stage.summary };
}

// Per-stage progress narration synthesised from the run. These read like a
// research agent thinking aloud and give the active-stage panel something to
// stream even in deterministic demo mode.
function progressLinesFor(run: PredictionEngineRun, stage: PredictionStage): string[] {
  switch (stage.id) {
    case "definition":
      return [
        `锁定事件主体与截止时间：${run.eventText}`,
        "区分单方表态 / 继续谈判 / 临时框架 / 可结算协议四种状态。",
        "标注需要人工复核的官方结算口径。"
      ];
    case "query-design":
      return [
        "把事件拆成 2-5 个必要条件节点 (A / B / C)。",
        "为每个条件生成官方、主流媒体、当事方、本地与第三方 query。"
      ];
    case "evidence":
      return [`按来源类型收集证据，共 ${run.evidence.length} 条待权重化。`];
    case "weighting":
      return [
        "按一手性、时效、交叉印证、战略性放话风险给每条证据打分。",
        `支持 ${run.evidence.filter((e) => e.stance === "support").length} 条 · 反对 ${run.evidence.filter((e) => e.stance === "oppose").length} 条。`
      ];
    case "model":
      return [`构建条件概率模型 ${run.model.map((n) => n.id).join(" × ")}，乘法结构校验中。`];
    case "bayes":
      return ["从基线出发，逐条把证据折算成对先验的有界更新。"];
    case "market":
      return [
        run.conclusion.marketProbability == null
          ? "未提供市场价格，仅输出独立概率与置信区间。"
          : `对比市场隐含概率 ${(run.conclusion.marketProbability * 100).toFixed(1)}%，计算 edge。`
      ];
    default:
      return [stage.detail];
  }
}

// Stage → which structured artifacts stream out while it is active. Evidence is
// only *added* during the `evidence` stage; the `weighting` stage re-displays
// the same accumulated evidence (via the UI) without re-emitting it.
function emitArtifactsForStage(run: PredictionEngineRun, stageId: string): ResearchEvent[] {
  if (stageId === "evidence") {
    return run.evidence.map((evidence) => ({ type: "evidence.add", stageId, evidence }));
  }
  if (stageId === "model") {
    return run.model.map((node) => ({ type: "model.add", stageId, node }));
  }
  if (stageId === "bayes") {
    return run.updates.map((update) => ({ type: "update.add", stageId, update }));
  }
  return [];
}

export async function replayRun(run: PredictionEngineRun, emit: EmitFn, options: ReplayOptions): Promise<void> {
  const speed = Math.min(Math.max(options.speed ?? 0.9, 0.1), 3);
  const { signal } = options;

  await emit({
    type: "run.accepted",
    runId: run.id,
    eventText: run.eventText,
    driver: options.driver,
    tier: options.tier,
    marketProbability: run.conclusion.marketProbability,
    stages: run.stages.map(toStageMeta)
  });

  const orderedStages = [...run.stages].sort((a, b) => a.order - b.order);
  for (const stage of orderedStages) {
    await emit({ type: "stage.enter", stageId: stage.id, order: stage.order });
    await sleep(280 * speed, signal);

    // Prefer real per-stage narration (a research snapshot supplies the actual
    // pipeline lines); otherwise fall back to synthetic lines + any driver overlay.
    const realLines = run.progressByStage?.[stage.id];
    const lines =
      realLines && realLines.length > 0
        ? realLines
        : [...progressLinesFor(run, stage), ...(options.extraProgress?.(stage.id) ?? [])];
    for (const text of lines) {
      await emit({ type: "stage.progress", stageId: stage.id, text });
      await sleep(stage.durationMs * speed * 0.5, signal);
    }

    const artifacts = emitArtifactsForStage(run, stage.id);
    for (const artifact of artifacts) {
      await emit(artifact);
      await sleep(stage.durationMs * speed * 0.7, signal);
    }

    const progress = run.progress.find((item) => item.stageId === stage.id);
    await emit({
      type: "stage.exit",
      stageId: stage.id,
      outcome: progress?.outcome ?? stage.summary,
      artifactLabel: progress?.artifactLabel,
      durationMs: stage.durationMs
    });
    await sleep(stage.durationMs * speed, signal);
  }

  await emit({ type: "run.conclusion", conclusion: run.conclusion });
  await sleep(900 * speed, signal);
  await emit({ type: "run.complete", run });
}
