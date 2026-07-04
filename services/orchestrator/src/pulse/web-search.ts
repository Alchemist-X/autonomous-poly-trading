import type { OrchestratorConfig } from "../config.js";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import type { PulseCandidate } from "./market-pulse.js";

const DEFAULT_RESULTS_PER_QUERY = 4;
const DEFAULT_QUERIES_PER_CANDIDATE = 4;
const DEFAULT_PAGES_PER_CANDIDATE = 2;
const PAGE_EXCERPT_MAX_CHARS = 1600;
const PAGE_FETCH_TIMEOUT_MS = 12_000;

export interface PulseWebSearchResult {
  title: string;
  url: string;
  sourceHost: string;
  snippet: string;
  rank: number;
}

export interface PulseWebSearchQueryEvidence {
  query: string;
  status: "completed" | "failed";
  results: PulseWebSearchResult[];
  error?: string;
}

// Full-text excerpt of a top search hit. Snippets alone proved to be
// navigational noise (titles + 300 chars) — the report LLM repeatedly flagged
// "no quantitative evidence, sources are nav pages"; fetching the top pages'
// readable text turns the search step into actual evidence.
export interface PulseWebSearchPageExcerpt {
  url: string;
  sourceHost: string;
  status: "fetched" | "failed";
  excerpt?: string;
  error?: string;
}

export interface PulseWebSearchCandidateEvidence {
  marketSlug: string;
  question: string;
  queries: PulseWebSearchQueryEvidence[];
  pages?: PulseWebSearchPageExcerpt[];
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

export type PulseWebSearchPageFetcher = (
  url: string,
  options: { signal: AbortSignal }
) => Promise<string>;

function htmlDecode(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value: string): string {
  return htmlDecode(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function normalizeSearchUrl(rawHref: string): string | null {
  const decoded = htmlDecode(rawHref.trim());
  try {
    const parsed = new URL(decoded, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    if (redirected) {
      return new URL(redirected).toString();
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function parseDuckDuckGoHtml(html: string): PulseWebSearchResult[] {
  const linkMatches = [...html.matchAll(
    /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )];
  const snippetMatches = [...html.matchAll(
    /<(?:a|div)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/gi
  )];
  const seen = new Set<string>();
  const results: PulseWebSearchResult[] = [];

  for (const [index, match] of linkMatches.entries()) {
    const url = normalizeSearchUrl(match[1] ?? "");
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    const title = stripTags(match[2] ?? "");
    if (!title) {
      continue;
    }
    const snippet = stripTags(snippetMatches[index]?.[1] ?? "");
    results.push({
      title: truncate(title, 180),
      url,
      sourceHost: hostFromUrl(url),
      snippet: truncate(snippet, 420),
      rank: results.length + 1
    });
  }

  return results;
}

// The authority query is category-aware: for sports the strongest public
// baseline is bookmaker odds (implied probabilities), for crypto/finance the
// live data itself; the wire/government site filter only fits politics-shaped
// events and used to be applied to everything.
const SPORTS_CATEGORIES = new Set(["sports", "soccer", "football", "tennis", "esports", "nba", "nfl", "mlb", "fifa"]);
const FINANCE_CATEGORIES = new Set(["crypto", "cryptocurrency", "finance", "economics", "macro", "commodities", "stocks"]);

function buildAuthorityQuery(candidate: PulseCandidate, terms: string): string {
  const category = (candidate.categorySlug ?? candidate.categoryLabel ?? "").toLowerCase();
  if ([...SPORTS_CATEGORIES].some((c) => category.includes(c))) {
    return `${candidate.question.trim()} bookmaker odds implied probability`;
  }
  if ([...FINANCE_CATEGORIES].some((c) => category.includes(c))) {
    return `${terms} price data analysis site:coingecko.com OR site:tradingview.com OR site:bloomberg.com OR site:reuters.com`;
  }
  return `${terms} site:reuters.com OR site:apnews.com OR site:state.gov OR site:whitehouse.gov OR site:iaea.org`;
}

export function buildPulseWebSearchQueries(candidate: PulseCandidate, now: Date = new Date()): string[] {
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
  // Recency anchor: DDG has no date operator that survives the HTML endpoint,
  // but a month-year token reliably pulls current coverage above evergreen pages.
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const queries = [
    `"${question}"`,
    `${terms} official announcement statement`,
    `${terms} Reuters AP latest ${monthYear}`,
    buildAuthorityQuery(candidate, terms)
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

// Fetch one page and reduce it to readable text (tags stripped, whitespace
// collapsed, capped). Failures are represented in the summary, never thrown.
async function fetchPageText(url: string, options: { signal: AbortSignal }): Promise<string> {
  const pageTimeout = AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    signal: AbortSignal.any([options.signal, pageTimeout]),
    redirect: "follow",
    headers: {
      "accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      "user-agent": "predict-raven-pulse-web-search/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`page fetch failed: HTTP ${response.status}`);
  }
  return stripTags(await response.text());
}

// Pick the pages worth reading in full for one candidate: round-robin across
// the candidate's queries (each query's top hit first, for source diversity),
// dedupe by URL, and skip hosts that cannot carry event evidence (the market
// itself, search engines).
const SKIP_PAGE_HOSTS = new Set(["polymarket.com", "duckduckgo.com"]);
export function selectPagesToFetch(
  queries: readonly PulseWebSearchQueryEvidence[],
  limit: number = DEFAULT_PAGES_PER_CANDIDATE
): PulseWebSearchResult[] {
  const seen = new Set<string>();
  const picks: PulseWebSearchResult[] = [];
  const maxResults = Math.max(0, ...queries.map((query) => query.results.length));
  for (let rank = 0; rank < maxResults; rank++) {
    for (const query of queries) {
      const result = query.results[rank];
      if (!result) {
        continue;
      }
      if (picks.length >= limit) {
        return picks;
      }
      if (seen.has(result.url) || SKIP_PAGE_HOSTS.has(result.sourceHost)) {
        continue;
      }
      seen.add(result.url);
      picks.push(result);
    }
  }
  return picks;
}

async function searchDuckDuckGo(query: string, options: { signal: AbortSignal }): Promise<PulseWebSearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      "accept": "text/html",
      "user-agent": "predict-raven-pulse-web-search/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }
  const html = await response.text();
  return parseDuckDuckGoHtml(html).slice(0, DEFAULT_RESULTS_PER_QUERY);
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
  fetchPage?: PulseWebSearchPageFetcher;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const search = input.search ?? searchDuckDuckGo;
  const fetchPage = input.fetchPage ?? fetchPageText;
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
      // Full-text pass: read the top hits so the render step gets dated,
      // quotable evidence instead of navigational snippets. Page failures are
      // recorded per URL; an expired global budget just stops further fetches
      // (already-collected search evidence must not be discarded as timed_out).
      const pages: PulseWebSearchPageExcerpt[] = [];
      for (const pick of selectPagesToFetch(queryEvidence)) {
        if (controller.signal.aborted) {
          break;
        }
        input.progress?.stage({
          percent: 47,
          label: "Pulse web-search page fetch",
          detail: `${candidate.marketSlug}: ${pick.sourceHost}`
        });
        try {
          const text = await fetchPage(pick.url, { signal: controller.signal });
          pages.push({
            url: pick.url,
            sourceHost: pick.sourceHost,
            status: "fetched",
            excerpt: truncate(text, PAGE_EXCERPT_MAX_CHARS)
          });
        } catch (error) {
          if (controller.signal.aborted) {
            break;
          }
          pages.push({
            url: pick.url,
            sourceHost: pick.sourceHost,
            status: "failed",
            error: getErrorMessage(error)
          });
        }
      }

      evidence.push({
        marketSlug: candidate.marketSlug,
        question: candidate.question,
        queries: queryEvidence,
        pages
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
