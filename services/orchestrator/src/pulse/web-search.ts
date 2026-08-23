import fs from "node:fs";
import type { OrchestratorConfig } from "../config.js";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import type { PulseCandidate } from "./market-pulse.js";

const DEFAULT_RESULTS_PER_QUERY = 4;
const DEFAULT_QUERIES_PER_CANDIDATE = 4;

export interface PulseWebSearchResult {
  title: string;
  url: string;
  sourceHost: string;
  snippet: string;
  rank: number;
  // Exa supplies this; it flows into the pulse evidence JSON so the render
  // stage can weigh fresh reporting over stale pages.
  publishedDate?: string;
}

export interface PulseWebSearchQueryEvidence {
  query: string;
  status: "completed" | "failed";
  results: PulseWebSearchResult[];
  error?: string;
}

export interface PulseWebSearchCandidateEvidence {
  marketSlug: string;
  question: string;
  queries: PulseWebSearchQueryEvidence[];
}

export interface PulseWebSearchSummary {
  enabled: boolean;
  status: "completed" | "timed_out" | "failed" | "disabled";
  searchedAtUtc: string;
  timeoutMs: number;
  elapsedMs: number;
  candidates: PulseWebSearchCandidateEvidence[];
  failureReason?: string;
}

export type PulseWebSearchRunner = (
  query: string,
  options: { signal: AbortSignal }
) => Promise<PulseWebSearchResult[]>;

function truncate(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Exa search runner (the default backend). The old keyless DuckDuckGo scraper
// was removed 2026-08-22: DDG bot-walls it with HTTP-200 CAPTCHA pages that
// parsed as "0 results", silently feeding the pulse prompt "no evidence" when
// the search never ran. Exa needs EXA_API_KEY; without it the collector
// reports a loud "failed" summary instead of degrading.
interface ExaSearchResult {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  highlights?: string[];
}

export async function searchExa(
  query: string,
  options: { signal: AbortSignal },
  fetchFn: typeof fetch = fetch
): Promise<PulseWebSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("exa search: EXA_API_KEY is not set");
  }
  const response = await fetchFn("https://api.exa.ai/search", {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: DEFAULT_RESULTS_PER_QUERY,
      contents: { highlights: true }
    })
  });
  if (!response.ok) {
    throw new Error(`exa search ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as { results?: ExaSearchResult[]; costDollars?: { total?: number } };
  const ledger = process.env.EXA_COST_LEDGER;
  if (ledger && typeof data.costDollars?.total === "number") {
    try {
      fs.appendFileSync(ledger, JSON.stringify({ atUtc: new Date().toISOString(), costDollars: data.costDollars.total }) + "\n");
    } catch {
      /* metering is best-effort */
    }
  }
  const results: PulseWebSearchResult[] = [];
  for (const item of data.results ?? []) {
    if (!item.url) {
      continue;
    }
    results.push({
      title: truncate((item.title ?? "").trim() || item.url, 180),
      url: item.url,
      sourceHost: hostFromUrl(item.url),
      snippet: truncate((item.highlights ?? []).join(" … ").replace(/\s+/g, " ").trim(), 420),
      rank: results.length + 1,
      ...(item.publishedDate ? { publishedDate: item.publishedDate } : {})
    });
    if (results.length >= DEFAULT_RESULTS_PER_QUERY) {
      break;
    }
  }
  return results;
}

export function buildPulseWebSearchQueries(candidate: PulseCandidate): string[] {
  const question = candidate.question.trim();
  const tagText = (candidate.tags ?? [])
    .map((tag) => tag.label || tag.slug)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  const categoryText = candidate.categoryLabel ?? candidate.categorySlug ?? "";
  const terms = [question, categoryText, tagText]
    .filter((part) => part.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const queries = [
    `"${question}"`,
    `${terms} official announcement statement`,
    `${terms} Reuters AP latest`,
    `${terms} site:reuters.com OR site:apnews.com OR site:state.gov OR site:whitehouse.gov OR site:iaea.org`
  ];
  const seen = new Set<string>();
  return queries
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query) => {
      if (!query || seen.has(query)) {
        return false;
      }
      seen.add(query);
      return true;
    })
    .slice(0, DEFAULT_QUERIES_PER_CANDIDATE);
}

export function resolvePulseWebSearchTimeoutMs(config: Pick<OrchestratorConfig, "pulse">): number {
  return Math.max(1, config.pulse.webSearchTimeoutSeconds) * 1000;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function collectPulseWebSearchEvidence(input: {
  candidates: readonly PulseCandidate[];
  config: Pick<OrchestratorConfig, "pulse">;
  progress?: ProgressReporter;
  search?: PulseWebSearchRunner;
  now?: () => Date;
}): Promise<PulseWebSearchSummary> {
  const searchedAt = input.now?.() ?? new Date();
  const timeoutMs = resolvePulseWebSearchTimeoutMs(input.config);
  const startedAt = Date.now();
  if (!input.config.pulse.webSearchEnabled) {
    return {
      enabled: false,
      status: "disabled",
      searchedAtUtc: searchedAt.toISOString(),
      timeoutMs,
      elapsedMs: 0,
      candidates: []
    };
  }

  // Fail loudly up front when the default backend cannot run at all: a missing
  // key would otherwise fail every query one by one for the full timeout.
  if (!input.search && !process.env.EXA_API_KEY) {
    const reason = "EXA_API_KEY is not set — pulse web search cannot run (keyless DuckDuckGo scraper removed 2026-08-22).";
    input.progress?.stage({ percent: 49, label: "Pulse web-search failed", detail: reason });
    return {
      enabled: true,
      status: "failed",
      searchedAtUtc: searchedAt.toISOString(),
      timeoutMs,
      elapsedMs: 0,
      candidates: [],
      failureReason: reason
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const search = input.search ?? searchExa;
  const evidence: PulseWebSearchCandidateEvidence[] = [];
  let queryCount = 0;
  let queryFailures = 0;

  input.progress?.stage({
    percent: 45,
    label: "Pulse web-search started",
    detail: `${input.candidates.length} candidate(s), timeout ${Math.round(timeoutMs / 1000)}s`
  });

  try {
    for (const candidate of input.candidates) {
      const queries = buildPulseWebSearchQueries(candidate);
      const queryEvidence: PulseWebSearchQueryEvidence[] = [];
      for (const query of queries) {
        if (controller.signal.aborted) {
          throw createAbortError("Pulse web-search timed out.");
        }
        queryCount += 1;
        input.progress?.stage({
          percent: 46,
          label: "Pulse web-search query",
          detail: `${candidate.marketSlug}: ${query}`
        });
        try {
          const results = await search(query, { signal: controller.signal });
          queryEvidence.push({
            query,
            status: "completed",
            results: results.slice(0, DEFAULT_RESULTS_PER_QUERY)
          });
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }
          queryFailures += 1;
          queryEvidence.push({
            query,
            status: "failed",
            results: [],
            error: getErrorMessage(error)
          });
        }
      }
      evidence.push({
        marketSlug: candidate.marketSlug,
        question: candidate.question,
        queries: queryEvidence
      });
    }
  } catch (error) {
    clearTimeout(timer);
    if (isAbortError(error)) {
      input.progress?.stage({
        percent: 49,
        label: "Pulse web-search timed out",
        detail: `${Math.round(timeoutMs / 1000)}s timeout reached; continuing without blocking Pulse render`
      });
      return {
        enabled: true,
        status: "timed_out",
        searchedAtUtc: searchedAt.toISOString(),
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        candidates: evidence,
        failureReason: `Timed out after ${timeoutMs}ms.`
      };
    }
    input.progress?.stage({
      percent: 49,
      label: "Pulse web-search failed",
      detail: getErrorMessage(error)
    });
    return {
      enabled: true,
      status: "failed",
      searchedAtUtc: searchedAt.toISOString(),
      timeoutMs,
      elapsedMs: Date.now() - startedAt,
      candidates: evidence,
      failureReason: getErrorMessage(error)
    };
  } finally {
    clearTimeout(timer);
  }

  const status = queryCount > 0 && queryFailures === queryCount ? "failed" : "completed";
  input.progress?.stage({
    percent: 49,
    label: status === "completed" ? "Pulse web-search complete" : "Pulse web-search failed",
    detail: `${queryCount - queryFailures}/${queryCount} query(s) completed`
  });
  return {
    enabled: true,
    status,
    searchedAtUtc: searchedAt.toISOString(),
    timeoutMs,
    elapsedMs: Date.now() - startedAt,
    candidates: evidence,
    ...(status === "failed" ? { failureReason: "All web-search queries failed." } : {})
  };
}
