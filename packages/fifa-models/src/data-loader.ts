/**
 * Load real extracted FIFA data + repo fixtures into a TournamentData the engine
 * can run on. Everything here is market-blind: Elo priors and on-pitch stats only.
 *
 *   team-match-stats.json   (from extract/fifa_extract.py)  -> CompletedMatch[]
 *   elo-table.json          (eloratings.net snapshot)        -> TeamPrior map
 *   bracket-prediction.json (repo, matches 73-104)           -> MatchFixture[]
 */

import { readFile } from "node:fs/promises";
import type {
  CompletedMatch,
  KnockoutStage,
  MatchFixture,
  TeamMatchStats,
  TeamPrior,
} from "./types.js";
import { buildProfiles } from "./profile.js";
import { deriveR32, type TeamStanding } from "./bracket.js";
import type { TournamentData } from "./orchestrator.js";

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8"));

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** elo-table.json is `{teams: {Name: {elo}}}` (or a flat `{Name: {elo}}`). */
export const loadPriors = async (eloTablePath: string): Promise<Map<string, TeamPrior>> => {
  const raw = (await readJson(eloTablePath)) as Record<string, unknown>;
  const teams = (raw.teams ?? raw) as Record<string, { elo?: number }>;
  const priors = new Map<string, TeamPrior>();
  for (const [team, v] of Object.entries(teams)) {
    if (v && typeof v.elo === "number") {
      priors.set(team, { team, elo: v.elo, squadValueIndex: null });
    }
  }
  return priors;
};

/** Pair the two extracted perspectives per matchId into CompletedMatch[]. */
export const loadCompletedMatches = async (statsPath: string): Promise<CompletedMatch[]> => {
  const stats = (await readJson(statsPath)) as TeamMatchStats[];
  const byMatch = new Map<string, TeamMatchStats[]>();
  for (const s of stats) {
    const list = byMatch.get(s.matchId) ?? [];
    list.push(s);
    byMatch.set(s.matchId, list);
  }
  const matches: CompletedMatch[] = [];
  for (const [matchId, pair] of byMatch) {
    if (pair.length !== 2) continue; // need both perspectives
    const [home, away] = pair as [TeamMatchStats, TeamMatchStats];
    const result =
      home.goalsFor > home.goalsAgainst ? "home" : home.goalsFor < home.goalsAgainst ? "away" : "draw";
    matches.push({ home, away, date: home.date, neutral: home.neutral, result });
    void matchId;
  }
  // Chronological order matters for the sequential Elo updates.
  return matches.sort((a, b) => a.date.localeCompare(b.date));
};

interface BracketEntry {
  readonly match: number;
  readonly a: string;
  readonly b: string;
}

/** Map a bracket round (default Round of 32 = matches 73-88) into fixtures. */
export const loadFixturesFromBracket = async (
  bracketPath: string,
  round: "R32" | "R16" | "QF" | "SF" | "F" = "R32",
): Promise<MatchFixture[]> => {
  const bracket = (await readJson(bracketPath)) as Record<string, BracketEntry[]>;
  const entries = bracket[round] ?? [];
  const stage = round as KnockoutStage;
  return entries.map((e) => ({
    id: `fifwc-r32-m${e.match}-${slug(e.a)}-vs-${slug(e.b)}`,
    stage,
    teamA: e.a,
    teamB: e.b,
    neutral: true, // knockout venues vary; no host bonus (mc-sim convention)
    kickoffUtc: "",
  }));
};

export interface LoadOptions {
  readonly statsPath: string;
  readonly eloTablePath: string;
  readonly bracketPath: string;
  readonly round?: "R32" | "R16" | "QF" | "SF" | "F";
}

/** Assemble a full TournamentData from extracted stats + priors + a bracket file. */
export const buildTournamentData = async (opts: LoadOptions): Promise<TournamentData> => {
  const [priors, matches, fixtures] = await Promise.all([
    loadPriors(opts.eloTablePath),
    loadCompletedMatches(opts.statsPath),
    loadFixturesFromBracket(opts.bracketPath, opts.round ?? "R32"),
  ]);
  const allStats = matches.flatMap((m) => [m.home, m.away]);
  const profiles = buildProfiles(allStats, priors);
  return { matches, profiles, priors, fixtures };
};

export interface LiveTournamentData extends TournamentData {
  readonly standings: Record<string, TeamStanding[]>;
  readonly qualifiedThirdGroups: readonly string[];
}

/**
 * Load ACTUAL R32 fixtures from a ground-truth bracket file (the real matchups,
 * e.g. read from Polymarket event structure). Our derived bracket gets the
 * winner/runner slots right but the third-place slot assignment is an approximation
 * of FIFA's official combination table, so for live forecasting we use the real
 * matchups. The Polymarket slug becomes the fixture id, so the baseline/results
 * scripts can look the market up directly by slug (no fuzzy name matching).
 */
export const loadActualFixtures = async (bracketFile: string): Promise<MatchFixture[]> => {
  const arr = (await readJson(bracketFile)) as Array<{
    slug?: string;
    date?: string;
    teamA: string;
    teamB: string;
  }>;
  return arr.map((e) => ({
    id: e.slug ?? `fifwc-r32-${slug(e.teamA)}-vs-${slug(e.teamB)}`,
    stage: "R32" as const,
    teamA: e.teamA,
    teamB: e.teamB,
    neutral: true,
    kickoffUtc: e.date ? `${e.date}T00:00:00Z` : "",
  }));
};

/** Live path using the REAL R32 matchups (from a ground-truth bracket file). */
export const buildActualTournamentData = async (opts: {
  readonly statsPath: string;
  readonly eloTablePath: string;
  readonly bracketFile: string;
}): Promise<LiveTournamentData> => {
  const [priors, matches, fixtures] = await Promise.all([
    loadPriors(opts.eloTablePath),
    loadCompletedMatches(opts.statsPath),
    loadActualFixtures(opts.bracketFile),
  ]);
  const derived = deriveR32(matches); // standings only (for display/transparency)
  const allStats = matches.flatMap((m) => [m.home, m.away]);
  const profiles = buildProfiles(allStats, priors);
  return {
    matches,
    profiles,
    priors,
    fixtures,
    standings: derived.standings,
    qualifiedThirdGroups: derived.qualifiedThirdGroups,
  };
};

/**
 * Live path: load extracted stats + priors, then DERIVE the real R32 bracket from
 * the actual group results (not the MC-predicted bracket, which has wrong matchups).
 */
export const buildLiveTournamentData = async (opts: {
  readonly statsPath: string;
  readonly eloTablePath: string;
}): Promise<LiveTournamentData> => {
  const [priors, matches] = await Promise.all([
    loadPriors(opts.eloTablePath),
    loadCompletedMatches(opts.statsPath),
  ]);
  const derived = deriveR32(matches);
  const allStats = matches.flatMap((m) => [m.home, m.away]);
  const profiles = buildProfiles(allStats, priors);
  return {
    matches,
    profiles,
    priors,
    fixtures: derived.fixtures,
    standings: derived.standings,
    qualifiedThirdGroups: derived.qualifiedThirdGroups,
  };
};
