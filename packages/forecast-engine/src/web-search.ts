import fs from "node:fs";

// Pluggable web-search backend for the OpenAI-compatible providers
// (DeepSeek/Kimi), used by the tool loop in deepseek-agent.ts.
//
// Backends, in preference order:
//   - exa     when EXA_API_KEY is set (neural/semantic index; returns
//             query-anchored highlights and a publishedDate per result)
//   - tavily  when TAVILY_API_KEY is set (reliable, 1k free credits/mo)
// The backend can be pinned via FORECAST_WEB_SEARCH=exa|tavily.
//
// There is deliberately NO keyless fallback. The old DuckDuckGo HTML scraper
// was removed 2026-08-22 (user decision): DDG bot-walls the scraper with
// HTTP-200 CAPTCHA pages, which parsed as "0 results" and silently fed the
// model "no evidence exists" when the search never ran. No key -> loud error.

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  // Only backends with a real index populate these. They matter for
  // recency-sensitive questions: the model can date a claim without an extra
  // fetch_page round-trip, and stale sources become visible rather than
  // silently equal-weighted with fresh ones.
  publishedDate?: string;
  author?: string;
}

const MAX_HITS = 8;
const SEARCH_TIMEOUT_MS = 15_000;
const PAGE_TIMEOUT_MS = 12_000;
const PAGE_TEXT_CAP = 6_000;
const SNIPPET_CAP = 300;
const UA = "Mozilla/5.0 (X11; Linux x86_64) raven-forecast-research/1.0";

export type SearchBackend = "exa" | "tavily";

// Resolve the active backend or throw an actionable error. Throwing (rather
// than degrading) is the contract: the tool loop surfaces the message to the
// model as "[tool failed: ...]" and the run's search trace shows the truth.
export function backendName(): SearchBackend {
  const pin = (process.env.FORECAST_WEB_SEARCH ?? "").trim().toLowerCase();
  if (pin === "exa") return "exa";
  if (pin === "tavily") return "tavily";
  if (pin === "duckduckgo") {
    throw new Error(
      "FORECAST_WEB_SEARCH=duckduckgo: the duckduckgo backend was removed 2026-08-22 " +
        "(bot-walled scraper). Set EXA_API_KEY (preferred) or TAVILY_API_KEY and pin exa|tavily."
    );
  }
  if (process.env.EXA_API_KEY) return "exa";
  if (process.env.TAVILY_API_KEY) return "tavily";
  throw new Error(
    "web search enabled but no backend key found: set EXA_API_KEY (preferred) or TAVILY_API_KEY."
  );
}

// Exa search endpoint. `contents.highlights` is what makes the result usable
// without a follow-up fetch: Exa picks the excerpts that answer the query
// rather than the page's opening boilerplate. numResults is pinned to MAX_HITS
// (Exa's own default is 10) so every backend hands the model the same budget.
async function exaSearch(query: string, fetchFn: typeof fetch): Promise<SearchHit[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("exa search: EXA_API_KEY is not set");
  const res = await fetchFn("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: MAX_HITS,
      contents: { highlights: true }
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`exa search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { results?: ExaResult[]; costDollars?: { total?: number } };
  recordExaCost(data.costDollars?.total);
  return (data.results ?? [])
    .filter((r) => r.url)
    .slice(0, MAX_HITS)
    .map((r) => ({
      title: r.title ?? "",
      url: r.url!,
      snippet: (r.highlights ?? []).join(" … ").replace(/\s+/g, " ").trim().slice(0, SNIPPET_CAP),
      ...(r.publishedDate ? { publishedDate: r.publishedDate } : {}),
      ...(r.author ? { author: r.author } : {})
    }));
}

// Exa has no balance API, but every response reports its exact cost. When
// EXA_COST_LEDGER points at a file, append one JSONL line per call so the
// quota monitor can meter spend against a manually-anchored credit balance.
// Never throws: metering must not break search.
function recordExaCost(costDollars: number | undefined): void {
  const ledger = process.env.EXA_COST_LEDGER;
  if (!ledger || typeof costDollars !== "number" || !Number.isFinite(costDollars)) return;
  try {
    fs.appendFileSync(ledger, JSON.stringify({ atUtc: new Date().toISOString(), costDollars }) + "\n");
  } catch {
    /* metering is best-effort */
  }
}

interface ExaResult {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  author?: string | null;
  highlights?: string[];
}

async function tavilySearch(query: string, fetchFn: typeof fetch): Promise<SearchHit[]> {
  const res = await fetchFn("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: MAX_HITS }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`tavily search ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results ?? [])
    .filter((r) => r.url)
    .slice(0, MAX_HITS)
    .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.content ?? "").slice(0, SNIPPET_CAP) }));
}

export async function webSearch(query: string, fetchFn: typeof fetch = fetch): Promise<SearchHit[]> {
  return backendName() === "exa" ? exaSearch(query, fetchFn) : tavilySearch(query, fetchFn);
}

export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Fetch a page and return readable text (scripts/styles/tags stripped,
// whitespace collapsed, capped) — enough for the model to extract claims.
export async function fetchPageText(url: string, fetchFn: typeof fetch = fetch): Promise<string> {
  try {
    const res = await fetchFn(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
    });
    if (!res.ok) return `[fetch failed: HTTP ${res.status}]`;
    const text = stripTags(await res.text());
    return text.slice(0, PAGE_TEXT_CAP) || "[fetch succeeded but the page had no extractable text]";
  } catch (error) {
    return `[fetch failed: ${error instanceof Error ? error.message : String(error)}]`;
  }
}
