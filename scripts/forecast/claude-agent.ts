// Claude Code invocation + stream-json parsing.
//
// We drive the model as a CLI session: `claude --print --output-format
// stream-json --verbose --allowedTools WebSearch`. The stream-json output lets
// us do two things a plain markdown render cannot:
//   1) capture the agent's ACTUAL WebSearch queries and the result URLs it was
//      given — the ground-truth source trace used to flag fabricated citations;
//   2) read the final assistant text and extract the structured JSON the round
//      contract requires.
//
// The endpoint is configured purely by env (ANTHROPIC_BASE_URL / API key), so
// no secret is committed here.

import { spawn } from "node:child_process";
import type { AgentRoundOutput } from "./types";

export interface AgentRunResult {
  rawFinalText: string;
  parsed: AgentRoundOutput | null;
  parseError: string | null;
  searchQueries: string[];
  searchResultUrls: Set<string>; // every URL the agent's searches actually returned
  costUsd: number | null;
  numTurns: number | null;
  exitCode: number;
  stderrTail: string;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.FORECAST_AGENT_TIMEOUT_MS) || 360_000;

function pushUrlsDeep(node: unknown, urls: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) pushUrlsDeep(item, urls);
    return;
  }
  const rec = node as Record<string, unknown>;
  // A search-result link is any object carrying both a title and a url string.
  if (typeof rec.url === "string" && typeof rec.title === "string") {
    urls.add(rec.url);
  }
  for (const v of Object.values(rec)) pushUrlsDeep(v, urls);
}

function parseStreamJson(stdout: string): {
  finalText: string;
  searchQueries: string[];
  searchResultUrls: Set<string>;
  costUsd: number | null;
  numTurns: number | null;
} {
  const queries: string[] = [];
  const urls = new Set<string>();
  let finalText = "";
  let costUsd: number | null = null;
  let numTurns: number | null = null;
  const lastAssistantTexts: string[] = [];

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== "{") continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const type = obj.type;
    if (type === "assistant") {
      const msg = obj.message as { content?: unknown } | undefined;
      const content = (msg?.content as unknown[]) ?? [];
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b.type === "tool_use" && b.name === "WebSearch") {
          const input = b.input as { query?: unknown } | undefined;
          if (typeof input?.query === "string") queries.push(input.query);
        }
        if (b.type === "text" && typeof b.text === "string") {
          lastAssistantTexts.push(b.text);
        }
      }
    } else if (type === "user") {
      // tool_result frames carry the search links; scan them deeply.
      pushUrlsDeep(obj, urls);
    } else if (type === "result") {
      if (typeof obj.result === "string") finalText = obj.result;
      if (typeof obj.total_cost_usd === "number") costUsd = obj.total_cost_usd;
      if (typeof obj.num_turns === "number") numTurns = obj.num_turns;
    }
  }

  if (!finalText && lastAssistantTexts.length) {
    finalText = lastAssistantTexts[lastAssistantTexts.length - 1];
  }
  return { finalText, searchQueries: queries, searchResultUrls: urls, costUsd, numTurns };
}

// Pull the first balanced JSON object out of possibly-chatty model text.
export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  let s = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const STANCES = new Set(["supports_yes", "supports_no", "neutral"]);
const STRENGTHS = new Set(["weak", "moderate", "strong"]);
const CONFIDENCES = new Set(["low", "medium", "high"]);

// Fail-closed validation: a malformed round throws rather than silently
// degrading to a guessed number.
export function validateRoundOutput(raw: unknown): AgentRoundOutput {
  if (!raw || typeof raw !== "object") throw new Error("agent output is not an object");
  const o = raw as Record<string, unknown>;
  const evidenceRaw = Array.isArray(o.new_evidence) ? o.new_evidence : null;
  if (!evidenceRaw) throw new Error("new_evidence missing or not an array");
  const new_evidence = evidenceRaw.map((e, i) => {
    const ev = e as Record<string, unknown>;
    if (typeof ev.source_url !== "string" || !ev.source_url.trim())
      throw new Error(`evidence[${i}].source_url missing`);
    if (typeof ev.claim !== "string") throw new Error(`evidence[${i}].claim missing`);
    if (!STANCES.has(ev.stance as string)) throw new Error(`evidence[${i}].stance invalid: ${ev.stance}`);
    if (!STRENGTHS.has(ev.strength as string)) throw new Error(`evidence[${i}].strength invalid`);
    if (typeof ev.llr !== "number" || !Number.isFinite(ev.llr))
      throw new Error(`evidence[${i}].llr not a finite number`);
    return {
      claim: ev.claim,
      source_url: ev.source_url,
      source_title: typeof ev.source_title === "string" ? ev.source_title : "",
      stance: ev.stance as AgentRoundOutput["new_evidence"][number]["stance"],
      strength: ev.strength as AgentRoundOutput["new_evidence"][number]["strength"],
      llr: ev.llr,
      rationale: typeof ev.rationale === "string" ? ev.rationale : "",
    };
  });
  const prob = Number(o.agent_holistic_probability);
  if (!Number.isFinite(prob) || prob < 0 || prob > 1)
    throw new Error("agent_holistic_probability must be 0..1");
  if (!CONFIDENCES.has(o.confidence as string)) throw new Error("confidence invalid");
  return {
    round_summary: typeof o.round_summary === "string" ? o.round_summary : "",
    new_evidence,
    agent_holistic_probability: prob,
    confidence: o.confidence as AgentRoundOutput["confidence"],
    found_new_information: Boolean(o.found_new_information),
    notes: typeof o.notes === "string" ? o.notes : "",
  };
}

export interface RunAgentOptions {
  allowedTools?: string;
  model?: string;
  timeoutMs?: number;
  cwd?: string;
}

export async function runAgent(prompt: string, opts: RunAgentOptions = {}): Promise<AgentRunResult> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required (set ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY).");
  }
  const allowedTools = opts.allowedTools ?? process.env.FORECAST_ALLOWED_TOOLS ?? "WebSearch WebFetch";
  const model = opts.model ?? process.env.FORECAST_MODEL ?? "";
  const args = ["--print", "--output-format", "stream-json", "--verbose", "--allowedTools", allowedTools];
  if (model) args.push("--model", model);

  return await new Promise<AgentRunResult>((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: opts.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...(baseUrl ? { ANTHROPIC_BASE_URL: baseUrl } : {}),
        ANTHROPIC_API_KEY: apiKey,
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`agent timed out after ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`));
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const parsedStream = parseStreamJson(stdout);
      let parsed: AgentRoundOutput | null = null;
      let parseError: string | null = null;
      try {
        const obj = extractJsonObject(parsedStream.finalText);
        if (!obj) throw new Error("no JSON object found in agent final text");
        parsed = validateRoundOutput(obj);
      } catch (err) {
        parseError = err instanceof Error ? err.message : String(err);
      }
      resolve({
        rawFinalText: parsedStream.finalText,
        parsed,
        parseError,
        searchQueries: parsedStream.searchQueries,
        searchResultUrls: parsedStream.searchResultUrls,
        costUsd: parsedStream.costUsd,
        numTurns: parsedStream.numTurns,
        exitCode: code ?? -1,
        stderrTail: stderr.slice(-800),
      });
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
