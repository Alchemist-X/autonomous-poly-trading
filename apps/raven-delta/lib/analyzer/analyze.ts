// Orchestrator: engine resolution -> analysis -> archive.
// LLM engines degrade to the rules fallback with an explicit, user-visible
// reason (never a silent fallback — repo rule §6).

import { headlineOf, type DeltaAnalysis, type DeltaRun, type EngineId, type NewsInput, type RunStage } from "./schema";
import { buildAnalysisPrompt } from "./prompt";
import { resolveEngine, runLlmAnalysis } from "./provider";
import { resolveLongport } from "./longport-mcp";
import { runRulesAnalysis } from "./rules-engine";
import { getUniverse } from "./universe";
import { saveRun } from "./store";

function buildRunId(headline: string, nowIso: string): string {
  let hash = 2166136261;
  const seed = `${headline}|${nowIso}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `delta_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export interface AnalysisOutcome {
  run: DeltaRun;
  archiveFile: string | null;
}

export async function runDeltaAnalysis(news: NewsInput, now = new Date()): Promise<AnalysisOutcome> {
  const nowIso = now.toISOString();
  const headline = headlineOf(news.text);
  const stages: RunStage[] = [];
  const resolution = resolveEngine();

  let engine: EngineId = resolution.engine;
  let engineFallbackReason: string | null = engine === "rules" ? resolution.reason : null;
  let analysis: DeltaAnalysis;

  // LongPort live market data is only reachable by the claude-cli engine.
  const longport = resolveLongport();
  const promptEngine = engine; // the engine the prompt was built for (may fall back below)

  const engineStart = Date.now();
  if (engine === "rules") {
    analysis = runRulesAnalysis(news, nowIso);
  } else {
    try {
      analysis = await runLlmAnalysis(engine, buildAnalysisPrompt(news, engine));
    } catch (error) {
      engineFallbackReason = `${engine} failed: ${error instanceof Error ? error.message : String(error)}`;
      engine = "rules";
      analysis = runRulesAnalysis(news, nowIso);
    }
  }
  stages.push({ id: "engine", title: `engine:${engine}`, durationMs: Date.now() - engineStart });
  // Record whether the analyst had live market data (surfaced to the reader so a
  // price-grounded run is distinguishable from a news-text-only one — never a
  // silent capability difference, repo rule §6). Computed on the FINAL engine:
  // a claude run that fell back to rules never touched a live price.
  const marketDataLive = engine === "claude-cli" && longport.enabled;
  const marketDataOffReason =
    promptEngine === "claude-cli" && longport.enabled
      ? `fell back to ${engine}`
      : engine === "claude-cli"
        ? longport.reason
        : "engine has no MCP tools";
  stages.push({
    id: "market-data",
    title: marketDataLive ? "longport:live" : `longport:off (${marketDataOffReason})`,
    durationMs: 0,
  });

  const run: DeltaRun = {
    id: buildRunId(headline, nowIso),
    mode: "demo_read_only",
    engine,
    engineFallbackReason,
    generatedAtUtc: nowIso,
    universeVersion: getUniverse().version,
    news: {
      headline,
      text: news.text,
      url: news.url ?? null,
      publishedAtUtc: news.publishedAtUtc ?? null
    },
    analysis,
    stages,
    delivery: []
  };

  let archiveFile: string | null = null;
  const archiveStart = Date.now();
  try {
    archiveFile = saveRun(run);
  } catch (error) {
    // Archiving must never kill a run; surface the miss in stages instead.
    console.error("raven-delta: run archive failed:", error);
  }
  stages.push({ id: "archive", title: archiveFile ? "archived" : "archive-failed", durationMs: Date.now() - archiveStart });

  return { run, archiveFile };
}
