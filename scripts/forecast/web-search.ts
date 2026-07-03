// Pluggable web-search backend for the OpenAI-compatible providers
// (DeepSeek/Kimi), used by the tool loop in deepseek-agent.ts.
//
// Backends, in preference order:
//   - tavily      when TAVILY_API_KEY is set (reliable, 1k free credits/mo)
//   - duckduckgo  keyless default (HTML endpoint; fine at this call volume)
// The backend can be pinned via FORECAST_WEB_SEARCH=tavily|duckduckgo.

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

const MAX_HITS = 8;
const SEARCH_TIMEOUT_MS = 15_000;
const PAGE_TIMEOUT_MS = 12_000;
const PAGE_TEXT_CAP = 6_000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) raven-forecast-research/1.0";

function backendName(): "tavily" | "duckduckgo" {
  const pin = (process.env.FORECAST_WEB_SEARCH ?? "").trim().toLowerCase();
  if (pin === "tavily") return "tavily";
  if (pin === "duckduckgo") return "duckduckgo";
  return process.env.TAVILY_API_KEY ? "tavily" : "duckduckgo";
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
    .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.content ?? "").slice(0, 300) }));
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

async function duckDuckGoSearch(query: string, fetchFn: typeof fetch): Promise<SearchHit[]> {
  const res = await fetchFn(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`duckduckgo search ${res.status}`);
  return parseDuckDuckGoHtml(await res.text());
}

export async function webSearch(query: string, fetchFn: typeof fetch = fetch): Promise<SearchHit[]> {
  return backendName() === "tavily" ? tavilySearch(query, fetchFn) : duckDuckGoSearch(query, fetchFn);
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
