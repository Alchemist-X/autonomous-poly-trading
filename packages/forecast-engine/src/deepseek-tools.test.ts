// Tool-loop orchestration test: a scripted fetchFn plays the OpenAI endpoint,
// the Exa backend and a cited page, verifying that the loop executes
// tools, records the search trace, and returns parsed JSON with trace-based
// verification (not the liveness fallback).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDeepSeekRaw } from "./deepseek-agent";

const ROUND_JSON = {
  round_summary: "found one source",
  new_evidence: [
    {
      claim: "BTC fell",
      source_url: "https://www.reuters.com/markets/bitcoin-2026/",
      source_title: "Reuters",
      stance: "supports_no",
      strength: "moderate",
      llr: -0.4,
      rationale: "r",
      cluster_id: "c1",
      source_type: "press",
      credibility: "high"
    }
  ],
  reflection: [],
  agent_holistic_probability: 0.1,
  confidence: "medium",
  found_new_information: true,
  notes: ""
};

const EXA_RESPONSE = {
  results: [
    {
      title: "Reuters",
      url: "https://www.reuters.com/markets/bitcoin-2026/",
      publishedDate: "2026-01-05T00:00:00.000Z",
      highlights: ["BTC fell below $60,000"]
    }
  ]
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("runDeepSeekRaw with FORECAST_WEB_SEARCH", () => {
  const savedExaKey = process.env.EXA_API_KEY;
  beforeEach(() => {
    process.env.FORECAST_WEB_SEARCH = "exa";
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.EXA_API_KEY = "test-exa-key";
    delete process.env.TAVILY_API_KEY;
  });
  afterEach(() => {
    delete process.env.FORECAST_WEB_SEARCH;
    delete process.env.DEEPSEEK_API_KEY;
    if (savedExaKey === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = savedExaKey;
  });

  it("executes tools, records the trace, returns parsed JSON", async () => {
    let llmCalls = 0;
    const seenBodies: string[] = [];
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/chat/completions")) {
        llmCalls += 1;
        seenBodies.push(String(init?.body ?? ""));
        if (llmCalls === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    { id: "t1", type: "function", function: { name: "web_search", arguments: '{"query":"bitcoin price 2026"}' } }
                  ]
                }
              }
            ],
            usage: { prompt_tokens: 100, completion_tokens: 20 }
          });
        }
        return jsonResponse({
          choices: [{ message: { role: "assistant", content: JSON.stringify(ROUND_JSON) } }],
          usage: { prompt_tokens: 200, completion_tokens: 80 }
        });
      }
      if (url.includes("api.exa.ai")) {
        return jsonResponse(EXA_RESPONSE);
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await runDeepSeekRaw("Research this. Reply with a json object.", {}, { fetchFn });

    expect(result.jsonError).toBeNull();
    expect((result.jsonObject as typeof ROUND_JSON).new_evidence[0]?.claim).toBe("BTC fell");
    expect(result.searchQueries).toEqual(["bitcoin price 2026"]);
    // trace-based verification: the cited Reuters URL came from the search hits
    expect(result.searchResultUrls.has("https://www.reuters.com/markets/bitcoin-2026/")).toBe(true);
    expect(llmCalls).toBe(2);
    // tool turn must NOT force json_object (it suppresses tool calls)
    expect(seenBodies[0]).toContain('"tools"');
    expect(seenBodies[0]).not.toContain("json_object");
  });

  it("repairs a non-JSON final answer with one json_object turn", async () => {
    let llmCalls = 0;
    const fetchFn = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/chat/completions")) {
        llmCalls += 1;
        if (llmCalls === 1) {
          return jsonResponse({ choices: [{ message: { role: "assistant", content: "Here is my analysis, no json." } }] });
        }
        return jsonResponse({ choices: [{ message: { role: "assistant", content: JSON.stringify(ROUND_JSON) } }] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await runDeepSeekRaw("Reply with a json object.", {}, { fetchFn });
    expect(result.jsonError).toBeNull();
    expect(llmCalls).toBe(2);
  });
});
