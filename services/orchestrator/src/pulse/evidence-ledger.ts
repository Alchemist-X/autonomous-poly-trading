// Stage 4 producer — score / weigh each evidence record into a typed ledger (Opus).
//
// The judgment parts (direction, strength, primary-source, credibility) come from one Opus call;
// the reproducible parts (recency from publishedAt, corroboration from cross-host agreement) are
// computed deterministically in code so the weights are auditable and unit-testable. Every ledger
// record keeps the sources-database recordId as a foreign key and inherits its node mapping.
//
// Scoring is index-keyed (same protocol as stage 3): each response object must carry the record
// "index" it scores, so a shuffled or partial response can never silently misalign. Records the
// response does not cover fall back to the named neutral defaults, and any degraded run (call
// failure, non-array response, or sub-half coverage) is flagged in the ledger's `gaps` field.

import {
  EVIDENCE_DIRECTIONS,
  type EvidenceDirection,
  type EvidenceLedger,
  type EvidenceLedgerRecord,
  type ResolutionDefinition,
  type SourcesDatabase
} from "./stage-artifacts.js";
import { asBool, asClamped01, asEnumValue, asIndex, asRecord, sanitizeForPrompt } from "./stage-coerce.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface EvidenceLedgerInput {
  marketSlug: string;
  sourcesDatabase: SourcesDatabase;
  generatedAtUtc: string;
  /** Reference time for deterministic recency scoring. */
  nowUtc: string;
  /** Stage-1 artifact; when present the scoring prompt states the question being forecast. */
  resolution?: ResolutionDefinition;
  callLlm: StageLlmCaller;
}

const DAY_MS = 86_400_000;
/** Recency half-life shaping constant: score = 1 / (1 + ageDays / RECENCY_DECAY_DAYS). */
const RECENCY_DECAY_DAYS = 30;
/** Recency score assigned when a record has no parseable publication date. */
const UNKNOWN_RECENCY_SCORE = 0.3;

// Named defaults applied to every record the scoring response does not cover.
const DEFAULT_DIRECTION: EvidenceDirection = "neutral";
const DEFAULT_STRENGTH = 0.3;
const DEFAULT_CREDIBILITY = 0.5;
const DEFAULT_PRIMARY_SOURCE = false;

interface EvidenceScore {
  direction: EvidenceDirection;
  strength: number;
  primarySource: boolean;
  credibilityScore: number;
}

const UNSCORED_DEFAULTS: EvidenceScore = {
  direction: DEFAULT_DIRECTION,
  strength: DEFAULT_STRENGTH,
  primarySource: DEFAULT_PRIMARY_SOURCE,
  credibilityScore: DEFAULT_CREDIBILITY
};

interface ScoringOutcome {
  scoresByIndex: ReadonlyMap<number, EvidenceScore>;
  /** Set when the scoring call degraded and the named defaults are (partially) in use. */
  degradedReason?: string;
}

interface ScoredRecord extends EvidenceScore {
  recordId: string;
  sourceHost: string;
  affectedNodeIds: string[];
  recencyScore: number;
  ageDays: number | null;
}

function recency(publishedAtUtc: string | undefined, nowUtc: string): { score: number; ageDays: number | null } {
  if (!publishedAtUtc) return { score: UNKNOWN_RECENCY_SCORE, ageDays: null };
  const published = Date.parse(publishedAtUtc);
  const now = Date.parse(nowUtc);
  if (Number.isNaN(published) || Number.isNaN(now)) return { score: UNKNOWN_RECENCY_SCORE, ageDays: null };
  const ageDays = Math.max(0, (now - published) / DAY_MS);
  return { score: 1 / (1 + ageDays / RECENCY_DECAY_DAYS), ageDays };
}

function questionLines(resolution: ResolutionDefinition | undefined): string[] {
  if (!resolution) {
    return ["Market question unavailable for this run; judge each record against the market's YES outcome as described by the records themselves."];
  }
  const lines = [`Market question: ${sanitizeForPrompt(resolution.officialQuestion)}`];
  const yesCondition = sanitizeForPrompt(resolution.yesBoundary?.condition);
  return yesCondition ? [...lines, `YES resolves when: ${yesCondition}`] : lines;
}

function buildScoringPrompt(database: SourcesDatabase, resolution: ResolutionDefinition | undefined): string {
  const items = database.records
    .map(
      (record, index) =>
        `[${index}] ${record.sourceHost} (${record.sourceCategory}) | ${sanitizeForPrompt(record.title)} | ${sanitizeForPrompt(record.summary ?? record.snippet)}`
    )
    .join("\n");
  return [
    ...questionLines(resolution),
    "",
    "You are the evidence-weighting stage of an independent forecasting pipeline.",
    "For each evidence record, judge how it bears on the YES resolution above. Do NOT reference market price.",
    "",
    "Records (index, host, category, title, summary):",
    items,
    "",
    'Return ONLY a JSON array with one object per record, each carrying the record "index" it scores:',
    '[ { "index": number,          // the [index] of the record being scored',
    '    "direction": "supports-yes"|"supports-no"|"neutral"|"ambiguous",',
    '    "strength": number,        // 0..1 how strongly it moves the probability',
    '    "primarySource": boolean,  // first-hand / official vs derivative',
    '    "credibilityScore": number // 0..1 source reliability',
    "} ]"
  ].join("\n");
}

async function scoreRecords(input: EvidenceLedgerInput): Promise<ScoringOutcome> {
  const totalRecords = input.sourcesDatabase.records.length;
  if (totalRecords === 0) return { scoresByIndex: new Map() };
  try {
    const response = await input.callLlm({
      prompt: buildScoringPrompt(input.sourcesDatabase, input.resolution),
      label: `evidence-ledger:${input.marketSlug}`,
      model: modelForStage("evidence_ledger")
    });
    if (!Array.isArray(response.json)) {
      return { scoresByIndex: new Map(), degradedReason: "scoring response was not a JSON array" };
    }
    const entries = response.json.flatMap((item): Array<[number, EvidenceScore]> => {
      const record = asRecord(item);
      const index = asIndex(record.index);
      if (index === undefined || index >= totalRecords) return [];
      return [
        [
          index,
          {
            direction: asEnumValue(record.direction, EVIDENCE_DIRECTIONS) ?? DEFAULT_DIRECTION,
            strength: asClamped01(record.strength, DEFAULT_STRENGTH),
            primarySource: asBool(record.primarySource, DEFAULT_PRIMARY_SOURCE),
            credibilityScore: asClamped01(record.credibilityScore, DEFAULT_CREDIBILITY)
          }
        ]
      ];
    });
    const scoresByIndex = new Map(entries);
    if (scoresByIndex.size * 2 < totalRecords) {
      return { scoresByIndex, degradedReason: `scoring response covered ${scoresByIndex.size} of ${totalRecords} records` };
    }
    return { scoresByIndex };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { scoresByIndex: new Map(), degradedReason: `scoring call failed (${message})` };
  }
}

function countCorroboration(target: ScoredRecord, all: ScoredRecord[]): number {
  const targetNodes = new Set(target.affectedNodeIds);
  const hosts = new Set<string>();
  for (const other of all) {
    if (other.recordId === target.recordId) continue;
    if (other.direction !== target.direction) continue;
    if (!other.affectedNodeIds.some((id) => targetNodes.has(id))) continue;
    hosts.add(other.sourceHost);
  }
  hosts.delete(target.sourceHost);
  return hosts.size;
}

export async function buildEvidenceLedger(input: EvidenceLedgerInput): Promise<EvidenceLedger> {
  const { scoresByIndex, degradedReason } = await scoreRecords(input);

  const scored: ScoredRecord[] = input.sourcesDatabase.records.map((record, index) => {
    const score = scoresByIndex.get(index) ?? UNSCORED_DEFAULTS;
    const { score: recencyScore, ageDays } = recency(record.publishedAtUtc, input.nowUtc);
    return {
      recordId: record.recordId,
      sourceHost: record.sourceHost,
      affectedNodeIds: record.addressedNodeIds,
      direction: score.direction,
      strength: score.strength,
      primarySource: score.primarySource,
      credibilityScore: score.credibilityScore,
      recencyScore,
      ageDays
    };
  });

  const records: EvidenceLedgerRecord[] = scored.map((entry) => ({
    recordId: entry.recordId,
    direction: entry.direction,
    strength: entry.strength,
    recencyScore: entry.recencyScore,
    primarySource: entry.primarySource,
    corroborationCount: countCorroboration(entry, scored),
    credibilityScore: entry.credibilityScore,
    affectedNodeIds: entry.affectedNodeIds
  }));

  const supportingYes = records.filter((record) => record.direction === "supports-yes").length;
  const supportingNo = records.filter((record) => record.direction === "supports-no").length;
  const netStrength = records.reduce((sum, record) => {
    if (record.direction === "supports-yes") return sum + record.strength;
    if (record.direction === "supports-no") return sum - record.strength;
    return sum;
  }, 0);
  const agedDays = scored.map((entry) => entry.ageDays).filter((value): value is number => value !== null);
  const averageRecencyDays = agedDays.length > 0 ? agedDays.reduce((sum, value) => sum + value, 0) / agedDays.length : undefined;

  return {
    marketSlug: input.marketSlug,
    generatedAtUtc: input.generatedAtUtc,
    records,
    summary: {
      totalRecords: records.length,
      supportingYes,
      supportingNo,
      netStrength,
      averageRecencyDays
    },
    ...(degradedReason ? { gaps: [`stage-4 scoring degraded: ${degradedReason}; deterministic defaults in use`] } : {})
  };
}
