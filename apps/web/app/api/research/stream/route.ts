// SSE endpoint for the Deep Research console.
//
// POST { eventText, marketPrice? } → text/event-stream of ResearchEvent.
//
// Flow: validate input → consume quota (no-op when auth is unconfigured) →
// pick driver from env → stream its emits. If a live driver isn't configured it
// throws DriverNotConfiguredError and we fall back to mock with a notice, so the
// page is always usable on a fresh public host.

import { normalizeTier, type NornTier } from "@autopoly/norns";
import { encodeResearchEvent, type ResearchEvent } from "../../../../lib/research/events";
import { getDriver, resolveRequestedDriverId } from "../../../../lib/research/drivers";
import { DriverNotConfiguredError } from "../../../../lib/research/drivers/types";
import { normalizeConsoleLocale, pick, type ConsoleLocale } from "../../../../lib/research/locale";
import {
  completePredictionUsageEvent,
  consumePredictionRunQuota
} from "../../../../lib/prediction-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENT_TEXT = 600;

function readEventText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_EVENT_TEXT).trim() : "";
}

function readMarketPrice(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request): Promise<Response> {
  let payload: { eventText: string; marketPrice: number | null; tier: NornTier; locale: ConsoleLocale };
  try {
    const body = (await request.json()) as Record<string, unknown>;
    payload = {
      eventText: readEventText(body?.eventText),
      marketPrice: readMarketPrice(body?.marketPrice),
      // Per-request tier (from the UI) wins; else the server default; else verdandi.
      tier: normalizeTier(body?.tier ?? process.env.RESEARCH_DEFAULT_TIER),
      // Output locale (from the UI); defaults to English.
      locale: normalizeConsoleLocale(body?.locale)
    };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.eventText) {
    return Response.json({ error: "eventText is required." }, { status: 422 });
  }

  // Quota / access. In disabled mode (no auth configured) this allows without
  // touching the DB, so a fresh public host just works.
  const quota = await consumePredictionRunQuota(payload.eventText);
  if (!quota.allowed) {
    return Response.json(
      { error: quota.error, access: quota.access, redirectTo: quota.access.signInUrl ?? quota.access.inviteUrl },
      { status: quota.status }
    );
  }

  const requestedId = resolveRequestedDriverId();
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: ResearchEvent) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(encodeResearchEvent(event)));
        } catch {
          closed = true;
        }
      };

      let failed = false;
      try {
        let driver = getDriver(requestedId);
        if (requestedId !== "mock") {
          // Probe the live driver; on missing config, swap to mock with a notice.
          try {
            await driver.run(payload, emit, abortController.signal);
          } catch (error) {
            if (error instanceof DriverNotConfiguredError) {
              const missing = error.missing.join(", ") || error.message;
              emit({
                type: "run.notice",
                level: "warn",
                message: pick(
                  payload.locale,
                  `Requested the ${requestedId} chain but it isn't fully configured (${missing}); using mock this run.`,
                  `已请求 ${requestedId} 链路但未完成配置（${missing}），本次使用 mock。`
                )
              });
              driver = getDriver("mock");
              await driver.run(payload, emit, abortController.signal);
            } else {
              throw error;
            }
          }
        } else {
          await driver.run(payload, emit, abortController.signal);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          failed = true;
          emit({
            type: "run.error",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      } finally {
        await completePredictionUsageEvent({
          usageEventId: quota.usageEventId,
          status: failed ? "failed" : "complete",
          backendSource: requestedId,
          errorMessage: failed ? "Research stream failed." : null
        });
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abortController.abort();
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-research-driver": requestedId,
      "x-research-tier": payload.tier,
      "x-research-locale": payload.locale,
      "x-accel-buffering": "no"
    }
  });
}
