/**
 * Settlement reader for the FIFA 8-model Round-of-32 (R32) forecasts.
 *
 * Mirrors update-results.ts but for the knockout bracket: for each of the 15 R32
 * fixtures in fifa8-r32.generated.json, locate the Polymarket per-match event BY
 * TEAM NAMES (the fixtureId is NOT the Polymarket slug for knockouts), read the
 * settled winner + final score, and map them to {status, winner, score} where the
 * winner key "a"/"b" is bound to OUR teamA/teamB BY NAME — never by leg position
 * (the known bug that flipped England/Croatia & Switzerland/Bosnia in the group
 * stage). Output: apps/web/lib/world-cup/generated/fifa8-results.generated.json.
 *
 * Market-blind policy (2026-06-11 user decision): the public forecasting pipeline
 * never reads or stores market prices / implied probabilities. This module uses
 * market data ONLY for settlement mapping (the explicitly allowed use): it keeps
 * the settled winner + score and nothing else — no price, no implied probability.
 *
 * Knockouts have no draw once extra time / penalties decide them, so in practice
 * winner is "a" or "b"; we keep the 3-way {a,draw,b} shape and only emit "draw"
 * if a market itself reports one (it normally won't).
 *
 * Degrades gracefully: a fixture whose market is not found or not yet settled is
 * "pending"; a prior results file is preserved across fetch failures.
 *
 *   pnpm tsx scripts/world-cup/fifa8-results.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDrawLeg, isResolvedYes, nameMatchesKey, normTeam, type GammaEvent, type GammaMarket
} from "./lib/settlement.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");
const PREDICTIONS = path.join(GEN_DIR, "fifa8-r32.generated.json");
const OUT = path.join(GEN_DIR, "fifa8-results.generated.json");

const GAMMA = "https://gamma-api.polymarket.com";

const C = {
  info: (m: string) => console.log(`\x1b[36mINFO\x1b[0m  ${m}`),
  ok: (m: string) => console.log(`\x1b[32mOK\x1b[0m    ${m}`),
  warn: (m: string) => console.log(`\x1b[33mWARN\x1b[0m  ${m}`),
  err: (m: string) => console.error(`\x1b[31mERR\x1b[0m   ${m}`)
};

// One scored fixture, oriented to OUR teamA (=a) / teamB (=b) by name.
export interface Fifa8Result {
  readonly status: "resolved" | "pending";
  readonly winner: "a" | "draw" | "b" | null;
  readonly score: string | null; // "2-1", ordered teamA-teamB
}

interface FixtureInput {
  readonly fixtureId: string;
  readonly teamA: string;
  readonly teamB: string;
}

const PENDING: Fifa8Result = { status: "pending", winner: null, score: null };

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// Exclude futures / aggregate markets that share team names but aren't the head-
// to-head match (e.g. "Belgium Stage of Elimination", "Nation to Reach …").
function isFutureMarket(title: string): boolean {
  return /stage of elimination|to reach|winner|top scorer|golden|group winner|advance|qualif/i.test(title);
}

// A genuine 2026 World Cup single-match event: the Polymarket slug is
// "fifwc-<abbr>-<abbr>-2026-MM-DD" (group + knockout share this convention).
// This rejects same-team-name decoys from other competitions (e.g. the 2024
// "uefa-nations-league-germany-vs-bosnia-..." event, which is a head-to-head
// "X vs Y" too) so a stale match can never be mistaken for an R32 result.
function isWorldCupMatchSlug(slug: string): boolean {
  return /^fif(wc)?-.*-2026-\d{2}-\d{2}$/.test(slug);
}

/**
 * Find the Polymarket per-match event for a knockout fixture by TEAM NAMES.
 * The R32 fixtureId is not the Polymarket slug, so we search Gamma and keep the
 * head-to-head event whose title names BOTH our teams ("TeamA vs. TeamB").
 */
async function findMatchSlug(teamA: string, teamB: string): Promise<string | null> {
  const keyA = normTeam(teamA);
  const keyB = normTeam(teamB);
  const url = `${GAMMA}/public-search?q=${encodeURIComponent(`${teamA} ${teamB}`)}&limit_per_type=12`;
  const data = (await fetchJson(url)) as { events?: GammaEvent[] };
  const events = data.events ?? [];

  let best: { slug: string; date: string } | null = null;
  for (const ev of events) {
    const title = ev.title ?? "";
    const slug = ev.slug ?? "";
    // Must be a genuine 2026 WC single-match event and not a futures market.
    if (!isWorldCupMatchSlug(slug) || isFutureMarket(title)) continue;
    // A head-to-head event names both teams and is split on "vs".
    const vs = title.match(/^(.+?)\s+vs\.?\s+(.+?)$/i);
    if (!vs) continue;
    const [left, right] = [vs[1].trim(), vs[2].trim()];
    const direct = (nameMatchesKey(left, keyA) ? 1 : 0) + (nameMatchesKey(right, keyB) ? 1 : 0);
    const swap = (nameMatchesKey(left, keyB) ? 1 : 0) + (nameMatchesKey(right, keyA) ? 1 : 0);
    if (Math.max(direct, swap) < 2) continue; // both our teams must appear
    // Among valid WC match events, keep the latest by the date in the slug — the
    // R32 fixture is later than any group-stage meeting of the same two teams.
    const date = (slug.match(/2026-\d{2}-\d{2}$/) ?? [""])[0];
    if (!best || date > best.date) best = { slug, date };
  }
  return best?.slug ?? null;
}

async function fetchEventBySlug(slug: string): Promise<GammaEvent | null> {
  const data = (await fetchJson(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`)) as GammaEvent[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

// Parse "Argentina 3 - 0 Algeria" → { left:"Argentina", lg:3, rg:0, right:"Algeria" }.
function parseExactScore(label: string): { left: string; lg: number; right: string; rg: number } | null {
  const m = label.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+?)$/);
  if (!m) return null;
  return { left: m[1].trim(), lg: Number(m[2]), right: m[4].trim(), rg: Number(m[3]) };
}

// Orient a (leftName, leftGoals, rightName, rightGoals) pair to OUR teamA/teamB by
// NAME, returning the winner key + a teamA-first "x-y" score. Position is ignored.
function orientByName(
  teamA: string,
  teamB: string,
  left: string,
  lg: number,
  right: string,
  rg: number
): Fifa8Result | null {
  const keyA = normTeam(teamA);
  const keyB = normTeam(teamB);
  const leftIsA = nameMatchesKey(left, keyA);
  const leftIsB = nameMatchesKey(left, keyB);
  const rightIsA = nameMatchesKey(right, keyA);
  const rightIsB = nameMatchesKey(right, keyB);

  let aGoals: number, bGoals: number;
  if (leftIsA && rightIsB) {
    aGoals = lg;
    bGoals = rg;
  } else if (leftIsB && rightIsA) {
    aGoals = rg;
    bGoals = lg;
  } else {
    return null; // ambiguous orientation — caller falls back / stays pending
  }
  const winner: Fifa8Result["winner"] = aGoals > bGoals ? "a" : aGoals < bGoals ? "b" : "draw";
  return { status: "resolved", winner, score: `${aGoals}-${bGoals}` };
}

/** Winner-only fallback from the 1x2 moneyline: map the winning leg to a/b/draw by NAME. */
function resultFromMoneyline(teamA: string, teamB: string, ev: GammaEvent): Fifa8Result | null {
  const markets = ev.markets ?? [];
  const won = markets.find(isResolvedYes);
  if (!won) return null;
  if (isDrawLeg(won)) return { status: "resolved", winner: "draw", score: null };
  const wonTitle = won.groupItemTitle ?? won.question ?? "";
  if (nameMatchesKey(wonTitle, normTeam(teamA))) return { status: "resolved", winner: "a", score: null };
  if (nameMatchesKey(wonTitle, normTeam(teamB))) return { status: "resolved", winner: "b", score: null };
  return null; // name didn't match either team — never guess by position
}

/**
 * Resolve one R32 fixture: find its match event by team names, then read the
 * exact-score event (winner + score) and fall back to the moneyline (winner-only).
 * Returns `pending` when the market is missing or nothing has settled yet.
 */
async function resolveFixture(fx: FixtureInput): Promise<Fifa8Result> {
  const slug = await findMatchSlug(fx.teamA, fx.teamB);
  if (!slug) return PENDING;

  // Exact-score event first: gives both winner and final score in one read.
  const exact = await fetchEventBySlug(`${slug}-exact-score`);
  if (exact) {
    const won = exact.markets?.find(isResolvedYes);
    const parsed = won ? parseExactScore(won.groupItemTitle ?? won.question ?? "") : null;
    if (parsed) {
      const oriented = orientByName(fx.teamA, fx.teamB, parsed.left, parsed.lg, parsed.right, parsed.rg);
      if (oriented) return oriented;
    }
  }

  // Moneyline fallback: winner only, mapped by name.
  const moneyline = await fetchEventBySlug(slug);
  if (moneyline) {
    const r = resultFromMoneyline(fx.teamA, fx.teamB, moneyline);
    if (r) return r;
  }
  return PENDING;
}

async function loadFixtures(): Promise<readonly FixtureInput[]> {
  const data = JSON.parse(await readFile(PREDICTIONS, "utf8")) as { fixtures: FixtureInput[] };
  return data.fixtures.map((f) => ({ fixtureId: f.fixtureId, teamA: f.teamA, teamB: f.teamB }));
}

// Read the prior results file so we can preserve it if every fetch fails.
async function loadPrior(): Promise<Record<string, Fifa8Result> | null> {
  try {
    const data = JSON.parse(await readFile(OUT, "utf8")) as { results?: Record<string, Fifa8Result> };
    return data.results ?? null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const now = new Date();
  C.info(`execution mode: live (read-only settlement) · source=polymarket · now=${now.toISOString()}`);

  const fixtures = await loadFixtures();
  C.info(`${fixtures.length} R32 fixtures imported`);

  const prior = await loadPrior();
  const results: Record<string, Fifa8Result> = {};
  const fetchErrors: string[] = [];

  // Small concurrency pool over the 15 fixtures; per-fixture errors are isolated.
  const concurrency = 5;
  let cursor = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (cursor < fixtures.length) {
      const fx = fixtures[cursor++];
      try {
        results[fx.fixtureId] = await resolveFixture(fx);
      } catch (err) {
        results[fx.fixtureId] = PENDING;
        fetchErrors.push(fx.fixtureId);
        C.warn(`  fetch failed for ${fx.fixtureId}: ${err instanceof Error ? err.message : String(err)}`);
      }
      done += 1;
      if (done === fixtures.length || done % 5 === 0) {
        C.info(`  progress ${done}/${fixtures.length} (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, fixtures.length) }, worker));

  // Every fixture failing (network outage) must not blow away a good results file.
  if (fixtures.length > 0 && fetchErrors.length === fixtures.length && prior) {
    C.warn(`all ${fixtures.length} fetches failed — preserving prior results file untouched`);
    C.ok(`data:  ${OUT} (unchanged)`);
    return;
  }

  const resolved = Object.values(results).filter((r) => r.status === "resolved").length;
  const pending = fixtures.length - resolved;
  const generatedAt = new Date().toISOString();

  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt,
        source: "polymarket-settlement",
        note: "Market-blind: settled winner + final score only — no prices or implied probabilities. winner a=teamA / b=teamB by NAME.",
        counts: { resolved, pending, total: fixtures.length },
        results
      },
      null,
      1
    )
  );

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  C.ok(`${resolved}/${fixtures.length} R32 fixtures settled in ${elapsed}s${fetchErrors.length ? ` (${fetchErrors.length} fetch warnings)` : ""}`);
  for (const fx of fixtures) {
    const r = results[fx.fixtureId];
    if (r.status === "resolved") {
      C.ok(`  ${fx.fixtureId}  ${r.score ?? "(winner only)"}  → ${r.winner}`);
    }
  }
  if (resolved === 0) C.info("no R32 fixtures settled yet — all pending (honest output; the bracket has not played).");
  C.ok(`data:  ${OUT}`);
}

main().catch((err) => {
  C.err(`fifa8-results failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exitCode = 1;
});
