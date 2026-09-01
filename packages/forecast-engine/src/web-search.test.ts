import { afterEach, describe, expect, it } from "vitest";
import { fetchPageText, parseDuckDuckGoHtml, stripTags, webSearch } from "./web-search";
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

describe("exa backend", () => {
  const prevPin = process.env.FORECAST_WEB_SEARCH;
  const prevKey = process.env.EXA_API_KEY;
  afterEach(() => {
    if (prevPin === undefined) delete process.env.FORECAST_WEB_SEARCH;
    else process.env.FORECAST_WEB_SEARCH = prevPin;
    if (prevKey === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = prevKey;
  });

  it("maps exa results to SearchHit and sends the api key header", async () => {
    process.env.FORECAST_WEB_SEARCH = "exa";
    process.env.EXA_API_KEY = "test-key";
    let captured: { url: string; init?: RequestInit } | null = null;
    const fake = (async (url: string, init?: RequestInit) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({
          results: [
            { title: "Hunyuan Hy4 preview", url: "https://example.com/hy4", text: "Tencent released…" },
            { title: "", url: "", text: "dropped: no url" }
          ]
        })
      };
    }) as unknown as typeof fetch;
    const hits = await webSearch("tencent hy4", fake);
    expect(hits).toEqual([
      { title: "Hunyuan Hy4 preview", url: "https://example.com/hy4", snippet: "Tencent released…" }
    ]);
    expect(captured!.url).toBe("https://api.exa.ai/search");
    const headers = captured!.init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(JSON.parse(String(captured!.init?.body)).numResults).toBeGreaterThan(0);
  });

  it("prefers exa over tavily when both keys are set and no pin is given", async () => {
    delete process.env.FORECAST_WEB_SEARCH;
    process.env.EXA_API_KEY = "test-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    let calledUrl = "";
    const fake = (async (url: string) => {
      calledUrl = url;
      return { ok: true, json: async () => ({ results: [] }) };
    }) as unknown as typeof fetch;
    await webSearch("q", fake);
    expect(calledUrl).toBe("https://api.exa.ai/search");
    delete process.env.TAVILY_API_KEY;
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
