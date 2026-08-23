import { afterEach, describe, expect, it } from "vitest";
import { backendName, fetchPageText, stripTags, webSearch } from "./web-search";
import { webSearchEnabled } from "./deepseek-agent";

function withEnv(overrides: Record<string, string | undefined>, fn: () => void | Promise<void>): void | Promise<void> {
  const saved = Object.fromEntries(Object.keys(overrides).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  try {
    const out = fn();
    if (out instanceof Promise) return out.finally(restore);
    restore();
  } catch (error) {
    restore();
    throw error;
  }
}

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
  it("recognizes 1/true/backends, rejects 0/unset", () =>
    withEnv({ FORECAST_WEB_SEARCH: undefined }, () => {
      // "duckduckgo" stays an *enabling* value on purpose: the backend is gone,
      // and enabling means backendName() throws loudly at tool time instead of
      // the run silently downgrading to no-research mode.
      for (const v of ["1", "true", "exa", "tavily", "duckduckgo"]) {
        process.env.FORECAST_WEB_SEARCH = v;
        expect(webSearchEnabled()).toBe(true);
      }
      process.env.FORECAST_WEB_SEARCH = "0";
      expect(webSearchEnabled()).toBe(false);
      delete process.env.FORECAST_WEB_SEARCH;
      expect(webSearchEnabled()).toBe(false);
    }));
});

describe("backendName", () => {
  it("prefers exa over tavily when both keys are present, and honours an explicit pin", () =>
    withEnv({ FORECAST_WEB_SEARCH: undefined, EXA_API_KEY: "exa-key", TAVILY_API_KEY: "tavily-key" }, () => {
      expect(backendName()).toBe("exa");
      process.env.FORECAST_WEB_SEARCH = "tavily";
      expect(backendName()).toBe("tavily");
      process.env.FORECAST_WEB_SEARCH = "exa";
      expect(backendName()).toBe("exa");
    }));

  it("falls back to tavily when only its key exists", () =>
    withEnv({ FORECAST_WEB_SEARCH: undefined, EXA_API_KEY: undefined, TAVILY_API_KEY: "tavily-key" }, () => {
      expect(backendName()).toBe("tavily");
    }));

  it("throws loudly with no key at all — there is no keyless fallback", () =>
    withEnv({ FORECAST_WEB_SEARCH: undefined, EXA_API_KEY: undefined, TAVILY_API_KEY: undefined }, () => {
      expect(() => backendName()).toThrow(/no backend key found: set EXA_API_KEY/);
    }));

  it("rejects the removed duckduckgo pin with a migration message", () =>
    withEnv({ FORECAST_WEB_SEARCH: "duckduckgo", EXA_API_KEY: "exa-key" }, () => {
      expect(() => backendName()).toThrow(/duckduckgo backend was removed/);
    }));
});

describe("exa backend", () => {
  const restoreEnv: Record<string, string | undefined> = {
    FORECAST_WEB_SEARCH: process.env.FORECAST_WEB_SEARCH,
    EXA_API_KEY: process.env.EXA_API_KEY
  };
  afterEach(() => {
    for (const [k, v] of Object.entries(restoreEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
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
});
