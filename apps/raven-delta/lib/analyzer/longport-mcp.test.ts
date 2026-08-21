import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, statSync, existsSync } from "node:fs";
import {
  LONGPORT_ALLOWED_TOOL_IDS,
  LONGPORT_BLOCKED_TOOLS,
  LONGPORT_BLOCKED_TOOL_IDS,
  LONGPORT_READ_TOOLS,
  LONGPORT_SERVER_NAME,
  assertReadOnlyAllowlist,
  buildLongportMcpConfig,
  isSensitiveToolName,
  longportMcpUrl,
  prepareLongportCli,
  resolveLongport,
} from "./longport-mcp";

afterEach(() => vi.unstubAllEnvs());

// The load-bearing safety property: no read tool the analyst can reach is a
// trade / account / write tool. A regression here could let an autonomous LLM
// place real orders against a real brokerage account.
describe("LongPort allowlist safety", () => {
  it("never exposes any order/trade tool", () => {
    for (const forbidden of ["submit_order", "cancel_order", "replace_order", "estimate_max_purchase_quantity"]) {
      expect(LONGPORT_READ_TOOLS).not.toContain(forbidden);
      expect(LONGPORT_ALLOWED_TOOL_IDS).not.toContain(`mcp__${LONGPORT_SERVER_NAME}__${forbidden}`);
    }
  });

  it("never exposes account / portfolio reads or funds movement", () => {
    for (const forbidden of ["account_balance", "stock_positions", "fund_positions", "cash_flow", "bank_cards", "deposits", "withdrawals"]) {
      expect(LONGPORT_READ_TOOLS).not.toContain(forbidden);
    }
  });

  it("never exposes the watchlist WRITE tools that hide in the quote category", () => {
    for (const forbidden of ["create_watchlist_group", "delete_watchlist_group", "update_watchlist_group", "watchlist"]) {
      expect(LONGPORT_READ_TOOLS).not.toContain(forbidden);
    }
  });

  it("keeps the allowlist and blocklist strictly disjoint", () => {
    const blocked = new Set(LONGPORT_BLOCKED_TOOLS);
    for (const allowed of LONGPORT_READ_TOOLS) {
      expect(blocked.has(allowed)).toBe(false);
    }
  });

  it("qualifies every tool with the mcp__longport__ prefix", () => {
    for (const id of LONGPORT_ALLOWED_TOOL_IDS) {
      expect(id.startsWith(`mcp__${LONGPORT_SERVER_NAME}__`)).toBe(true);
    }
    for (const id of LONGPORT_BLOCKED_TOOL_IDS) {
      expect(id.startsWith(`mcp__${LONGPORT_SERVER_NAME}__`)).toBe(true);
    }
  });

  it("includes the core market-data reads a news-impact desk needs", () => {
    for (const wanted of ["quote", "candlesticks", "history_candlesticks_by_date", "market_status", "valuation"]) {
      expect(LONGPORT_READ_TOOLS).toContain(wanted);
    }
  });

  it("passes the fail-closed sensitive-pattern assertion for the real allowlist", () => {
    expect(() => assertReadOnlyAllowlist()).not.toThrow();
  });

  it("the sensitive-pattern assertion does NOT false-positive on genuine market-data reads", () => {
    // short_positions = market short interest (read); capital_flow, fund_holder,
    // trade_stats, short_trades are all legitimate reads that superficially
    // resemble account/trade tools.
    for (const safe of ["short_positions", "capital_flow", "fund_holder", "trade_stats", "short_trades", "operating"]) {
      expect(LONGPORT_READ_TOOLS).toContain(safe);
      expect(isSensitiveToolName(safe)).toBe(false);
    }
    expect(() => assertReadOnlyAllowlist()).not.toThrow();
  });

  it("the sensitive-pattern catches every write/trade/account tool (fail-closed backstop)", () => {
    for (const dangerous of [
      "submit_order",
      "cancel_order",
      "replace_order",
      "account_balance",
      "stock_positions",
      "fund_positions",
      "today_orders",
      "history_executions",
      "cash_flow",
      "create_watchlist_group",
      "delete_watchlist_group",
      "deposits",
      "withdrawals",
      "dca_create",
      "alert_add",
      "sharelist_create",
      "statement_export",
      "authenticate",
      "quant_run",
      "estimate_max_purchase_quantity",
    ]) {
      expect(isSensitiveToolName(dangerous)).toBe(true);
    }
  });
});

describe("resolveLongport", () => {
  it("is OFF by default", () => {
    vi.stubEnv("DELTA_LONGPORT_ENABLED", "");
    expect(resolveLongport().enabled).toBe(false);
  });

  it("is ON only with the explicit opt-in", () => {
    vi.stubEnv("DELTA_LONGPORT_ENABLED", "1");
    expect(resolveLongport().enabled).toBe(true);
    vi.stubEnv("DELTA_LONGPORT_ENABLED", "true");
    expect(resolveLongport().enabled).toBe(false); // only "1" enables
  });
});

describe("buildLongportMcpConfig", () => {
  it("points at the hosted endpoint by default with no auth header", () => {
    vi.stubEnv("DELTA_LONGPORT_TOKEN", "");
    vi.stubEnv("DELTA_LONGPORT_MCP_URL", "");
    const { config, hasToken } = buildLongportMcpConfig();
    const server = config.mcpServers[LONGPORT_SERVER_NAME]!;
    expect(server.type).toBe("http");
    expect(server.url).toBe("https://mcp.longportapp.com");
    expect(server.headers).toBeUndefined();
    expect(hasToken).toBe(false);
  });

  it("injects a bearer header when a token is provided", () => {
    vi.stubEnv("DELTA_LONGPORT_TOKEN", "tok-123");
    const { config, hasToken } = buildLongportMcpConfig();
    expect(config.mcpServers[LONGPORT_SERVER_NAME]!.headers).toEqual({ Authorization: "Bearer tok-123" });
    expect(hasToken).toBe(true);
  });

  it("honors a custom endpoint and strips trailing slashes", () => {
    vi.stubEnv("DELTA_LONGPORT_MCP_URL", "http://127.0.0.1:8000/");
    expect(longportMcpUrl()).toBe("http://127.0.0.1:8000");
  });
});

describe("prepareLongportCli", () => {
  it("writes a private (0600) mcp-config temp file and cleans it up", () => {
    vi.stubEnv("DELTA_LONGPORT_TOKEN", "secret-token");
    const cli = prepareLongportCli();
    try {
      expect(existsSync(cli.configPath)).toBe(true);
      const mode = statSync(cli.configPath).mode & 0o777;
      expect(mode).toBe(0o600);
      const written = JSON.parse(readFileSync(cli.configPath, "utf8")) as {
        mcpServers: Record<string, { headers?: Record<string, string> }>;
      };
      expect(written.mcpServers[LONGPORT_SERVER_NAME]!.headers!.Authorization).toBe("Bearer secret-token");
      expect(cli.allowedTools).toEqual(LONGPORT_ALLOWED_TOOL_IDS);
      expect(cli.disallowedTools).toEqual(LONGPORT_BLOCKED_TOOL_IDS);
    } finally {
      cli.cleanup();
    }
    expect(existsSync(cli.configPath)).toBe(false);
  });
});
