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
import { fetchEspnScore } from "./lib/espn-results.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");
const PREDICTIONS = path.join(GEN_DIR, "predictions.generated.json");
const OUT = path.join(GEN_DIR, "results.generated.json");
const OVERRIDES = path.join(REPO_ROOT, "scripts/world-cup/results-overrides.json");
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
  readonly outcomes?: readonly { readonly key: string; readonly label_en: string }[];
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

interface OverrideEntry {
  readonly winner: "a" | "draw" | "b";
  readonly homeGoals?: number | null;
  readonly awayGoals?: number | null;
  readonly score?: string | null;
  readonly note?: string;
}

// Apply operator-verified overrides over the fetched results. Keys starting with
// "_" (e.g. "_note") are ignored; a missing file is a no-op.
async function applyOverrides(results: Record<string, MatchResult>): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(OVERRIDES, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  const overrides = JSON.parse(raw) as Record<string, OverrideEntry>;
  let applied = 0;
  for (const [slug, ov] of Object.entries(overrides)) {
    if (slug.startsWith("_") || !(slug in results)) continue;
    const prev = results[slug];
    const next: MatchResult = {
      ...prev,
      status: "resolved",
      winner: ov.winner,
      homeGoals: ov.homeGoals ?? null,
      awayGoals: ov.awayGoals ?? null,
      score: ov.score ?? null,
      source: "verified"
    };
    if (prev.winner !== next.winner || prev.score !== next.score) {
      C.warn(
        `  override ${slug}: ${prev.score ?? "(winner only)"} → ${next.score ?? "(winner only)"}, winner ${prev.winner ?? "?"} → ${next.winner} [verified]`
      );
    }
    results[slug] = next;
    applied += 1;
  }
  if (applied > 0) C.info(`verified overrides applied: ${applied}`);
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

  // ESPN backfill: Polymarket settles some fixtures winner-only (its exact-score
  // market hit the "Any Other Score" bucket), leaving score === null. Recover the
  // numeric score from ESPN's results feed (results-only — no odds/prices read,
  // so market-blind holds), adopting it ONLY when ESPN's winner agrees with
  // Polymarket's settled winner. A failed lookup leaves the fixture winner-only.
  const winnerOnly = matches.filter((m) => {
    const r = results[m.event_slug];
    return r.status === "resolved" && r.score == null && r.winner != null;
  });
  let backfilled = 0;
  for (const m of winnerOnly) {
    const a = m.outcomes?.find((o) => o.key === "a")?.label_en;
    const b = m.outcomes?.find((o) => o.key === "b")?.label_en;
    const date = m.event_slug.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!a || !b || !date) continue;
    try {
      const espn = await fetchEspnScore(date, a, b);
      if (!espn) {
        C.warn(`  ESPN: no completed score for ${m.event_slug} (${a} vs ${b})`);
        continue;
      }
      const r = results[m.event_slug];
      if (espn.winner !== r.winner) {
        C.warn(`  ESPN winner '${espn.winner}' != settled '${r.winner}' for ${m.event_slug}; keeping winner-only`);
        continue;
      }
      results[m.event_slug] = { ...r, homeGoals: espn.aGoals, awayGoals: espn.bGoals, score: espn.score, source: "espn" };
      backfilled += 1;
      C.ok(`  ESPN backfill ${m.event_slug}: ${espn.score}`);
    } catch (err) {
      C.warn(`  ESPN fetch failed for ${m.event_slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (winnerOnly.length > 0) {
    C.info(`ESPN backfill: ${backfilled}/${winnerOnly.length} winner-only fixtures got an exact score`);
  }

  // Operator-verified overrides (results-overrides.json): authoritative settled
  // facts confirmed from public sources, applied LAST so they win over fetched
  // Polymarket/ESPN data and persist across daily re-runs. This is the durable
  // "verified result is authoritative on conflict" policy — market-blind (winner
  // + score only). A missing file is fine (no overrides).
  await applyOverrides(results);

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
