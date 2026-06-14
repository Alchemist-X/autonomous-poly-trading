// Chain A — VPS agent driver.
//
// The web app can't spawn agent CLIs (codex / claude-code / openclaw) itself —
// those run on a VPS through the existing orchestrator provider-runtime
// (services/orchestrator/src/runtime/provider-runtime.ts). This driver is the
// client seam: it POSTs the request to a configured VPS endpoint and adapts
// whatever that endpoint returns into our event protocol.
//
// The VPS endpoint contract (to be implemented on the VPS side):
//   POST { eventText, marketPrice, tier } →
//     • text/event-stream of ResearchEvent objects (preferred — true streaming), OR
//     • application/json PredictionEngineRun (replayed here as a stream).
//   `tier` is the Norns capability tier (urd / verdandi / skuld); the VPS maps
//   it to a provider-runtime model via @autopoly/norns on its side.
//
// Status: functional skeleton. Transport + adaptation are real; if the endpoint
// is unreachable or returns an unexpected shape we degrade to a demo replay with
// a visible warning rather than breaking the stream.

import { normalizeTier } from "@autopoly/norns";
import { buildPredictionDemoRun, type PredictionEngineRun } from "../../prediction-engine-demo";
import { parseResearchEvent } from "../events";
import { replayRun, type EmitFn } from "../replay";
import { DriverNotConfiguredError, type ResearchDriver, type ResearchRequest } from "./types";

interface VpsConfig {
  url: string;
  token: string | null;
  timeoutMs: number;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveVpsConfig(): VpsConfig {
  // Prefer a research-specific URL, then fall back to the existing
  // prediction-engine backend env so a single VPS can serve both.
  const direct = process.env.RESEARCH_VPS_URL?.trim() || process.env.PREDICTION_ENGINE_API_URL?.trim();
  const base =
    process.env.RESEARCH_VPS_BASE_URL?.trim() ||
    process.env.PREDICTION_ENGINE_API_BASE_URL?.trim() ||
    process.env.PREDICTION_ENGINE_VPS_URL?.trim();
  const url = direct || (base ? `${normalizeBaseUrl(base)}/research/stream` : null);
  if (!url) {
    throw new DriverNotConfiguredError(
      "VPS driver: no endpoint configured.",
      ["RESEARCH_VPS_URL", "RESEARCH_VPS_BASE_URL", "PREDICTION_ENGINE_API_URL"]
    );
  }
  const token = process.env.RESEARCH_VPS_TOKEN?.trim() || process.env.PREDICTION_ENGINE_API_TOKEN?.trim() || null;
  const timeoutMs = Number(process.env.RESEARCH_VPS_TIMEOUT_MS) || 120_000;
  return { url, token, timeoutMs };
}

function isPredictionRun(value: unknown): value is PredictionEngineRun {
  return Boolean(
    value &&
      typeof value === "object" &&
      "conclusion" in value &&
      "stages" in value &&
      Array.isArray((value as PredictionEngineRun).stages)
  );
}

async function pipeSseStream(body: ReadableStream<Uint8Array>, emit: EmitFn): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) {
          continue;
        }
        const event = parseResearchEvent(line.slice(5).trim());
        if (event) {
          await emit(event);
        }
      }
    }
  }
}

export const vpsAgentDriver: ResearchDriver = {
  id: "vps",
  async run(request: ResearchRequest, emit: EmitFn, signal?: AbortSignal): Promise<void> {
    const config = resolveVpsConfig(); // throws DriverNotConfiguredError → route falls back to mock
    const tier = normalizeTier(request.tier);

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "text/event-stream, application/json"
      };
      if (config.token) {
        headers.authorization = `Bearer ${config.token}`;
      }
      const response = await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ eventText: request.eventText, marketPrice: request.marketPrice ?? null, tier }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`VPS endpoint ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        await pipeSseStream(response.body, emit);
        return;
      }

      const json = (await response.json()) as unknown;
      if (isPredictionRun(json)) {
        await replayRun(json, emit, { driver: "vps", tier, signal });
        return;
      }
      throw new Error("VPS endpoint returned an unrecognised payload shape.");
    } catch (error) {
      // Configured-but-failing VPS: keep the UI alive with a demo replay and a
      // loud warning rather than a dead stream.
      await emit({
        type: "run.notice",
        level: "warn",
        message: `VPS agent 链路调用失败，本次回退到 demo：${error instanceof Error ? error.message : String(error)}`
      });
      const run = buildPredictionDemoRun({ eventText: request.eventText, marketPrice: request.marketPrice ?? null });
      await replayRun(
        {
          ...run,
          mode: "vps_proxy",
          service: { ...run.service, source: "vps", endpointLabel: config.url, note: "Chain A 回退 demo（VPS 不可用）。" }
        },
        emit,
        { driver: "vps", tier, signal }
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
};
