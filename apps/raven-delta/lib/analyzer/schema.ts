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

export const newsInputSchema = z.object({
  headline: z.string().trim().min(1).max(500),
  body: z.string().trim().max(4000).optional(),
  source: z.string().trim().max(140).optional(),
  url: z.string().trim().url().max(500).optional(),
  publishedAtUtc: z.string().trim().datetime({ offset: true }).optional(),
  locale: z.enum(["en", "zh"]).default("en")
});
export type NewsInput = z.infer<typeof newsInputSchema>;

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
    body: string | null;
    source: string | null;
    url: string | null;
    publishedAtUtc: string;
  };
  analysis: DeltaAnalysis;
  stages: RunStage[];
  delivery: DeliveryReceipt[];
}
