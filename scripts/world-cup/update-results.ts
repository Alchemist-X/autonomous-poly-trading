/**
 * Refresh World Cup group-stage results from Polymarket settlement.
 *
 * Pipeline: read the imported group_match forecasts → for every fixture whose
 * kickoff is in the past, pull its Polymarket settlement (winner + final score)
 * → write apps/web/lib/world-cup/generated/results.generated.json, which the web
 * app statically imports (SSG; no runtime fetch).
 *
 * This is the repeatable, unattended-safe job behind the daily schedule:
 *   - per-fixture fetch errors are isolated (never abort the whole run);
 *   - the existing results file is preserved if the run fails before writing;
 *   - each run appends a line to results-log.jsonl; failures archive to
 *     run-error/<ts>-update-results/ with context.
 *
 * Market-blind: only settled facts (winner + score) are stored — never a price
 * or implied probability. See scripts/world-cup/lib/settlement.ts.
 *
 *   pnpm wc:results            # past fixtures only (the daily job)
 *   pnpm wc:results -- --all   # probe every fixture regardless of kickoff
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchResults, type MatchResult } from "./lib/settlement.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");
const PREDICTIONS = path.join(GEN_DIR, "predictions.generated.json");
const OUT = path.join(GEN_DIR, "results.generated.json");
const ARTIFACT_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup");
const LOG = path.join(ARTIFACT_DIR, "results-log.jsonl");

const C = {
  info: (m: string) => console.log(`\x1b[36mINFO\x1b[0m  ${m}`),
  ok: (m: string) => console.log(`\x1b[32mOK\x1b[0m    ${m}`),
  warn: (m: string) => console.log(`\x1b[33mWARN\x1b[0m  ${m}`),
  err: (m: string) => console.error(`\x1b[31mERR\x1b[0m   ${m}`)
};

interface Forecast {
  readonly family: string;
  readonly event_slug: string;
  readonly kickoff_utc: string | null;
}

function pending(event_slug: string): MatchResult {
  return { event_slug, status: "pending", winner: null, homeGoals: null, awayGoals: null, score: null, settledAt: null, source: null };
}

async function loadGroupMatches(): Promise<readonly Forecast[]> {
  const data = JSON.parse(await readFile(PREDICTIONS, "utf8")) as { entries: Forecast[] };
  return data.entries.filter((e) => e.family === "group_match");
}

// Archive a failed run so it can be diagnosed / resumed later (global convention §2).
async function archiveError(reason: string, context: Record<string, unknown>): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(REPO_ROOT, "run-error", `${stamp}-update-results`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "error.json"), JSON.stringify({ stage: "update-results", reason, ...context }, null, 2));
  return dir;
}

async function main(): Promise<void> {
  const all = process.argv.includes("--all");
  const startedAt = Date.now();
  const now = new Date();

  C.info(`execution mode: live (read-only settlement) · source=polymarket · now=${now.toISOString()}`);
  const matches = await loadGroupMatches();
  C.info(`${matches.length} group-stage fixtures imported`);

  // Future fixtures cannot have settled — skip the network call and mark pending.
  const due = matches.filter((m) => all || (m.kickoff_utc != null && new Date(m.kickoff_utc) <= now));
  C.info(`probing ${due.length} fixtures kicked off before now${all ? " (--all)" : ""}; ${matches.length - due.length} still in the future`);

  const fetchErrors: string[] = [];
  const settled = await fetchResults(due.map((m) => m.event_slug), {
    onError: (slug, err) => {
      fetchErrors.push(slug);
      C.warn(`  fetch failed for ${slug}: ${err instanceof Error ? err.message : String(err)}`);
    },
    onProgress: (done, total, slug) => {
      if (done === total || done % 8 === 0) {
        C.info(`  progress ${done}/${total} (${((Date.now() - startedAt) / 1000).toFixed(0)}s) — ${slug}`);
      }
    }
  });

  // Every fixture down (network outage) on a tournament day with due matches is
  // a hard failure — don't blow away a good results file with all-pending data.
  if (due.length > 0 && fetchErrors.length === due.length) {
    const dir = await archiveError("all fetches failed — Gamma unreachable?", { dueCount: due.length, errors: fetchErrors });
    throw new Error(`all ${due.length} settlement fetches failed; existing results.generated.json left untouched. Context: ${dir}`);
  }

  const results: Record<string, MatchResult> = {};
  for (const m of matches) results[m.event_slug] = pending(m.event_slug);
  for (const r of settled) results[r.event_slug] = r;

  const resolved = Object.values(results).filter((r) => r.status === "resolved");
  const generatedAt = new Date().toISOString();
  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt,
        source: "polymarket-settlement",
        note: "Market-blind: settled winner + final score only — no prices or implied probabilities.",
        counts: { resolved: resolved.length, pending: matches.length - resolved.length, total: matches.length },
        results
      },
      null,
      1
    )
  );

  // Append a traceable run record.
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await appendFile(
    LOG,
    JSON.stringify({
      ranAt: generatedAt,
      durationS: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
      probed: due.length,
      resolved: resolved.length,
      pending: matches.length - resolved.length,
      fetchErrors: fetchErrors.length
    }) + "\n"
  );

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  C.ok(`${resolved.length}/${matches.length} fixtures settled in ${elapsed}s${fetchErrors.length ? ` (${fetchErrors.length} fetch warnings)` : ""}`);
  for (const r of resolved.sort((a, b) => (a.settledAt ?? "").localeCompare(b.settledAt ?? ""))) {
    C.ok(`  ${r.event_slug}  ${r.score ?? "(winner only)"}  → ${r.winner}  [${r.source}]`);
  }
  C.ok(`data:  ${OUT}`);
  C.ok(`log:   ${LOG}`);
  C.info("page data refreshed. Deploy to publish: pnpm tsx scripts/world-cup/import-predictions.ts && (your deploy step)");
}

main().catch(async (err) => {
  C.err(`update-results failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await archiveError("uncaught", { message: err instanceof Error ? err.message : String(err) }).catch(() => undefined);
  process.exitCode = 1;
});
