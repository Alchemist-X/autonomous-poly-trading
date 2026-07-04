// Wire shape of runtime-artifacts/pulse-live/<run>/recommendation.json — the
// "order basis" file written once per forecast run and consumed by the report
// renderers and the managed-trading bridge.
//
// IMPORTANT (see docs/internal/recommendation-json-operations-map.md):
// - The file is a camelCase WRAPPER; decisions[] inside it are snake_case
//   (decisionSchema) while executablePlans[] are camelCase. Both namings are
//   real and must stay modeled separately.
// - Stage 1 of the unification is COMPILE-TIME ONLY: the writer locks its
//   literal with `satisfies RecommendationFile` and readers derive their local
//   types from these schemas. Nothing calls .parse()/.safeParse() yet — the
//   two disk readers deliberately soft-read (strict runtime validation would
//   turn graceful degradation into aborted live runs; see the ops map).
import { z } from "zod";
import type { OverviewResponse } from "./public-api.js";
import { actionSchema, decisionSchema, orderTypeSchema, sideSchema } from "./trade-decision.js";

// Mirrors services/orchestrator/src/lib/execution-planning.ts PlannedExecution
// (mutual-assignability asserted there in lib/wire-assertions.ts).
export const plannedExecutionSchema = z.object({
  action: actionSchema,
  marketSlug: z.string(),
  eventSlug: z.string(),
  tokenId: z.string(),
  outcomeLabel: z.string().nullish(),
  side: sideSchema,
  notionalUsd: z.number(),
  bankrollRatio: z.number(),
  executionAmount: z.number(),
  unit: z.enum(["usd", "shares"]),
  thesisMd: z.string(),
  bestAsk: z.number().nullable(),
  bestBid: z.number().nullable(),
  minOrderSize: z.number().nullable(),
  exchangeMinNotionalUsd: z.number().nullable(),
  orderType: orderTypeSchema,
  gtcLimitPrice: z.number().nullable(),
  categorySlug: z.string().nullable(),
  negRisk: z.boolean()
});
export type PlannedExecutionWire = z.infer<typeof plannedExecutionSchema>;

// Mirrors execution-planning.ts SkippedDecision. Named "SkippedExecution*" to
// avoid worsening the existing name collision with managed-trading's own,
// structurally different SkippedDecision.
export const skippedExecutionSchema = z.object({
  action: actionSchema.nullable(),
  marketSlug: z.string(),
  tokenId: z.string().nullable(),
  reason: z.string()
});
export type SkippedExecutionWire = z.infer<typeof skippedExecutionSchema>;

// overview is typed (not validated): it is the OverviewResponse snapshot the
// writer embeds; a zod schema for it belongs to the (future) runtime-
// validation step, not the type-unification step.
const overviewResponseType = z.custom<OverviewResponse>(
  (value) => typeof value === "object" && value !== null
);

export const recommendationFileSchema = z.object({
  runId: z.string(),
  executionMode: z.string(),
  envFilePath: z.string().nullable(),
  collateralBalanceUsd: z.number(),
  overview: overviewResponseType,
  pulseMarkdownPath: z.string().nullable(),
  pulseJsonPath: z.string().nullable(),
  runtimeLogPath: z.string().nullable(),
  promptSummary: z.string(),
  reasoningMd: z.string(),
  decisions: z.array(decisionSchema),
  executablePlans: z.array(plannedExecutionSchema),
  skipped: z.array(skippedExecutionSchema)
});
export type RecommendationFile = z.infer<typeof recommendationFileSchema>;
