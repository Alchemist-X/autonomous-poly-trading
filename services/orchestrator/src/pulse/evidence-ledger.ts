// Stage 4 producer — score / weigh each evidence record into a typed ledger (Opus).
//
// The judgment parts (direction, strength, primary-source, credibility) come from one Opus call;
// the reproducible parts (recency from publishedAt, corroboration from cross-host agreement) are
// computed deterministically in code so the weights are auditable and unit-testable. Every ledger
// record keeps the sources-database recordId as a foreign key and inherits its node mapping.

import {
  type EvidenceDirection,
  type EvidenceLedger,
  type EvidenceLedgerRecord,
  type SourcesDatabase
} from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface EvidenceLedgerInput {
  marketSlug: string;
  sourcesDatabase: SourcesDatabase;
  generatedAtUtc: string;
  /** Reference time for deterministic recency scoring. */
  nowUtc: string;
  callLlm: StageLlmCaller;
}

const DIRECTIONS: readonly EvidenceDirection[] = ["supports-yes", "supports-no", "neutral", "ambiguous"];
const DAY_MS = 86_400_000;

interface EvidenceScore {
  direction: EvidenceDirection;
  strength: number;
  primarySource: boolean;
  credibilityScore: number;
}

interface ScoredRecord extends EvidenceScore {
  recordId: string;
  sourceHost: string;
  affectedNodeIds: string[];
  recencyScore: number;
  ageDays: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asDirection(value: unknown): EvidenceDirection {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value) ? (value as EvidenceDirection) : "neutral";
}

function clamp01(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : fallback;
}

function recency(publishedAtUtc: string | undefined, nowUtc: string): { score: number; ageDays: number | null } {
  if (!publishedAtUtc) return { score: 0.3, ageDays: null };
  const published = Date.parse(publishedAtUtc);
  const now = Date.parse(nowUtc);
  if (Number.isNaN(published) || Number.isNaN(now)) return { score: 0.3, ageDays: null };
  const ageDays = Math.max(0, (now - published) / DAY_MS);
  return { score: 1 / (1 + ageDays / 30), ageDays };
}

function buildScoringPrompt(database: SourcesDatabase): string {
  const items = database.records
    .map((record, index) => `[${index}] ${record.sourceHost} (${record.sourceCategory}) | ${record.title ?? ""} | ${record.summary ?? record.snippet ?? ""}`)
    .join("\n");
  return [
    "You are the evidence-weighting stage of an independent forecasting pipeline.",
    "For each evidence record, judge how it bears on the YES resolution. Do NOT reference market price.",
    "",
    "Records (index, host, category, title, summary):",
    items,
    "",
    "Return ONLY a JSON array aligned by index, one object per record:",
    '[ { "direction": "supports-yes"|"supports-no"|"neutral"|"ambiguous",',
    '    "strength": number,        // 0..1 how strongly it moves the probability',
    '    "primarySource": boolean,  // first-hand / official vs derivative',
    '    "credibilityScore": number // 0..1 source reliability',
    "} ]"
  ].join("\n");
}

async function scoreRecords(input: EvidenceLedgerInput): Promise<EvidenceScore[]> {
  if (input.sourcesDatabase.records.length === 0) return [];
  try {
    const response = await input.callLlm({
      prompt: buildScoringPrompt(input.sourcesDatabase),
      label: `evidence-ledger:${input.marketSlug}`,
      model: modelForStage("evidence_ledger")
    });
    if (!Array.isArray(response.json)) return [];
    return response.json.map((item) => {
      const record = asRecord(item);
      return {
        direction: asDirection(record.direction),
        strength: clamp01(record.strength, 0.3),
        primarySource: typeof record.primarySource === "boolean" ? record.primarySource : false,
        credibilityScore: clamp01(record.credibilityScore, 0.5)
      };
    });
  } catch {
    return [];
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
  const scores = await scoreRecords(input);

  const scored: ScoredRecord[] = input.sourcesDatabase.records.map((record, index) => {
    const score = scores[index] ?? { direction: "neutral" as EvidenceDirection, strength: 0.3, primarySource: false, credibilityScore: 0.5 };
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
    }
  };
}
