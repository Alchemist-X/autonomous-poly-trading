# Iterative Forecaster — Roadmap / Decisions

> Branch `feat/iterative-forecaster`. Records design decisions so they survive
> across sessions. Shipped items live in the code; this file tracks what's next.

## Shipped (verified end-to-end)

- Round-0 **framing** + **skeptical audit** (P0-1) + model **self-estimated
  base-rate prior** (P0-2): normalize prompt → binary question + resolution
  criteria + inferred date + settlement source; a second pass corrects an
  ambiguous bar; the prior seeds currentProb (clamped [0.01,0.99]) instead of 0.5.
  Refuse + ask clarification if not forecastable.
- **Research Focus Center** (phase one, 2026-08-27): after framing, classify and
  decompose the question, choose one probability model, require broad search
  directions, rank source classes, and define completion criteria before research.
- **Claim-level iterative loop**: each round searches broadly, performs a
  primary-source pass, cross-checks decisive claims, tests the strongest
  countercase, and selects the best evidence. One atomic claim receives one signed
  log-likelihood-ratio update; additional pages only corroborate or contradict it.
- **Engine-computed evidence quality**: direct sources are ranked; search-trace
  verification and independent-origin groups determine confirmed, single-source,
  contested, or unverified status. The research model cannot self-certify a claim.
- **Single probability authority**: the research agent no longer emits a holistic
  challenger probability. The engine alone maintains the estimate.
- **Readable decision report**: resolution rules, Focus Center, the one adopted
  model, ranked claims with direct links, scenarios, monitoring triggers,
  information gaps, quality checks, and an audit appendix. User-facing prose avoids
  abbreviations or defines them on first use.
- **Independence-aware aggregation** (P0-3): per-claim cluster identifier;
  correlated claims from the same causal story receive diminishing weight.
- **Disconfirmation pass + confirmation-ratio** (P0-5): each round must search to
  falsify the current lean; one-sided rounds flagged.
- **Cross-round claim dedupe** by semantic claim identifier or normalized claim
  text; **fabricated-source guard** (P0-4):
  cited URLs reconciled against the actual WebSearch+WebFetch tool trace;
  unverified sources soft-clamped to |llr|≤0.2 (not dropped).
- **(a) Reflection / cross-check**: each round may correct a prior source
  (target + signed adjustment + reason + NEW cited source), clamped to |llr|≤1.0,
  tagged separately, threaded before new evidence — never re-picks the whole number.
- **(b) Per-round why-changed**: computed net pp + supporting/opposing split +
  dominant driver, rendered as a "Why it changed" line.
- **Default max-rounds = 3** (tuned from a 6-question batch; see below).
- **Fail-closed** structured output (validate + 1 retry, never default a number).
- **Continuity invariant** (round N prior == N-1 posterior); stop on
  max-rounds / no-new-info / convergence. Resumable state + traceable report.

## Future: agentic redesign beyond phase one (NOT urgent)

The per-round "score every source" cadence is somewhat rigid. Keep the core
binding (engine owns the number; every move attributed via LLR — this prevents
the demo's hallucinated-number problem), but loosen the *unit* and add
cross-check as a first-class step. **Level 1 shipped in phase one**: the evidence
unit is now a reasoned claim backed by one or more ranked sources. The remaining
larger option is:
- **Level 2:** a true action loop — agent picks search / fetch /
  cross_check / reason / update / reflect / finalize each step; only `update`
  moves the probability (still via engine LLR). Higher quality ceiling, much more
  orchestration. Do only if Level 1 proves insufficient.
- **Red line:** "more agentic" = freer RESEARCH; the OUTPUT stays structured,
  attributed, and guardrailed (reflection guardrails preserved).

## Non-goals (decided)
- No automatic Brier/calibration scoring (arbitrary prompt events have no
  settlement oracle). State schema keeps enough to add resolution tracking later.
- Binary only (v1).
- Market-blindness NOT enforced (open web search is fine for this product).
- Web visualization built separately by the user (report.md + state.json are the
  integration surface).

## Brainstorm: further pipeline improvements (necessity-reviewed)

Ranked by NECESSITY after a multi-lens proposal + adversarial challenge pass.
"Necessary" = the forecaster is materially wrong/untrustworthy without it.

### NECESSARY (correctness / trust) — ✅ ALL 5 SHIPPED + validated
1. **Validate the framing before spending rounds** [S–M] — ✅ second skeptical audit
   and only retries on JSON parse failure; if it drifts the YES/NO bar, inverts an
   edge case, picks the wrong resolution date, or wrongly returns forecastable, the
   whole calibrated engine quantifies the WRONG question ("garbage bar in,
   beautifully-calibrated garbage out"). Fix: a cheap second-opinion cross-check on
   {question, bar, date} (or a human-confirmable restatement gate), and re-surface
   the frame inside the reflection step so a round can flag a mis-stated bar.
2. **Base-rate / reference-class prior instead of 0.5** [M] — logit(0.5)=0 means the
   posterior is ENTIRELY the LLRs a few searches surface; no anchor, no offset, and
   nothing to regress toward. Framing emits a reference class + base_rate; seed
   currentProb from it. Rare/near-certain events are otherwise pulled to ~50%.
3. **Independence-aware aggregation (cluster correlated sources)** [M] — additive
   log-odds is valid only under conditional independence. 5 outlets echoing one wire
   story each add an LLR → +10 nats from one fact, slamming P to the wall. URL dedupe
   is blind to this. Tag a claim_cluster_id; apply diminishing returns within a
   cluster. The dominant integrity defect.
4. **Make the `verified` flag consequential** [S] — the fabrication guard already
   flags cited URLs absent from the real WebSearch trace, but the engine applies them
   at full strength anyway. Down-weight/clamp unverified sources. ⚠ Pair with a
   capture-completeness audit (WebFetch URLs / nested result shapes can false-negative)
   and start with a SOFT clamp (~0.2), NOT a hard drop, or real evidence gets deleted.
5. **Disconfirmation pass + confirmation-ratio** [S] — the round prompt feeds the agent
   its own prior and lets it free-search → a structural confirmation-bias ratchet that
   also evades the convergence stop. Require ≥1 search framed to falsify the current
   lean each round; track the confirming/opposing LLR ratio. Composes with reflection (a).

### HIGH VALUE
6. **Anti-extremization shrink toward the base rate** [M, after #2] — regress the
   posterior toward the outside view when confidence is low / few independent clusters.
7. **Convergence needs K-round stability with NEW independent evidence** [S] — don't
   stop on a single sub-1pp round; distinguish "converged" from "stalled / dedup-starved".
8. **Per-round signed-sum LLR cap** [S] — cheap interim backstop against single-round
   saturation; largely subsumed once clustering (#3) lands, so ship as a stopgap then retire.

### LATER / NICE
- Surface daysUntilResolution to the agent (prompt only; skip auto time-decay LLR — it
  hard-codes a contestable "YES needs a visible precursor" assumption).
- Effective-independent-source count in the credible interval (rider on #3) — or just
  downgrade the CI to a qualitative label, since it's explicitly uncalibrated.
- Reliability-tier source weighting (overlaps with #3 + #4).
- Scoped self-consistency: re-rate ONLY the few highest-impact LLRs (not full ensemble).

### DO NOT (over-engineering / non-goals)
- Full N-agent ensemble per round (cost×, low marginal calibration gain vs shrink+caps).
- Automatic Brier/calibration scoring (no settlement oracle — explicit non-goal).
- Multi-outcome / continuous (binary only, v1). Enforcing market-blindness (open web is fine).


## Empirical: max-rounds tuning (6-question batch @ max-rounds 6)

Round 1 does the bulk of the prior→evidence correction; rounds beyond 3 moved
<2pp or oscillated without converging. Per-round |move| (pp):

| Question (prior→final) | rounds | moves |
| --- | --- | --- |
| Foldable iPhone (60%→41%) | 6 (max) | −28.9, +4.7, −2.3, +5.1, +4.8, −2.9 (oscillates, never converges) |
| Unemployment >5% (12%→1.6%) | 4 conv | −4.0, −4.4, −1.8, −0.2 |
| ETH >$6k (5%→1%) | 3 conv | −2.5, −1.5, +0.0 |
| GPT-6 by 2026 (40%→34%) | 3 max | +9.2, −13.9, −1.6 |
| Film >$2B (7%→1%) | 2 conv | −5.1, −0.9 |

**Decision: default max-rounds = 3** (was 4). 3 captures ~all the signal at ~half
the cost; the one case that wanted more (iPhone) oscillated in a ±4pp band rather
than converging — a sign it's genuinely uncertain, not under-researched, so extra
rounds don't help. Users can bump `--max-rounds` for hard/contested questions.
Reflections fired in 5/6 multi-round runs (1–2 each) — (a) is actively used.

**Follow-up (P1):** the single sub-1pp convergence stop missed the oscillating
case; a "small move for K consecutive rounds" band-convergence would stop it
earlier (already on the P1 list as "convergence needs K-round stability").
