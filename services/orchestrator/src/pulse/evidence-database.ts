// Stage 3 producer — collect + list evidence into a typed sources database (Sonnet).
//
// Runs the stage-2 query plan's searches (injected runner, so it is testable without network),
// applies the spoiler firewall to every result (host AND content level), dedups, then makes ONE
// Sonnet enrichment call to categorize + summarize + map each record to the query-plan nodes it
// addresses. Enrichment is best-effort and index-keyed: every response object must carry the
// integer index of the search result it describes, so a partial or shuffled response can never
// silently misalign records. On any failure the records are still built deterministically from
// the raw results. When every node-level query comes back empty, the plan's baseQueries run as a
// designed fallback.

import {
  SOURCE_CATEGORIES,
  type EvidenceSourceRecord,
  type QueryPlan,
  type SourceCategory,
  type SourcesDatabase
} from "./stage-artifacts.js";
import { isSpoilerSource, normalizeHost, textMentionsSpoiler } from "./spoiler-firewall.js";
import { asEnumValue, asIndex, asRecord, asStringArray, asText, sanitizeForPrompt } from "./stage-coerce.js";
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

interface GatheredResult extends RawSearchResult {
  nodeId: string;
  category: SourceCategory;
}

interface EvidenceEnrichment {
  sourceCategory?: SourceCategory;
  summary?: string;
  addressedNodeIds?: string[];
}

async function runSearchSafely(
  runSearch: StageSearchRunner,
  query: string,
  nodeId: string,
  category: SourceCategory
): Promise<GatheredResult[]> {
  try {
    const results = await runSearch({ query, nodeId, category });
    return results.map((result) => ({ ...result, nodeId, category }));
  } catch {
    // One failing provider call must skip only that query, never abort the whole stage.
    return [];
  }
}

async function gather(input: SourcesDatabaseInput): Promise<GatheredResult[]> {
  const batches: GatheredResult[][] = [];
  for (const node of input.queryPlan.nodes) {
    for (const category of node.sourceCategories) {
      for (const query of category.queries) {
        batches.push(await runSearchSafely(input.runSearch, query, node.nodeId, category.category));
      }
    }
  }
  return batches.flat();
}

async function gatherBaseQueries(input: SourcesDatabaseInput): Promise<GatheredResult[]> {
  // Fallback path when every node-level query yielded nothing. Base queries are market-wide and
  // not tied to any single node, so we APPROXIMATE by tagging their results with the first node's
  // id (stage 2 orders nodes by importance) and the neutral "third-party" category; the stage-4
  // ledger re-derives per-node relevance anyway.
  const firstNode = input.queryPlan.nodes[0];
  if (!firstNode) return [];
  const batches: GatheredResult[][] = [];
  for (const query of input.queryPlan.baseQueries) {
    batches.push(await runSearchSafely(input.runSearch, query, firstNode.nodeId, "third-party"));
  }
  return batches.flat();
}

function isSpoilerResult(result: GatheredResult): boolean {
  // Host-level firewall plus content-level check: odds quoted INSIDE an allowed site's title or
  // snippet must not reach the evidence pool either.
  if (isSpoilerSource(result.url) || (result.host ? isSpoilerSource(result.host) : false)) return true;
  return textMentionsSpoiler(result.title) || textMentionsSpoiler(result.snippet);
}

function firewallAndDedup(gathered: GatheredResult[], maxRecords?: number): GatheredResult[] {
  const seen = new Set<string>();
  const kept: GatheredResult[] = [];
  for (const result of gathered) {
    if (isSpoilerResult(result)) continue;
    const key = result.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(result);
  }
  return typeof maxRecords === "number" ? kept.slice(0, Math.max(0, maxRecords)) : kept;
}

function buildEnrichmentPrompt(results: GatheredResult[], queryPlan: QueryPlan): string {
  const nodeList = queryPlan.nodes.map((node) => `- ${node.nodeId}: ${node.label}`).join("\n");
  // Titles/snippets are untrusted web content: sanitize so a hostile page cannot inject fake list
  // items or instructions into the prompt on fresh lines.
  const items = results
    .map((result, index) => {
      const host = sanitizeForPrompt(result.host ?? normalizeHost(result.url));
      return `[${index}] (${result.category}) ${host} | ${sanitizeForPrompt(result.title)} | ${sanitizeForPrompt(result.snippet)}`;
    })
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
    "Return ONLY a JSON array, one object per result. Each object MUST carry the integer \"index\"",
    "of the search result it describes:",
    '[ { "index": number,',
    '    "sourceCategory": "official"|"mainstream"|"local"|"third-party"|"military-map"|"social",',
    '    "summary": string, "addressedNodeIds": string[] } ]'
  ].join("\n");
}

async function enrich(results: GatheredResult[], input: SourcesDatabaseInput): Promise<ReadonlyMap<number, EvidenceEnrichment>> {
  try {
    const response = await input.callLlm({
      prompt: buildEnrichmentPrompt(results, input.queryPlan),
      label: `sources:${input.marketSlug}`,
      model: modelForStage("sources")
    });
    if (!Array.isArray(response.json)) return new Map();
    // Index-keyed lookup: out-of-range and duplicate indices are ignored, and a record with no
    // matching index simply keeps its deterministic defaults. This replaces the old positional
    // alignment, where one skipped element silently shifted every following enrichment.
    const byIndex = new Map<number, EvidenceEnrichment>();
    for (const item of response.json) {
      const record = asRecord(item);
      const index = asIndex(record.index);
      if (index === undefined || index >= results.length || byIndex.has(index)) continue;
      byIndex.set(index, {
        sourceCategory: asEnumValue(record.sourceCategory, SOURCE_CATEGORIES),
        summary: asText(record.summary),
        addressedNodeIds: asStringArray(record.addressedNodeIds)
      });
    }
    return byIndex;
  } catch {
    return new Map();
  }
}

export async function buildSourcesDatabase(input: SourcesDatabaseInput): Promise<SourcesDatabase> {
  const fromNodeQueries = firewallAndDedup(await gather(input), input.maxRecords);
  // Base-queries fallback fires ONLY when the node-level queries kept zero records.
  const kept =
    fromNodeQueries.length === 0 && input.queryPlan.baseQueries.length > 0
      ? firewallAndDedup(await gatherBaseQueries(input), input.maxRecords)
      : fromNodeQueries;
  const enrichment = kept.length > 0 ? await enrich(kept, input) : new Map<number, EvidenceEnrichment>();
  const validNodeIds = new Set(input.queryPlan.nodes.map((node) => node.nodeId));

  const records: EvidenceSourceRecord[] = kept.map((result, index) => {
    const extra = enrichment.get(index) ?? {};
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
