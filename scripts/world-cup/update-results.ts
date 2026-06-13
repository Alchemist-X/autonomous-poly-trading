/**
 * Refresh World Cup group-stage results from Polymarket settlement.
 *
 * Pipeline: read the imported group_match forecasts → for every fixture whose
 * kickoff is in the past, pull its Polymarket settlement (winner + final score)
 * → write apps/web/lib/world-cup/generated/results.generated.json, which the web
 * app statically imports (SSG; no runtime fetch).
 *
 * Market-blind: only settled facts (winner + score) are stored — never a price
 * or implied probability. See scripts/world-cup/lib/settlement.ts.
 *
 *   pnpm tsx scripts/world-cup/update-results.ts          # past fixtures only
 *   pnpm tsx scripts/world-cup/update-results.ts --all    # probe every fixture
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchResults, type MatchResult } from "./lib/settlement.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");
const PREDICTIONS = path.join(GEN_DIR, "predictions.generated.json");
const OUT = path.join(GEN_DIR, "results.generated.json");

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

async function loadGroupMatches(): Promise<readonly Forecast[]> {
  const data = JSON.parse(await readFile(PREDICTIONS, "utf8")) as { entries: Forecast[] };
  return data.entries.filter((e) => e.family === "group_match");
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
  const skipped = matches.length - due.length;
  C.info(`probing ${due.length} fixtures kicked off before now${all ? " (--all: probing every fixture)" : ""}; ${skipped} still in the future`);

  const settled = await fetchResults(
    due.map((m) => m.event_slug),
    {
      onProgress: (done, total, slug) => {
        if (done === total || done % 8 === 0) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          C.info(`  progress ${done}/${total} (${elapsed}s) — ${slug}`);
        }
      }
    }
  );

  const results: Record<string, MatchResult> = {};
  for (const m of matches) results[m.event_slug] = { ...PENDING(m.event_slug) };
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

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  C.ok(`${resolved.length}/${matches.length} fixtures settled in ${elapsed}s`);
  for (const r of resolved.sort((a, b) => (a.settledAt ?? "").localeCompare(b.settledAt ?? ""))) {
    C.ok(`  ${r.event_slug}  ${r.score ?? "(winner only)"}  → ${r.winner}  [${r.source}]`);
  }
  C.ok(`wrote ${OUT}`);
}

function PENDING(event_slug: string): MatchResult {
  return { event_slug, status: "pending", winner: null, homeGoals: null, awayGoals: null, score: null, settledAt: null, source: null };
}

main().catch((err) => {
  C.err(`update-results failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exitCode = 1;
});
