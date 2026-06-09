// Stage 3 producer — collect + list evidence into a typed sources database (Sonnet).
//
// Runs the stage-2 query plan's searches (injected runner, so it is testable without network),
// applies the spoiler firewall to every result, dedups, then makes ONE Sonnet enrichment call to
// categorize + summarize + map each record to the query-plan nodes it addresses. Enrichment is
// best-effort: on any failure the records are still built deterministically from the raw results.

import {
  type EvidenceSourceRecord,
  type QueryPlan,
  type SourceCategory,
  type SourcesDatabase
} from "./stage-artifacts.js";
import { isSpoilerSource, normalizeHost } from "./spoiler-firewall.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface RawSearchResult {
  url: string;
  host?: string;
  title?: string;
  snippet?: string;
  publishedAtUtc?: string;
}

export type StageSearchRunner = (input: { query: string; nodeId: string; category: SourceCategory }) => Promise<RawSearchResult[]>;

export interface SourcesDatabaseInput {
  marketSlug: string;
  queryPlan: QueryPlan;
  generatedAtUtc: string;
  runSearch: StageSearchRunner;
  callLlm: StageLlmCaller;
  maxRecords?: number;
}

const SOURCE_CATEGORIES: readonly SourceCategory[] = ["official", "mainstream", "local", "third-party", "military-map", "social"];

interface GatheredResult extends RawSearchResult {
  nodeId: string;
  category: SourceCategory;
}

interface EvidenceEnrichment {
  sourceCategory?: SourceCategory;
  summary?: string;
  addressedNodeIds?: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asCategory(value: unknown): SourceCategory | undefined {
  return typeof value === "string" && (SOURCE_CATEGORIES as readonly string[]).includes(value) ? (value as SourceCategory) : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

async function gather(input: SourcesDatabaseInput): Promise<GatheredResult[]> {
  const gathered: GatheredResult[] = [];
  for (const node of input.queryPlan.nodes) {
    for (const category of node.sourceCategories) {
      for (const query of category.queries) {
        const results = await input.runSearch({ query, nodeId: node.nodeId, category: category.category });
        for (const result of results) {
          gathered.push({ ...result, nodeId: node.nodeId, category: category.category });
        }
      }
    }
  }
  return gathered;
}

function firewallAndDedup(gathered: GatheredResult[], maxRecords?: number): GatheredResult[] {
  const seen = new Set<string>();
  const kept: GatheredResult[] = [];
  for (const result of gathered) {
    if (isSpoilerSource(result.url) || (result.host ? isSpoilerSource(result.host) : false)) continue;
    const key = result.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(result);
  }
  return typeof maxRecords === "number" ? kept.slice(0, Math.max(0, maxRecords)) : kept;
}

function buildEnrichmentPrompt(results: GatheredResult[], queryPlan: QueryPlan): string {
  const nodeList = queryPlan.nodes.map((node) => `- ${node.nodeId}: ${node.label}`).join("\n");
  const items = results
    .map((result, index) => `[${index}] (${result.category}) ${result.host ?? normalizeHost(result.url)} | ${result.title ?? ""} | ${result.snippet ?? ""}`)
    .join("\n");
  return [
    "You are the evidence-collection stage of an independent forecasting pipeline.",
    "For each search result below, categorize the source, write a one-line factual summary, and list",
    "which event nodes it bears on. Do NOT reference market prices or odds.",
    "",
    "Event nodes:",
    nodeList,
    "",
    "Search results (index, category-hint, host, title, snippet):",
    items,
    "",
    "Return ONLY a JSON array aligned by index, one object per result:",
    '[ { "sourceCategory": "official"|"mainstream"|"local"|"third-party"|"military-map"|"social",',
    '    "summary": string, "addressedNodeIds": string[] } ]'
  ].join("\n");
}

async function enrich(results: GatheredResult[], input: SourcesDatabaseInput): Promise<EvidenceEnrichment[]> {
  try {
    const response = await input.callLlm({
      prompt: buildEnrichmentPrompt(results, input.queryPlan),
      label: `sources:${input.marketSlug}`,
      model: modelForStage("sources")
    });
    if (!Array.isArray(response.json)) return [];
    return response.json.map((item) => {
      const record = asRecord(item);
      return {
        sourceCategory: asCategory(record.sourceCategory),
        summary: asText(record.summary),
        addressedNodeIds: asStringArray(record.addressedNodeIds)
      };
    });
  } catch {
    return [];
  }
}

export async function buildSourcesDatabase(input: SourcesDatabaseInput): Promise<SourcesDatabase> {
  const kept = firewallAndDedup(await gather(input), input.maxRecords);
  const enrichment = kept.length > 0 ? await enrich(kept, input) : [];
  const validNodeIds = new Set(input.queryPlan.nodes.map((node) => node.nodeId));

  const records: EvidenceSourceRecord[] = kept.map((result, index) => {
    const extra = enrichment[index] ?? {};
    const addressed = (extra.addressedNodeIds ?? [result.nodeId]).filter((id) => validNodeIds.has(id));
    return {
      recordId: `src-${index + 1}`,
      sourceUrl: result.url,
      sourceHost: normalizeHost(result.host ?? result.url),
      sourceCategory: extra.sourceCategory ?? result.category,
      retrievedAtUtc: input.generatedAtUtc,
      retrievedVia: "web-search",
      title: result.title,
      publishedAtUtc: result.publishedAtUtc,
      snippet: result.snippet,
      summary: extra.summary,
      addressedNodeIds: addressed.length > 0 ? addressed : (validNodeIds.has(result.nodeId) ? [result.nodeId] : [])
    };
  });

  const byCategory: Partial<Record<SourceCategory, number>> = {};
  for (const record of records) {
    byCategory[record.sourceCategory] = (byCategory[record.sourceCategory] ?? 0) + 1;
  }
  const publishedDates = records
    .map((record) => record.publishedAtUtc)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    marketSlug: input.marketSlug,
    fetchedAtUtc: input.generatedAtUtc,
    records,
    summary: {
      totalRecords: records.length,
      byCategory,
      oldestPublishedAtUtc: publishedDates[0],
      newestPublishedAtUtc: publishedDates[publishedDates.length - 1]
    }
  };
}
