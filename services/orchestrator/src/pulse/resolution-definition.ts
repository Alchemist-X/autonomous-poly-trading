// Stage 1 producer — clarify the resolution definition.
//
// Takes ONLY non-pricing market facts (question + scraped resolution rules + deadline) so the
// market price can never leak into the reasoning. Makes one structured LLM call and coerces the
// result into a typed ResolutionDefinition, never throwing on missing fields: gaps are recorded
// and validationStatus is downgraded instead.

import {
  validateResolutionDefinition,
  type ResolutionBoundary,
  type ResolutionDefinition,
  type StageValidationStatus
} from "./stage-artifacts.js";
import type { StageLlmCaller } from "./stage-llm.js";
import { modelForStage } from "./stage-models.js";

export interface ResolutionDefinitionInput {
  marketSlug: string;
  eventSlug?: string;
  question: string;
  /** Polymarket scraped resolution rules (factual, not pricing). */
  rulesText?: string;
  resolutionSource?: string;
  endDateUtc?: string;
  categoryLabel?: string | null;
  generatedAtUtc: string;
  callLlm: StageLlmCaller;
}

const VALID_STATUSES: readonly StageValidationStatus[] = ["valid", "ambiguous", "contested", "unclarifiable"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asClamped01(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function asStatus(value: unknown): StageValidationStatus | undefined {
  return typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value)
    ? (value as StageValidationStatus)
    : undefined;
}

function coerceBoundary(value: unknown): ResolutionBoundary {
  const record = asRecord(value);
  return {
    condition: asText(record.condition) ?? "",
    meetsByDeadline: asBool(record.meetsByDeadline, false),
    toleranceNotes: asText(record.toleranceNotes)
  };
}

export function buildResolutionPrompt(input: ResolutionDefinitionInput): string {
  return [
    "You are the resolution-definition stage of an independent forecasting pipeline.",
    "Clarify EXACTLY how this prediction-market question resolves. You are given only factual",
    "market metadata and the official resolution rules. You are deliberately NOT given any market",
    "price or odds, and you must not ask for or guess them — this stage must stay independent of pricing.",
    "",
    `Question: ${input.question}`,
    input.endDateUtc ? `Stated end date (UTC): ${input.endDateUtc}` : "Stated end date: unavailable",
    input.categoryLabel ? `Category: ${input.categoryLabel}` : "",
    input.resolutionSource ? `Resolution source: ${input.resolutionSource}` : "",
    "Official resolution rules:",
    input.rulesText ? input.rulesText : "(no rules text was scraped — mark this as a gap)",
    "",
    "Return ONLY a JSON object with these fields:",
    "{",
    '  "officialQuestion": string,',
    '  "officialResolutionRules": string,',
    '  "resolutionSource": string | null,',
    '  "representativeAuthority": string | null,  // who/what authority resolves it; who represents each party',
    '  "yesBoundary": { "condition": string, "meetsByDeadline": boolean, "toleranceNotes": string | null },',
    '  "noBoundary": { "condition": string, "meetsByDeadline": boolean, "toleranceNotes": string | null },',
    '  "deadline": string | null,  // ISO 8601',
    '  "timezone": string | null,',
    '  "resolutionDate": string | null,  // ISO 8601',
    '  "validationStatus": "valid" | "ambiguous" | "contested" | "unclarifiable",',
    '  "gaps": string[],  // boundary traps / unclear definitions',
    '  "confidence": number  // 0..1, your confidence the definition is unambiguous',
    "}",
    "Do not invent facts. If the rules are silent on something, record it in gaps and lower confidence."
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function coerceResolutionDefinition(json: unknown, input: ResolutionDefinitionInput): ResolutionDefinition {
  const record = asRecord(json);
  const yesBoundary = coerceBoundary(record.yesBoundary);
  const noBoundary = coerceBoundary(record.noBoundary);
  const gaps = asStringArray(record.gaps);

  const definition: ResolutionDefinition = {
    marketSlug: input.marketSlug,
    eventSlug: input.eventSlug,
    officialQuestion: asText(record.officialQuestion) ?? input.question,
    officialResolutionRules: asText(record.officialResolutionRules) ?? input.rulesText ?? "",
    resolutionSource: asText(record.resolutionSource) ?? input.resolutionSource,
    representativeAuthority: asText(record.representativeAuthority),
    yesBoundary,
    noBoundary,
    deadline: asText(record.deadline) ?? input.endDateUtc,
    timezone: asText(record.timezone),
    resolutionDate: asText(record.resolutionDate),
    validationStatus: asStatus(record.validationStatus) ?? "ambiguous",
    gaps,
    confidence: asClamped01(record.confidence, 0.4),
    definedAtUtc: input.generatedAtUtc
  };

  // Audit with the deterministic validator; structural failures become gaps + a status downgrade.
  const validation = validateResolutionDefinition(definition);
  if (!validation.ok) {
    const mergedGaps = [...definition.gaps, ...validation.errors];
    const downgraded: StageValidationStatus = definition.validationStatus === "unclarifiable" ? "unclarifiable" : "ambiguous";
    return { ...definition, gaps: mergedGaps, validationStatus: downgraded };
  }
  return definition;
}

export async function buildResolutionDefinition(input: ResolutionDefinitionInput): Promise<ResolutionDefinition> {
  const prompt = buildResolutionPrompt(input);
  const response = await input.callLlm({ prompt, label: `resolution:${input.marketSlug}`, model: modelForStage("resolution") });
  return coerceResolutionDefinition(response.json, input);
}
