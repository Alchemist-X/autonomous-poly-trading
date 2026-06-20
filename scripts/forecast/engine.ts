// The iterative forecasting loop.
//
// One forecast = a binary event whose P(YES) is maintained across rounds. Each
// round: build a PRIOR-AWARE prompt (carry the current probability + the list of
// already-counted sources) -> run the agent with WebSearch -> validate (fail
// closed) -> dedupe new sources by canonical URL -> thread their LLRs through a
// Bayesian log-odds update so each source's percentage-point contribution is
// computed, not guessed -> persist -> check stop conditions.

import {
  applyLlrs,
  clamp,
  clampUnverified,
  clusterFactors,
  confirmationRatio,
  credibleInterval,
  effectiveLlr,
} from "./bayes";
import { runAgentRaw, validateRoundOutput } from "./claude-agent";
import { saveState, writeReport } from "./store";
import { canonicalizeUrl } from "./url";
import type {
  AgentRoundOutput,
  EventFraming,
  ForecastState,
  LedgerEntry,
  PerSourceUpdate,
  RoundRecord,
} from "./types";

export interface RunForecastOptions {
  maxRounds?: number;
  convergenceEpsilon?: number; // stop if a round with new evidence moves prob by less than this
  model?: string;
  onLog?: (msg: string) => void;
  onRoundComplete?: (state: ForecastState, round: RoundRecord) => void;
}

function nowUtc(): string {
  return new Date().toISOString();
}

function buildPrompt(state: ForecastState, roundNo: number, maxRounds: number): string {
  const counted =
    state.evidenceLedger.length === 0
      ? "(none yet — this is the first round)"
      : state.evidenceLedger
          .map((e) => `- ${e.url}  — ${e.claim}`)
          .join("\n");

  return `You are a forecasting research agent. You estimate the probability that a specific BINARY (yes/no) event will happen, using live web research, and you attribute every probability change to a cited source.

EVENT: ${state.framing.normalizedQuestion}
RESOLUTION CRITERIA: ${state.framing.resolutionCriteria}
RESOLUTION DATE (must occur by): ${state.framing.resolutionDate ?? "(open-ended)"}

CURRENT ESTIMATE (this is your PRIOR for this round): P(YES) = ${(state.currentProb * 100).toFixed(1)}%
ROUND: ${roundNo} of ${maxRounds}

SOURCES ALREADY COUNTED IN PREVIOUS ROUNDS — do NOT re-use or re-count these URLs; you must find NEW information:
${counted}

YOUR TASK THIS ROUND:
1. Use WebSearch to find NEW, relevant, recent evidence about whether this event will happen. Do not re-count any source already listed above.
2. DISCONFIRMATION (required): run at least ONE search aimed at FALSIFYING the current lean — if P(YES) above is >50%, search for the strongest reasons it will NOT happen; if <50%, search for the strongest reasons it WILL. Report what you find even if it is weak or comes up empty (say so in round_summary). Do not only look for evidence that confirms the current estimate.
3. For each NEW source, decide whether it makes YES more likely (supports_yes), less likely (supports_no), or neutral, and how strongly.
4. Express each source's impact as a signed log-likelihood ratio "llr" in nats: POSITIVE favors YES, NEGATIVE favors NO. Magnitude guidance: weak ≈ 0.1–0.3, moderate ≈ 0.4–0.8, strong ≈ 0.9–1.5. Be conservative — a single web article is rarely "strong".
5. Group correlated sources with cluster_id: give sources that trace to the SAME underlying story, wire report, poll, or primary actor the SAME cluster_id string; give genuinely independent sources DIFFERENT cluster_ids. (Five outlets re-reporting one announcement are one cluster, not five.)
6. Start from the CURRENT ESTIMATE above and move it; do not restate a probability from scratch. The prior already reflects a base rate from general knowledge, so only count NEW, specific developments as evidence — do not re-add general facts the base rate already implies.
7. Only cite source_url values you actually retrieved via WebSearch.

OUTPUT FORMAT: Respond with ONLY a single JSON object — no prose before or after, no markdown code fence — of EXACTLY this shape:
{
  "round_summary": "1-2 sentences on what you found this round",
  "new_evidence": [
    {
      "claim": "the specific fact, one sentence",
      "source_url": "https://...",
      "source_title": "page or site title",
      "stance": "supports_yes" | "supports_no" | "neutral",
      "strength": "weak" | "moderate" | "strong",
      "llr": -1.5,
      "cluster_id": "okc-sweep",
      "rationale": "why this moves the probability and by how much"
    }
  ],
  "agent_holistic_probability": 0.42,
  "confidence": "low" | "medium" | "high",
  "found_new_information": true,
  "notes": "caveats, resolution assumptions, what to check next round"
}
If you genuinely found no new relevant information this round, return an empty new_evidence array and set found_new_information to false.`;
}

export function newForecastState(input: {
  eventId: string;
  eventText: string;
  framing: EventFraming;
  startProb?: number;
}): ForecastState {
  const ts = nowUtc();
  // P0-2: seed from the model's base-rate prior, not a blind 0.5. Clamp only to
  // the engine's own probability range [0.01, 0.99] (matching PROB_FLOOR/CEIL) so
  // genuinely rare / near-certain base rates (e.g. an M9 quake ~0.03%) are kept,
  // not flattened toward 50%.
  const p = clamp(input.startProb ?? input.framing.priorProbability ?? 0.5, 0.01, 0.99);
  return {
    eventId: input.eventId,
    eventText: input.eventText,
    framing: input.framing,
    createdAtUtc: ts,
    updatedAtUtc: ts,
    currentProb: p,
    credibleInterval: [clamp(p - 0.18, 0, 1), clamp(p + 0.18, 0, 1)],
    round: 0,
    status: "open",
    evidenceLedger: [],
    roundHistory: [],
  };
}

async function runOneRound(
  state: ForecastState,
  roundNo: number,
  maxRounds: number,
  opts: RunForecastOptions
): Promise<RoundRecord> {
  const log = opts.onLog ?? (() => {});
  const prompt = buildPrompt(state, roundNo, maxRounds);

  // Run the agent, validating fail-closed with one retry on a parse/schema miss.
  const validate = (r: { jsonObject: unknown | null }): AgentRoundOutput | null => {
    try {
      return validateRoundOutput(r.jsonObject);
    } catch {
      return null;
    }
  };
  let result = await runAgentRaw(prompt, { model: opts.model });
  let out = validate(result);
  if (!out) {
    log(`  ⚠ round ${roundNo}: agent output failed validation; retrying once…`);
    result = await runAgentRaw(prompt, { model: opts.model });
    out = validate(result);
  }
  if (!out) {
    throw new Error(
      `round ${roundNo} aborted: agent output invalid after retry: ${result.jsonError ?? "schema mismatch"}\n` +
        `stderr: ${result.stderrTail}`
    );
  }

  // Canonical set of URLs the agent's searches actually returned (for the
  // fabricated-citation guard).
  const traceCanonical = new Set<string>();
  for (const u of result.searchResultUrls) traceCanonical.add(canonicalizeUrl(u));

  // Dedupe against already-counted sources AND within this round.
  const counted = new Set(state.evidenceLedger.map((e) => e.urlCanonical));
  const seenThisRound = new Set<string>();
  const survivors: typeof out.new_evidence = [];
  let duplicateCount = 0;
  for (const ev of out.new_evidence) {
    const canon = canonicalizeUrl(ev.source_url);
    if (!canon) continue;
    if (counted.has(canon) || seenThisRound.has(canon)) {
      duplicateCount++;
      continue;
    }
    seenThisRound.add(canon);
    survivors.push(ev);
  }

  // Thread the survivors' LLRs through the Bayesian update from the prior.
  // P0-4: decide verification BEFORE applying each LLR, and soft-clamp any source
  // whose URL is absent from the agent's real tool trace (possible fabrication).
  const priorProb = state.currentProb;
  const verifiedFlags = survivors.map((ev) => traceCanonical.has(canonicalizeUrl(ev.source_url)));
  const baseLlrs = survivors.map((ev) => effectiveLlr(ev.stance, ev.llr));
  // P0-3: damp correlated (same-cluster) sources before they enter the sum.
  const factors = clusterFactors(survivors.map((ev) => ev.cluster_id), baseLlrs);
  const llrs = baseLlrs.map((base, i) => {
    const clustered = base * factors[i];
    return verifiedFlags[i] ? clustered : clampUnverified(clustered);
  });
  const { post, steps } = applyLlrs(priorProb, llrs);

  const ts = nowUtc();
  const perSourceUpdates: PerSourceUpdate[] = [];
  const newLedger: LedgerEntry[] = [];
  let unverifiedPp = 0;
  survivors.forEach((ev, i) => {
    const step = steps[i];
    const canon = canonicalizeUrl(ev.source_url);
    const verified = verifiedFlags[i];
    if (!verified) unverifiedPp += Math.abs(step.deltaPp);
    perSourceUpdates.push({
      url: ev.source_url,
      title: ev.source_title,
      from: step.probBefore,
      to: step.probAfter,
      deltaPp: step.deltaPp,
      explanation: ev.rationale || ev.claim,
      verified,
      clusterId: ev.cluster_id || `__solo_${i}`,
      clusterFactor: factors[i],
    });
    newLedger.push({
      id: `${state.eventId}-r${roundNo}-${i}`,
      url: ev.source_url,
      urlCanonical: canon,
      title: ev.source_title,
      claim: ev.claim,
      stance: ev.stance,
      strength: ev.strength,
      clusterId: ev.cluster_id || `__solo_${i}`,
      clusterFactor: factors[i],
      effectiveLlr: llrs[i],
      probBefore: step.probBefore,
      probAfter: step.probAfter,
      deltaPp: step.deltaPp,
      rationale: ev.rationale,
      retrievedAtUtc: ts,
      firstSeenRound: roundNo,
      verifiedInSearchTrace: verified,
    });
  });

  // Commit the round into state (continuity: priorProb == previous postProb).
  state.evidenceLedger.push(...newLedger);
  state.currentProb = post;
  state.credibleInterval = credibleInterval(post, state.evidenceLedger.length, out.confidence);
  state.round = roundNo;
  state.updatedAtUtc = ts;

  const record: RoundRecord = {
    round: roundNo,
    ts,
    priorProb,
    postProb: post,
    perSourceUpdates,
    newSourceCount: survivors.length,
    duplicateCount,
    unverifiedPp,
    confirmationRatio: confirmationRatio(priorProb, baseLlrs),
    agentHolisticProb: out.agent_holistic_probability,
    confidence: out.confidence,
    reasoning: out.round_summary + (out.notes ? `  Notes: ${out.notes}` : ""),
    searchQueries: result.searchQueries,
    searchResultUrlCount: result.searchResultUrls.size,
    costUsd: result.costUsd,
  };
  state.roundHistory.push(record);
  return record;
}

export async function runForecast(
  state: ForecastState,
  opts: RunForecastOptions = {}
): Promise<ForecastState> {
  const maxRounds = opts.maxRounds ?? (Number(process.env.FORECAST_MAX_ROUNDS) || 4);
  const epsilon = opts.convergenceEpsilon ?? 0.01;
  const log = opts.onLog ?? (() => {});

  const startRound = state.round + 1;
  for (let roundNo = startRound; roundNo <= maxRounds; roundNo++) {
    log(`\n▶ Round ${roundNo}/${maxRounds} — prior P(YES) = ${(state.currentProb * 100).toFixed(1)}%`);
    let record: RoundRecord;
    try {
      record = await runOneRound(state, roundNo, maxRounds, opts);
    } catch (err) {
      state.status = "aborted";
      state.updatedAtUtc = nowUtc();
      saveState(state);
      writeReport(state);
      throw err;
    }

    // Persist after EVERY round before deciding to stop (crash-resumable).
    saveState(state);
    writeReport(state);
    opts.onRoundComplete?.(state, record);

    log(
      `  ✓ ${record.newSourceCount} new source(s)` +
        (record.duplicateCount ? `, ${record.duplicateCount} dup skipped` : "") +
        ` → P(YES) ${(record.priorProb * 100).toFixed(1)}% → ${(record.postProb * 100).toFixed(1)}%` +
        (record.costUsd != null ? `  ($${record.costUsd.toFixed(3)})` : "")
    );

    // Stop conditions.
    if (record.newSourceCount === 0) {
      state.status = "no_new_info";
      log(`  ■ no new evidence — stopping.`);
      break;
    }
    if (Math.abs(record.postProb - record.priorProb) < epsilon) {
      state.status = "converged";
      log(`  ■ converged (move < ${(epsilon * 100).toFixed(1)}pp) — stopping.`);
      break;
    }
    if (roundNo >= maxRounds) {
      state.status = "max_rounds";
      log(`  ■ reached max rounds — stopping.`);
    }
  }

  state.updatedAtUtc = nowUtc();
  saveState(state);
  writeReport(state);
  return state;
}
