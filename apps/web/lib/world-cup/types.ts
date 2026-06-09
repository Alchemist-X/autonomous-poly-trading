import type { PredictionEngineRun } from "../prediction-engine-demo";

// The 2026 World Cup forecast report shape. It composes the existing
// PredictionEngineRun (stage UI, evidence, model nodes, updates) with
// football-specific match metadata and the public scoreboard fields.
// MVP note: statistical engines (Elo / Dixon-Coles / Monte Carlo) arrive in
// Phase 1. For now `modelSource` flags which inputs are real vs pending.

export type MatchOutcome = "home" | "draw" | "away";

export type WorldCupReportKind =
  | "match"
  | "tournament_winner"
  | "advance_group"
  | "top_scorer";

export interface OutcomeProbability {
  readonly outcome: MatchOutcome;
  readonly label: string;
  // Our model's probability for this outcome (0-1).
  readonly modelProbability: number;
  // Market-implied probability from Polymarket (0-1), null if unmapped.
  readonly marketProbability: number | null;
  // edge = model - market, expressed as a research signal (NOT a bet edge).
  readonly edge: number | null;
}

export interface ScoreboardEntry {
  // Three-way public scoreboard: us vs Kimi's published value vs the market.
  // Brier is filled after the match resolves; null until then.
  readonly source: "us" | "kimi" | "market";
  readonly label: string;
  readonly probabilityForActual: number | null;
  readonly brier: number | null;
  readonly note?: string;
}

export interface WorldCupMatchMeta {
  readonly matchId: string; // = Polymarket event_slug, e.g. fifwc-mex-rsa-2026-06-11
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly group?: string;
  readonly stage: string; // e.g. "小组赛 第1轮" / "Group stage MD1"
  readonly kickoffUtc: string | null;
  readonly venue?: string;
  readonly polymarketUrl?: string;
}

export interface WorldCupReport {
  readonly schemaVersion: 1;
  readonly meta: WorldCupMatchMeta;
  readonly kind: WorldCupReportKind;
  readonly generatedAtUtc: string;
  // Per-outcome 1X2 view (the football-native conclusion).
  readonly outcomes: readonly OutcomeProbability[];
  // The headline outcome we lead with (usually the favourite or the value pick).
  readonly headlineOutcome: MatchOutcome;
  readonly confidenceTier: "high" | "medium" | "low";
  readonly confidenceInterval: readonly [number, number];
  // Which inputs are real in this report (MVP transparency).
  readonly modelSource: {
    readonly statistical: boolean; // Elo/Poisson/MC — Phase 1
    readonly llm: boolean;
    readonly market: boolean;
  };
  readonly scoreboard: readonly ScoreboardEntry[];
  // Reuse the full stage/evidence/model UI payload from the prediction engine.
  readonly run: PredictionEngineRun;
  readonly resolvedOutcome: MatchOutcome | null;
  readonly disclaimerVersion: string;
}

export interface WorldCupReportSummary {
  readonly matchId: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly stage: string;
  readonly group?: string;
  readonly kickoffUtc: string | null;
  readonly headlineOutcome: MatchOutcome;
  readonly headlineProbability: number;
  readonly headlineEdge: number | null;
  readonly confidenceTier: "high" | "medium" | "low";
  readonly resolvedOutcome: MatchOutcome | null;
}

export function toSummary(report: WorldCupReport): WorldCupReportSummary {
  const headline = report.outcomes.find((o) => o.outcome === report.headlineOutcome);
  return {
    matchId: report.meta.matchId,
    homeTeam: report.meta.homeTeam,
    awayTeam: report.meta.awayTeam,
    stage: report.meta.stage,
    group: report.meta.group,
    kickoffUtc: report.meta.kickoffUtc,
    headlineOutcome: report.headlineOutcome,
    headlineProbability: headline?.modelProbability ?? 0,
    headlineEdge: headline?.edge ?? null,
    confidenceTier: report.confidenceTier,
    resolvedOutcome: report.resolvedOutcome
  };
}
