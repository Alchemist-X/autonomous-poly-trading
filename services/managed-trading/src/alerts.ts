// Alert webhook helper for the managed-trading service.
//
// The managed-pulse bridge calls `sendAlert` after each fan-out run when
// it detects a failure or operationally significant skip (empty Safe,
// rate-limited adapter, revoked session). Payloads are POSTed to the
// URL in `MANAGED_TRADING_ALERT_WEBHOOK` as Slack-compatible JSON
// (`{ text, blocks? }`); any incoming-webhook URL works (Slack, Discord
// via Slack-format adapters, generic relay).
//
// Per CLAUDE.md §6: alerts are *informational*. Failure to deliver an
// alert MUST NOT abort the underlying dispatch. We retry up to 3× with
// exponential backoff then log + return; the caller never throws.
//
// If the env var is unset we log a single warning at process start (the
// caller's responsibility) and silently no-op subsequent calls.

export type AlertKind =
  | "run_failed"
  | "user_failed"
  | "session_revoked"
  | "balance_zero"
  | "rate_limited";

export interface AlertPayload {
  readonly kind: AlertKind;
  readonly userId?: string;
  readonly runBatchId: string;
  readonly details: Record<string, unknown>;
}

export interface SendAlertOptions {
  // Override the env-driven URL (used by tests).
  readonly webhookUrl?: string | null;
  // Fetch impl; tests inject a stub. Defaults to the global `fetch`.
  readonly fetchImpl?: typeof fetch;
  // Override retry shape (mostly for tests; default 3 attempts, base 200ms).
  readonly maxAttempts?: number;
  readonly initialBackoffMs?: number;
  // Optional logger for transport errors. Defaults to `console.warn`.
  readonly logger?: (message: string) => void;
  // Optional clock for deterministic backoff (tests use a fake setTimeout).
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 200;

// Build the Slack `text` line for an alert. Kept terse so the channel
// doesn't drown in noise; the `blocks` payload carries structured
// context for whoever clicks through.
function buildHeadline(payload: AlertPayload): string {
  switch (payload.kind) {
    case "run_failed":
      return `[managed-pulse] run failed — runBatchId=${payload.runBatchId}`;
    case "user_failed":
      return `[managed-pulse] user failed — user=${payload.userId ?? "unknown"} runBatchId=${payload.runBatchId}`;
    case "session_revoked":
      return `[managed-pulse] session signer revoked — user=${payload.userId ?? "unknown"} runBatchId=${payload.runBatchId}`;
    case "balance_zero":
      return `[managed-pulse] empty Safe — user=${payload.userId ?? "unknown"} runBatchId=${payload.runBatchId}`;
    case "rate_limited":
      return `[managed-pulse] rate-limited — user=${payload.userId ?? "unknown"} runBatchId=${payload.runBatchId}`;
    default: {
      const exhaustive: never = payload.kind;
      return `[managed-pulse] unknown alert ${exhaustive as string} runBatchId=${payload.runBatchId}`;
    }
  }
}

// Slack-style payload shape. `blocks` is optional but every consumer of
// Slack incoming webhooks accepts the basic context block we ship; we
// stick to the lowest-common-denominator markdown layout so Discord +
// other Slack-format relays render it sensibly.
export interface SlackWebhookBody {
  readonly text: string;
  readonly blocks: ReadonlyArray<unknown>;
}

export function buildSlackBody(payload: AlertPayload): SlackWebhookBody {
  const headline = buildHeadline(payload);
  const detailsBlock = JSON.stringify(payload.details, null, 2);
  return {
    text: headline,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${headline}*`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "```\n" + detailsBlock + "\n```"
        }
      }
    ]
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `sendAlert` — POST one alert to MANAGED_TRADING_ALERT_WEBHOOK.
// Resolves to `true` if delivered, `false` on a final failure or no-op.
// Never throws; callers can fire-and-forget without try/catch.
export async function sendAlert(
  payload: AlertPayload,
  options: SendAlertOptions = {}
): Promise<boolean> {
  const url = options.webhookUrl ?? process.env.MANAGED_TRADING_ALERT_WEBHOOK?.trim() ?? "";
  if (!url) {
    return false;
  }

  const body = buildSlackBody(payload);
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialBackoff = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const log = options.logger ?? ((message: string) => console.warn(message));
  const sleep = options.sleep ?? defaultSleep;

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        return true;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maxAttempts) {
      // Exponential backoff: 200ms, 400ms, 800ms by default.
      const backoff = initialBackoff * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }

  log(
    `[managed-trading] sendAlert failed after ${maxAttempts} attempts (kind=${payload.kind} runBatchId=${payload.runBatchId}): ${lastError ?? "unknown"}`
  );
  return false;
}

// Single-shot warning for the bridge to emit at start when the env var
// is missing. `hasAlertWebhookConfigured` returns false when unset so
// callers can decide whether to log.
export function hasAlertWebhookConfigured(): boolean {
  return Boolean(process.env.MANAGED_TRADING_ALERT_WEBHOOK?.trim());
}
