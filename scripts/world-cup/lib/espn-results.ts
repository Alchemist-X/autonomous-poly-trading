/**
 * ESPN results backfill for World Cup group-stage fixtures.
 *
 * Polymarket's "exact-score" market only enumerates ~16 common scorelines plus a
 * catch-all "Any Other Score"; a lopsided result (e.g. 7-1) settles that bucket,
 * so Polymarket recovers the WINNER but not the numbers. This module fills in the
 * exact final score for those winner-only fixtures from ESPN's public scoreboard.
 *
 * Market-blind compliance: ESPN's scoreboard is a RESULTS feed, not a market. We
 * read ONLY the final goal counts + completion status here — never odds/prices.
 * Using a results source for settlement mapping is exactly what the policy allows
 * (event structure & settlement only; no market prices). Keyless, read-only.
 *
 * Orientation: our event_slug puts team `a` first (home), so the returned score
 * is always "<a goals>-<b goals>". The caller adopts a backfilled score ONLY when
 * ESPN's derived winner agrees with Polymarket's settled winner.
 */

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export interface EspnScore {
  readonly aGoals: number;
  readonly bGoals: number;
  readonly score: string; // "a-b"
  readonly winner: "a" | "draw" | "b";
}

interface EspnCompetitor {
  readonly score?: string | number;
  readonly team?: {
    readonly displayName?: string;
    readonly shortDisplayName?: string;
    readonly name?: string;
    readonly location?: string;
    readonly abbreviation?: string;
  };
}

interface EspnEvent {
  readonly competitions?: ReadonlyArray<{
    readonly competitors?: readonly EspnCompetitor[];
    readonly status?: { readonly type?: { readonly completed?: boolean } };
  }>;
}

// Accent-/punctuation-insensitive comparison so "Côte d'Ivoire", "United States",
// "Curaçao" match ESPN's spellings. The connector "and" is dropped too, so
// "Bosnia and Herzegovina" matches ESPN's "Bosnia-Herzegovina".
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function nameMatches(comp: EspnCompetitor, target: string): boolean {
  const t = norm(target);
  if (!t) return false;
  const names = [
    comp.team?.displayName,
    comp.team?.shortDisplayName,
    comp.team?.name,
    comp.team?.location,
    comp.team?.abbreviation
  ].filter((n): n is string => Boolean(n));
  return names.some((n) => {
    const x = norm(n);
    return x === t || (x.length >= 3 && t.includes(x)) || (t.length >= 3 && x.includes(t));
  });
}

// A kickoff late in the UTC day can land on ESPN's next calendar date, so probe
// the slug date and its neighbours.
function candidateDates(slugDate: string): readonly string[] {
  const base = new Date(`${slugDate}T12:00:00Z`);
  const out: string[] = [];
  for (const delta of [0, 1, -1]) {
    const d = new Date(base.getTime() + delta * 86_400_000);
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return out;
}

// Memoize one scoreboard fetch per date for the lifetime of a run.
const boardCache = new Map<string, Promise<readonly EspnEvent[]>>();

async function scoreboard(yyyymmdd: string, fetchImpl: typeof fetch): Promise<readonly EspnEvent[]> {
  const cached = boardCache.get(yyyymmdd);
  if (cached) return cached;
  const p = (async () => {
    const res = await fetchImpl(`${ESPN_BASE}?dates=${yyyymmdd}`);
    if (!res.ok) throw new Error(`ESPN scoreboard ${yyyymmdd}: ${res.status}`);
    const data: unknown = await res.json();
    const events = (data as { events?: readonly EspnEvent[] }).events;
    return Array.isArray(events) ? events : [];
  })();
  boardCache.set(yyyymmdd, p);
  return p;
}

function winnerFromGoals(a: number, b: number): "a" | "draw" | "b" {
  return a > b ? "a" : a < b ? "b" : "draw";
}

/**
 * Find the completed ESPN result for a fixture by date + team names, oriented to
 * our team `a` / team `b`. Returns null when no completed, two-team match with
 * both teams identified and numeric scores is found.
 */
export async function fetchEspnScore(
  slugDate: string,
  teamAEn: string,
  teamBEn: string,
  fetchImpl: typeof fetch = fetch
): Promise<EspnScore | null> {
  for (const dt of candidateDates(slugDate)) {
    const events = await scoreboard(dt, fetchImpl);
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      const competitors = comp?.competitors ?? [];
      if (competitors.length !== 2) continue;
      if (comp?.status?.type?.completed === false) continue; // not final yet

      const aComp = competitors.find((c) => nameMatches(c, teamAEn));
      const bComp = competitors.find((c) => nameMatches(c, teamBEn));
      if (!aComp || !bComp || aComp === bComp) continue;

      const aGoals = Number(aComp.score);
      const bGoals = Number(bComp.score);
      if (!Number.isFinite(aGoals) || !Number.isFinite(bGoals)) continue;

      return { aGoals, bGoals, score: `${aGoals}-${bGoals}`, winner: winnerFromGoals(aGoals, bGoals) };
    }
  }
  return null;
}
