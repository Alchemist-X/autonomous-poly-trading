// A/B harness for the forecast-engine web-search backends.
//
// Runs the SAME query set through one or more backends (default: exa; pass
// --backends exa,tavily to A/B the keyed backends)
// and reports what a forecaster actually cares about: how fast, how many
// distinct sources, how many results carry a publish date, how fresh those
// dates are, and how much usable text lands in the model's context.
//
// Read-only. It calls search APIs and nothing else — no market data, no
// orders, no writes outside runtime-artifacts/.
//
// Usage:
//   ENV_FILE=.env.exa tsx scripts/forecast/search-backend-compare.ts
//   ... --backends exa,tavily --label gpt-6

import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "@autopoly/contracts/env";
import { webSearch, type SearchBackend, type SearchHit } from "@autopoly/forecast-engine/web-search";

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m"
};
const log = {
  info: (m: string) => console.log(`${C.cyan}INFO${C.reset} ${m}`),
  ok: (m: string) => console.log(`${C.green}OK  ${C.reset} ${m}`),
  warn: (m: string) => console.log(`${C.yellow}WARN${C.reset} ${m}`),
  err: (m: string) => console.log(`${C.red}ERR ${C.reset} ${m}`)
};

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

// Two query idioms, because the backends were built for different ones:
// "operator" is what services/orchestrator/src/pulse/web-search.ts emits today
// (quoted phrase + keyword soup + site: filters, tuned for a keyword engine);
// "natural" is the phrasing Exa's docs recommend (intent in plain language).
// Running both through both backends separates "Exa is better" from
// "Exa is better *when you stop writing keyword queries*".
interface Query { id: string; idiom: "operator" | "natural"; text: string }

const QUERIES: Query[] = [
  { id: "q1", idiom: "operator", text: `"Will GPT-6 be released by December 31, 2026?"` },
  { id: "q2", idiom: "operator", text: "GPT-6 OpenAI release official announcement statement" },
  { id: "q3", idiom: "operator", text: "GPT-6 OpenAI release site:reuters.com OR site:apnews.com OR site:openai.com" },
  { id: "q4", idiom: "natural", text: "Has OpenAI released GPT-6 to the general public yet?" },
  { id: "q5", idiom: "natural", text: "What has OpenAI said publicly about when GPT-6 will ship?" },
  { id: "q6", idiom: "natural", text: "recent reporting on OpenAI's GPT-6 launch timeline and delays" }
];

interface QueryRun {
  queryId: string;
  idiom: Query["idiom"];
  query: string;
  backend: SearchBackend;
  status: "ok" | "failed";
  elapsedMs: number;
  hits: SearchHit[];
  error?: string;
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function ageDays(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / 86_400_000 : null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

async function runBackend(backend: SearchBackend, q: Query): Promise<QueryRun> {
  const prev = process.env.FORECAST_WEB_SEARCH;
  process.env.FORECAST_WEB_SEARCH = backend;
  const startedAt = Date.now();
  try {
    const hits = await webSearch(q.text);
    return { queryId: q.id, idiom: q.idiom, query: q.text, backend, status: "ok", elapsedMs: Date.now() - startedAt, hits };
  } catch (error) {
    return {
      queryId: q.id, idiom: q.idiom, query: q.text, backend, status: "failed",
      elapsedMs: Date.now() - startedAt, hits: [],
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    if (prev === undefined) delete process.env.FORECAST_WEB_SEARCH;
    else process.env.FORECAST_WEB_SEARCH = prev;
  }
}

interface BackendSummary {
  backend: SearchBackend;
  queriesOk: number;
  queriesFailed: number;
  medianLatencyMs: number | null;
  totalHits: number;
  uniqueUrls: number;
  uniqueHosts: number;
  datedHits: number;
  datedPct: number;
  medianAgeDays: number | null;
  hitsUnder30d: number;
  hitsUnder7d: number;
  meanSnippetChars: number;
  emptySnippets: number;
  totalSnippetChars: number;
}

function summarize(backend: SearchBackend, runs: QueryRun[], now: number): BackendSummary {
  const mine = runs.filter((r) => r.backend === backend);
  const ok = mine.filter((r) => r.status === "ok");
  const hits = ok.flatMap((r) => r.hits);
  const ages = hits.map((h) => ageDays(h.publishedDate, now)).filter((a): a is number => a !== null);
  const snippetLens = hits.map((h) => h.snippet.length);
  return {
    backend,
    queriesOk: ok.length,
    queriesFailed: mine.length - ok.length,
    medianLatencyMs: median(ok.map((r) => r.elapsedMs)),
    totalHits: hits.length,
    uniqueUrls: new Set(hits.map((h) => h.url)).size,
    uniqueHosts: new Set(hits.map((h) => host(h.url)).filter(Boolean)).size,
    datedHits: ages.length,
    datedPct: hits.length ? Math.round((ages.length / hits.length) * 100) : 0,
    medianAgeDays: median(ages),
    hitsUnder30d: ages.filter((a) => a <= 30).length,
    hitsUnder7d: ages.filter((a) => a <= 7).length,
    meanSnippetChars: snippetLens.length ? Math.round(snippetLens.reduce((a, b) => a + b, 0) / snippetLens.length) : 0,
    emptySnippets: snippetLens.filter((n) => n === 0).length,
    totalSnippetChars: snippetLens.reduce((a, b) => a + b, 0)
  };
}

async function main(): Promise<void> {
  const envPath = loadEnvFile();
  const backends = arg("backends", "exa").split(",").map((b) => b.trim()) as SearchBackend[];
  const label = arg("label", "compare");
  const now = Date.now();
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");

  console.log(`${C.bold}forecast search-backend A/B${C.reset}  execution_mode=inspect (read-only, no orders)`);
  log.info(`env file: ${envPath ?? "(none loaded — using process env)"}`);
  log.info(`backends: ${backends.join(" vs ")}`);
  for (const b of backends) {
    const need = b === "exa" ? "EXA_API_KEY" : "TAVILY_API_KEY";
    if (!process.env[need]) {
      log.err(`backend "${b}" needs ${need}, which is not set. Aborting before spending any calls.`);
      process.exitCode = 1;
      return;
    }
    log.ok(`${b}: ${need} present (len=${process.env[need]!.length})`);
  }

  const runs: QueryRun[] = [];
  let done = 0;
  const total = backends.length * QUERIES.length;
  for (const q of QUERIES) {
    for (const backend of backends) {
      const run = await runBackend(backend, q);
      runs.push(run);
      done += 1;
      const head = `[${done}/${total}] ${backend.padEnd(10)} ${q.id}/${q.idiom.padEnd(8)}`;
      if (run.status === "ok") {
        const dated = run.hits.filter((h) => h.publishedDate).length;
        log.ok(`${head} ${String(run.elapsedMs).padStart(5)}ms  ${run.hits.length} hits, ${dated} dated`);
      } else {
        log.warn(`${head} ${String(run.elapsedMs).padStart(5)}ms  FAILED: ${run.error}`);
      }
    }
  }

  const summaries = backends.map((b) => summarize(b, runs, now));
  const outDir = path.resolve(process.cwd(), "runtime-artifacts", "search-compare", `${stamp}-${label}`);
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "runs.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAtUtc: new Date(now).toISOString(), backends, queries: QUERIES, summaries, runs }, null, 2));

  const mdPath = path.join(outDir, "report.md");
  fs.writeFileSync(mdPath, renderMarkdown({ now, backends, summaries, runs }));

  console.log();
  console.log(`${C.bold}Summary${C.reset}`);
  const cols: Array<[string, (s: BackendSummary) => string]> = [
    ["queries ok", (s) => `${s.queriesOk}/${s.queriesOk + s.queriesFailed}`],
    ["median latency", (s) => (s.medianLatencyMs === null ? "—" : `${s.medianLatencyMs}ms`)],
    ["hits", (s) => String(s.totalHits)],
    ["unique urls", (s) => String(s.uniqueUrls)],
    ["unique hosts", (s) => String(s.uniqueHosts)],
    ["dated", (s) => `${s.datedHits} (${s.datedPct}%)`],
    ["median age", (s) => (s.medianAgeDays === null ? "unknown" : `${s.medianAgeDays.toFixed(1)}d`)],
    ["hits <=7d", (s) => (s.datedHits ? String(s.hitsUnder7d) : "unknown")],
    ["mean snippet", (s) => `${s.meanSnippetChars} chars`],
    ["empty snippets", (s) => String(s.emptySnippets)]
  ];
  const w = Math.max(...cols.map(([n]) => n.length));
  console.log(`${" ".repeat(w)}  ${summaries.map((s) => s.backend.padEnd(12)).join("")}`);
  for (const [name, get] of cols) {
    console.log(`${name.padStart(w)}  ${summaries.map((s) => get(s).padEnd(12)).join("")}`);
  }

  console.log();
  log.info(`markdown report : ${mdPath}`);
  log.info(`raw runs (json) : ${jsonPath}`);
}

function renderMarkdown(input: { now: number; backends: SearchBackend[]; summaries: BackendSummary[]; runs: QueryRun[] }): string {
  const { now, backends, summaries, runs } = input;
  const out: string[] = [];
  out.push(`# Forecast web-search backend A/B — ${backends.join(" vs ")}`);
  out.push("");
  out.push(`Generated ${new Date(now).toISOString()} · read-only (no market data, no orders).`);
  out.push("");
  out.push("## Aggregate");
  out.push("");
  out.push(`| metric | ${summaries.map((s) => s.backend).join(" | ")} |`);
  out.push(`| --- | ${summaries.map(() => "---").join(" | ")} |`);
  const rows: Array<[string, (s: BackendSummary) => string]> = [
    ["queries succeeded", (s) => `${s.queriesOk}/${s.queriesOk + s.queriesFailed}`],
    ["median latency", (s) => (s.medianLatencyMs === null ? "—" : `${s.medianLatencyMs} ms`)],
    ["total hits", (s) => String(s.totalHits)],
    ["unique URLs", (s) => String(s.uniqueUrls)],
    ["unique hosts", (s) => String(s.uniqueHosts)],
    ["hits carrying a publish date", (s) => `${s.datedHits} (${s.datedPct}%)`],
    ["median result age", (s) => (s.medianAgeDays === null ? "unknown" : `${s.medianAgeDays.toFixed(1)} d`)],
    ["hits published <= 30d", (s) => (s.datedHits ? String(s.hitsUnder30d) : "unknown")],
    ["hits published <= 7d", (s) => (s.datedHits ? String(s.hitsUnder7d) : "unknown")],
    ["mean snippet length", (s) => `${s.meanSnippetChars} chars`],
    ["empty snippets", (s) => String(s.emptySnippets)],
    ["total snippet payload", (s) => `${s.totalSnippetChars} chars`]
  ];
  for (const [name, get] of rows) out.push(`| ${name} | ${summaries.map(get).join(" | ")} |`);
  out.push("");

  out.push("## Per-query");
  out.push("");
  const byQuery = new Map<string, QueryRun[]>();
  for (const r of runs) byQuery.set(r.queryId, [...(byQuery.get(r.queryId) ?? []), r]);
  for (const [qid, qruns] of byQuery) {
    const first = qruns[0]!;
    out.push(`### ${qid} (${first.idiom}) — \`${first.query}\``);
    out.push("");
    const urlSets = qruns.map((r) => new Set(r.hits.map((h) => h.url)));
    const overlap = urlSets.length === 2 ? [...urlSets[0]!].filter((u) => urlSets[1]!.has(u)).length : 0;
    out.push(`Overlap between backends: **${overlap}** shared URL(s).`);
    out.push("");
    for (const r of qruns) {
      out.push(`**${r.backend}** — ${r.status}, ${r.elapsedMs} ms, ${r.hits.length} hits`);
      if (r.error) out.push(`> error: ${r.error}`);
      out.push("");
      if (r.hits.length) {
        out.push("| # | published | host | title | snippet |");
        out.push("| --- | --- | --- | --- | --- |");
        r.hits.forEach((h, i) => {
          const age = ageDays(h.publishedDate, now);
          const pub = h.publishedDate ? `${h.publishedDate.slice(0, 10)} (${age!.toFixed(0)}d)` : "—";
          const snip = h.snippet.replace(/\|/g, "\\|").slice(0, 220) || "_(empty)_";
          out.push(`| ${i + 1} | ${pub} | ${host(h.url)} | ${(h.title || "—").replace(/\|/g, "\\|").slice(0, 80)} | ${snip} |`);
        });
        out.push("");
      }
    }
  }
  return out.join("\n");
}

void main().catch((error) => {
  console.error(`${C.red}ERR ${C.reset} ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
