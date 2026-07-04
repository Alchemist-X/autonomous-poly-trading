// Final whole-forecast synthesis (after the last round).
//
// A multi-round run leaves the reader with per-round deltas but no overall read.
// This step asks the agent to synthesize the WHOLE forecast into a verdict: why
// the final probability landed where it did, the strongest factors each way, and
// the open uncertainties. RED LINE: it EXPLAINS the engine's number — it does not
// re-decide it, and it introduces no new evidence (synthesis only, no search).

import { runAgent } from "./agent";
import { extractJsonObject } from "./claude-agent";
import { languageDirective } from "./language";
import type { AgentRunResult, RunAgentOptions } from "./claude-agent";
import type { ForecastState, ForecastSummary } from "./types";

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;
const signed = (pp: number): string => `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;

function buildSummaryPrompt(state: ForecastState): string {
  // Numbered "evidence book": two-digit global index in ledger order, so the
  // verdict prose can cite [NN] and the UI can anchor-link narrative → source.
  const ledger =
    state.evidenceLedger.length === 0
      ? "(no evidence gathered)"
      : state.evidenceLedger
          .map(
            (e, i) =>
              `[${String(i + 1).padStart(2, "0")}] [${e.stance}, ${signed(e.deltaPp)}${
                e.kind === "reflection" ? ", reflection" : ""
              }] ${e.title || e.url} — ${e.claim} (${e.url})`
          )
          .join("\n");
  const trajectory = state.roundHistory
    .map((r) => `${pct(r.priorProb)}→${pct(r.postProb)}`)
    .join(", ");

  return `You are wrapping up a multi-round probability forecast. Below is the full picture. Write an OVERALL summary that EXPLAINS the final probability. Do NOT change the number, do NOT introduce new evidence, and do NOT search — synthesize only what is given.

EVENT: ${state.framing.normalizedQuestion}
RESOLUTION CRITERIA: ${state.framing.resolutionCriteria}
RESOLUTION DATE: ${state.framing.resolutionDate ?? "(open-ended)"}
FINAL P(YES): ${pct(state.currentProb)}
ROUNDS: ${state.round}; trajectory: ${trajectory || "(none)"}

EVIDENCE LEDGER (every counted source, numbered [NN], with its effect on P(YES)):
${ledger}

When the verdict prose references a specific source, cite it inline as [NN] — its two-digit index in the ledger above.

OUTPUT only a single JSON object — no prose, no code fence:
{
  "verdict": "1-2 paragraphs: the overall read — why P(YES) landed at ${pct(state.currentProb)}, the balance of evidence, citing sources inline as [NN]",
  "key_factors_yes": ["strongest factors pushing toward YES"],
  "key_factors_no": ["strongest factors pushing toward NO"],
  "main_uncertainties": "what is unresolved or could move this before the resolution date",
  "calibration_note": "if you think the computed probability is materially mis-calibrated, say so and why — but do NOT assert a different number as the answer; otherwise empty string",
  "premortem": "assume the event has RESOLVED THE OTHER WAY (against the current lean): in 1-3 sentences, the single most plausible path that got it there, citing [NN] where relevant — the reader's early-warning signal",
  "why_sentence": "ONE complete, self-explaining sentence — the single reason the number landed where it did, naming the decisive evidence; no fragment",
  "quip": "one short dry human aside reacting to the verdict — personality, not advice",
  "confidence_reason": "one line on why confidence is high/medium/low"
}
${languageDirective()}`;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

// New display fields are optional strings (default undefined); never throw on them.
function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function validateSummary(raw: unknown): ForecastSummary {
  if (!raw || typeof raw !== "object") throw new Error("summary output is not an object");
  const o = raw as Record<string, unknown>;
  if (typeof o.verdict !== "string" || !o.verdict.trim()) throw new Error("summary.verdict missing");
  return {
    verdict: o.verdict.trim(),
    keyFactorsYes: strArray(o.key_factors_yes),
    keyFactorsNo: strArray(o.key_factors_no),
    mainUncertainties: typeof o.main_uncertainties === "string" ? o.main_uncertainties : "",
    calibrationNote: typeof o.calibration_note === "string" ? o.calibration_note : "",
    premortem: optStr(o.premortem),
    whySentence: optStr(o.why_sentence),
    quip: optStr(o.quip),
    confidenceReason: optStr(o.confidence_reason),
  };
}

export async function summarizeForecast(
  state: ForecastState,
  opts: { model?: string; runAgentFn?: (prompt: string, opts: RunAgentOptions) => Promise<AgentRunResult> } = {}
): Promise<ForecastSummary> {
  const prompt = buildSummaryPrompt(state);
  const callAgent = opts.runAgentFn ?? runAgent;
  // No tools: pure synthesis over the gathered evidence (no new, un-scored evidence).
  let res = await callAgent(prompt, { model: opts.model, allowedTools: "" });
  try {
    return validateSummary(res.jsonObject ?? extractJsonObject(res.rawFinalText));
  } catch {
    res = await callAgent(prompt, { model: opts.model, allowedTools: "" });
    return validateSummary(res.jsonObject ?? extractJsonObject(res.rawFinalText));
  }
}
