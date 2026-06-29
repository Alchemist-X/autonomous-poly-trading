/**
 * Derive the ACTUAL Round-of-32 bracket from real group-stage results.
 *
 * The MC-predicted bracket (runtime-artifacts/.../bracket-prediction.json) uses
 * modal Elo standings and is wrong for the real matchups. The R32 SLOT structure,
 * however, is fixed FIFA metadata (e.g. M73 = runner-up A vs runner-up B); only
 * WHICH teams fill the slots depends on the final tables. So we compute real
 * standings from the extracted results and fill the fixed slots.
 *
 * Tiebreakers applied: points, then goal difference, then goals for, then
 * head-to-head points among the tied teams. (Fair-play / drawing-of-lots edge
 * cases are not modelled.)
 */

import type { CompletedMatch, MatchFixture } from "./types.js";

/** The 12 groups, in the canonical team names used by elo-table.json / the manifest. */
export const GROUPS_2026: Readonly<Record<string, readonly string[]>> = {
  A: ["Mexico", "Korea Republic", "Czechia", "South Africa"],
  B: ["Switzerland", "Canada", "Bosnia-Herzegovina", "Qatar"],
  C: ["Brazil", "Morocco", "Scotland", "Haiti"],
  D: ["United States", "Türkiye", "Paraguay", "Australia"],
  E: ["Germany", "Ecuador", "Côte d'Ivoire", "Curaçao"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "IR Iran", "New Zealand"],
  H: ["Spain", "Uruguay", "Saudi Arabia", "Cabo Verde"],
  I: ["France", "Norway", "Senegal", "Iraq"],
  J: ["Argentina", "Austria", "Algeria", "Jordan"],
  K: ["Portugal", "Colombia", "DR Congo", "Uzbekistan"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

type Slot = readonly ["W" | "R", string] | readonly ["T", string];

/** Fixed FIFA R32 slot table (match number -> [slotA, slotB]). */
const R32_SLOTS: Readonly<Record<number, readonly [Slot, Slot]>> = {
  73: [["R", "A"], ["R", "B"]],
  74: [["W", "E"], ["T", "ABCDF"]],
  75: [["W", "F"], ["R", "C"]],
  76: [["W", "C"], ["R", "F"]],
  77: [["W", "I"], ["T", "CDFGH"]],
  78: [["R", "E"], ["R", "I"]],
  79: [["W", "A"], ["T", "CEFHI"]],
  80: [["W", "L"], ["T", "EHIJK"]],
  81: [["W", "D"], ["T", "BEFIJ"]],
  82: [["W", "G"], ["T", "AEHIJ"]],
  83: [["R", "K"], ["R", "L"]],
  84: [["W", "H"], ["R", "J"]],
  85: [["W", "B"], ["T", "EFGIJ"]],
  86: [["W", "J"], ["R", "H"]],
  87: [["W", "K"], ["T", "DEIJL"]],
  88: [["R", "D"], ["R", "G"]],
};

export interface TeamStanding {
  readonly team: string;
  readonly played: number;
  readonly points: number;
  readonly gf: number;
  readonly ga: number;
  readonly gd: number;
}

interface Tally {
  team: string;
  played: number;
  points: number;
  gf: number;
  ga: number;
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Accumulate points/goals for every team from the completed matches. */
const buildTallies = (matches: readonly CompletedMatch[]): Map<string, Tally> => {
  const t = new Map<string, Tally>();
  const ensure = (name: string): Tally => {
    const cur = t.get(name) ?? { team: name, played: 0, points: 0, gf: 0, ga: 0 };
    t.set(name, cur);
    return cur;
  };
  for (const m of matches) {
    const home = ensure(m.home.team);
    const away = ensure(m.away.team);
    home.played += 1;
    away.played += 1;
    home.gf += m.home.goalsFor;
    home.ga += m.home.goalsAgainst;
    away.gf += m.away.goalsFor;
    away.ga += m.away.goalsAgainst;
    if (m.result === "home") home.points += 3;
    else if (m.result === "away") away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }
  return t;
};

/** Head-to-head points among a tied subset, from the matches between them. */
const headToHeadPoints = (
  teams: readonly string[],
  matches: readonly CompletedMatch[],
): Map<string, number> => {
  const set = new Set(teams);
  const pts = new Map<string, number>(teams.map((x) => [x, 0]));
  for (const m of matches) {
    if (!set.has(m.home.team) || !set.has(m.away.team)) continue;
    if (m.result === "home") pts.set(m.home.team, (pts.get(m.home.team) ?? 0) + 3);
    else if (m.result === "away") pts.set(m.away.team, (pts.get(m.away.team) ?? 0) + 3);
    else {
      pts.set(m.home.team, (pts.get(m.home.team) ?? 0) + 1);
      pts.set(m.away.team, (pts.get(m.away.team) ?? 0) + 1);
    }
  }
  return pts;
};

const toStanding = (t: Tally): TeamStanding => ({
  team: t.team,
  played: t.played,
  points: t.points,
  gf: t.gf,
  ga: t.ga,
  gd: t.gf - t.ga,
});

/** Rank one group's teams by points -> GD -> GF -> head-to-head points. */
const rankGroup = (
  groupTeams: readonly string[],
  tallies: ReadonlyMap<string, Tally>,
  matches: readonly CompletedMatch[],
): TeamStanding[] => {
  const rows = groupTeams.map((team) =>
    toStanding(tallies.get(team) ?? { team, played: 0, points: 0, gf: 0, ga: 0 }),
  );
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const h2h = headToHeadPoints([a.team, b.team], matches);
    return (h2h.get(b.team) ?? 0) - (h2h.get(a.team) ?? 0);
  });
};

/** Full standings table for all 12 groups, each ranked 1..4. */
export const computeStandings = (
  matches: readonly CompletedMatch[],
): Record<string, TeamStanding[]> => {
  const tallies = buildTallies(matches);
  const out: Record<string, TeamStanding[]> = {};
  for (const [g, teams] of Object.entries(GROUPS_2026)) {
    out[g] = rankGroup(teams, tallies, matches);
  }
  return out;
};

/** Assign the 8 qualified third-placed groups to their allowed T-slots (backtracking). */
const assignThirds = (
  qualifiedGroups: readonly string[],
): Record<number, string> | null => {
  const tSlots = Object.keys(R32_SLOTS)
    .map(Number)
    .filter((m) => R32_SLOTS[m]![1][0] === "T");
  const allowed = new Map<number, Set<string>>(
    tSlots.map((m) => [m, new Set((R32_SLOTS[m]![1][1]).split(""))]),
  );
  const solve = (
    i: number,
    used: Set<number>,
    acc: Record<number, string>,
  ): Record<number, string> | null => {
    if (i === qualifiedGroups.length) return acc;
    const g = qualifiedGroups[i]!;
    for (const m of tSlots) {
      if (!used.has(m) && allowed.get(m)!.has(g)) {
        const r = solve(i + 1, new Set([...used, m]), { ...acc, [m]: g });
        if (r) return r;
      }
    }
    return null;
  };
  return solve(0, new Set(), {});
};

export interface DerivedBracket {
  readonly standings: Record<string, TeamStanding[]>;
  readonly qualifiedThirdGroups: readonly string[];
  readonly fixtures: readonly MatchFixture[];
}

/**
 * Derive the real R32 fixtures from completed group matches. Returns the 16
 * fixtures (M73-M88) plus the standings used, for transparency.
 */
export const deriveR32 = (matches: readonly CompletedMatch[]): DerivedBracket => {
  const standings = computeStandings(matches);
  const firsts: Record<string, string> = {};
  const seconds: Record<string, string> = {};
  const thirds: Record<string, string> = {};
  for (const [g, rows] of Object.entries(standings)) {
    firsts[g] = rows[0]!.team;
    seconds[g] = rows[1]!.team;
    thirds[g] = rows[2]!.team;
  }

  // Best 8 third-placed teams by points -> GD -> GF.
  const thirdGroups = Object.keys(GROUPS_2026).sort((g1, g2) => {
    const a = standings[g1]![2]!;
    const b = standings[g2]![2]!;
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
  const qualifiedThirdGroups = thirdGroups.slice(0, 8).sort();
  const slotThird = assignThirds(qualifiedThirdGroups);
  if (!slotThird) throw new Error("third-place slot assignment failed");

  const srcTeam = (s: Slot, matchNo: number): string => {
    if (s[0] === "W") return firsts[s[1]]!;
    if (s[0] === "R") return seconds[s[1]]!;
    return thirds[slotThird[matchNo]!]!;
  };

  const fixtures: MatchFixture[] = Object.keys(R32_SLOTS)
    .map(Number)
    .sort((a, b) => a - b)
    .map((m) => {
      const [sa, sb] = R32_SLOTS[m]!;
      const a = srcTeam(sa, m);
      const b = srcTeam(sb, m);
      return {
        id: `fifwc-r32-m${m}-${slug(a)}-vs-${slug(b)}`,
        stage: "R32" as const,
        teamA: a,
        teamB: b,
        neutral: true,
        kickoffUtc: "",
      };
    });

  return { standings, qualifiedThirdGroups, fixtures };
};
