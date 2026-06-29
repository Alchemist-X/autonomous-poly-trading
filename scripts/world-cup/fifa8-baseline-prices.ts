/**
 * One-shot capture of the Polymarket prediction-time prices for every FIFA 8-model
 * Round-of-32 fixture, written to
 * apps/web/lib/world-cup/generated/fifa8-baseline-prices.generated.json.
 *
 * Sibling of scripts/world-cup/fetch-baseline-prices.ts (group stage). Same
 * Gamma + CLOB price-history mechanics; the ONE difference is discovery: the
 * FIFA8 R32 fixtures carry no Polymarket slug, so we list the World Cup series
 * (soccer-fifwc) and fuzzy-match each fixture to an event BY TEAM NAME.
 *
 * Policy note: the FIFA8 forecasts are MARKET-BLIND — they are generated with
 * zero price input (no betting line, no implied probability, at any stage). This
 * file captures Polymarket prices ONLY to benchmark those blind forecasts after
 * the fact (the "预测效果 / performance" page: Mock PNL, Brier skill vs market,
 * calibration). No price captured here ever feeds a prediction.
 *
 * Each fixture's prices are read at the top-level forecast `generatedAt` from the
 * Polymarket CLOB price history. The 1x2 legs are mapped to a(teamA)/b(teamB) by
 * TEAM NAME, never by leg position — Polymarket's leg order is not reliably
 * home-first (it flipped teams on England/Croatia and Switzerland/Bosnia; see
 * scripts/world-cup/lib/settlement.ts).
 *
 *   pnpm tsx scripts/world-cup/fifa8-baseline-prices.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");
const INPUT = path.join(GEN_DIR, "fifa8-r32.generated.json");
const OUT = path.join(GEN_DIR, "fifa8-baseline-prices.generated.json");

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

// The Polymarket "FIFA World Cup" series groups every fixture event (group stage
// + knockouts + their derived prop/halftime/exact-score sub-events).
const SERIES_ID = "11433";
const PAGE = 100;
const MAX_PAGES = 12; // safety cap; series is < 700 events today

// Sub-event suffixes we must NOT treat as the moneyline event for a fixture.
const SKIP_SUFFIXES = [
  "-player-props",
  "-halftime-result",
  "-second-half-result",
  "-exact-score",
  "-first-to-score",
  "-more-markets",
  "-total-corners"
] as const;

const C = {
  info: (m: string) => console.log(`\x1b[36mINFO\x1b[0m  ${m}`),
  ok: (m: string) => console.log(`\x1b[32mOK\x1b[0m    ${m}`),
  warn: (m: string) => console.log(`\x1b[33mWARN\x1b[0m  ${m}`),
  err: (m: string) => console.log(`\x1b[31mERR\x1b[0m   ${m}`)
};

interface Fixture {
  readonly fixtureId: string;
  readonly teamA: string;
  readonly teamB: string;
}
interface FifaR32 {
  readonly generatedAt: string;
  readonly fixtures: readonly Fixture[];
}
interface GammaMarket {
  readonly groupItemTitle?: string;
  readonly question?: string;
  readonly clobTokenIds?: string;
}
interface GammaEvent {
  readonly slug?: string;
  readonly title?: string;
  readonly markets?: readonly GammaMarket[];
}
export interface BaselinePrice {
  readonly a: number;
  readonly draw: number;
  readonly b: number;
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { "User-Agent": "predict-raven/fifa8-baseline-prices" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// Accent-/punctuation-insensitive team key; drops the connector "and" so
// "Bosnia and Herzegovina" == "Bosnia-Herzegovina" (mirrors settlement.ts).
function normTeam(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Coarse string similarity, reused from fetch-baseline-prices.ts for fuzzy
// title matching when team-name keys are not an exact substring of each other.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function sim(title: string, name: string): number {
  const a = norm(title);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  return [...a].filter((c) => b.includes(c)).length / Math.max(a.length, b.length);
}

// Does a leg title name this team? Substring-on-normalised-key match, with a
// length>=3 guard so short codes don't collide (e.g. "us" inside "australia").
function titleNamesTeam(title: string, team: string): boolean {
  const t = normTeam(title);
  const x = normTeam(team);
  if (!t || !x) return false;
  return t === x || (x.length >= 3 && t.includes(x)) || (t.length >= 3 && x.includes(t));
}

const isDrawLeg = (m: GammaMarket): boolean =>
  /^draw\b/i.test(m.groupItemTitle ?? "") || /end in a draw/i.test(m.question ?? "");

// The two non-draw (team) legs of a 1x2 moneyline event.
const teamLegs = (ev: GammaEvent): readonly GammaMarket[] => (ev.markets ?? []).filter((m) => !isDrawLeg(m));

// An event is a fixture moneyline iff its slug carries no sub-event suffix and it
// has exactly two team legs plus a draw leg.
function isMoneylineEvent(ev: GammaEvent): boolean {
  const slug = ev.slug ?? "";
  if (SKIP_SUFFIXES.some((s) => slug.endsWith(s))) return false;
  return teamLegs(ev).length === 2 && (ev.markets ?? []).some(isDrawLeg);
}

// Find the one series event whose two team legs name BOTH teamA and teamB
// (orientation-agnostic). Returns null when no event pairs these two teams —
// e.g. the real bracket diverged from the FIFA8 forecast, so the matchup never
// existed on Polymarket. That null is an honest result, not a failure.
function findEvent(events: readonly GammaEvent[], teamA: string, teamB: string): GammaEvent | null {
  for (const ev of events) {
    if (!isMoneylineEvent(ev)) continue;
    const [l1, l2] = teamLegs(ev);
    const t1 = l1.groupItemTitle ?? l1.question ?? "";
    const t2 = l2.groupItemTitle ?? l2.question ?? "";
    const direct = titleNamesTeam(t1, teamA) && titleNamesTeam(t2, teamB);
    const swap = titleNamesTeam(t1, teamB) && titleNamesTeam(t2, teamA);
    if (direct || swap) return ev;
  }
  return null;
}

// Read the prediction-time yes-price per outcome {a,draw,b} for one event,
// mapping the two team legs to a(teamA)/b(teamB) by NAME, never by position.
async function priceForEvent(ev: GammaEvent, tsISO: string, teamA: string, teamB: string): Promise<BaselinePrice> {
  const ts = Math.floor(new Date(tsISO).getTime() / 1000);
  const team: Array<{ title: string; p: number }> = [];
  let draw = NaN;
  for (const m of ev.markets ?? []) {
    const title = m.groupItemTitle ?? m.question ?? "";
    if (!m.clobTokenIds) throw new Error(`missing clobTokenIds (${title})`);
    const token = JSON.parse(m.clobTokenIds)[0] as string;
    const hist =
      ((await fetchJson(
        `${CLOB}/prices-history?market=${token}&startTs=${ts - 7200}&endTs=${ts + 7200}&fidelity=10`
      )) as { history?: Array<{ t: number; p: number }> }).history ?? [];
    if (!hist.length) throw new Error(`no price history (${title})`);
    let best = hist[0];
    for (const pt of hist) if (Math.abs(pt.t - ts) < Math.abs(best.t - ts)) best = pt;
    if (isDrawLeg(m)) draw = best.p;
    else team.push({ title, p: best.p });
  }
  if (team.length !== 2 || Number.isNaN(draw)) throw new Error("unexpected market shape");
  const [l1, l2] = team;
  // Map by team name. Exact-substring match first; ties broken by sim() score.
  const directExact = titleNamesTeam(l1.title, teamA) && titleNamesTeam(l2.title, teamB);
  const swapExact = titleNamesTeam(l1.title, teamB) && titleNamesTeam(l2.title, teamA);
  let direct: boolean;
  if (directExact && !swapExact) direct = true;
  else if (swapExact && !directExact) direct = false;
  else direct = sim(l1.title, teamA) + sim(l2.title, teamB) >= sim(l1.title, teamB) + sim(l2.title, teamA);
  const [a, b] = direct ? [l1.p, l2.p] : [l2.p, l1.p];

  // Store RAW yes-prices (overround-inclusive, summing to > 1), matching the
  // group-stage baseline-prices.generated.json convention that lib/performance.ts
  // expects: it uses each leg price as the raw Mock-PNL entry cost and normalises
  // internally where it needs a probability. Normalising here would double-strip
  // the vig and inflate Mock PNL.
  if (a + draw + b <= 0) throw new Error("non-positive probability total");
  return { a, draw, b };
}

// Page the World Cup series until a short page (all events fetched).
async function loadSeriesEvents(): Promise<readonly GammaEvent[]> {
  const events: GammaEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = (await fetchJson(
      `${GAMMA}/events?series_id=${SERIES_ID}&limit=${PAGE}&offset=${page * PAGE}`
    )) as GammaEvent[];
    events.push(...batch);
    if (batch.length < PAGE) break;
  }
  return events;
}

async function main(): Promise<void> {
  const data = JSON.parse(await readFile(INPUT, "utf8")) as FifaR32;
  const fixtures = data.fixtures ?? [];
  const generatedAt = data.generatedAt;
  C.info(`fifa8 R32 forecast generatedAt = ${generatedAt}`);
  C.info(`capturing prediction-time Polymarket prices for ${fixtures.length} R32 fixtures …`);

  // Baseline is captured-once history: preserve any previously-captured price so a
  // transient failure on a re-run can't null out good data.
  let prior: Record<string, BaselinePrice | null> = {};
  try {
    prior = (JSON.parse(await readFile(OUT, "utf8")) as { prices?: Record<string, BaselinePrice | null> }).prices ?? {};
  } catch {
    // no prior file — first capture
  }

  let events: readonly GammaEvent[];
  try {
    events = await loadSeriesEvents();
  } catch (err) {
    // A series-listing failure is the only thing that can legitimately abort:
    // without the event list there is nothing to match. Still degrade to an
    // all-null artifact so the daily build never crashes on a transient outage.
    C.err(`could not list World Cup series events: ${err instanceof Error ? err.message : String(err)}`);
    events = [];
  }
  C.info(`loaded ${events.length} World Cup series events`);

  const prices: Record<string, BaselinePrice | null> = {};
  const matched: Array<{ id: string; slug: string; title: string }> = [];
  let cursor = 0;
  // Small concurrency pool; one fixture's failure must never abort the run.
  const worker = async (): Promise<void> => {
    while (cursor < fixtures.length) {
      const f = fixtures[cursor++];
      try {
        const ev = findEvent(events, f.teamA, f.teamB);
        if (!ev) {
          prices[f.fixtureId] = null;
          C.warn(`  ${f.fixtureId}: no Polymarket event pairs ${f.teamA} vs ${f.teamB}`);
          continue;
        }
        prices[f.fixtureId] = await priceForEvent(ev, generatedAt, f.teamA, f.teamB);
        matched.push({ id: f.fixtureId, slug: ev.slug ?? "", title: ev.title ?? "" });
        const p = prices[f.fixtureId] as BaselinePrice;
        C.ok(
          `  ${f.fixtureId} → ${ev.title} (${ev.slug}) | a=${p.a.toFixed(3)} draw=${p.draw.toFixed(3)} b=${p.b.toFixed(3)}`
        );
      } catch (err) {
        prices[f.fixtureId] = null;
        C.warn(`  ${f.fixtureId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, fixtures.length || 1) }, worker));

  // Restore any good prior price where this run came up null (transient failure).
  for (const id of Object.keys(prices)) {
    if (prices[id] == null && prior[id]) prices[id] = prior[id]!;
  }

  const captured = Object.values(prices).filter(Boolean).length;
  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt,
        capturedAt: new Date().toISOString(),
        source: "polymarket-clob-price-history",
        note: "Market's implied win/draw/loss for each FIFA8 R32 fixture at the forecast time. Post-hoc benchmark only — the FIFA8 forecasts are market-blind and never read a price.",
        prices
      },
      null,
      1
    )
  );
  C.ok(`captured ${captured}/${fixtures.length} R32 fixtures (${fixtures.length - captured} null)`);
  for (const m of matched) C.info(`  matched ${m.id} → ${m.title} (${m.slug})`);
  C.ok(`data: ${OUT}`);
}

main().catch((err) => {
  console.error("fifa8-baseline-prices failed:", err);
  process.exitCode = 1;
});
