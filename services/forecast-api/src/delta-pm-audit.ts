// Delta PM audit-chain aggregation for the /live-delta-pm review page.
//
// Joins the shadow agent's on-disk artifacts (shared runtime-artifacts
// volume, written by services/delta-pm) into per-news "IC memo" cases: news
// desk → analyst thesis → market check → PM arithmetic → risk guards →
// execution — every number the decision consumed, nothing summarized away.
// Read-only; simulation data only (the delta-pm service holds no keys).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./repo";

const CACHE_TTL_MS = 60_000;

function deltaPmRoot(): string {
  const explicit = process.env.DELTA_PM_ARTIFACTS_DIR?.trim();
  if (explicit) return explicit;
  const shared = process.env.ARTIFACT_STORAGE_ROOT?.trim();
  if (shared) return path.join(shared, "delta-pm");
  return path.join(repoRoot(), "runtime-artifacts", "delta-pm");
}

type Json = Record<string, unknown>;

function readJson(file: string): Json | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Json;
  } catch {
    return null;
  }
}

function readJsonl(file: string): Json[] {
  if (!existsSync(file)) return [];
  const out: Json[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Json);
    } catch {
      // torn tail line
    }
  }
  return out;
}

function readDir(dir: string): Json[] {
  if (!existsSync(dir)) return [];
  const out: Json[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const v = readJson(path.join(dir, f));
    if (v) out.push(v);
  }
  return out;
}

export interface DeltaPmAuditPayload {
  generatedAtUtc: string;
  bookStartedUtc: string | null;
  equitySource: "portfolio.json";
  portfolio: Json | null;
  latestReflection: Json | null;
  cases: Json[];
}

let cache: { at: number; payload: DeltaPmAuditPayload } | null = null;

export function buildDeltaPmAudit(rootDir: string = deltaPmRoot(), limit = 30): DeltaPmAuditPayload | null {
  const ledgerFile = path.join(rootDir, "ledger.jsonl");
  if (!existsSync(ledgerFile)) return null;

  const ledger = readJsonl(ledgerFile);
  const signals = readDir(path.join(rootDir, "signals"));
  const theses = readDir(path.join(rootDir, "theses"));
  const portfolio = readJson(path.join(rootDir, "portfolio.json"));

  // 原文存档: news/<sanitized id>.json written by the service on ingest.
  const newsDir = path.join(rootDir, "news");
  const newsBodies = new Map<string, Json>();
  if (existsSync(newsDir)) {
    for (const f of readdirSync(newsDir)) {
      if (!f.endsWith(".json")) continue;
      const v = readJson(path.join(newsDir, f));
      if (v && typeof v.id === "string") newsBodies.set(v.id, v);
    }
  }

  const signalsByNews = new Map<string, Json>();
  for (const s of signals) if (typeof s.newsId === "string") signalsByNews.set(s.newsId, s);
  const thesesBySignal = new Map<string, Json>();
  for (const t of theses) if (typeof t.signalId === "string") thesesBySignal.set(t.signalId, t);

  const decisionsByThesis = new Map<string, Json>();
  const opensByDecision = new Map<string, Json>();
  const closesByTicker = new Map<string, Json[]>();
  const newsSeen: Json[] = [];
  for (const e of ledger) {
    if (e.type === "news_seen") newsSeen.push(e);
    else if (e.type === "decision") {
      const d = e.decision as Json | undefined;
      if (d && typeof d.thesisId === "string") decisionsByThesis.set(d.thesisId, { ...d, ts: e.ts });
    } else if (e.type === "paper_open" && typeof e.decisionId === "string") {
      opensByDecision.set(e.decisionId, e);
    } else if ((e.type === "paper_close" || e.type === "stop_loss" || e.type === "hard_floor_stop") && typeof e.ticker === "string") {
      const arr = closesByTicker.get(e.ticker) ?? [];
      arr.push(e);
      closesByTicker.set(e.ticker, arr);
    }
  }

  // Newest first; dedupe repeated news_seen (restarts re-log backfills).
  const seenIds = new Set<string>();
  const cases: Json[] = [];
  for (const n of [...newsSeen].reverse()) {
    const newsId = String(n.newsId ?? "");
    if (!newsId || seenIds.has(newsId)) continue;
    seenIds.add(newsId);
    const signal = signalsByNews.get(newsId) ?? null;
    const thesis = signal && typeof signal.id === "string" ? thesesBySignal.get(signal.id) ?? null : null;
    const decision = thesis && typeof thesis.id === "string" ? decisionsByThesis.get(thesis.id) ?? null : null;
    const execution = decision && typeof decision.id === "string" ? opensByDecision.get(decision.id) ?? null : null;
    const ticker = (thesis?.ticker as string | undefined) ?? null;
    const positionNow =
      ticker && portfolio && Array.isArray(portfolio.positions)
        ? ((portfolio.positions as Json[]).find((p) => p.ticker === ticker) ?? null)
        : null;
    // Per-stage latency (性能监控): computed from ledger timestamps, ms.
    const ms = (v: unknown): number | null => {
      const t = typeof v === "string" ? Date.parse(v) : NaN;
      return Number.isFinite(t) ? t : null;
    };
    const tPub = ms(n.publishedUtc);
    const tSeen = ms(n.ts);
    const tSignal = ms(signal?.createdAtUtc);
    const tThesis = ms(thesis?.createdAtUtc);
    const tDecision = ms((decision as Json | null)?.ts);
    const span = (a: number | null, b: number | null) => (a !== null && b !== null && b >= a ? b - a : null);
    const timingsMs = {
      publishToSeen: span(tPub, tSeen),
      seenToSignal: span(tSeen, tSignal),
      signalToThesis: span(tSignal, tThesis),
      thesisToDecision: span(tThesis, tDecision),
      seenToDecision: span(tSeen, tDecision)
    };
    const body = newsBodies.get(newsId) ?? null;
    cases.push({
      news: {
        newsId,
        title: n.title ?? null,
        publishedUtc: n.publishedUtc ?? null,
        kind: n.kind ?? null,
        prefix: n.prefix ?? null,
        seenAtUtc: n.ts ?? null,
        url: (body?.url as string | undefined) ?? null,
        teaser: (body?.teaser as string | undefined) ?? null,
        fullText: (body?.fullText as string | undefined) ?? null,
        source: (body?.source as string | undefined) ?? null
      },
      timingsMs,
      signal,
      thesis,
      decision,
      execution,
      positionNow,
      postEvents: ticker ? (closesByTicker.get(ticker) ?? []) : []
    });
    if (cases.length >= limit) break;
  }

  const reportsDir = path.join(rootDir, "reports");
  let latestReflection: Json | null = null;
  if (existsSync(reportsDir)) {
    const files = readdirSync(reportsDir).filter((f) => f.endsWith("-reflection.json")).sort();
    const latest = files.at(-1);
    if (latest) latestReflection = readJson(path.join(reportsDir, latest));
  }

  const serviceStart = ledger.find((e) => e.type === "service_start");
  return {
    generatedAtUtc: new Date().toISOString(),
    bookStartedUtc: serviceStart ? String(serviceStart.ts ?? "") : null,
    equitySource: "portfolio.json",
    portfolio,
    latestReflection,
    cases
  };
}

export function getDeltaPmAudit(limit = 30): DeltaPmAuditPayload | null {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS && cache.payload.cases.length >= Math.min(limit, cache.payload.cases.length)) {
    return cache.payload;
  }
  const payload = buildDeltaPmAudit(undefined, limit);
  if (payload) cache = { at: Date.now(), payload };
  return payload;
}
