// Raven Delta — machine contracts for the news-impact analysis.
//
// The prompt guides the model's thinking; THIS file is the contract that
// guarantees correctness (see docs: prompt-philosophy — prompts guide,
// harness enforces). Every engine (LLM or rules fallback) must produce a
// DeltaAnalysis that parses against this schema before it reaches a user.

import { z } from "zod";

export const DIRECTIONS = ["bullish", "bearish", "mixed"] as const;
export const MAGNITUDES = ["small", "medium", "large"] as const;
export const CONFIDENCES = ["high", "medium", "low"] as const;
export const ACTIONS = ["buy", "add", "watch", "trim", "sell", "hedge", "avoid"] as const;
export const ENGINES = ["deepseek", "claude-cli", "rules"] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type Magnitude = (typeof MAGNITUDES)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type TradeAction = (typeof ACTIONS)[number];
export type EngineId = (typeof ENGINES)[number];

export const MAX_IMPACTED_STOCKS = 5;

// Input is deliberately minimal: paste the news text, optionally attach the
// URL. There is no self-declared "source" field — verification (who really
// reported this, and when it first appeared) is the ENGINE's job, not the
// caller's claim.
export const newsInputSchema = z.object({
  text: z.string().trim().min(1).max(6000),
  url: z.string().trim().url().max(500).optional(),
  // Machine feeds (e.g. a tweet timestamp) may pass this; the console doesn't.
  publishedAtUtc: z.string().trim().datetime({ offset: true }).optional(),
  locale: z.enum(["en", "zh"]).default("en")
});
export type NewsInput = z.infer<typeof newsInputSchema>;

// Display headline = first non-empty line of the pasted text.
export function headlineOf(text: string): string {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine ?? text.trim()).slice(0, 200);
}

const evidenceSchema = z.object({
  point: z.string().trim().min(1).max(500),
  source: z.string().trim().max(200).optional(),
  url: z.string().trim().url().max(500).optional()
});

const impactedStockSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/),
  company: z.string().trim().min(1).max(120),
  inUniverse: z.boolean(),
  direction: z.enum(DIRECTIONS),
  magnitude: z.enum(MAGNITUDES),
  expectedMovePct: z
    .object({ min: z.number().gte(-40).lte(40), max: z.number().gte(-40).lte(40) })
    .refine((range) => range.min <= range.max, { message: "expectedMovePct.min must be <= max" }),
  confidence: z.enum(CONFIDENCES),
  horizon: z.string().trim().min(1).max(80),
  reasoning: z.string().trim().min(1).max(1200),
  evidence: z.array(evidenceSchema).max(6),
  action: z.enum(ACTIONS),
  actionRationale: z.string().trim().min(1).max(500),
  risks: z.array(z.string().trim().min(1).max(300)).max(5)
});
export type ImpactedStock = z.infer<typeof impactedStockSchema>;

export const deltaAnalysisSchema = z.object({
  attention: z.object({
    worthAttention: z.boolean(),
    // 0-100: how much a US-equity desk should care about this headline NOW.
    score: z.number().gte(0).lte(100),
    verdict: z.string().trim().min(1).max(400),
    newsType: z.string().trim().min(1).max(80),
    credibilityNote: z.string().trim().min(1).max(400)
  }),
  // When did this news FIRST appear anywhere public? Freshness is the whole
  // game for news trading — staleness must be stated, never implied.
  timing: z.object({
    firstSeenUtc: z.string().trim().datetime({ offset: true }).nullable(),
    // How firstSeenUtc was established (web-search trace, caller timestamp,
    // or an honest "cannot verify in this mode").
    basis: z.string().trim().min(1).max(300)
  }),
  // How the market mechanism transmits this news (the "delta", not the level).
  marketReadout: z.string().trim().min(1).max(1200),
  impactedStocks: z.array(impactedStockSchema).max(MAX_IMPACTED_STOCKS),
  tradingPlan: z.string().trim().min(1).max(1200),
  limitations: z.array(z.string().trim().min(1).max(400)).min(1).max(6)
});
export type DeltaAnalysis = z.infer<typeof deltaAnalysisSchema>;

export interface RunStage {
  id: string;
  title: string;
  durationMs: number;
}

export interface DeliveryReceipt {
  channel: "email" | "websocket";
  status: "sent" | "simulated" | "skipped" | "failed";
  provider: string;
  target: string;
  detail: string;
  timestampUtc: string;
}

export interface DeltaRun {
  id: string;
  mode: "demo_read_only";
  engine: EngineId;
  // Set when the requested engine failed and the run degraded to `engine`.
  engineFallbackReason: string | null;
  generatedAtUtc: string;
  universeVersion: string;
  news: {
    headline: string;
    text: string;
    url: string | null;
    publishedAtUtc: string | null;
  };
  analysis: DeltaAnalysis;
  stages: RunStage[];
  delivery: DeliveryReceipt[];
}
