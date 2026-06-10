// Shared JSON-coercion helpers for the stage producers.
//
// Every stage producer turns untrusted LLM JSON into a typed artifact. These helpers were
// originally copy-pasted per module and had already drifted (three clamp variants); this module
// is now the single source of truth. All helpers are total: they never throw on malformed input,
// they fall back to a safe default instead, matching the producers' "coerce, then validate" design.

/** Narrow an unknown value to a plain object record ({} for anything else). */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Non-empty trimmed string, else undefined. */
export function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Boolean passthrough with an explicit fallback for non-booleans. */
export function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Array of non-empty strings (drops every non-string / blank entry). */
export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/** Member of an allowed string-enum list, else undefined. */
export function asEnumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Plain numeric clamp (assumes finite inputs; combine with the coercers below for LLM values). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerce to a finite number clamped to [0,1]; non-numeric input yields the fallback. */
export function asClamped01(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? clamp(num, 0, 1) : fallback;
}

/** Coerce to a finite number clamped to [min,max]; non-numeric input yields the fallback. */
export function asClampedNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? clamp(num, min, max) : fallback;
}

/** Finite integer >= 0, else undefined (for LLM-provided indices). */
export function asIndex(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

const MAX_PROMPT_FIELD_LENGTH = 400;

/**
 * Sanitize untrusted text (web titles/snippets/summaries) before interpolating it into a stage
 * prompt. Newlines and control characters are collapsed so a hostile source cannot fake list
 * items / instructions on fresh lines, and the text is truncated to keep one record one line.
 */
export function sanitizeForPrompt(value: string | undefined, maxLength: number = MAX_PROMPT_FIELD_LENGTH): string {
  if (!value) return "";
  // eslint-disable-next-line no-control-regex
  const collapsed = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}
