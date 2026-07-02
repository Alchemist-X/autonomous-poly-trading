// DeepSeek provider — OpenAI-compatible chat completion, NO web search.
//
// This backend exists so the loop can be exercised cheaply (and driven from the
// Raven app) without Claude Code: one HTTP POST per round, structured JSON via
// json_object mode. It has no tool trace, so the fabrication guard degrades to
// a CITATION LIVENESS check (see verifyCitedUrls): a cited URL counts as
// "verified" unless it provably does not exist — a strictly weaker guarantee
// than Claude's search-trace membership (a live page does not prove the model
// read it, only that the citation isn't a dead fabrication).
//
// The endpoint is configured purely by env (DEEPSEEK_BASE_URL / API key), so no
// secret is committed here.

import { extractJsonObject } from "./claude-agent";
import type { AgentRunResult, RunAgentOptions } from "./claude-agent";

export interface DeepSeekDeps {
  fetchFn?: typeof fetch; // injectable for tests
}

// Deep-scan the agent's structured output for every cited URL (source_url on
// evidence, new_source_url on reflections) so their liveness can be checked.
export function collectCitedUrls(jsonObject: unknown): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const rec = node as Record<string, unknown>;
    for (const key of ["source_url", "new_source_url"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim() && !seen.has(v)) {
        seen.add(v);
        urls.push(v);
      }
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(jsonObject);
  return urls;
}

const VERIFY_TIMEOUT_MS = 8_000; // per-URL budget
const VERIFY_CONCURRENCY = 6;
const VERIFY_MAX_URLS = 24; // cap the probe fan-out per round

// Only these statuses prove a citation is DEAD. Anti-bot refusals (401/403/
// 405/429) and origin hiccups (5xx) come from real, existing pages — major
// outlets (WSJ, Reuters, Bloomberg) refuse HEAD/GET from scripts, and treating
// them as fabrications would soft-clamp exactly the highest-quality citations.
// A fabricated path on a real domain overwhelmingly returns 404/410.
const DEAD_STATUSES = new Set([404, 410]);

// CITATION LIVENESS check standing in for the search trace: a cited URL counts
// as "verified" unless it demonstrably does not exist (DEAD_STATUSES) or the
// host is unreachable (network error / timeout on both probes). Method: HEAD
// first; on a dead status or a thrown probe, one GET attempt (aborted right
// after headers — the body is never downloaded). NOTE this only proves the
// citation resolves to a live page, NOT that the model actually read it; the
// engine's unverified soft-clamp still applies to anything that fails.
export async function verifyCitedUrls(urls: string[], fetchFn: typeof fetch = fetch): Promise<Set<string>> {
  const unique = [...new Set(urls)].slice(0, VERIFY_MAX_URLS);
  const verified = new Set<string>();

  const probe = async (url: string, method: "HEAD" | "GET"): Promise<number> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const res = await fetchFn(url, { method, redirect: "follow", signal: controller.signal });
      if (method === "GET") controller.abort(); // headers are enough; do not download the body
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  };

  const check = async (url: string): Promise<void> => {
    try {
      if (!DEAD_STATUSES.has(await probe(url, "HEAD"))) {
        verified.add(url);
        return;
      }
    } catch {
      /* HEAD failed outright — fall through to the GET attempt */
    }
    // HEAD said dead (some servers 404 HEAD but serve GET) or errored — one GET attempt.
    try {
      if (!DEAD_STATUSES.has(await probe(url, "GET"))) verified.add(url);
    } catch {
      /* unreachable — leave it out of the set */
    }
  };

  // Bounded concurrency: a shared cursor over the deduped list.
  let next = 0;
  const workers = Array.from({ length: Math.min(VERIFY_CONCURRENCY, unique.length) }, async () => {
    while (next < unique.length) {
      const url = unique[next++];
      if (url === undefined) break;
      await check(url);
    }
  });
  await Promise.all(workers);
  return verified;
}

export async function runDeepSeekRaw(
  prompt: string,
  opts: RunAgentOptions = {},
  deps: DeepSeekDeps = {}
): Promise<AgentRunResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for the deepseek provider.");
  }
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = opts.model || process.env.FORECAST_DEEPSEEK_MODEL || "deepseek-chat";
  const fetchFn = deps.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? (Number(process.env.FORECAST_AGENT_TIMEOUT_MS) || 360_000);

  // The timeout must cover the BODY read too, not just the response headers — a
  // drip-fed body would otherwise stall a round indefinitely. The abort signal
  // propagates into res.text()/res.json(), so the timer stays armed until the
  // body is fully consumed.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let data: {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        // json_object mode requires the word "json" in the prompt — every engine
        // prompt already demands a JSON object, so this is safe to always set.
        response_format: { type: "json_object" },
        max_tokens: 6000,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`deepseek API error ${res.status}: ${body.slice(0, 300)}`);
    }
    data = (await res.json()) as typeof data;
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`deepseek request timed out after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const rawFinalText = data.choices?.[0]?.message?.content ?? "";
  const jsonObject = rawFinalText ? extractJsonObject(rawFinalText) : null;
  const jsonError = !rawFinalText
    ? "empty completion"
    : jsonObject
      ? null
      : "no JSON object found in agent final text";

  // Cost is only computable when the operator supplies prices (per Mtok) via env.
  const priceIn = Number(process.env.DEEPSEEK_PRICE_IN_PER_MTOK);
  const priceOut = Number(process.env.DEEPSEEK_PRICE_OUT_PER_MTOK);
  const costUsd =
    Number.isFinite(priceIn) && Number.isFinite(priceOut) && data.usage
      ? ((data.usage.prompt_tokens ?? 0) * priceIn + (data.usage.completion_tokens ?? 0) * priceOut) / 1_000_000
      : null;

  // No search trace exists for this provider; the liveness-checked citation set
  // stands in so the engine's verified/unverified soft-clamp still functions.
  const searchResultUrls = await verifyCitedUrls(collectCitedUrls(jsonObject), deps.fetchFn);

  return {
    rawFinalText,
    jsonObject,
    jsonError,
    searchQueries: [], // provider has no search
    searchResultUrls,
    costUsd,
    numTurns: 1,
    exitCode: 0,
    stderrTail: "",
  };
}
