# Raven 10x Roadmap (2026-07-02)

> 中文主文档：[`../raven-10x-roadmap.md`](../raven-10x-roadmap.md)
>
> Method: 4 independent lenses (product / forecasting science / trading & monetization / platform) proposed 22 features grounded in the actual codebase; an adversarial audit verified every code claim (caught 1 fabricated asset), scored 10x impact, and merged duplicates; final human synthesis below.

## North star

Turn Raven from a one-shot Q&A tool into a **trusted, self-updating, publicly scored forecasting system**. Three flywheels mesh: research engine (done) → scoring/calibration (P1) → public credibility (P4), with continuous monitoring (P2) and trading edge (P3, per-action user confirmation) hanging off them.

The single sentence that organizes everything: **an unscored forecast is an opinion**. The codebase's biggest unclaimed asset is that `state.json` already records everything scoring needs (resolutionDate, settlementSource, evidence ledger) — nothing collects.

## Phase 0 — Foundations (~1–2 wks)

1. **Engine extraction** = issue #56 (already accepted).
2. **Deadline-aware probability decay** (correctness fix, zero LLM cost): for "X by DATE" questions the displayed P must drift toward NO as the window shrinks with no confirming news. AC: decay function alongside (never overwriting) raw P; unit-tested curve; UI labels decayed values.
3. **Single-flight run queue + global budget arbiter**: deterministic per-eventId single-flight (replacing the mtime heuristic); ALL schedulers share one priority queue and one daily round budget; exhausted budget → visible skip, never silent.
4. **Zero-resolution validity checks** (runnable this week on the DeepSeek tier): question inversion (P+P(complement)≈1), paraphrase stability ×3, cross-provider agreement. AC: `forecast:validity` command + baseline report for 10 sample questions archived as a regression reference.

## Phase 1 — Scoring loop / Track Record (audit score 9/10)

Resolution proposal (agent) → **analyst one-click confirm** (never auto-scored) → append-only JSONL ledger → public `/track-record` page (all-time N, Brier, calibration bins + ECE, misses included, unresolved/void listed — no survivorship bias). Brier/ECE extracted to a shared lib consumed by both this page and the WC performance page. Corrections are superseding entries, never edits. Grounded in: `resolutionDate`/`settlementSource` already framed; `"resolved"` status enum exists but is never set; `scripts/world-cup/lib/performance.ts` already implements the math.

## Phase 2 — Living forecasts / Watchlist (7/10)

Explicit opt-in tracking; daily scheduled re-runs via the existing resume path (scheduler must raise `--max-rounds` per session — audit-confirmed semantics fix); delta feed UI sorted by |Δpp| with whyChanged driver lines; daily one-page markdown brief to one user-chosen channel; <2pp = "no material change", excluded from brief; direction-flip oscillation → "contested" flag; all runs through the Phase-0 budget arbiter.

## Phase 3 — Edge stack (8/10), strict order

1. **Machine-enforced market-blind quarantine** (build first, shared): price-domain blocklist + post-hoc search-trace audit → "quarantine certificate" written into state.json; edge/trading paths consume certified runs only. (Audit: "best single mechanism of all 22 proposals.")
2. **Edge scanner**: blind-forecast the top ~30 liquid Polymarket binaries (question text only), join vs frozen implied price at forecast timestamp (existing baseline-prices pattern); market settlement doubles as the resolution oracle and feeds Phase-1 N.
3. **Cost tiers**: DeepSeek triage gates the Claude deep pass; triage tier never trades/publishes (code-enforced).
4. **Positions re-review**: scanner machinery pointed at open holdings; makes "net edge < 0 → sell" mechanically checkable; no auto-orders.
5. **Approval-gated routing** (⚠️ per-action user confirmation): candidates into the existing `pulse-live --recommend-only` pipeline; forced market re-read before any order; no silent path past recommend-only.

## Phase 4 — Distribution (after the ledger has receipts) (6/10)

One-click publish: frozen static dossier at forecasting-agent.com/f/\<slug\> with OG card; verified/unverified flags preserved (trust flags never laundered); versioned re-publish; curated by the operator — NO public self-serve asks, no comments, no accounts.

## Continuous (condition-triggered)

- **Calibration backfit** (at N≥~50 resolutions): zero-LLM replay of persisted ledgers to fit the hand-tuned bayes constants; report-only, constant changes require user confirmation + archived fit report.
- **Ensemble disagreement CI**: opt-in for high-stakes questions only (3× cost).
- **Fermi decomposition**: cut; keep the one-line cheap version (audit flags conjunctive questions in framingCaveats).

## Explicitly cut (audit verdicts)

Scoped API keys / multi-user (2/10) · API v1 + HMAC webhooks (4/10) · SQLite ledger (4/10 — nightly script suffices) · Analyst impact ledger (4/10 — revisit post-scoring) · Base-rate library (5/10 — revisit when the resolved corpus can seed it).

## Two user decisions needed

1. **World Cup succession**: the public site's content engine (87 blind forecasts, daily resolutions) dries up in ~3 weeks. Which public blind-forecast stream replaces it (macro / tech launches / sports seasons / scanner picks), at what cadence?
2. **Publish-vs-trade sequencing**: advertising an edge can move the market you want to trade. Trade-then-publish, publish-only domains, or full transparency — needs an explicit policy.
