// Delta PM machine contracts. The prompt guides the model's thinking; THIS
// file is the contract that guarantees correctness (repo doctrine: prompts
// guide, harness enforces). Every module boundary payload must parse against
// these schemas before it crosses the boundary.
//
// PRD: docs/us-stock-trading-prd.md (v1.1, 2026-08-22).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Universe

export const LIQUIDITY_TIERS = [1, 2, 3] as const;

export const universeEntrySchema = z.object({
  ticker: z.string().regex(/^[A-Z][A-Z0-9.\-]{0,9}$/),
  company: z.string().min(1),
  companyZh: z.string().min(1),
  hlSymbol: z.string().regex(/^xyz:[A-Z0-9]+$/),
  group: z.enum(["mag7", "storage", "semis", "ai-infra", "narrative", "pre-ipo"]),
  tags: z.array(z.string()).min(1),
  aliases: z.array(z.string()).min(1),
  // β benchmark for excess-return computation. null = raw reaction (pre-IPO).
  benchmark: z.enum(["XYZ100", "SP500"]).nullable(),
  liquidityTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  marginMode: z.enum(["cross", "isolated"]),
  maxLeverageOnVenue: z.number().int().positive(),
  preIpo: z.boolean().default(false),
  // Ops-maintained: next scheduled earnings (null = unknown / not applicable).
  nextEarningsUtc: z.string().datetime({ offset: true }).nullable().default(null),
  // Ops/agent-maintained consensus baseline the surprise gate scores against.
  consensusBaseline: z
    .object({ text: z.string().min(1), asOfUtc: z.string().datetime({ offset: true }) })
    .nullable()
    .default(null)
});
export type UniverseEntry = z.infer<typeof universeEntrySchema>;

export const universeFileSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  stocks: z.array(universeEntrySchema).min(1)
});
export type UniverseFile = z.infer<typeof universeFileSchema>;

// ---------------------------------------------------------------------------
// News ingest (The Information Atom feed / manual paste / future adapters)

export const newsItemSchema = z.object({
  id: z.string().min(1), // stable feed entry id (dedupe key)
  source: z.string().min(1), // "the-information"
  kind: z.enum(["article", "briefing", "manual"]),
  title: z.string().min(1),
  teaser: z.string().default(""),
  fullText: z.string().nullable().default(null), // from manual paste / newsletter
  url: z.string().url().nullable().default(null),
  author: z.string().nullable().default(null),
  // t0 candidate. For "reportedly" items the engine must verify firstSeen.
  publishedUtc: z.string().datetime({ offset: true }),
  updatedUtc: z.string().datetime({ offset: true }).nullable().default(null),
  prefix: z.enum(["exclusive", "reportedly", "none"]).default("none"),
  fetchedAtUtc: z.string().datetime({ offset: true })
});
export type NewsItem = z.infer<typeof newsItemSchema>;

// ---------------------------------------------------------------------------
// M1 — materiality + priced-in

export const DIRECTIONS = ["bullish", "bearish", "mixed"] as const;
export const IMPACT_BANDS = ["small", "medium", "large"] as const;
// Coarse impact bands in |excess move| % — used before M2 refines.
export const IMPACT_BAND_PCT: Record<(typeof IMPACT_BANDS)[number], { min: number; max: number }> = {
  small: { min: 0.5, max: 2 },
  medium: { min: 2, max: 6 },
  large: { min: 6, max: 20 }
};

export const materialitySchema = z.object({
  tradeable: z.boolean(),
  score: z.number().min(0).max(100),
  eventType: z.enum([
    "earnings_guidance",
    "order_contract",
    "mna",
    "product_tech",
    "regulatory_legal",
    "management",
    "supply_chain",
    "macro_direct",
    "other"
  ]),
  factLevel: z.enum(["fact", "forecast", "opinion"]),
  tickers: z.array(z.string()).max(3), // universe tickers, headline actors only
  surpriseNote: z.string().min(1), // what is beyond the consensus baseline
  reason: z.string().min(1)
});
export type Materiality = z.infer<typeof materialitySchema>;

export const PRICED_IN_STATUSES = ["none", "partial", "full", "leaked", "reverse", "awaiting_market"] as const;

export const pricedInSchema = z.object({
  status: z.enum(PRICED_IN_STATUSES),
  tEvalUtc: z.string().datetime({ offset: true }),
  deltaTMinutes: z.number().min(0), // t_eval − t0, calibration key
  realizedExcessPct: z.number().nullable(), // β-adjusted move since t0 (null when awaiting)
  volumeZ: z.number().nullable(),
  dataBasis: z.enum(["hl_perp"]), // sole market-data source in V1
  sessionBucket: z.enum(["rth", "offhours", "weekend"]),
  benchmarkUsed: z.enum(["XYZ100", "SP500", "none"]),
  betaUsed: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().min(1)
});
export type PricedIn = z.infer<typeof pricedInSchema>;

// Result of the gate-time cross-source coverage search: did anyone publish
// this story BEFORE our item's timestamp? Powers first-seen verification for
// "Reportedly" items and shifts gate-2 t0 earlier (the safe direction: an
// earlier t0 counts more of the realized move as already-priced).
export const priorCoverageSchema = z.object({
  searched: z.boolean(), // false = skipped (no key/disabled) or errored
  skippedReason: z.string().nullable(),
  error: z.string().nullable(),
  query: z.string().nullable(),
  priorHitCount: z.number().int().min(0), // same-story hits published before t0
  earliestPriorUtc: z.string().datetime({ offset: true }).nullable(),
  hits: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        domain: z.string(),
        publishedUtc: z.string().datetime({ offset: true }).nullable(),
        titleSimilarity: z.number().min(0).max(1)
      })
    )
    .max(8)
});
export type PriorCoverage = z.infer<typeof priorCoverageSchema>;

export const newsSignalSchema = z.object({
  id: z.string().min(1),
  newsId: z.string().min(1),
  fingerprint: z.string().min(1), // hash(entities + eventType + magnitudes)
  firstSeenUtc: z.string().datetime({ offset: true }).nullable(),
  firstSeenBasis: z.string().min(1),
  expectedDirection: z.enum(DIRECTIONS),
  coarseImpactBand: z.enum(IMPACT_BANDS),
  consensusBaselineAsOf: z.string().nullable(), // baseline version the surprise was scored against
  materiality: materialitySchema,
  pricedIn: pricedInSchema.nullable(), // null until gate 2 ran (immaterial items skip it)
  priorCoverage: priorCoverageSchema.nullable().default(null), // null on pre-coverage-check archives
  createdAtUtc: z.string().datetime({ offset: true })
});
export type NewsSignal = z.infer<typeof newsSignalSchema>;

// ---------------------------------------------------------------------------
// M2 — trade thesis

export const impactStepSchema = z.object({
  step: z.string().min(1), // e.g. "FY27 datacenter revenue +$2.5B (assumes ...)"
  value: z.string().min(1)
});

export const evidenceSchema = z.object({
  point: z.string().min(1),
  source: z.string().nullable().default(null),
  url: z.string().url().nullable().default(null),
  credibility: z.enum(["high", "medium", "low"]).default("medium")
});

export const tradeThesisSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  ticker: z.string().min(1),
  direction: z.enum(["long", "short"]),
  tradeType: z.literal("event"), // V1: short-horizon event trades only
  // Fair |excess| impact vs the pre-news baseline, price-reaction-blind.
  fairImpactPct: z
    .object({ min: z.number().gte(-40).lte(40), max: z.number().gte(-40).lte(40), point: z.number().gte(-40).lte(40) })
    .refine((r) => r.min <= r.point && r.point <= r.max, { message: "min <= point <= max required" }),
  impactPath: z.array(impactStepSchema).min(1).max(8),
  evidence: z.array(evidenceSchema).max(8),
  contamination: z.enum(["none", "soft", "hard"]), // post-t0 price anchoring detected
  horizonHours: z.number().positive().max(24 * 14), // event trades: hours to ~2 weeks
  catalysts: z.array(z.string().min(1)).max(5),
  falsifiers: z.array(z.string().min(1)).min(1).max(5),
  limitations: z.array(z.string().min(1)).max(6),
  confidence: z.enum(["high", "medium", "low"]),
  provider: z.string().min(1), // engine that produced this (deepseek/claude-cli/rules)
  createdAtUtc: z.string().datetime({ offset: true })
});
export type TradeThesis = z.infer<typeof tradeThesisSchema>;

// ---------------------------------------------------------------------------
// M3 — PM decision

export const PM_ACTIONS = ["open", "add", "trim", "close", "flip", "no_trade"] as const;

// Full decision arithmetic for human audit (the hedge-fund IC-memo view):
// every number that produced the decision, itemized — never just a verdict.
export const decisionAuditSchema = z.object({
  vetoedBy: z.string().nullable(), // pre-arithmetic veto (halted/cooldown/earnings/...), null when arithmetic ran
  edge: z
    .object({
      conservativePct: z.number(), // fairImpact conservative end
      pointPct: z.number(),
      realizedPct: z.number(), // excess realized since t0 at decision time
      residualPct: z.number() // conservative − realized, signed toward trade direction
    })
    .nullable(),
  threshold: z
    .object({
      takerFeePct: z.number(),
      slippagePct: z.number(),
      fundingPct: z.number(), // signed holding-period funding cost (floored at 0)
      roundTripPct: z.number(),
      costFloorPct: z.number(), // entryCostMultiple × roundTrip
      volFloorPct: z.number(), // entryVolFraction × dailyVol × holdFactor
      thresholdPct: z.number() // max(costFloor, volFloor)
    })
    .nullable(),
  stopMenu: z
    .object({
      atr20d: z.number(),
      atrStopPx: z.number(),
      swingPx: z.number().nullable(),
      hardFloorPx: z.number(),
      chosenPx: z.number(),
      stopDistPct: z.number()
    })
    .nullable(),
  sizing: z
    .object({
      equityUsd: z.number(),
      riskBudgetPct: z.number(),
      intendedNotionalUsd: z.number(),
      guards: z.array(
        z.object({
          name: z.string(), // tier1_cap / gross_cap / net_cap / cluster_cap:<tag> / isolated_margin_cap
          capUsd: z.number(),
          notionalAfterUsd: z.number(),
          clipped: z.boolean()
        })
      ),
      finalNotionalUsd: z.number(),
      leverage: z.object({ configCap: z.number(), volCap: z.number(), venueCap: z.number(), chosen: z.number() })
    })
    .nullable(),
  marketView: z
    .object({
      markPx: z.number(),
      dailyVolPct: z.number(),
      maxDailyMovePct: z.number(),
      fundingHourly: z.number().nullable(),
      beta: z.number().nullable()
    })
    .nullable()
});
export type DecisionAudit = z.infer<typeof decisionAuditSchema>;

export const pmDecisionSchema = z.object({
  id: z.string().min(1),
  thesisId: z.string().nullable(), // null for pure risk-driven exits (stop/floor)
  ticker: z.string().min(1),
  action: z.enum(PM_ACTIONS),
  direction: z.enum(["long", "short"]).nullable(),
  refPx: z.number().positive().nullable(), // mark used for the decision
  sizeUsd: z.number().nonnegative(),
  leverage: z.number().positive().max(20).nullable(),
  // Deterministic stop menu output — fully replayable.
  stop: z
    .object({
      initialPx: z.number().positive(),
      hardFloorPx: z.number().positive(), // −20% user rule
      rule: z.string().min(1), // e.g. "max(entry-1.5*ATR20d, swingLow)"
      atr20d: z.number().nonnegative(),
      trailArmed: z.boolean()
    })
    .nullable(),
  targetPctExcess: z.object({ lo: z.number(), hi: z.number() }).nullable(), // valuation-track target, excess frame
  horizonUtc: z.string().datetime({ offset: true }).nullable(),
  intendedRiskPct: z.number().nonnegative().nullable(),
  realizedRiskPct: z.number().nonnegative().nullable(),
  bindingConstraint: z.string().nullable(), // which guard clipped the size
  residualEdgePct: z.number().nullable(),
  reason: z.string().min(1),
  audit: decisionAuditSchema.nullable().default(null),
  createdAtUtc: z.string().datetime({ offset: true })
});
export type PMDecision = z.infer<typeof pmDecisionSchema>;

// ---------------------------------------------------------------------------
// Book state (paper)

export const positionSchema = z.object({
  ticker: z.string().min(1),
  hlSymbol: z.string().min(1),
  direction: z.enum(["long", "short"]),
  qty: z.number().positive(), // contracts (underlying units)
  entryPx: z.number().positive(),
  entryUtc: z.string().datetime({ offset: true }),
  notionalUsdAtEntry: z.number().positive(),
  leverage: z.number().positive(),
  stopPx: z.number().positive(),
  hardFloorPx: z.number().positive(),
  targetPctExcess: z.object({ lo: z.number(), hi: z.number() }).nullable(),
  horizonUtc: z.string().datetime({ offset: true }),
  extendedOnce: z.boolean().default(false),
  thesisId: z.string(),
  decisionId: z.string(),
  signalT0Utc: z.string().datetime({ offset: true }),
  baselinePx: z.number().positive(), // px at t0 (excess-frame anchor)
  benchmarkBaselinePx: z.number().positive().nullable(),
  beta: z.number().nullable(),
  trailArmed: z.boolean().default(false),
  highestClosePx: z.number().positive().nullable().default(null)
});
export type Position = z.infer<typeof positionSchema>;

export const portfolioSchema = z.object({
  mode: z.literal("shadow"), // Phase 0: decisions are recorded, never filled for real
  initialCapitalUsd: z.number().positive(),
  realizedPnlUsd: z.number(),
  positions: z.array(positionSchema),
  halted: z.boolean().default(false),
  haltedReason: z.string().nullable().default(null),
  // ticker -> ISO ts of last stop-out (cooldown bookkeeping)
  lastStopOutUtc: z.record(z.string()).default({}),
  updatedAtUtc: z.string().datetime({ offset: true })
});
export type Portfolio = z.infer<typeof portfolioSchema>;

// ---------------------------------------------------------------------------
// Console status contract (read by apps/delta-pm-console via lenient decode;
// keep this shape additive-only).

export const RUN_STAGES = ["ingest", "gate1", "gate2", "analysis", "decision", "done"] as const;
export type RunStage = (typeof RUN_STAGES)[number];

export interface RunStatus {
  runId: string;
  newsId: string;
  title: string;
  tickers: string[];
  stage: RunStage;
  stagePct: number; // 0-100 overall progress estimate
  outcome: string | null; // e.g. "archived: full priced-in" / "decision: open NVDA long"
  startedAtUtc: string;
  updatedAtUtc: string;
  stages: Array<{ stage: RunStage; status: "pending" | "running" | "done" | "skipped"; note?: string }>;
}

export interface StatusSnapshot {
  service: { name: string; version: string; mode: "shadow"; startedAtUtc: string; nowUtc: string };
  feed: { lastPollUtc: string | null; lastNewItemUtc: string | null; seenCount: number; lastError: string | null };
  market: { lastSweepUtc: string | null; archivedCoins: number; lastError: string | null };
  portfolio: {
    equityUsd: number;
    initialCapitalUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    halted: boolean;
    haltedReason: string | null;
    positions: Array<{
      ticker: string;
      direction: "long" | "short";
      qty: number;
      entryPx: number;
      markPx: number | null;
      notionalUsd: number;
      unrealizedPnlUsd: number | null;
      unrealizedPnlPct: number | null;
      stopPx: number;
      hardFloorPx: number;
      horizonUtc: string;
      thesisId: string;
    }>;
  };
  activeRuns: RunStatus[];
  recentRuns: RunStatus[];
  recentSignals: Array<{
    signalId: string;
    newsId: string; // the paste-full-text seam re-ingests by news id
    title: string;
    tickers: string[];
    pricedInStatus: string | null;
    materialityScore: number;
    tradeable: boolean;
    createdAtUtc: string;
  }>;
}

// ---------------------------------------------------------------------------
// Ledger events (append-only journal). Keep the union open-ended via type.

export const LEDGER_EVENT_TYPES = [
  "service_start",
  "news_seen",
  "signal_created",
  "signal_archived",
  "thesis_created",
  "decision",
  "paper_open",
  "paper_close",
  "stop_loss",
  "hard_floor_stop",
  "halt",
  "resume",
  "reflection_written",
  "error"
] as const;

export interface LedgerEvent {
  ts: string;
  type: (typeof LEDGER_EVENT_TYPES)[number];
  [key: string]: unknown;
}
