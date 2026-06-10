// Stage 2 producer — base reasoning + search-query design.
//
// Decomposes the event into necessary-condition nodes (QUERY_PLAN_NODE_MIN..MAX), each with
// source-category-tagged search queries. The independent-forecasting firewall is enforced in CODE
// (not just the prompt): any query that names a prediction market / odds / sportsbook is stripped
// before the plan is returned, and the planned total is recomputed from what survives. The
// deterministic validator runs on the coerced plan and its findings are recorded in `gaps`
// (never thrown) so downstream stages can see structural problems.

import {
  QUERY_PLAN_NODE_MAX,
  QUERY_PLAN_NODE_MIN,
  SOURCE_CATEGORIES,
  validateQueryPlan,
  type QueryPlan,
  type QueryPlanNode,
  type QueryPlanSourceCategory
} from "./stage-artifacts.js";
import { asEnumValue, asRecord, asStringArray, asText } from "./stage-coerce.js";
import { stripSpoilerQueries } from "./spoiler-firewall.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface QueryPlanInput {
  marketSlug: string;
  eventSlug?: string;
  question: string;
  categoryLabel?: string | null;
  tags?: string[];
  generatedAtUtc: string;
  callLlm: StageLlmCaller;
}

function coerceSourceCategory(value: unknown): QueryPlanSourceCategory {
  const record = asRecord(value);
  return {
    category: asEnumValue(record.category, SOURCE_CATEGORIES) ?? "third-party",
    queries: stripSpoilerQueries(asStringArray(record.queries)),
    expectedEvidence: asStringArray(record.expectedEvidence)
  };
}

function coerceNode(value: unknown, index: number): QueryPlanNode {
  const record = asRecord(value);
  const sourceCategories = (Array.isArray(record.sourceCategories) ? record.sourceCategories : [])
    .map(coerceSourceCategory)
    .filter((category) => category.queries.length > 0);
  const weight = typeof record.weight === "number" && Number.isFinite(record.weight) ? record.weight : undefined;
  return {
    nodeId: asText(record.nodeId) ?? `node-${index + 1}`,
    label: asText(record.label) ?? `Node ${index + 1}`,
    condition: asText(record.condition) ?? "",
    weight,
    timeframe: asText(record.timeframe),
    sourceCategories
  };
}

function countQueries(nodes: QueryPlanNode[]): number {
  return nodes.reduce((total, node) => total + node.sourceCategories.reduce((sum, sc) => sum + sc.queries.length, 0), 0);
}

export function buildQueryPlanPrompt(input: QueryPlanInput): string {
  return [
    "You are the search-query-design stage of an independent forecasting pipeline.",
    `Decompose this event into ${QUERY_PLAN_NODE_MIN} to ${QUERY_PLAN_NODE_MAX} necessary-condition nodes (the things that must each happen`,
    "for the event to resolve Yes), and design source-specific search queries to gather evidence",
    "for each node. You are deliberately NOT given the market price, and you MUST NOT generate any",
    "query that targets a prediction market, sportsbook, odds aggregator, or betting site",
    "(e.g. Polymarket, Kalshi, oddschecker) — the reasoning must stay independent of market pricing.",
    "",
    `Question: ${input.question}`,
    input.categoryLabel ? `Category: ${input.categoryLabel}` : "",
    input.tags && input.tags.length ? `Tags: ${input.tags.join(", ")}` : "",
    "",
    "Return ONLY a JSON object:",
    "{",
    '  "nodes": [',
    "    {",
    '      "nodeId": string,',
    '      "label": string,',
    '      "condition": string,',
    '      "weight": number | null,  // optional importance, nodes should sum to ~1 if provided',
    '      "timeframe": string | null,  // optional window in which the condition must hold',
    '      "sourceCategories": [',
    '        { "category": "official"|"mainstream"|"local"|"third-party"|"military-map"|"social",',
    '          "queries": string[], "expectedEvidence": string[] }',
    "      ]",
    "    }",
    "  ],",
    '  "baseQueries": string[]  // a few broad fallback queries',
    "}",
    `Use ${QUERY_PLAN_NODE_MIN}-${QUERY_PLAN_NODE_MAX} nodes. Each node needs at least one query. Do not name any betting/odds/market site.`
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function coerceQueryPlan(json: unknown, input: QueryPlanInput): QueryPlan {
  const record = asRecord(json);
  const nodes = (Array.isArray(record.nodes) ? record.nodes : []).map(coerceNode);
  const baseQueries = stripSpoilerQueries(asStringArray(record.baseQueries));
  const plan: QueryPlan = {
    marketSlug: input.marketSlug,
    eventSlug: input.eventSlug,
    generatedAtUtc: input.generatedAtUtc,
    nodes,
    baseQueries,
    totalQueriesPlanned: countQueries(nodes)
  };
  // Audit with the deterministic validator; findings are recorded, never thrown, so the pipeline
  // can degrade gracefully while downstream stages still see the structural problems.
  const validation = validateQueryPlan(plan);
  return validation.ok ? plan : { ...plan, gaps: validation.errors };
}

export async function buildQueryPlan(input: QueryPlanInput): Promise<QueryPlan> {
  const prompt = buildQueryPlanPrompt(input);
  const response = await input.callLlm({ prompt, label: `query-plan:${input.marketSlug}`, model: modelForStage("query_plan") });
  return coerceQueryPlan(response.json, input);
}
