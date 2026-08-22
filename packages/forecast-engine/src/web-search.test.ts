import { afterEach, describe, expect, it } from "vitest";
import { backendName, fetchPageText, isDuckDuckGoChallenge, parseDuckDuckGoHtml, stripTags, webSearch } from "./web-search";
import { webSearchEnabled } from "./deepseek-agent";

const DDG_FIXTURE = `
<div class="result">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.reuters.com%2Fmarkets%2Fbitcoin-2026%2F&amp;rut=abc">Bitcoin slides to <b>21-month</b> low</a>
  <a class="result__snippet" href="#">BTC fell below $60,000 amid <b>ETF outflows</b>…</a>
</div>
<div class="result">
  <a rel="nofollow" class="result__a" href="https://coindesk.com/direct-link">Direct link result</a>
  <a class="result__snippet" href="#">Second snippet</a>
</div>
<div class="result">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=javascript%3Aalert(1)">bad scheme</a>
</div>`;

describe("parseDuckDuckGoHtml", () => {
  it("decodes uddg redirects, keeps direct links, strips tags, drops non-http", () => {
    const hits = parseDuckDuckGoHtml(DDG_FIXTURE);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      title: "Bitcoin slides to 21-month low",
      url: "https://www.reuters.com/markets/bitcoin-2026/",
      snippet: "BTC fell below $60,000 amid ETF outflows …"
    });
    expect(hits[1]?.url).toBe("https://coindesk.com/direct-link");
  });
});

describe("stripTags / fetchPageText", () => {
  it("removes scripts, styles, tags and collapses whitespace", () => {
    expect(stripTags("<script>x()</script><style>a{}</style><p>Hello &amp; <b>world</b></p>\n\n  extra")).toBe(
      "Hello & world extra"
    );
  });

  it("returns a tagged error string instead of throwing", async () => {
    const failing = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    expect(await fetchPageText("https://x.example", failing)).toContain("[fetch failed: boom]");
  });
});

describe("webSearchEnabled", () => {
  const prev = process.env.FORECAST_WEB_SEARCH;
  afterEach(() => {
    if (prev === undefined) delete process.env.FORECAST_WEB_SEARCH;
    else process.env.FORECAST_WEB_SEARCH = prev;
  });

  it("recognizes 1/true/backends, rejects 0/unset", () => {
    for (const v of ["1", "true", "duckduckgo", "tavily"]) {
      process.env.FORECAST_WEB_SEARCH = v;
      expect(webSearchEnabled()).toBe(true);
    }
    process.env.FORECAST_WEB_SEARCH = "0";
    expect(webSearchEnabled()).toBe(false);
    delete process.env.FORECAST_WEB_SEARCH;
    expect(webSearchEnabled()).toBe(false);
  });
});

describe("backendName", () => {
  const saved = { pin: process.env.FORECAST_WEB_SEARCH, exa: process.env.EXA_API_KEY, tavily: process.env.TAVILY_API_KEY };
  afterEach(() => {
    for (const [k, v] of [["FORECAST_WEB_SEARCH", saved.pin], ["EXA_API_KEY", saved.exa], ["TAVILY_API_KEY", saved.tavily]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("prefers exa over tavily when both keys are present, and honours an explicit pin", () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    delete process.env.FORECAST_WEB_SEARCH;
    expect(backendName()).toBe("exa");

    process.env.FORECAST_WEB_SEARCH = "duckduckgo";
    expect(backendName()).toBe("duckduckgo");

    process.env.FORECAST_WEB_SEARCH = "tavily";
    expect(backendName()).toBe("tavily");
  });

  it("falls back down the chain as keys disappear", () => {
    delete process.env.FORECAST_WEB_SEARCH;
    delete process.env.EXA_API_KEY;
    process.env.TAVILY_API_KEY = "tavily-key";
    expect(backendName()).toBe("tavily");
    delete process.env.TAVILY_API_KEY;
    expect(backendName()).toBe("duckduckgo");
  });
});

describe("exa backend", () => {
  const saved = { pin: process.env.FORECAST_WEB_SEARCH, exa: process.env.EXA_API_KEY };
  afterEach(() => {
    if (saved.pin === undefined) delete process.env.FORECAST_WEB_SEARCH;
    else process.env.FORECAST_WEB_SEARCH = saved.pin;
    if (saved.exa === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = saved.exa;
  });

  it("sends the recommended request shape and maps highlights + publishedDate", async () => {
    process.env.FORECAST_WEB_SEARCH = "exa";
    process.env.EXA_API_KEY = "exa-key";
    let seen: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              title: "OpenAI ships GPT-6",
              url: "https://openai.com/index/gpt-6/",
              publishedDate: "2026-08-20T14:00:00.000Z",
              author: "OpenAI",
              highlights: ["GPT-6 is available   to all\nChatGPT users", "rolling out today"]
            },
            { title: "No url result", highlights: ["dropped"] }
          ]
        })
      };
    }) as unknown as typeof fetch;

    const hits = await webSearch("has GPT-6 been released", fake);

    const body = JSON.parse(String(seen!.init.body));
    expect(seen!.url).toBe("https://api.exa.ai/search");
    expect((seen!.init.headers as Record<string, string>)["x-api-key"]).toBe("exa-key");
    expect(body).toEqual({ query: "has GPT-6 been released", type: "auto", numResults: 8, contents: { highlights: true } });

    // Results without a url are dropped; highlights join into one whitespace-collapsed snippet.
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      title: "OpenAI ships GPT-6",
      url: "https://openai.com/index/gpt-6/",
      snippet: "GPT-6 is available to all ChatGPT users … rolling out today",
      publishedDate: "2026-08-20T14:00:00.000Z",
      author: "OpenAI"
    });
  });

  it("surfaces the API error body instead of returning an empty result set", async () => {
    process.env.FORECAST_WEB_SEARCH = "exa";
    process.env.EXA_API_KEY = "bad-key";
    const failing = (async () => ({ ok: false, status: 401, text: async () => "unauthorized" })) as unknown as typeof fetch;
    await expect(webSearch("q", failing)).rejects.toThrow(/exa search 401: unauthorized/);
  });

  it("fails loudly when the backend is pinned but the key is missing", async () => {
    process.env.FORECAST_WEB_SEARCH = "exa";
    delete process.env.EXA_API_KEY;
    const unused = (async () => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    await expect(webSearch("q", unused)).rejects.toThrow(/EXA_API_KEY is not set/);
  });
});

describe("duckduckgo bot-check", () => {
  const saved = process.env.FORECAST_WEB_SEARCH;
  afterEach(() => {
    if (saved === undefined) delete process.env.FORECAST_WEB_SEARCH;
    else process.env.FORECAST_WEB_SEARCH = saved;
  });

  it("tells a challenge page apart from a genuinely empty result page", () => {
    expect(isDuckDuckGoChallenge('<div class="anomaly-modal__modal">Select all squares containing a duck</div>')).toBe(true);
    expect(isDuckDuckGoChallenge('<form id="challenge-form" action="/html/">')).toBe(true);
    expect(isDuckDuckGoChallenge('<div class="no-results">No results.</div>')).toBe(false);
    expect(isDuckDuckGoChallenge(DDG_FIXTURE)).toBe(false);
  });

  it("throws instead of reporting an empty-but-successful search when blocked", async () => {
    process.env.FORECAST_WEB_SEARCH = "duckduckgo";
    const blocked = (async () => ({
      ok: true,
      text: async () => '<div class="anomaly-modal__mask"></div><form id="challenge-form"></form>'
    })) as unknown as typeof fetch;
    await expect(webSearch("q", blocked)).rejects.toThrow(/bot-check challenge page/);
  });

  it("still returns an empty array for a real no-results page", async () => {
    process.env.FORECAST_WEB_SEARCH = "duckduckgo";
    const empty = (async () => ({ ok: true, text: async () => "<div>No results.</div>" })) as unknown as typeof fetch;
    await expect(webSearch("q", empty)).resolves.toEqual([]);
  });
});
