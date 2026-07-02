// The iterative forecasting loop.
//
// One forecast = a binary event whose P(YES) is maintained across rounds. Each
// round: build a PRIOR-AWARE prompt (carry the current probability + the list of
// already-counted sources + any pending analyst input) -> run the agent (via the
// provider dispatch; WebSearch only when the provider has it) -> validate (fail
// closed) -> dedupe new sources by canonical URL -> thread their LLRs through a
// Bayesian log-odds update so each source's percentage-point contribution is
// computed, not guessed -> persist -> check stop conditions.

import { providerHasWebSearch, runAgent } from "./agent";
import {
  applyLlrs,
  clamp,
  clampReflection,
  clampUnverified,
  clusterFactors,
  confirmationRatio,
  credibleInterval,
  effectiveLlr,
} from "./bayes";
import { validateRoundOutput } from "./claude-agent";
import type { AgentRunResult, RunAgentOptions } from "./claude-agent";
import { loadAnalyst, saveAnalyst, saveState, writeReport } from "./store";
import { summarizeForecast } from "./summary";
import { canonicalizeUrl } from "./url";
import type {
  AgentRoundOutput,
  AnalystState,
  EventFraming,
  ForecastState,
  LedgerEntry,
  PerSourceUpdate,
  RoundRecord,
  WhyChanged,
} from "./types";

export interface RunForecastOptions {
  maxRounds?: number;
  minRounds?: number; // convergence cannot stop the loop before this many rounds (env FORECAST_MIN_ROUNDS, default 1)
  convergenceEpsilon?: number; // stop if a round with new evidence moves prob by less than this
  model?: string;
  onLog?: (msg: string) => void;
  onRoundComplete?: (state: ForecastState, round: RoundRecord) => void;
  // DI seam for loop-level tests and in-process embedding: replaces the
  // provider-dispatched runAgent for every model call in the loop.
  runAgentFn?: (prompt: string, opts: RunAgentOptions) => Promise<AgentRunResult>;
}

function nowUtc(): string {
  return new Date().toISOString();
}

// Exported (pure) so the prompt contract can be unit-tested and so the app can
// preview exactly what a round will see. extras.hasWebSearch reworks the
// research instructions for a search-less provider; extras.analyst injects
// pending analyst notes / doubt marks as leads to investigate.
export function buildPrompt(
  state: ForecastState,
  roundNo: number,
  maxRounds: number,
  extras: { hasWebSearch: boolean; analyst: AnalystState | null }
): string {
  const counted =
    state.evidenceLedger.length === 0
      ? "(none yet — this is the first round)"
      : state.evidenceLedger
          .map(
            (e) =>
              `- [${e.stance}, ${e.deltaPp >= 0 ? "+" : ""}${e.deltaPp.toFixed(1)}pp] ${e.url} — ${e.claim}`
          )
          .join("\n");

  // Analyst-in-the-loop: unconsumed notes become leads (never established
  // fact); "doubt" marks ask the agent to re-examine specific prior sources via
  // the reflection mechanism. Rendered only when there is anything to inject.
  const ledgerById = new Map(state.evidenceLedger.map((e) => [e.id, e]));
  const pendingNotes = extras.analyst?.notes.filter((n) => n.consumedRound == null) ?? [];
  const handledDoubts = extras.analyst?.doubtsHandled ?? {};
  const doubted = Object.entries(extras.analyst?.marks ?? {})
    .filter(([id, mark]) => mark === "doubt" && handledDoubts[id] == null)
    .map(([id]) => ledgerById.get(id))
    .filter((e): e is LedgerEntry => e !== undefined);
  let analystSection = "";
  if (pendingNotes.length || doubted.length) {
    const stanceTag = (s: string): string =>
      s === "yes" ? "[PUSHES YES]" : s === "no" ? "[PUSHES NO]" : "[OPEN QUESTION]";
    const lines: string[] = [
      "",
      "ANALYST INPUT — a human analyst reviewing this run left the following. Treat each item as a hypothesis or lead to INVESTIGATE this round — not as established fact. If a lead pans out, include it as evidence with a real source; if it does not, say so in round_summary.",
    ];
    for (const n of pendingNotes) {
      const target = n.targetId ? ledgerById.get(n.targetId) : undefined;
      lines.push(`- ${stanceTag(n.stance)}${target ? ` (re: ${target.url})` : ""} ${n.text}`);
    }
    if (doubted.length) {
      lines.push(
        "The analyst DOUBTS these prior sources — re-examine them; if the doubt is justified, walk them back with a reflection entry (cite a new source):"
      );
      for (const e of doubted) lines.push(`- ${e.url} — ${e.claim}`);
    }
    analystSection = lines.join("\n") + "\n";
  }

  // Research instructions are provider-aware: a search-less provider must never
  // be told to WebSearch, and must not fabricate URLs to satisfy the cite rule.
  const research = extras.hasWebSearch
    ? "1. Use WebSearch to find NEW, relevant, recent evidence about whether this event will happen. Do not re-count any source already listed above.\n2. DISCONFIRMATION (required): run at least ONE search aimed at FALSIFYING the current lean — if P(YES) above is >50%, search for the strongest reasons it will NOT happen; if <50%, search for the strongest reasons it WILL. Report what you find even if it is weak or comes up empty (say so in round_summary). Do not only look for evidence that confirms the current estimate."
    : "1. You have NO web access. Use your own knowledge (respecting its cutoff) to surface NEW, relevant evidence about whether this event will happen. Do not re-count any source already listed above.\n2. DISCONFIRMATION (required): argue the strongest case against the current lean — if P(YES) above is >50%, the strongest reasons it will NOT happen; if <50%, the strongest reasons it WILL — and include it as evidence if it holds up. Report the attempt even if it comes up empty (say so in round_summary). Do not only reason toward what confirms the current estimate.";
  const citeRule = extras.hasWebSearch
    ? "8. Only cite source_url values you actually retrieved via WebSearch."
    : "8. Only cite source_url values you are confident actually exist — never fabricate or guess URLs; prefer canonical, stable URLs. If you cannot name a real URL for a claim, drop the claim.";

  return `You are a forecasting research agent. You estimate the probability that a specific BINARY (yes/no) event will happen, ${extras.hasWebSearch ? "using live web research" : "using your own knowledge (no web access)"}, and you attribute every probability change to a cited source.

EVENT: ${state.framing.normalizedQuestion}
RESOLUTION CRITERIA: ${state.framing.resolutionCriteria}
RESOLUTION DATE (must occur by): ${state.framing.resolutionDate ?? "(open-ended)"}

CURRENT ESTIMATE (this is your PRIOR for this round): P(YES) = ${(state.currentProb * 100).toFixed(1)}%
ROUND: ${roundNo} of ${maxRounds}

SOURCES ALREADY COUNTED IN PREVIOUS ROUNDS — do NOT re-use or re-count these URLs; you must find NEW information:
${counted}
${analystSection}
YOUR TASK THIS ROUND:
${research}
3. For each NEW source, decide whether it makes YES more likely (supports_yes), less likely (supports_no), or neutral, and how strongly.
4. Express each source's impact as a signed log-likelihood ratio "llr" in nats: POSITIVE favors YES, NEGATIVE favors NO. Magnitude guidance: weak ≈ 0.1–0.3, moderate ≈ 0.4–0.8, strong ≈ 0.9–1.5. Be conservative — a single web article is rarely "strong".
5. Tag each source's provenance and reliability: "source_type" — "official" (primary/company/government/regulator statements), "press" (journalism), or "insider" (leakers, analysts, industry chatter) — and "credibility" ("high" | "medium" | "low"): how reliable this specific source is for this claim (track record, primacy), independent of how much it moves the number.
6. Group correlated sources with cluster_id: give sources that trace to the SAME underlying story, wire report, poll, or primary actor the SAME cluster_id string; give genuinely independent sources DIFFERENT cluster_ids. (Five outlets re-reporting one announcement are one cluster, not five.)
7. Start from the CURRENT ESTIMATE above and move it; do not restate a probability from scratch. The prior already reflects a base rate from general knowledge, so only count NEW, specific developments as evidence — do not re-add general facts the base rate already implies.
${citeRule}
9. REFLECTION (optional): each prior source above shows its [stance, ±pp effect]. If this round's research shows a PRIOR source was wrong, stale, or double-counted, add a reflection entry: its target_url, a signed llr_adjustment (the CHANGE to its weight — NEGATIVE to walk it back toward NO, POSITIVE toward YES), a reason, and a new_source_url citing the NEW information that justifies the change. Only adjust a prior source when you have a NEW cited reason; do not re-litigate the whole estimate. Leave reflection empty ([]) if nothing prior needs correcting.

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
      "source_type": "official" | "press" | "insider",
      "credibility": "high" | "medium" | "low",
      "llr": -1.5,
      "cluster_id": "okc-sweep",
      "rationale": "why this moves the probability and by how much"
    }
  ],
  "reflection": [
    {
      "target_url": "https://... (a URL from the SOURCES ALREADY COUNTED list)",
      "llr_adjustment": -0.6,
      "reason": "why the prior source should be reweighted, given new info",
      "new_source_url": "https://... (the new source justifying this change)"
    }
  ],
  "agent_holistic_probability": 0.42,
  "confidence": "low" | "medium" | "high",
  "found_new_information": true,
  "notes": "caveats, resolution assumptions, what to check next round"
}
If you genuinely found no new relevant information this round, return an empty new_evidence array, an empty reflection array, and set found_new_information to false.`;
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
    summary: null,
  };
}

async function runOneRound(
  state: ForecastState,
  roundNo: number,
  maxRounds: number,
  opts: RunForecastOptions
): Promise<RoundRecord> {
  const log = opts.onLog ?? (() => {});

  // Analyst-in-the-loop: pending (unconsumed) notes and not-yet-handled doubt
  // marks are injected into this round's prompt as leads; consumed/handled ids
  // are stamped after success so the same input is never injected twice (a
  // doubt re-injected every round would let the agent walk the same source
  // back repeatedly — reflections are not URL-deduped).
  const analyst = loadAnalyst(state.eventId);
  const pendingNotes = analyst.notes.filter((n) => n.consumedRound == null);
  const doubtsHandled = analyst.doubtsHandled ?? {};
  const ledgerIds = new Set(state.evidenceLedger.map((e) => e.id));
  const pendingDoubtIds = Object.entries(analyst.marks)
    .filter(([id, mark]) => mark === "doubt" && doubtsHandled[id] == null && ledgerIds.has(id))
    .map(([id]) => id);
  const hasAnalystInput = pendingNotes.length > 0 || pendingDoubtIds.length > 0;
  const prompt = buildPrompt(state, roundNo, maxRounds, {
    hasWebSearch: providerHasWebSearch(),
    analyst: hasAnalystInput ? analyst : null,
  });

  // Run the agent, validating fail-closed with one retry on a parse/schema miss.
  const callAgent = opts.runAgentFn ?? runAgent;
  const validate = (r: { jsonObject: unknown | null }): AgentRoundOutput | null => {
    try {
      return validateRoundOutput(r.jsonObject);
    } catch {
      return null;
    }
  };
  let result = await callAgent(prompt, { model: opts.model });
  let out = validate(result);
  if (!out) {
    log(`  ⚠ round ${roundNo}: agent output failed validation; retrying once…`);
    result = await callAgent(prompt, { model: opts.model });
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

  const priorProb = state.currentProb;

  // (a) Reflection: corrections to PRIOR sources. Guardrail — keep only those whose
  // target is a real prior-round source (cited new source already enforced at
  // validation). Applied BEFORE this round's new evidence, clamped tighter, and
  // tagged separately so they never silently re-pick the whole probability.
  const ledgerByCanon = new Map(state.evidenceLedger.map((e) => [e.urlCanonical, e]));
  const reflItems = out.reflection
    .map((r) => ({ r, target: ledgerByCanon.get(canonicalizeUrl(r.target_url)) }))
    .filter((x): x is { r: (typeof out.reflection)[number]; target: LedgerEntry } => x.target !== undefined);
  const reflVerified = reflItems.map((x) => traceCanonical.has(canonicalizeUrl(x.r.new_source_url)));
  const reflLlrs = reflItems.map((x, i) => {
    const a = clampReflection(x.r.llr_adjustment);
    return reflVerified[i] ? a : clampUnverified(a);
  });

  // P0-4 + P0-3: new evidence, verification-clamped and cluster-damped.
  const verifiedFlags = survivors.map((ev) => traceCanonical.has(canonicalizeUrl(ev.source_url)));
  const baseLlrs = survivors.map((ev) => effectiveLlr(ev.stance, ev.llr));
  const factors = clusterFactors(
    survivors.map((ev) => ev.cluster_id),
    baseLlrs
  );
  const evLlrs = baseLlrs.map((base, i) => {
    const clustered = base * factors[i];
    return verifiedFlags[i] ? clustered : clampUnverified(clustered);
  });

  // Thread reflection adjustments first, then this round's new evidence.
  const { post, steps } = applyLlrs(priorProb, [...reflLlrs, ...evLlrs]);
  const reflSteps = steps.slice(0, reflItems.length);
  const evSteps = steps.slice(reflItems.length);

  const ts = nowUtc();
  const perSourceUpdates: PerSourceUpdate[] = [];
  const newLedger: LedgerEntry[] = [];
  let unverifiedPp = 0;

  reflItems.forEach((x, i) => {
    const step = reflSteps[i];
    const verified = reflVerified[i];
    if (!verified) unverifiedPp += Math.abs(step.deltaPp);
    const stance = reflLlrs[i] >= 0 ? "supports_yes" : "supports_no";
    const targetLabel = (x.target.title || x.r.target_url).slice(0, 60);
    perSourceUpdates.push({
      url: x.r.new_source_url,
      title: `↻ reflection on: ${targetLabel}`,
      from: step.probBefore,
      to: step.probAfter,
      deltaPp: step.deltaPp,
      explanation: x.r.reason,
      verified,
      clusterId: "__reflection",
      clusterFactor: 1,
      kind: "reflection",
      // The new source's own metadata isn't collected for reflections.
      sourceType: "press",
      credibility: "medium",
    });
    newLedger.push({
      id: `${state.eventId}-r${roundNo}-refl-${i}`,
      url: x.r.new_source_url,
      urlCanonical: canonicalizeUrl(x.r.new_source_url),
      title: `reflection on ${targetLabel}`,
      claim: x.r.reason,
      stance,
      strength: "moderate",
      kind: "reflection",
      clusterId: "__reflection",
      clusterFactor: 1,
      effectiveLlr: reflLlrs[i],
      probBefore: step.probBefore,
      probAfter: step.probAfter,
      deltaPp: step.deltaPp,
      rationale: x.r.reason,
      retrievedAtUtc: ts,
      firstSeenRound: roundNo,
      verifiedInSearchTrace: verified,
      // The new source's own metadata isn't collected for reflections.
      sourceType: "press",
      credibility: "medium",
    });
  });

  survivors.forEach((ev, i) => {
    const step = evSteps[i];
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
      kind: "evidence",
      sourceType: ev.source_type,
      credibility: ev.credibility,
    });
    newLedger.push({
      id: `${state.eventId}-r${roundNo}-${i}`,
      url: ev.source_url,
      urlCanonical: canon,
      title: ev.source_title,
      claim: ev.claim,
      stance: ev.stance,
      strength: ev.strength,
      kind: "evidence",
      clusterId: ev.cluster_id || `__solo_${i}`,
      clusterFactor: factors[i],
      effectiveLlr: evLlrs[i],
      probBefore: step.probBefore,
      probAfter: step.probAfter,
      deltaPp: step.deltaPp,
      rationale: ev.rationale,
      retrievedAtUtc: ts,
      firstSeenRound: roundNo,
      verifiedInSearchTrace: verified,
      sourceType: ev.source_type,
      credibility: ev.credibility,
    });
  });

  // (b) why-changed: decompose the round's net move across all of its deltas.
  let upPp = 0;
  let downPp = 0;
  let dom: PerSourceUpdate | null = null;
  for (const u of perSourceUpdates) {
    if (u.deltaPp >= 0) upPp += u.deltaPp;
    else downPp += u.deltaPp;
    if (!dom || Math.abs(u.deltaPp) > Math.abs(dom.deltaPp)) dom = u;
  }
  const whyChanged: WhyChanged | null = dom
    ? {
        netPp: (post - priorProb) * 100,
        upPp,
        downPp,
        dominantUrl: dom.url,
        dominantTitle: dom.title,
        dominantPp: dom.deltaPp,
        dominantKind: dom.kind,
      }
    : null;

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
    reflectionCount: reflItems.length,
    unverifiedPp,
    confirmationRatio: confirmationRatio(priorProb, baseLlrs),
    whyChanged,
    agentHolisticProb: out.agent_holistic_probability,
    confidence: out.confidence,
    reasoning: out.round_summary + (out.notes ? `  Notes: ${out.notes}` : ""),
    searchQueries: result.searchQueries,
    searchResultUrlCount: result.searchResultUrls.size,
    costUsd: result.costUsd,
  };

  // Stamp consumed analyst input (success path only). Re-read fresh: the app may
  // have appended notes while the round ran — only the ids actually injected are
  // stamped, anything newer stays pending for the next round. Doubt marks stay
  // visible in the UI but get a doubtsHandled stamp so they inject only once.
  if (pendingNotes.length > 0 || pendingDoubtIds.length > 0) {
    const injectedIds = new Set(pendingNotes.map((n) => n.id));
    const fresh = loadAnalyst(state.eventId);
    const freshHandled = { ...(fresh.doubtsHandled ?? {}) };
    for (const id of pendingDoubtIds) {
      if (fresh.marks[id] === "doubt" && freshHandled[id] == null) freshHandled[id] = roundNo;
    }
    saveAnalyst(state.eventId, {
      ...fresh,
      notes: fresh.notes.map((n) =>
        injectedIds.has(n.id) && n.consumedRound == null ? { ...n, consumedRound: roundNo } : n
      ),
      doubtsHandled: freshHandled,
    });
    if (pendingNotes.length > 0) record.analystConsumedIds = pendingNotes.map((n) => n.id);
  }

  state.roundHistory.push(record);
  return record;
}

export async function runForecast(
  state: ForecastState,
  opts: RunForecastOptions = {}
): Promise<ForecastState> {
  // Default 3: across a varied batch, round 1 does the bulk of the prior→evidence
  // correction and rounds beyond 3 moved <2pp (or oscillated without converging),
  // so 3 captures ~all the signal at ~1/2 the cost of higher caps.
  const maxRounds = opts.maxRounds ?? (Number(process.env.FORECAST_MAX_ROUNDS) || 3);
  const epsilon = opts.convergenceEpsilon ?? 0.01;
  // A single round with offsetting evidence can net ~0pp; before minRounds have
  // run, that is treated as "balanced so far", not convergence — the next
  // round's disconfirmation pass still gets its chance to break the tie.
  // Default 1 preserves the original stop behavior.
  const minRounds = opts.minRounds ?? (Number(process.env.FORECAST_MIN_ROUNDS) || 1);
  const log = opts.onLog ?? (() => {});

  const startRound = state.round + 1;
  let roundsRan = 0;
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
    roundsRan++;
    saveState(state);
    writeReport(state);
    opts.onRoundComplete?.(state, record);

    log(
      `  ✓ ${record.newSourceCount} new source(s)` +
        (record.reflectionCount ? `, ${record.reflectionCount} reflection(s)` : "") +
        (record.duplicateCount ? `, ${record.duplicateCount} dup skipped` : "") +
        ` → P(YES) ${(record.priorProb * 100).toFixed(1)}% → ${(record.postProb * 100).toFixed(1)}%` +
        (record.costUsd != null ? `  ($${record.costUsd.toFixed(3)})` : "")
    );

    // Stop conditions.
    if (record.newSourceCount === 0 && record.reflectionCount === 0) {
      state.status = "no_new_info";
      log(`  ■ no new evidence — stopping.`);
      break;
    }
    if (Math.abs(record.postProb - record.priorProb) < epsilon && roundNo >= minRounds) {
      state.status = "converged";
      log(`  ■ converged (move < ${(epsilon * 100).toFixed(1)}pp) — stopping.`);
      break;
    }
    if (roundNo >= maxRounds) {
      state.status = "max_rounds";
      log(`  ■ reached max rounds — stopping.`);
    }
  }

  // A resume with no rounds left (state.round already >= maxRounds) must not be
  // left "open" — the CLI resets status on resume, and an open state reads as
  // "still running" to every consumer forever.
  if (state.status === "open" && roundsRan === 0) {
    state.status = "max_rounds";
    log(`  ■ already at ${state.round}/${maxRounds} rounds — nothing to do.`);
  }

  // Final whole-forecast synthesis (explains the number; never re-decides it).
  // Skipped when no new round ran and a summary already exists (a no-op resume
  // must not re-spend an LLM call rewriting the same summary).
  if (state.roundHistory.length > 0 && state.status !== "aborted" && (roundsRan > 0 || !state.summary)) {
    log(`\n▶ Writing final summary…`);
    try {
      state.summary = await summarizeForecast(state, { model: opts.model, runAgentFn: opts.runAgentFn });
    } catch (err) {
      log(`  ⚠ summary generation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  state.updatedAtUtc = nowUtc();
  saveState(state);
  writeReport(state);
  return state;
}
