import fifa8Data from "./generated/fifa8-r32.generated.json";

// Market-blind Round-of-32 store for the FIFA 8-model comparison. The JSON is
// generated offline and statically imported (SSG, no runtime fs, no backend),
// and by policy carries no market prices — only model probabilities. Read-only
// accessors; callers never mutate the shared data.

export type Pick = "a" | "draw" | "b";
export type Tier = "high" | "medium" | "low";
export type ForecasterFamily = "statistical" | "elo" | "ml" | "ensemble";

export interface ForecasterMeta {
  readonly id: string;
  readonly name: string;
  readonly family: ForecasterFamily;
}

export interface HeadlineDriver {
  readonly label: string;
  readonly detail: string;
  readonly contributionPp: number;
}

export interface ForecasterRow {
  readonly id: string;
  readonly name: string;
  readonly family: ForecasterFamily;
  readonly a: number;
  readonly draw: number;
  readonly b: number;
  // Full rationale, so the per-match detail page can show how each model reasoned.
  readonly headline: string;
  readonly drivers: readonly HeadlineDriver[];
  readonly methodNote: string;
}

// Curated market-blind FIFA-stat card per team (the evidence the detail page renders).
export interface TeamStats {
  readonly elo: number;
  readonly matches: number;
  readonly xgFor: number;
  readonly xgAgainst: number;
  readonly possessionPct: number;
  readonly highPressPct: number;
  readonly counterAttackPct: number;
  readonly lowBlockPct: number;
  readonly highIntensityKm: number;
}

export interface Headline {
  readonly forecaster: string;
  readonly pick: Pick;
  readonly pickPct: number;
  readonly tier: Tier;
  readonly a: number;
  readonly draw: number;
  readonly b: number;
  readonly drivers: readonly HeadlineDriver[];
  readonly methodNote: string;
}

export interface Fifa8Fixture {
  readonly fixtureId: string;
  readonly matchNo: number;
  readonly stage: string;
  readonly teamA: string;
  readonly teamB: string;
  readonly statsA: TeamStats | null;
  readonly statsB: TeamStats | null;
  readonly headline: Headline;
  readonly forecasters: readonly ForecasterRow[];
}

interface Fifa8File {
  readonly generatedAt: string;
  readonly headlineForecaster: string;
  readonly marketBlind: boolean;
  readonly forecasterMeta: readonly ForecasterMeta[];
  readonly fixtures: readonly Fifa8Fixture[];
}

const data = fifa8Data as unknown as Fifa8File;

export function getFifa8Fixtures(): readonly Fifa8Fixture[] {
  return [...data.fixtures].sort((a, b) => a.matchNo - b.matchNo);
}

export function getForecasterMeta(): readonly ForecasterMeta[] {
  return data.forecasterMeta;
}

// The id of the multi-calibrated blend that drives every headline call, so the
// comparison table can flag which row is the published pick.
export function getHeadlineForecasterId(): string {
  return data.headlineForecaster;
}

export function getFifa8GeneratedAt(): string {
  return data.generatedAt;
}

// One fixture by its id — for the per-match detail page (/world-cup/knockout/[id]).
export function getFifa8FixtureById(id: string): Fifa8Fixture | undefined {
  return data.fixtures.find((f) => f.fixtureId === id);
}

export function getFifa8FixtureIds(): readonly string[] {
  return data.fixtures.map((f) => f.fixtureId);
}
