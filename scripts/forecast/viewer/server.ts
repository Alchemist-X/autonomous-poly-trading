// Local server that connects the web viewer to the real forecasting engine.
//
//   ANTHROPIC_BASE_URL=... ANTHROPIC_API_KEY=... \
//   pnpm exec tsx scripts/forecast/viewer/server.ts      # then open http://127.0.0.1:8123
//
// Routes:
//   GET  /                      -> the viewer in LIVE mode (template.html, RUN=null)
//   GET  /api/runs              -> [{eventId,eventText,currentProb,round,status,sources,updatedAtUtc}]
//   GET  /api/runs/:eventId     -> { state: <state.json|null>, job: {status,log} }
//   POST /api/forecast {question,maxRounds,fresh} -> { eventId } ; spawns the real CLI
//
// A POST runs `tsx scripts/forecast/cli.ts "<question>"` as a child process. The
// engine writes runtime-artifacts/forecasts/<eventId>/state.json after every
// round, so the page polls /api/runs/:eventId and shows real progress as it lands.

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeEventId, loadState, forecastsRoot } from "../store";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const cliPath = path.join(here, "..", "cli.ts");
const templatePath = path.join(here, "template.html");
const PORT = Number(process.env.PORT) || 8123;
const HOST = process.env.HOST || "127.0.0.1";

type JobStatus = "running" | "done" | "error" | "unforecastable";
interface Job {
  status: JobStatus;
  code: number | null;
  log: string[];
  startedAt: string;
  question: string;
}
const jobs = new Map<string, Job>();

function sendJson(res: ServerResponse, code: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(body);
}

function listRuns(): unknown[] {
  const root = forecastsRoot();
  if (!existsSync(root)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const id of readdirSync(root)) {
    const file = path.join(root, id, "state.json");
    if (!existsSync(file)) continue;
    try {
      const s = JSON.parse(readFileSync(file, "utf8"));
      out.push({
        eventId: s.eventId,
        eventText: s.eventText,
        question: s.framing?.normalizedQuestion ?? "",
        currentProb: s.currentProb,
        round: s.round,
        status: s.status,
        sources: Array.isArray(s.evidenceLedger) ? s.evidenceLedger.length : 0,
        updatedAtUtc: s.updatedAtUtc,
      });
    } catch {
      /* skip unreadable */
    }
  }
  out.sort((a, b) => String(b.updatedAtUtc ?? "").localeCompare(String(a.updatedAtUtc ?? "")));
  return out;
}

function startForecast(question: string, maxRounds: number | undefined, fresh: boolean): string {
  const eventId = makeEventId(question);
  const existing = jobs.get(eventId);
  if (existing && existing.status === "running") return eventId;

  const args = [cliPath, question];
  if (maxRounds && Number.isFinite(maxRounds)) args.push("--max-rounds", String(maxRounds));
  if (fresh) args.push("--fresh");

  const job: Job = { status: "running", code: null, log: [], startedAt: new Date().toISOString(), question };
  jobs.set(eventId, job);

  // Spawn the real CLI via tsx (same path as `pnpm forecast:event`), inheriting
  // ANTHROPIC_* from this server's env so the agent can run.
  const child = spawn(path.join(repoRoot, "node_modules/.bin/tsx"), args, {
    cwd: repoRoot,
    env: process.env,
  });
  const onData = (buf: Buffer) => {
    for (const line of buf.toString().split("\n")) {
      const t = line.trim();
      if (t) {
        job.log.push(t);
        if (job.log.length > 60) job.log.shift();
      }
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("error", (err) => {
    job.log.push("spawn error: " + err.message);
    job.status = "error";
  });
  child.on("close", (code) => {
    job.code = code;
    job.status = code === 0 ? "done" : code === 2 ? "unforecastable" : "error";
  });
  console.log(`[forecast] started ${eventId} (maxRounds=${maxRounds ?? "default"}${fresh ? ", fresh" : ""})`);
  return eventId;
}

function serveTemplate(res: ServerResponse): void {
  try {
    const tpl = readFileSync(templatePath, "utf8");
    const html = tpl.replace("__RUN_JSON__", "null"); // null => LIVE mode in the page
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
  } catch (err) {
    res.writeHead(500);
    res.end("template read error: " + (err instanceof Error ? err.message : String(err)));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === "GET" && (p === "/" || p === "/index.html")) return serveTemplate(res);
  if (req.method === "GET" && p === "/api/runs") return sendJson(res, 200, listRuns());

  const runMatch = p.match(/^\/api\/runs\/(.+)$/);
  if (req.method === "GET" && runMatch) {
    const eventId = decodeURIComponent(runMatch[1]);
    const state = loadState(eventId);
    const job = jobs.get(eventId);
    return sendJson(res, 200, {
      state,
      job: job ? { status: job.status, log: job.log.slice(-14), startedAt: job.startedAt } : null,
    });
  }

  if (req.method === "POST" && p === "/api/forecast") {
    const raw = await readBody(req);
    let body: { question?: string; maxRounds?: number; fresh?: boolean };
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "invalid JSON body" });
    }
    const question = (body.question ?? "").trim();
    if (!question) return sendJson(res, 400, { error: "question is required" });
    if (!process.env.ANTHROPIC_API_KEY)
      return sendJson(res, 500, { error: "server missing ANTHROPIC_API_KEY (start it with the key in env)" });
    const eventId = startForecast(question, body.maxRounds, Boolean(body.fresh));
    return sendJson(res, 200, { eventId });
  }

  // static assets from the viewer dir (e.g. /logos/raven-logo.png)
  if (req.method === "GET" && !p.startsWith("/api/")) {
    const rel = path.normalize(decodeURIComponent(p)).replace(/^([/\\]|\.\.[/\\])+/, "");
    const file = path.join(here, rel);
    if (file.startsWith(here) && existsSync(file) && statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase();
      const mime =
        ext === ".png" ? "image/png" :
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
        ext === ".svg" ? "image/svg+xml" :
        ext === ".webp" ? "image/webp" :
        ext === ".ico" ? "image/x-icon" :
        ext === ".css" ? "text/css" :
        ext === ".js" ? "text/javascript" : "application/octet-stream";
      res.writeHead(200, { "content-type": mime, "cache-control": "public, max-age=3600" });
      res.end(readFileSync(file));
      return;
    }
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Forecast viewer (LIVE) on http://${HOST}:${PORT}`);
  console.log(`  endpoint: ${process.env.ANTHROPIC_BASE_URL ?? "(default Anthropic)"}`);
  console.log(`  api key:  ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING — POST /api/forecast will fail"}`);
});
