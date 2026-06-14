// Chain B — direct-API driver.
//
// Drives Deep Research straight from a model API (Anthropic Messages or OpenAI
// Chat Completions) using plain `fetch` streaming — no SDK dependency added.
//
// Status: functional skeleton. The live call (request builders + SSE parsing)
// is real and runs when a key is present and RESEARCH_API_LIVE=true; its output
// is streamed into the structured replay as narration. The numeric backbone
// (stages / evidence weights / conditional model / conclusion) still comes from
// the deterministic generator — see INTEGRATION POINT below for the one seam
// that needs schema extraction to make the numbers themselves live.

import {
  getTierSpec,
  normalizeTier,
  resolveModelAlias,
  resolveNornModel,
  type NornTier
} from "@autopoly/norns";
import { buildPredictionDemoRun } from "../../prediction-engine-demo";
import { normalizeConsoleLocale, pick, type ConsoleLocale } from "../locale";
import { replayRun, type EmitFn } from "../replay";
import { DriverNotConfiguredError, type ResearchDriver, type ResearchRequest } from "./types";

// An ApiProvider is exactly a Norns ModelFamily — the tier→model table is keyed
// by the same two families, so they map 1:1.
type ApiProvider = "anthropic" | "openai";

interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  model: string;
  live: boolean;
  maxTokens: number;
  tier: NornTier;
}

function readBool(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value ? ["1", "true", "yes", "on"].includes(value) : false;
}

function resolveApiConfig(tier: NornTier): ApiConfig {
  const explicit = process.env.RESEARCH_API_PROVIDER?.trim().toLowerCase() as ApiProvider | undefined;
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  const provider: ApiProvider | undefined =
    explicit === "anthropic" || explicit === "openai"
      ? explicit
      : anthropicKey
        ? "anthropic"
        : openaiKey
          ? "openai"
          : undefined;

  if (!provider) {
    throw new DriverNotConfiguredError(
      "API driver: no provider/key configured.",
      ["RESEARCH_API_PROVIDER", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]
    );
  }
  const apiKey = provider === "anthropic" ? anthropicKey : openaiKey;
  if (!apiKey) {
    throw new DriverNotConfiguredError(
      `API driver: ${provider} selected but its API key is missing.`,
      [provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"]
    );
  }
  // Model resolution order: explicit RESEARCH_API_MODEL (a raw id OR a Norns
  // tier name, both handled by resolveModelAlias) → otherwise the tier's model
  // for this provider family. Token budget likewise scales with the tier.
  const spec = getTierSpec(tier);
  const model =
    resolveModelAlias(process.env.RESEARCH_API_MODEL, provider) || resolveNornModel(tier, provider);
  const maxTokens = Number(process.env.RESEARCH_API_MAX_TOKENS) || spec.depth.maxTokens;
  return { provider, apiKey, model, live: readBool("RESEARCH_API_LIVE"), maxTokens, tier };
}

function buildResearchPrompt(eventText: string, locale: ConsoleLocale): string {
  if (locale === "zh") {
    return [
      "你是一个事件概率研究助手。针对下面的问题，按 Forecasting Engine 流程逐步分析：",
      `问题：${eventText}`,
      "",
      "请输出简洁的分步推理（理清定义 → 条件拆解 → 证据 → 权重 → 条件概率模型 → 贝叶斯更新 → 结论），",
      "每步 1-2 句中文，便于在流式 UI 中逐行展示。先不要下任何交易结论。"
    ].join("\n");
  }
  return [
    "You are an event-probability research assistant. Analyze the question below step by step, following the Forecasting Engine pipeline:",
    `Question: ${eventText}`,
    "",
    "Output concise step-by-step reasoning (frame the definition → decompose conditions → evidence → weighting → conditional-probability model → Bayesian update → conclusion),",
    "1-2 sentences per step in English, suitable for line-by-line display in a streaming UI. Do not draw any trading conclusion yet."
  ].join("\n");
}

// Real streaming call. Returns the accumulated assistant text. Throws on
// transport / API errors so the caller can fall back gracefully.
// TODO(integration): switch the `emit` from post-hoc narration to true
// token-by-token `stage.progress` interleaving, and parse a strict JSON tail
// into the run schema so the numbers are live, not scaffolded.
async function streamModelText(config: ApiConfig, prompt: string, signal?: AbortSignal): Promise<string> {
  const { url, headers, body } = buildProviderRequest(config, prompt);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${config.provider} API ${response.status}: ${detail.slice(0, 400)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
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
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") {
          continue;
        }
        text += extractDelta(config.provider, data);
      }
    }
  }
  return text.trim();
}

function buildProviderRequest(config: ApiConfig, prompt: string): {
  url: string;
  headers: Record<string, string>;
  body: unknown;
} {
  if (config.provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: {
        model: config.model,
        max_tokens: config.maxTokens,
        stream: true,
        messages: [{ role: "user", content: prompt }]
      }
    };
  }
  return {
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: {
      model: config.model,
      max_tokens: config.maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }]
    }
  };
}

function extractDelta(provider: ApiProvider, data: string): string {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (provider === "anthropic") {
      const delta = parsed.delta as { text?: string } | undefined;
      return typeof delta?.text === "string" ? delta.text : "";
    }
    const choice = (parsed.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0];
    return typeof choice?.delta?.content === "string" ? choice.delta.content : "";
  } catch {
    return "";
  }
}

function splitNarration(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
}

export const apiDriver: ResearchDriver = {
  id: "api",
  async run(request: ResearchRequest, emit: EmitFn, signal?: AbortSignal): Promise<void> {
    const tier = normalizeTier(request.tier);
    const locale = normalizeConsoleLocale(request.locale);
    const config = resolveApiConfig(tier); // throws DriverNotConfiguredError → route falls back to mock

    // INTEGRATION POINT: structured backbone is scaffolded by the deterministic
    // generator. Replace this with a schema-validated extraction of the model's
    // own evidence / conditional model / conclusion to make the numbers live.
    const run = buildPredictionDemoRun(
      {
        eventText: request.eventText,
        marketPrice: request.marketPrice ?? null
      },
      new Date(),
      locale
    );

    let narration: string[] = [];
    if (config.live) {
      try {
        const text = await streamModelText(config, buildResearchPrompt(request.eventText, locale), signal);
        narration = splitNarration(text);
        await emit({
          type: "run.notice",
          level: "info",
          message: pick(
            locale,
            `Connected to ${config.provider}/${config.model} live reasoning.`,
            `已接入 ${config.provider}/${config.model} 实时推理。`
          )
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await emit({
          type: "run.notice",
          level: "warn",
          message: pick(
            locale,
            `${config.provider} live call failed; falling back to demo reasoning this run: ${detail}`,
            `${config.provider} 实时调用失败，本次回退到 demo 推理：${detail}`
          )
        });
      }
    } else {
      await emit({
        type: "run.notice",
        level: "info",
        message: pick(
          locale,
          `API chain is configured (${config.provider}), but RESEARCH_API_LIVE is off — using a demo structural replay this run.`,
          `API 链路已配置 (${config.provider})，但 RESEARCH_API_LIVE 未开启——本次使用 demo 结构回放。`
        )
      });
    }

    const annotated = {
      ...run,
      mode: "api_live" as const,
      service: {
        ...run.service,
        source: "local" as const,
        endpointLabel: `${config.provider}:${config.model}`,
        note: config.live
          ? pick(
              locale,
              "Chain B: direct-API driver; live reasoning overlaid on the demo structural scaffold (numbers pending schema extraction).",
              "Chain B：直接 API 驱动；实时推理叠加在 demo 结构骨架上（数值待 schema 抽取打通）。"
            )
          : pick(
              locale,
              "Chain B: direct-API driver skeleton; live is off, using a demo structural replay.",
              "Chain B：直接 API 驱动骨架；live 未开启，使用 demo 结构回放。"
            )
      }
    };

    // Live narration is surfaced on the evidence stage as the "research" phase.
    await replayRun(annotated, emit, {
      driver: "api",
      tier,
      locale,
      signal,
      extraProgress: (stageId) => (stageId === "evidence" ? narration : [])
    });
  }
};
