/**
 * Rebuild apps/web/lib/world-cup/generated/fifa8-performance.generated.json — the
 * 9-way leaderboard scoring EVERY FIFA 8-model forecaster on the settled R32
 * fixtures. Mirrors build-performance.ts but loops over all forecasters instead of
 * scoring a single forecast set.
 *
 * Inputs (all static / no network here — fetch happens in fifa8-results.ts):
 *   • fifa8-r32.generated.json            — 15 fixtures × 9 forecasters' a/draw/b
 *   • fifa8-results.generated.json        — settled winner + score per fixture
 *   • fifa8-baseline-prices.generated.json — market implied a/draw/b at forecast
 *                                            time (post-hoc benchmark; optional)
 *
 * For each forecaster we build PerfFixture[] and call computePerformance() from
 * lib/performance.ts (the SAME metric code the group-stage page uses — Brier skill
 * vs market, Mock PNL, calibration/ECE, best-pick). Forecasters are ranked by
 * Brier skill vs market (agg.bssPct desc). The per-match table + calibration bins
 * are emitted for the headline (multicalibrated) forecaster only, matching the
 * group-stage performance page shape.
 *
 * Market-blind: prices are used ONLY to benchmark the blind forecasts after the
 * fact; the forecasts themselves never read a price. When the baseline-price file
 * is missing/empty, Brier skill + Mock PNL degrade to 0 (best-pick + ECE still
 * compute), which is the honest pre-benchmark state.
 *
 *   pnpm tsx scripts/world-cup/fifa8-performance.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computePerformance,
  type BaselinePrice,
  type PerfFixture,
  type PerfResult
} from "./lib/performance.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");

const C = {
  info: (m: string) => console.log(`\x1b[36mINFO\x1b[0m  ${m}`),
  ok: (m: string) => console.log(`\x1b[32mOK\x1b[0m    ${m}`),
  warn: (m: string) => console.log(`\x1b[33mWARN\x1b[0m  ${m}`),
  err: (m: string) => console.error(`\x1b[31mERR\x1b[0m   ${m}`)
};

const HEADLINE = "multicalibrated";

interface ForecasterMeta {
  readonly id: string;
  readonly name: string;
  readonly family: string;
}
interface ForecasterProbs {
  readonly id: string;
  readonly a: number;
  readonly draw: number;
  readonly b: number;
}
interface Fixture {
  readonly fixtureId: string;
  readonly teamA: string;
  readonly teamB: string;
  readonly forecasters: readonly ForecasterProbs[];
}
interface Fifa8Forecasts {
  readonly forecasterMeta: readonly ForecasterMeta[];
  readonly fixtures: readonly Fixture[];
}

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(GEN_DIR, name), "utf8")) as T;
}

// Optional inputs degrade to empty rather than aborting the build.
async function readJsonOptional<T>(name: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      C.warn(`${name} not found — continuing without it`);
      return fallback;
    }
    throw err;
  }
}

// Build the PerfFixture[] for one forecaster: each fixture's a/draw/b probs keyed
// to teamA(a)/Draw/teamB(b), with event_slug = fixtureId (the results + baseline
// maps are keyed by fixtureId too).
function fixturesForForecaster(forecasterId: string, fixtures: readonly Fixture[]): PerfFixture[] {
  const out: PerfFixture[] = [];
  for (const fx of fixtures) {
    const f = fx.forecasters.find((p) => p.id === forecasterId);
    if (!f) continue;
    out.push({
      event_slug: fx.fixtureId,
      outcomes: [
        { key: "a", label_en: fx.teamA, p: f.a },
        { key: "draw", label_en: "Draw", p: f.draw },
        { key: "b", label_en: fx.teamB, p: f.b }
      ]
    });
  }
  return out;
}

async function main(): Promise<void> {
  const forecasts = await readJson<Fifa8Forecasts>("fifa8-r32.generated.json");
  // Results may not exist yet (no R32 settled) — degrade to all-pending, don't crash.
  const results = (
    await readJsonOptional<{ results: Record<string, PerfResult> }>("fifa8-results.generated.json", { results: {} })
  ).results;
  const baseline = (
    await readJsonOptional<{ prices: Record<string, BaselinePrice | null> }>("fifa8-baseline-prices.generated.json", {
      prices: {}
    })
  ).prices;

  // Score every forecaster with the shared metric code (no reimplementation).
  const scored = forecasts.forecasterMeta.map((meta) => {
    const fixtures = fixturesForForecaster(meta.id, forecasts.fixtures);
    const perf = computePerformance(fixtures, results, baseline);
    return { meta, perf };
  });

  // Leaderboard sorted by Brier skill vs market (relative skill), best first.
  const forecasters = scored
    .map(({ meta, perf }) => ({ id: meta.id, name: meta.name, family: meta.family, agg: perf.agg }))
    .sort((x, y) => y.agg.bssPct - x.agg.bssPct);

  // Per-match table + calibration bins come from the headline forecaster (matches
  // the group-stage page, which surfaces one forecast's match detail).
  const headline = scored.find((s) => s.meta.id === HEADLINE) ?? scored[0];
  const settled = headline ? headline.perf.agg.settled : 0;

  const out = path.join(GEN_DIR, "fifa8-performance.generated.json");
  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        headline: HEADLINE,
        settled,
        forecasters,
        matches: headline ? headline.perf.matches : [],
        bins: headline ? headline.perf.bins : []
      },
      null,
      1
    )
  );

  C.ok(`fifa8-performance: ${forecasters.length} forecasters scored · settled=${settled}/${forecasts.fixtures.length}`);
  for (const f of forecasters) {
    const a = f.agg;
    C.info(
      `  ${f.id.padEnd(18)} brierSkill=${a.bssPct >= 0 ? "+" : ""}${a.bssPct}% · ` +
        `mockPNL=${a.roiPct >= 0 ? "+" : ""}${a.roiPct}% · ECE=${a.ecePct}% · ` +
        `bestPick=${a.bestPickHit}/${a.settled} (${a.bestPickPct}%)`
    );
  }
  if (settled === 0) C.info("settled=0 — no R32 fixtures resolved yet; leaderboard is all-zero until the bracket plays.");
  C.ok(`data:  ${out}`);
}

main().catch((err) => {
  C.err(`fifa8-performance failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exitCode = 1;
});
