// The HTTP surface (raw node:http — no framework, matching the minimal
// scripts/forecast/viewer/server.ts precedent):
//
//   GET  /healthz                      liveness (no auth)
//   POST /v1/forecasts                 start/resume a forecast ({question, maxRounds?, fresh?, provider?, wait?})
//   GET  /v1/forecasts                 list forecasts
//   GET  /v1/forecasts/:id             answer as JSON (probability + analysis + evidence)
//   GET  /v1/forecasts/:id/text        answer as plain text
//   GET  /v1/forecasts/:id/pdf         answer as a PDF dossier
//   POST /mcp                          MCP streamable-HTTP endpoint (stateless)
//   GET  /paper/snapshot               paper-agent book snapshot (token OR invite code)
//
// Every /v1 + /mcp route is token-gated (Authorization: Bearer, x-api-key, or ?token=).

import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { buildAnswer, verdictFor, pct } from "./answer";
import { isAuthorized } from "./auth";
import type { ServiceConfig } from "./config";
import { authorizeInviteUse, describeInviteState, inviteState } from "./invites";
import { log } from "./log";
import { handleMcpRequest } from "./mcp";
import { getPaperSnapshot } from "./paper-snapshot";
import { ensurePdf } from "./pdf";
import { QuotaExceededError } from "./quota";
import { renderHtml } from "./render-html";
import { renderText } from "./render-text";
import { isSafeEventId, listStates, loadState, makeEventId, stateMtimeMs } from "./repo";
import { getJob, RunLimitError, startForecast } from "./run-manager";

const MAX_BODY_BYTES = 64 * 1024;

const StartBody = z.object({
  question: z.string().trim().min(8).max(400),
  maxRounds: z.number().int().min(1).max(6).optional(),
  fresh: z.boolean().optional(),
  provider: z.enum(["claude", "deepseek"]).optional(),
  wait: z.boolean().optional(),
  invite: z.string().optional()
});

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body too large");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Block until the run leaves "running" (or the deadline passes) by watching
// the job map + on-disk state; used by POST ?wait=true so curl users get the
// finished answer in one call.
async function waitForCompletion(eventId: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = getJob(eventId);
    const state = loadState(eventId);
    const running = job?.status === "running" || (!job && state?.status === "open");
    if (!running && (state || job)) return;
    await sleep(2000);
  }
}

function baseUrlFor(req: IncomingMessage, config: ServiceConfig): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const host = req.headers.host ?? `127.0.0.1:${config.port}`;
  return `http://${host}`;
}

function applyCors(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, x-api-key, content-type, mcp-session-id, mcp-protocol-version");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
}

async function handleStart(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServiceConfig,
  body: unknown
): Promise<void> {
  const parsed = StartBody.safeParse(body);
  if (!parsed.success) {
    sendJson(res, 400, {
      error: "invalid request",
      detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      expected: { question: "string (8-400 chars)", maxRounds: "1-6 optional", fresh: "boolean optional", wait: "boolean optional" }
    });
    return;
  }
  const { question, maxRounds, fresh, provider, wait, invite } = parsed.data;
  const headerInvite = req.headers["x-invite-code"];
  // Prefer a non-empty body field, else the header — an empty body value must
  // not mask a valid header.
  const presentedInvite = invite?.trim() || (typeof headerInvite === "string" ? headerInvite.trim() : "");
  let job;
  try {
    job = startForecast(question, {
      maxRounds,
      fresh,
      provider,
      maxConcurrent: config.maxConcurrentRuns,
      quota: {
        service: "forecast-api",
        limit: config.dailyQuota,
        authorizeBypass: presentedInvite
          ? () => authorizeInviteUse(presentedInvite, "forecast-api", makeEventId(question))
          : undefined
      }
    });
  } catch (error) {
    if (error instanceof RunLimitError) {
      sendJson(res, 429, { error: error.message });
      return;
    }
    if (error instanceof QuotaExceededError) {
      sendJson(res, 429, {
        error: presentedInvite ? describeInviteState(inviteState(presentedInvite)) : error.message,
        hint: 'resend with the invite code: header "x-invite-code: <code>" or "invite" in the JSON body'
      });
      return;
    }
    throw error;
  }
  if (wait) await waitForCompletion(job.eventId, config.waitTimeoutMs);
  const state = loadState(job.eventId);
  const answer = buildAnswer(
    job.eventId,
    state,
    getJob(job.eventId) ?? job,
    baseUrlFor(req, config),
    stateMtimeMs(job.eventId)
  );
  sendJson(res, answer.status === "running" ? 202 : 200, { forecast: answer });
}

function handleList(req: IncomingMessage, res: ServerResponse, config: ServiceConfig): void {
  const base = baseUrlFor(req, config);
  const all = listStates();
  const runs = all.slice(0, 100).map((s) => ({
    id: s.eventId,
    question: s.framing?.normalizedQuestion ?? s.eventText,
    status: s.status === "open" ? "running" : "done",
    probability: s.currentProb,
    probabilityPct: pct(s.currentProb),
    verdict: verdictFor(s.currentProb),
    rounds: s.round,
    updatedAtUtc: s.updatedAtUtc,
    links: { json: `${base}/v1/forecasts/${s.eventId}` }
  }));
  sendJson(res, 200, { runs, total: all.length });
}

async function handleGet(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServiceConfig,
  id: string,
  format: "json" | "text" | "pdf"
): Promise<void> {
  if (!isSafeEventId(id)) {
    sendJson(res, 400, { error: "invalid forecast id" });
    return;
  }
  const state = loadState(id);
  const job = getJob(id);
  if (!state && !job) {
    sendJson(res, 404, { error: `no forecast found for id ${id}` });
    return;
  }
  const answer = buildAnswer(id, state, job, baseUrlFor(req, config), stateMtimeMs(id));
  if (format === "json") {
    sendJson(res, 200, { forecast: answer });
    return;
  }
  if (format === "text") {
    sendText(res, 200, renderText(answer));
    return;
  }
  try {
    const pdfPath = await ensurePdf(id, renderHtml(answer));
    const { readFileSync } = await import("node:fs");
    const pdf = readFileSync(pdfPath);
    res.writeHead(200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="forecast-${id}.pdf"`,
      "content-length": pdf.length
    });
    res.end(pdf);
  } catch (error) {
    log.error(`pdf render failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
    sendJson(res, 500, { error: "pdf rendering failed — the text and json formats are still available" });
  }
}

// Never log credentials: ?token= is a supported auth path and error logs go
// to docker logs.
function redactUrl(url: string | undefined): string {
  return (url ?? "").replace(/([?&]token=)[^&]*/gi, "$1***");
}

export function createRequestHandler(config: ServiceConfig): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void route(req, res, config).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`unhandled: ${req.method} ${redactUrl(req.url)} — ${message}`);
      if (!res.headersSent) {
        sendJson(res, message.includes("too large") ? 413 : message.includes("JSON") ? 400 : 500, { error: message });
      } else {
        res.end();
      }
    });
  };
}

async function route(req: IncomingMessage, res: ServerResponse, config: ServiceConfig): Promise<void> {
  applyCors(res);
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "forecast-api" });
    return;
  }
  if (url.pathname === "/" && method === "GET") {
    sendJson(res, 200, {
      service: "Raven Forecasting Engine API",
      usage: {
        start: "POST /v1/forecasts {question, maxRounds?, wait?} (Authorization: Bearer <token>)",
        answer: "GET /v1/forecasts/:id · /text · /pdf",
        mcp: "POST /mcp (streamable HTTP, same token)"
      }
    });
    return;
  }

  // Paper-book snapshot for the /live-predict-raven review page. Simulation
  // data only (no keys, no live-trading state); the page's invite code is
  // accepted as a lighter credential so the web app needs no extra secret.
  if (url.pathname === "/paper/snapshot" && method === "GET") {
    if (!isAuthorized(req, url, config.token) && !isAuthorized(req, url, config.inviteCode)) {
      sendJson(res, 401, { error: "unauthorized — provide the access token or invite code (Authorization: Bearer, x-api-key, or ?token=)" });
      return;
    }
    sendJson(res, 200, getPaperSnapshot());
    return;
  }

  if (!isAuthorized(req, url, config.token)) {
    sendJson(res, 401, { error: "unauthorized — provide the access token (Authorization: Bearer, x-api-key, or ?token=)" });
    return;
  }

  if (url.pathname === "/mcp") {
    if (method === "POST") {
      const body = await readBody(req);
      await handleMcpRequest(req, res, body, config);
      return;
    }
    // Stateless mode: no SSE stream to resume, no session to delete.
    sendJson(res, 405, { error: "method not allowed — this MCP endpoint is stateless; use POST" });
    return;
  }

  if (url.pathname === "/v1/forecasts" && method === "POST") {
    await handleStart(req, res, config, await readBody(req));
    return;
  }
  if (url.pathname === "/v1/forecasts" && method === "GET") {
    handleList(req, res, config);
    return;
  }
  const match = url.pathname.match(/^\/v1\/forecasts\/([^/]+)(?:\/(text|pdf))?$/);
  if (match && match[1] && method === "GET") {
    const format = match[2] === "text" ? "text" : match[2] === "pdf" ? "pdf" : "json";
    await handleGet(req, res, config, match[1], format);
    return;
  }

  sendJson(res, 404, { error: "not found" });
}
