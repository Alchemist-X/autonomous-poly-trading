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
import { rankClaimSources } from "./claims";
import type {
  AgentRoundOutput,
  ClaimCategory,
  ClaimSource,
  ClaimSupport,
  CrossCheckStatus,
  ResolutionRelevance,
  SourceType,
  SupportQuality
} from "./types";

export interface AgentRunResult {
  rawFinalText: string;
  jsonObject: unknown | null; // first balanced JSON object extracted from the final text
  jsonError: string | null; // set when no JSON object could be extracted
  searchQueries: string[];
  searchResultUrls: Set<string>; // every URL the agent's searches actually returned
  costUsd: number | null;
  numTurns: number | null;
  exitCode: number;
  stderrTail: string;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.FORECAST_AGENT_TIMEOUT_MS) || 360_000;

// Collect every URL the agent actually interacted with via a tool, so a cited
// source can be reconciled against what was really retrieved (fabrication guard).
// Two strong signals, captured without over-capturing page-embedded links:
//   - tool_use with input.url  → e.g. WebFetch: the URL the agent explicitly fetched
//   - {title, url} pairs        → WebSearch result links returned to the agent
function collectToolUrlsDeep(node: unknown, urls: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectToolUrlsDeep(item, urls);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (rec.type === "tool_use" && rec.input && typeof rec.input === "object") {
    const u = (rec.input as Record<string, unknown>).url;
    if (typeof u === "string" && u) urls.add(u);
  }
  if (typeof rec.url === "string" && typeof rec.title === "string") {
    urls.add(rec.url);
  }
  for (const v of Object.values(rec)) collectToolUrlsDeep(v, urls);
}

// Exported for testing: pull the tool-interaction URL set out of a raw
// stream-json stdout (covers both WebSearch results and WebFetch fetches).
export function extractToolUrls(stdout: string): Set<string> {
  const urls = new Set<string>();
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t || t[0] !== "{") continue;
    try {
      collectToolUrlsDeep(JSON.parse(t), urls);
    } catch {
      /* skip non-JSON lines */
    }
  }
  return urls;
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
    collectToolUrlsDeep(obj, urls); // tool_use.input.url (WebFetch) + {title,url} (WebSearch)
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
const SOURCE_TYPES = new Set<SourceType>([
  "official",
  "data",
  "academic",
  "original_reporting",
  "press",
  "insider",
  "secondary"
]);
const CLAIM_CATEGORIES = new Set<ClaimCategory>([
  "base_rate",
  "resolution",
  "current_state",
  "causal_driver",
  "counterevidence"
]);
const RELEVANCE = new Set<ResolutionRelevance>(["direct", "indirect", "context"]);
const RELATIONS = new Set<ClaimSupport>(["supports", "contradicts", "context"]);
const SUPPORT_QUALITY = new Set<SupportQuality>(["direct", "partial", "context"]);
const CROSS_CHECK = new Set<CrossCheckStatus>(["confirmed", "single_source", "contested", "unverified"]);

function cleanId(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value : "";
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function parseClaimSource(raw: unknown, fallback: Record<string, unknown>, index: number): ClaimSource | null {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : fallback;
  const url =
    typeof source.url === "string" ? source.url : typeof source.source_url === "string" ? source.source_url : "";
  if (!url.trim()) return null;
  const sourceType = SOURCE_TYPES.has(source.source_type as SourceType) ? (source.source_type as SourceType) : "press";
  const credibility = CONFIDENCES.has(source.credibility as string)
    ? (source.credibility as ClaimSource["credibility"])
    : "medium";
  return {
    url: url.trim(),
    title:
      typeof source.title === "string"
        ? source.title.trim()
        : typeof source.source_title === "string"
          ? source.source_title.trim()
          : "",
    sourceType,
    credibility,
    relation: RELATIONS.has(source.relation as ClaimSupport) ? (source.relation as ClaimSupport) : "supports",
    supportQuality: SUPPORT_QUALITY.has(source.support_quality as SupportQuality)
      ? (source.support_quality as SupportQuality)
      : "direct",
    publishedAt:
      typeof source.published_at === "string" && source.published_at.trim() ? source.published_at.trim() : null,
    isPrimary:
      typeof source.is_primary === "boolean" ? source.is_primary : sourceType === "official" || sourceType === "data",
    independenceGroup:
      typeof source.independence_group === "string" && source.independence_group.trim()
        ? source.independence_group.trim()
        : `source-${index + 1}`
  };
}

// Fail-closed validation: a malformed round throws rather than silently
// degrading to a guessed number.
export function validateRoundOutput(raw: unknown): AgentRoundOutput {
  if (!raw || typeof raw !== "object") throw new Error("agent output is not an object");
  const o = raw as Record<string, unknown>;
  const claimsRaw = Array.isArray(o.new_claims) ? o.new_claims : Array.isArray(o.new_evidence) ? o.new_evidence : null;
  if (!claimsRaw) throw new Error("new_claims missing or not an array");
  const newClaims = claimsRaw.map((e, i) => {
    const ev = e as Record<string, unknown>;
    if (typeof ev.claim !== "string" || !ev.claim.trim()) throw new Error(`claim[${i}].claim missing`);
    if (!STANCES.has(ev.stance as string)) throw new Error(`claim[${i}].stance invalid: ${ev.stance}`);
    if (!STRENGTHS.has(ev.strength as string)) throw new Error(`claim[${i}].strength invalid`);
    if (typeof ev.llr !== "number" || !Number.isFinite(ev.llr)) throw new Error(`claim[${i}].llr not a finite number`);
    const rawSources = Array.isArray(ev.sources) && ev.sources.length ? ev.sources : [ev];
    const sources = rankClaimSources(
      rawSources
        .map((source, sourceIndex) => parseClaimSource(source, ev, sourceIndex))
        .filter((source): source is ClaimSource => source !== null)
    );
    if (!sources.length) throw new Error(`claim[${i}] has no source URL`);
    const supportingSources = sources.filter((source) => source.relation === "supports");
    if (!supportingSources.length) throw new Error(`claim[${i}] has no source that supports the factual claim`);
    const best = supportingSources[0];
    const independent = new Set(sources.map((source) => source.independenceGroup)).size;
    const hasContradiction = sources.some((source) => source.relation === "contradicts");
    const derivedStatus: CrossCheckStatus = hasContradiction
      ? "contested"
      : independent >= 2
        ? "confirmed"
        : "single_source";
    const crossCheckStatus = CROSS_CHECK.has(ev.cross_check_status as CrossCheckStatus)
      ? (ev.cross_check_status as CrossCheckStatus)
      : derivedStatus;
    return {
      // When an older caller omits a semantic id, leave it empty so the
      // engine derives the dedupe key from the claim text. A positional id
      // such as claim-1 would incorrectly collide across research rounds.
      claim_id: cleanId(ev.claim_id, ""),
      focus_id: cleanId(ev.focus_id, "unassigned"),
      claim: ev.claim.trim(),
      source_url: best.url,
      source_title: best.title,
      stance: ev.stance as AgentRoundOutput["newClaims"][number]["stance"],
      strength: ev.strength as AgentRoundOutput["newClaims"][number]["strength"],
      llr: ev.llr,
      rationale: typeof ev.rationale === "string" ? ev.rationale : "",
      cluster_id: typeof ev.cluster_id === "string" ? ev.cluster_id : "",
      source_type: best.sourceType,
      credibility: best.credibility,
      category: CLAIM_CATEGORIES.has(ev.category as ClaimCategory) ? (ev.category as ClaimCategory) : "current_state",
      resolution_relevance: RELEVANCE.has(ev.resolution_relevance as ResolutionRelevance)
        ? (ev.resolution_relevance as ResolutionRelevance)
        : "direct",
      cross_check_status: crossCheckStatus,
      selection_rationale: typeof ev.selection_rationale === "string" ? ev.selection_rationale.trim() : "",
      sources
    };
  });
  if (!CONFIDENCES.has(o.confidence as string)) throw new Error("confidence invalid");
  // (a) reflection is optional; keep only well-formed entries (target + new source + finite adj).
  const reflectionRaw = Array.isArray(o.reflection) ? o.reflection : [];
  const reflection = reflectionRaw
    .map((r) => r as Record<string, unknown>)
    .filter(
      (r) =>
        typeof r.target_url === "string" &&
        r.target_url.trim() &&
        typeof r.new_source_url === "string" &&
        r.new_source_url.trim() &&
        typeof r.llr_adjustment === "number" &&
        Number.isFinite(r.llr_adjustment)
    )
    .map((r) => ({
      target_url: r.target_url as string,
      llr_adjustment: r.llr_adjustment as number,
      reason: typeof r.reason === "string" ? r.reason : "",
      new_source_url: r.new_source_url as string
    }));
  return {
    round_summary: typeof o.round_summary === "string" ? o.round_summary : "",
    newClaims,
    reflection,
    confidence: o.confidence as AgentRoundOutput["confidence"],
    found_new_information: Boolean(o.found_new_information),
    notes: typeof o.notes === "string" ? o.notes : ""
  };
}

export interface RunAgentOptions {
  allowedTools?: string;
  model?: string;
  timeoutMs?: number;
  cwd?: string;
}

export async function runAgentRaw(prompt: string, opts: RunAgentOptions = {}): Promise<AgentRunResult> {
  // Auth is whatever the claude CLI can resolve from the inherited env, in its
  // own precedence: ANTHROPIC_API_KEY (API billing), CLAUDE_CODE_OAUTH_TOKEN
  // (long-lived subscription token from `claude setup-token` — the headless-
  // server path), or the CLI's stored interactive login. No key is required
  // here; an unauthenticated CLI fails the run with its own clear error.
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const allowedTools = opts.allowedTools ?? process.env.FORECAST_ALLOWED_TOOLS ?? "WebSearch WebFetch";
  const model = opts.model ?? process.env.FORECAST_MODEL ?? "";
  const args = ["--print", "--output-format", "stream-json", "--verbose", "--allowedTools", allowedTools];
  if (model) args.push("--model", model);

  return await new Promise<AgentRunResult>((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: opts.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...(baseUrl ? { ANTHROPIC_BASE_URL: baseUrl } : {})
      }
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
      const jsonObject = extractJsonObject(parsedStream.finalText);
      const jsonError = jsonObject ? null : "no JSON object found in agent final text";
      resolve({
        rawFinalText: parsedStream.finalText,
        jsonObject,
        jsonError,
        searchQueries: parsedStream.searchQueries,
        searchResultUrls: parsedStream.searchResultUrls,
        costUsd: parsedStream.costUsd,
        numTurns: parsedStream.numTurns,
        exitCode: code ?? -1,
        stderrTail: stderr.slice(-800)
      });
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
