# Iterative Forecaster — Roadmap / Decisions

> Branch `feat/iterative-forecaster`. Records design decisions so they survive
> across sessions. Shipped items live in the code; this file tracks what's next.

## Shipped (verified end-to-end)

- Round-0 **framing**: normalize prompt → binary question + resolution criteria +
  inferred resolution date + settlement source; refuse + ask clarification if
  not forecastable. `--resolution` optional override.
- **Iterative loop**: each round the agent (Claude Code WebSearch) finds NEW
  evidence and proposes a signed per-source LLR; engine threads it through a
  Bayesian log-odds update (per-source percentage-point attribution).
- **Cross-round dedupe** by canonical URL; **fabricated-source guard** (cited
  URLs reconciled against the actual WebSearch trace).
- **Fail-closed** structured output (validate + 1 retry, never default a number).
- **Continuity invariant** (round N prior == N-1 posterior); stop on
  max-rounds / no-new-info / convergence. Resumable state + traceable report.

## Approved, not yet built

### (a) Reflection / cross-check stage (before each round's new search)
Feed the full evidence ledger + round history back to the agent and let it
re-examine prior rounds for staleness, contradictions, and missed
double-counting. **Guardrails (agreed):**
- A prior source may be **reweighted/retracted ONLY with a NEW cited reason**.
- Adjustment magnitude is **clamped** (same per-step LLR clamp).
- Reflection deltas are **tagged separately** (reflection-type, not new-source)
  and applied as their own attributed ledger entries.
- The agent may **not re-pick the whole probability** from scratch — only adjust
  specific prior sources with justification (preserves the continuity invariant
  and prevents oscillation / self-persuasion).

### (b) Per-round "why it changed" summary (delta → source AND reasoning)
Each round emits a structured synthesis: computed **net +pp vs −pp**
decomposition + **dominant driver(s)**, plus a one-line agent synthesis naming
the specific sources. Reasoning-type deltas (e.g. reflection reweights) are
traceable alongside source-type deltas. Rendered in report.md + state.json.

## Non-goals (decided)
- No automatic Brier/calibration scoring (arbitrary prompt events have no
  settlement oracle). State schema keeps enough to add resolution tracking later.
- Binary only (v1).
- Market-blindness NOT enforced (open web search is fine for this product).
- Web visualization built separately by the user (report.md + state.json are the
  integration surface).

## Brainstorm: further pipeline improvements
_Pending a multi-perspective necessity review — results appended here._
