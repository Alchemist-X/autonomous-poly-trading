import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJsonObject, resolveEngine } from "./provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses an object wrapped in markdown fences and prose", () => {
    const text = 'Here you go:\n```json\n{"a": {"b": 2}}\n```\nDone.';
    expect(extractJsonObject(text)).toEqual({ a: { b: 2 } });
  });

  it("returns null when no valid object exists", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("{broken")).toBeNull();
  });
});

describe("resolveEngine", () => {
  it("uses rules when nothing is configured", () => {
    vi.stubEnv("DELTA_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("DELTA_CLAUDE_CLI", "");
    expect(resolveEngine().engine).toBe("rules");
  });

  it("prefers deepseek when a key is present", () => {
    vi.stubEnv("DELTA_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    expect(resolveEngine().engine).toBe("deepseek");
  });

  it("honors an explicit DELTA_PROVIDER override", () => {
    vi.stubEnv("DELTA_PROVIDER", "claude");
    expect(resolveEngine().engine).toBe("claude-cli");
    vi.stubEnv("DELTA_PROVIDER", "rules");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    expect(resolveEngine().engine).toBe("rules");
  });

  it("selects claude-cli via DELTA_CLAUDE_CLI opt-in", () => {
    vi.stubEnv("DELTA_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("DELTA_CLAUDE_CLI", "1");
    expect(resolveEngine().engine).toBe("claude-cli");
  });
});
