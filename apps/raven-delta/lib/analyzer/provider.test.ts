import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaudeArgs, extractJsonObject, resolveEngine } from "./provider";
import { LONGPORT_ALLOWED_TOOL_IDS } from "./longport-mcp";

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

describe("buildClaudeArgs LongPort wiring", () => {
  it("adds no MCP config or longport tools when disabled", () => {
    vi.stubEnv("DELTA_LONGPORT_ENABLED", "");
    const { args, cleanup } = buildClaudeArgs(true);
    try {
      expect(args).not.toContain("--mcp-config");
      expect(args).not.toContain("--disallowedTools");
      const allowed = args[args.indexOf("--allowedTools") + 1];
      expect(allowed).toBe("WebSearch");
    } finally {
      cleanup();
    }
  });

  it("adds no MCP config for a non-market-data call even when enabled (gate/repair path)", () => {
    vi.stubEnv("DELTA_LONGPORT_ENABLED", "1");
    vi.stubEnv("DELTA_LONGPORT_TOKEN", "tok");
    const { args, cleanup } = buildClaudeArgs(false);
    try {
      expect(args).not.toContain("--mcp-config");
      const allowed = args[args.indexOf("--allowedTools") + 1];
      expect(allowed).toBe("WebSearch");
    } finally {
      cleanup();
    }
  });

  it("attaches the MCP config, read-only allowlist, and trade denylist for a market-data call when enabled", () => {
    vi.stubEnv("DELTA_LONGPORT_ENABLED", "1");
    vi.stubEnv("DELTA_LONGPORT_TOKEN", "tok");
    const { args, cleanup } = buildClaudeArgs(true);
    try {
      expect(args).toContain("--mcp-config");
      expect(args).toContain("--strict-mcp-config");
      const allowed = args[args.indexOf("--allowedTools") + 1];
      expect(allowed).toContain("WebSearch");
      expect(allowed).toContain(LONGPORT_ALLOWED_TOOL_IDS[0]);
      // Trade tools must be BOTH absent from the allowlist and present in the denylist.
      expect(allowed).not.toContain("submit_order");
      const disallowed = args[args.indexOf("--disallowedTools") + 1];
      expect(disallowed).toContain("submit_order");
      expect(disallowed).toContain("create_watchlist_group");
    } finally {
      cleanup();
    }
  });
});
