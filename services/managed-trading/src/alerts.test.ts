import { describe, expect, it, vi } from "vitest";
import {
  buildSlackBody,
  hasAlertWebhookConfigured,
  sendAlert,
  type AlertPayload
} from "./alerts.js";

// --- helpers -----------------------------------------------------------------

function makePayload(overrides: Partial<AlertPayload> = {}): AlertPayload {
  return {
    kind: "user_failed",
    userId: "user-1",
    runBatchId: "batch-1",
    details: { reason: "rpc_unavailable" },
    ...overrides
  };
}

function okFetch(): typeof fetch {
  return vi.fn(async () =>
    new Response("", { status: 200 })
  ) as unknown as typeof fetch;
}

function badFetch(status: number): typeof fetch {
  return vi.fn(async () =>
    new Response("nope", { status })
  ) as unknown as typeof fetch;
}

function throwingFetch(message: string): typeof fetch {
  return vi.fn(async () => {
    throw new Error(message);
  }) as unknown as typeof fetch;
}

// --- tests -------------------------------------------------------------------

describe("buildSlackBody", () => {
  it("emits Slack-compatible text + blocks for run_failed", () => {
    const body = buildSlackBody(
      makePayload({ kind: "run_failed", details: { failed: 2, total: 5 } })
    );
    expect(body.text).toContain("run failed");
    expect(body.text).toContain("batch-1");
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it("includes user id in user_failed text", () => {
    const body = buildSlackBody(
      makePayload({ kind: "user_failed", userId: "alice" })
    );
    expect(body.text).toContain("alice");
  });

  it("renders details as JSON inside a code block", () => {
    const body = buildSlackBody(
      makePayload({ details: { foo: "bar", n: 7 } })
    );
    const detailsBlock = body.blocks[1] as {
      text?: { text?: string };
    };
    expect(detailsBlock.text?.text).toContain("\"foo\": \"bar\"");
    expect(detailsBlock.text?.text).toContain("\"n\": 7");
  });
});

describe("sendAlert", () => {
  it("no-ops with false when webhook URL is unset", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("", { status: 200 })
    ) as unknown as typeof fetch;
    const result = await sendAlert(makePayload(), {
      webhookUrl: null,
      fetchImpl
    });
    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns true on first-attempt success", async () => {
    const fetchImpl = okFetch();
    const result = await sendAlert(makePayload(), {
      webhookUrl: "https://hooks.test/x",
      fetchImpl
    });
    expect(result).toBe(true);
    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("posts the Slack body with content-type json", async () => {
    const fetchImpl = okFetch();
    await sendAlert(makePayload({ kind: "run_failed", details: { x: 1 } }), {
      webhookUrl: "https://hooks.test/x",
      fetchImpl
    });
    const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    const [, init] = calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json"
    );
    const parsed = JSON.parse(init.body as string);
    expect(parsed.text).toContain("run failed");
    expect(Array.isArray(parsed.blocks)).toBe(true);
  });

  it("retries on transient HTTP failure then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return new Response("server error", { status: 500 });
      }
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const sleep = vi.fn(async () => {});
    const result = await sendAlert(makePayload(), {
      webhookUrl: "https://hooks.test/x",
      fetchImpl,
      sleep,
      initialBackoffMs: 1
    });
    expect(result).toBe(true);
    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("returns false after exhausting retries (network error path)", async () => {
    const fetchImpl = throwingFetch("ECONNREFUSED");
    const sleep = vi.fn(async () => {});
    const logger = vi.fn();
    const result = await sendAlert(makePayload(), {
      webhookUrl: "https://hooks.test/x",
      fetchImpl,
      sleep,
      logger,
      maxAttempts: 3,
      initialBackoffMs: 1
    });
    expect(result).toBe(false);
    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]![0]).toContain("ECONNREFUSED");
  });

  it("returns false after exhausting retries on 4xx (bad webhook URL)", async () => {
    const fetchImpl = badFetch(404);
    const sleep = vi.fn(async () => {});
    const logger = vi.fn();
    const result = await sendAlert(makePayload(), {
      webhookUrl: "https://hooks.test/missing",
      fetchImpl,
      sleep,
      logger,
      maxAttempts: 3,
      initialBackoffMs: 1
    });
    expect(result).toBe(false);
    expect(logger.mock.calls[0]![0]).toContain("HTTP 404");
  });
});

describe("hasAlertWebhookConfigured", () => {
  it("reflects current MANAGED_TRADING_ALERT_WEBHOOK env state", () => {
    const previous = process.env.MANAGED_TRADING_ALERT_WEBHOOK;
    try {
      delete process.env.MANAGED_TRADING_ALERT_WEBHOOK;
      expect(hasAlertWebhookConfigured()).toBe(false);
      process.env.MANAGED_TRADING_ALERT_WEBHOOK = "https://hooks.test/x";
      expect(hasAlertWebhookConfigured()).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.MANAGED_TRADING_ALERT_WEBHOOK;
      } else {
        process.env.MANAGED_TRADING_ALERT_WEBHOOK = previous;
      }
    }
  });
});
