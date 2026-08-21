// Read-only status HTTP server (:8792) — the console's data source, plus the
// token-gated /ingest seam (manual news injection + the paste-full-text
// console feature). Raw node:http, forecast-api style, zero framework.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { readdirSync } from "node:fs";
import type { NewsItem, Portfolio, StatusSnapshot, UniverseEntry } from "@autopoly/delta-pm-contracts";
import { config } from "./config.js";
import { loadFeedState } from "./feed.js";
import { archivedDayCount, marketState } from "./market.js";
import { equityOf } from "./policy.js";
import { activeRuns, recentRuns } from "./progress.js";
import { currentMarks, loadPortfolio, processNews } from "./run-cycle.js";
import { paths, readJson } from "./store.js";

const startedAtUtc = new Date().toISOString();

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 512 * 1024) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

interface SignalDigestFile {
  id?: string;
  newsId?: string;
  title?: string;
  materiality?: { tickers?: string[]; score?: number; tradeable?: boolean };
  pricedIn?: { status?: string } | null;
  createdAtUtc?: string;
}

function recentSignalDigests(limit = 12): StatusSnapshot["recentSignals"] {
  let files: string[] = [];
  try {
    files = readdirSync(paths.signalsDir())
      .filter((f) => f.endsWith(".json"))
      .sort()
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
  const out: StatusSnapshot["recentSignals"] = [];
  for (const f of files) {
    const s = readJson<SignalDigestFile>(path.join(paths.signalsDir(), f));
    if (!s?.id) continue;
    out.push({
      signalId: s.id,
      newsId: s.newsId ?? s.id,
      title: s.title ?? "(untitled)",
      tickers: s.materiality?.tickers ?? [],
      pricedInStatus: s.pricedIn?.status ?? null,
      materialityScore: s.materiality?.score ?? 0,
      tradeable: Boolean(s.materiality?.tradeable),
      createdAtUtc: s.createdAtUtc ?? ""
    });
  }
  return out;
}

function buildSnapshot(universe: UniverseEntry[]): StatusSnapshot {
  const portfolio: Portfolio = loadPortfolio();
  const marks = currentMarks(universe);
  const equity = equityOf(portfolio, marks);
  const feed = loadFeedState();
  let unrealized = 0;
  const positions = portfolio.positions.map((p) => {
    const mark = marks.get(p.ticker) ?? null;
    const sign = p.direction === "long" ? 1 : -1;
    const pnl = mark === null ? null : sign * (mark - p.entryPx) * p.qty;
    if (pnl !== null) unrealized += pnl;
    return {
      ticker: p.ticker,
      direction: p.direction,
      qty: Math.round(p.qty * 10_000) / 10_000,
      entryPx: p.entryPx,
      markPx: mark,
      notionalUsd: Math.round(p.qty * (mark ?? p.entryPx)),
      unrealizedPnlUsd: pnl === null ? null : Math.round(pnl * 100) / 100,
      unrealizedPnlPct: pnl === null ? null : Math.round((pnl / p.notionalUsdAtEntry) * 10_000) / 100,
      stopPx: p.stopPx,
      hardFloorPx: p.hardFloorPx,
      horizonUtc: p.horizonUtc,
      thesisId: p.thesisId
    };
  });
  const archivedCoins = universe.filter((u) => archivedDayCount(u.hlSymbol) > 0).length;
  return {
    service: { name: config.serviceName, version: config.version, mode: "shadow", startedAtUtc, nowUtc: new Date().toISOString() },
    feed: { lastPollUtc: feed.lastPollUtc, lastNewItemUtc: feed.lastNewItemUtc, seenCount: feed.seenIds.length, lastError: feed.lastError },
    market: { lastSweepUtc: marketState.lastCandleSweepUtc, archivedCoins, lastError: marketState.lastError },
    portfolio: {
      equityUsd: Math.round(equity * 100) / 100,
      initialCapitalUsd: portfolio.initialCapitalUsd,
      realizedPnlUsd: Math.round(portfolio.realizedPnlUsd * 100) / 100,
      unrealizedPnlUsd: Math.round(unrealized * 100) / 100,
      halted: portfolio.halted,
      haltedReason: portfolio.haltedReason,
      positions
    },
    activeRuns: activeRuns(),
    recentRuns: recentRuns(),
    recentSignals: recentSignalDigests()
  };
}

interface IngestBody {
  mode?: string;
  newsId?: string;
  fullText?: string;
  title?: string;
  text?: string;
  url?: string;
  publishedAtUtc?: string;
}

async function handleIngest(req: IncomingMessage, res: ServerResponse, universe: UniverseEntry[]): Promise<void> {
  if (!config.ingestToken) return json(res, 503, { error: "ingest disabled: DELTAPM_INGEST_TOKEN not set" });
  if (req.headers["x-delta-pm-token"] !== config.ingestToken) return json(res, 401, { error: "bad token" });
  let body: IngestBody;
  try {
    body = JSON.parse(await readBody(req)) as IngestBody;
  } catch {
    return json(res, 400, { error: "invalid JSON" });
  }

  if (body.mode === "paste_full_text") {
    if (!body.newsId || !body.fullText) return json(res, 400, { error: "newsId and fullText required" });
    // Re-run the pipeline for this news with the pasted full text attached.
    // t0 stays the ORIGINAL published time (pasting never resets the clock);
    // dedupe is bypassed via a fresh manual id suffix.
    const nowIso = new Date().toISOString();
    const item: NewsItem = {
      id: `${body.newsId}#fulltext-${Date.now().toString(36)}`,
      source: "the-information",
      kind: "manual",
      title: body.title ?? `[补全原文] ${body.newsId}`,
      teaser: "",
      fullText: body.fullText.slice(0, 50_000),
      url: body.url ?? null,
      author: null,
      publishedUtc: body.publishedAtUtc ?? nowIso,
      updatedUtc: null,
      prefix: "none",
      fetchedAtUtc: nowIso
    };
    void processNews(item, { universe });
    return json(res, 202, { accepted: true, id: item.id });
  }

  if (body.mode === "manual_news") {
    if (!body.title || !body.text) return json(res, 400, { error: "title and text required" });
    const nowIso = new Date().toISOString();
    const item: NewsItem = {
      id: `manual:${Date.now().toString(36)}`,
      source: "manual",
      kind: "manual",
      title: body.title,
      teaser: body.text.slice(0, 4000),
      fullText: body.text.slice(0, 50_000),
      url: body.url ?? null,
      author: null,
      publishedUtc: body.publishedAtUtc ?? nowIso,
      updatedUtc: null,
      prefix: "none",
      fetchedAtUtc: nowIso
    };
    void processNews(item, { universe });
    return json(res, 202, { accepted: true, id: item.id });
  }

  return json(res, 400, { error: "unknown mode (paste_full_text | manual_news)" });
}

export function startStatusServer(universe: UniverseEntry[]): void {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (req.method === "GET" && url === "/healthz") return json(res, 200, { ok: true, mode: "shadow" });
    if (req.method === "GET" && (url === "/status" || url === "/snapshot")) {
      try {
        return json(res, 200, buildSnapshot(universe));
      } catch (error) {
        return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (req.method === "POST" && url === "/ingest") {
      void handleIngest(req, res, universe).catch((error) => json(res, 500, { error: String(error) }));
      return;
    }
    return json(res, 404, { error: "not found" });
  });
  server.listen(config.statusPort, "0.0.0.0", () => {
    console.log(`[OK] status server on :${config.statusPort} (/healthz /status /ingest)`);
  });
}
