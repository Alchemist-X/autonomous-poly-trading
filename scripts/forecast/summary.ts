// Final whole-forecast synthesis (after the last round).
//
// A multi-round run leaves the reader with per-round deltas but no overall read.
// This step asks the agent to synthesize the WHOLE forecast into a verdict: why
// the final probability landed where it did, the strongest factors each way, and
// the open uncertainties. RED LINE: it EXPLAINS the engine's number — it does not
// re-decide it, and it introduces no new evidence (synthesis only, no search).

import { extractJsonObject, runAgentRaw } from "./claude-agent";
import type { ForecastState, ForecastSummary } from "./types";

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;
const signed = (pp: number): string => `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;

function buildSummaryPrompt(state: ForecastState): string {
  const ledger =
    state.evidenceLedger.length === 0
      ? "(no evidence gathered)"
      : state.evidenceLedger
          .map(
            (e) =>
              `- [${e.stance}, ${signed(e.deltaPp)}${e.kind === "reflection" ? ", reflection" : ""}] ${
                e.title || e.url
              } — ${e.claim} (${e.url})`
          )
          .join("\n");
  const trajectory = state.roundHistory
    .map((r) => `${pct(r.priorProb)}→${pct(r.postProb)}`)
    .join(", ");

  return `You are wrapping up a multi-round probability forecast. Below is the full picture. Write an OVERALL summary that EXPLAINS the final probability. Do NOT change the number, do NOT introduce new evidence, and do NOT search — synthesize only what is given.

EVENT: ${state.framing.normalizedQuestion}
RESOLUTION CRITERIA: ${state.framing.resolutionCriteria}
RESOLUTION DATE: ${state.framing.resolutionDate ?? "(open-ended)"}
FINAL P(YES): ${pct(state.currentProb)}  (80% band ${pct(state.credibleInterval[0])} – ${pct(state.credibleInterval[1])})
ROUNDS: ${state.round}; trajectory: ${trajectory || "(none)"}

EVIDENCE LEDGER (every counted source, with its effect on P(YES)):
${ledger}

OUTPUT only a single JSON object — no prose, no code fence:
{
  "verdict": "1-2 paragraphs: the overall read — why P(YES) landed at ${pct(state.currentProb)}, the balance of evidence",
  "key_factors_yes": ["strongest factors pushing toward YES"],
  "key_factors_no": ["strongest factors pushing toward NO"],
  "main_uncertainties": "what is unresolved or could move this before the resolution date",
  "calibration_note": "if you think the computed probability is materially mis-calibrated, say so and why — but do NOT assert a different number as the answer; otherwise empty string"
}`;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
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
  };
}

export async function summarizeForecast(
  state: ForecastState,
  opts: { model?: string } = {}
): Promise<ForecastSummary> {
  const prompt = buildSummaryPrompt(state);
  // No tools: pure synthesis over the gathered evidence (no new, un-scored evidence).
  let res = await runAgentRaw(prompt, { model: opts.model, allowedTools: "" });
  try {
    return validateSummary(res.jsonObject ?? extractJsonObject(res.rawFinalText));
  } catch {
    res = await runAgentRaw(prompt, { model: opts.model, allowedTools: "" });
    return validateSummary(res.jsonObject ?? extractJsonObject(res.rawFinalText));
  }
}
