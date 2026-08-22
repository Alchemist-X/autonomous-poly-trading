// Pluggable web-search backend for the OpenAI-compatible providers
// (DeepSeek/Kimi), used by the tool loop in deepseek-agent.ts.
//
// Backends, in preference order:
//   - exa         when EXA_API_KEY is set (neural/semantic index; returns
//                 query-anchored highlights and a publishedDate per result)
//   - tavily      when TAVILY_API_KEY is set (reliable, 1k free credits/mo)
//   - duckduckgo  keyless default (HTML endpoint; fine at this call volume)
// The backend can be pinned via FORECAST_WEB_SEARCH=exa|tavily|duckduckgo.

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

export type SearchBackend = "exa" | "tavily" | "duckduckgo";

export function backendName(): SearchBackend {
  const pin = (process.env.FORECAST_WEB_SEARCH ?? "").trim().toLowerCase();
  if (pin === "exa") return "exa";
  if (pin === "tavily") return "tavily";
  if (pin === "duckduckgo") return "duckduckgo";
  if (process.env.EXA_API_KEY) return "exa";
  return process.env.TAVILY_API_KEY ? "tavily" : "duckduckgo";
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
  const data = (await res.json()) as { results?: ExaResult[] };
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

// DuckDuckGo's HTML endpoint wraps result hrefs as /l/?uddg=<encoded real url>.
export function parseDuckDuckGoHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html)) && snippets.length < MAX_HITS * 2) {
    snippets.push(stripTags(sm[1] ?? ""));
  }
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && hits.length < MAX_HITS) {
    const href = m[1] ?? "";
    let url = href;
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg?.[1]) {
      try {
        url = decodeURIComponent(uddg[1]);
      } catch {
        url = href;
      }
    }
    if (!/^https?:\/\//i.test(url)) continue;
    hits.push({ title: stripTags(m[2] ?? ""), url, snippet: snippets[hits.length] ?? "" });
  }
  return hits;
}

// DuckDuckGo answers bot-detected requests with HTTP 200 and a CAPTCHA page
// ("select all squares containing a duck") that carries no results. The result
// parser reads that as zero hits, so a blocked scraper is indistinguishable
// from a genuine empty result — the model is told "no evidence exists" when
// the truth is "the search never ran". Detect the challenge and fail loudly.
export function isDuckDuckGoChallenge(html: string): boolean {
  return /anomaly-modal__|challenge-form/i.test(html);
}

async function duckDuckGoSearch(query: string, fetchFn: typeof fetch): Promise<SearchHit[]> {
  const res = await fetchFn(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`duckduckgo search ${res.status}`);
  const html = await res.text();
  if (isDuckDuckGoChallenge(html)) {
    throw new Error("duckduckgo search blocked: bot-check challenge page (HTTP 200, no results)");
  }
  return parseDuckDuckGoHtml(html);
}

export async function webSearch(query: string, fetchFn: typeof fetch = fetch): Promise<SearchHit[]> {
  switch (backendName()) {
    case "exa":
      return exaSearch(query, fetchFn);
    case "tavily":
      return tavilySearch(query, fetchFn);
    default:
      return duckDuckGoSearch(query, fetchFn);
  }
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
