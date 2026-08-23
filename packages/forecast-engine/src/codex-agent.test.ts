import { afterEach, describe, expect, it } from "vitest";
import { parseCodexEvents } from "./codex-agent";
import { providerHasWebSearch, providerName } from "./agent";

// Shape captured from a real `codex exec --json` run (codex-cli 0.148.0,
// model gpt-5.6-terra, tools.web_search=true) on 2026-08-23.
const EVENTS = [
  `{"type": "thread.started", "thread_id": "01a02d86-2835-7dd1-b17f-b204a9e1afaa"}`,
  `{"type": "turn.started"}`,
  `{"type": "item.completed", "item": {"id": "item_0", "type": "agent_message", "text": "I will verify today's date first."}}`,
  `{"type": "item.started", "item": {"id": "exec-1", "type": "web_search", "query": "", "action": {"type": "other"}}}`,
  `{"type": "item.completed", "item": {"id": "exec-1", "type": "web_search", "query": "latest news August 23 2026 headline", "action": {"type": "search", "query": "latest news August 23 2026 headline"}}}`,
  `{"type": "item.completed", "item": {"id": "item_2", "type": "agent_message", "text": "{\\"answer\\": 42}"}}`,
  `{"type": "turn.completed", "usage": {"input_tokens": 33943, "output_tokens": 145}}`,
  `not json at all`,
  ``
].join("\n");

describe("parseCodexEvents", () => {
  it("takes the last agent_message as final text, real queries only, counts turns", () => {
    const parsed = parseCodexEvents(EVENTS);
    expect(parsed.finalText).toBe(`{"answer": 42}`);
    // The empty item.started query is skipped; only the completed one counts.
    expect(parsed.searchQueries).toEqual(["latest news August 23 2026 headline"]);
    expect(parsed.numTurns).toBe(1);
  });

  it("returns empties on garbage input", () => {
    expect(parseCodexEvents("plain text\nno events")).toEqual({ finalText: "", searchQueries: [], numTurns: 0 });
  });
});

describe("provider dispatch with codex", () => {
  const saved = process.env.FORECAST_PROVIDER;
  afterEach(() => {
    if (saved === undefined) delete process.env.FORECAST_PROVIDER;
    else process.env.FORECAST_PROVIDER = saved;
  });

  it("recognizes codex and reports web search available", () => {
    process.env.FORECAST_PROVIDER = "codex";
    expect(providerName()).toBe("codex");
    expect(providerHasWebSearch()).toBe(true);
    process.env.FORECAST_PROVIDER = "deepseek";
    expect(providerName()).toBe("deepseek");
    delete process.env.FORECAST_PROVIDER;
    expect(providerName()).toBe("claude");
  });
});
