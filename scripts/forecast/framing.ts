// Round 0 — event framing.
//
// A free-text user prompt ("will Apple do a foldable in 2026?") is not yet a
// well-posed forecastable event: the resolution window, the exact YES/NO bar,
// and the settlement source are all implicit. Before any probability is
// estimated, the agent reads the prompt (and may WebSearch for dates/context)
// and writes an explicit frame. If the question is too vague or subjective to
// forecast as a binary, it says so and asks for clarification instead of
// emitting a false-precision number.

import { extractJsonObject, runAgentRaw } from "./claude-agent";
import type { EventFraming } from "./types";

function buildFramingPrompt(question: string, userResolution: string | null): string {
  const pinned = userResolution
    ? `\nUSER-SPECIFIED RESOLUTION (authoritative — keep it, do not override; only fill in the date/source/assumptions around it):\n"${userResolution}"\n`
    : "";
  return `You are a forecasting question editor. The user gave a rough description of a future event they want a probability for. BEFORE any forecasting, turn it into a precise, well-posed BINARY (yes/no) question with explicit resolution.

USER PROMPT: "${question}"${pinned}
You MAY use WebSearch to look up dates, definitions, or context needed to frame this well (e.g. when a relevant season/event/deadline falls, or how an entity is defined). Do not estimate the probability yet — only frame the question.

Produce:
- normalized_question: a crisp question answerable strictly YES or NO.
- resolution_criteria: exactly what counts as YES and what counts as NO, including edge cases.
- resolution_date: the date (YYYY-MM-DD) by which the event must occur for YES; infer a sensible one from the question/context if unstated. This bounds the time window. Use null only if the question is genuinely open-ended.
- settlement_source: the authoritative source that would confirm the real outcome.
- assumptions: any assumptions you made while framing (timezone, definitions, scope).
- forecastable: true if this can be sensibly forecast as a binary event with a checkable resolution; false if it is too vague, subjective, or has no resolvable answer.
- clarification_needed: if forecastable is false, what the user must specify to make it forecastable; otherwise an empty string.

OUTPUT FORMAT: respond with ONLY a single JSON object — no prose before or after, no markdown code fence:
{
  "normalized_question": "...",
  "resolution_criteria": "...",
  "resolution_date": "2026-12-31",
  "settlement_source": "...",
  "assumptions": "...",
  "forecastable": true,
  "clarification_needed": ""
}`;
}

export function validateFraming(raw: unknown): EventFraming {
  if (!raw || typeof raw !== "object") throw new Error("framing output is not an object");
  const o = raw as Record<string, unknown>;
  if (typeof o.normalized_question !== "string" || !o.normalized_question.trim())
    throw new Error("framing.normalized_question missing");
  if (typeof o.resolution_criteria !== "string" || !o.resolution_criteria.trim())
    throw new Error("framing.resolution_criteria missing");
  if (typeof o.forecastable !== "boolean") throw new Error("framing.forecastable must be boolean");
  const rd = o.resolution_date;
  const resolutionDate =
    typeof rd === "string" && rd.trim() && rd.trim().toLowerCase() !== "null" ? rd.trim() : null;
  return {
    normalizedQuestion: o.normalized_question.trim(),
    resolutionCriteria: o.resolution_criteria.trim(),
    resolutionDate,
    settlementSource: typeof o.settlement_source === "string" ? o.settlement_source : "",
    assumptions: typeof o.assumptions === "string" ? o.assumptions : "",
    forecastable: o.forecastable,
    clarificationNeeded: typeof o.clarification_needed === "string" ? o.clarification_needed : "",
  };
}

export interface FrameResult {
  framing: EventFraming;
  searchQueries: string[];
  costUsd: number | null;
}

export async function frameEvent(
  question: string,
  opts: { userResolution?: string | null; model?: string } = {}
): Promise<FrameResult> {
  const prompt = buildFramingPrompt(question, opts.userResolution ?? null);
  // One retry on a fail-closed parse/validation miss.
  let res = await runAgentRaw(prompt, { model: opts.model });
  let framing: EventFraming | null = null;
  try {
    framing = validateFraming(res.jsonObject ?? extractJsonObject(res.rawFinalText));
  } catch {
    res = await runAgentRaw(prompt, { model: opts.model });
    framing = validateFraming(res.jsonObject ?? extractJsonObject(res.rawFinalText));
  }
  return { framing, searchQueries: res.searchQueries, costUsd: res.costUsd };
}
