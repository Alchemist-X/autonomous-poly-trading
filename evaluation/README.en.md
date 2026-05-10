# Forecasting Agent Evaluation (eval) Rubric

Last updated: 2026-05-07

This directory fixes the standard quality-evaluation workflow for forecasting agents. `evaluation/` is the canonical directory name; `eval` is the short name.

## Human Review Entry

- Current sample score: [`runs/2026-04-26-5f9b3d43.en.md`](runs/2026-04-26-5f9b3d43.en.md)
- Eval quality TODOs: [`backlog.en.md`](backlog.en.md)
- Chinese originals: [`README.md`](README.md), [`runs/2026-04-26-5f9b3d43.md`](runs/2026-04-26-5f9b3d43.md)
- Raw run summary: `runtime-artifacts/pulse-live/2026-04-26T060306Z-5f9b3d43-56b9-481b-a593-a5f64863e26a/run-summary.md`
- Raw Pulse report: `runtime-artifacts/reports/pulse/2026/04/26/pulse-20260426T060323Z-claude-code-full-5f9b3d43-56b9-481b-a593-a5f64863e26a.md`
- Machine-readable artifacts: `runtime-artifacts/pulse-live/2026-04-26T060306Z-5f9b3d43-56b9-481b-a593-a5f64863e26a/recommendation.json` and `execution-summary.json`

## Score Structure

Total score: 100. The object being scored is reproducible forecasting quality, not one-run PnL.

| Dimension | Weight | Evaluation Question |
| --- | ---: | --- |
| Agentic Search | 45 | Did the agent find strong information and assemble it into a verifiable evidence chain? |
| Long-horizon Reasoning | 45 | Did the agent convert evidence into probabilities, scenarios, position sizing, and future-state previews? |
| Trading / Archive Integrity | 10 | Are the researched market, executed order, fill result, and run summary consistent? |

## Hard Gates And Score Caps

These are not normal deductions. They cap the final score. If multiple gates trigger, use the lowest cap.

| Gate | Cap | Meaning |
| --- | ---: | --- |
| Researched object does not match the live `marketSlug` / `tokenId` / outcome / threshold | 49 | P00 issue for real-money trading. If the report researches market A but executes market B, edge, sizing, and fill explanations are invalid |
| Executed trade lacks explicit rules or resolution source | 60 | A forecast cannot safely become an executable trade without known settlement rules |
| Tradable recommendation mainly relies on unverifiable common knowledge with no independent external support | 75 | Especially important for sports, politics, commodities, and macro markets |
| Existing position has no fresh signal but is reported as “still has edge” | 80 | Holding can be valid, but it must be labeled stale-hold / needs-review, not refreshed edge |
| Post-fill account state, position count, or equity change is inconsistent and unexplained | 85 | The run summary must make the real state understandable |

## A. Agentic Search (45 Points)

| Subitem | Points | Full-Credit Standard |
| --- | ---: | --- |
| A1 Candidate discovery and coverage | 8 | Records scan scope, filters, and candidate-pool size; deep research coverage is sufficient to support final trades |
| A2 Research-rule compliance | 8 | Every tradable decision has rule text, resolution source, price/orderbook, comments, and missing-info notes |
| A3 Source targeting | 8 | Uses primary sources, authoritative data, and independent external sources; avoids relying only on Polymarket pages and generic common sense |
| A4 Comment-section mining | 6 | Explains sampling method and covers newest, top-liked, holder, and opposing comments when available |
| A5 Credibility and citation discipline | 8 | Each key claim has source, retrieval time, credibility grade, viewpoint attribution, and short original quote when useful |
| A6 Evidence assembly and gap surfacing | 7 | Assembles evidence, counterevidence, and gaps into one coherent thesis; marks information insufficient for trading when needed |

## B. Long-horizon Reasoning (45 Points)

| Subitem | Points | Full-Credit Standard |
| --- | ---: | --- |
| B1 Probability-model clarity | 8 | Shows base rate, market price, AI estimate, and edge in a way humans can audit |
| B2 Evidence-to-probability update chain | 8 | Explains how each evidence item raises or lowers probability without arbitrary +/- adjustments |
| B3 Scenario simulation and time path | 10 | Previews future nodes, triggers, adverse cases, and price paths before expiry |
| B4 Calibration, sensitivity, and thresholds | 7 | Shows sensitivity to key assumptions; low-edge trades have explicit skip/downgrade rules |
| B5 Portfolio-level reasoning | 6 | Checks correlation, directional crowding, category risk, fresh edge on existing positions, and event exposure |
| B6 Readability and redundancy control | 6 | Reasoning is detailed but not repetitive; conclusions, evidence, and actions line up |

## C. Trading / Archive Integrity (10 Points)

| Subitem | Points | Full-Credit Standard |
| --- | ---: | --- |
| C1 Market-binding consistency | 4 | Report title, rule threshold, marketSlug, tokenId, and outcomeLabel must match exactly; bestBid/bestAsk and decision price may differ within 3% |
| C2 Sizing and risk-control consistency | 3 | Kelly, live caps, minimum order, event exposure, and final order amount are explained |
| C3 Post-fill state traceability | 3 | Cash, equity, position count, orders, missing positions, and anomalies are explained |

## Standard Eval Workflow

1. Collect the same-`runId` `run-summary.md`, Pulse Markdown/JSON, review/monitor/rebalance reports, `recommendation.json`, and `execution-summary.json`.
2. Run consistency preflight: check `runId`, execution mode, wallet/env, timestamps, candidate count, decision count, fill count, and post-fill position count.
3. Build a decision evidence sheet: for each decision, record action, exact `marketSlug`, `tokenId`, outcome, threshold, price, AI probability, market probability, edge, sources, comment sample, gaps, and confidence.
4. Check market binding line by line: the market in the research text must be the same outcome that is executed, especially for different strikes / candidates / teams under the same event.
5. Score the raw run across A/B/C.
6. Apply hard gates and score caps to produce the final score.
7. Output P00/P0/P1/P2/P3 findings: P00 blocks live, P0 should be fixed before the next live run, P1 is this-week quality improvement, P2 is report/evidence improvement, and P3 is long-term data-source TODO.
8. Provide the next-run acceptance checklist instead of only abstract feedback.

## Calibration / Backtesting Data

After 2026-05-07, `pulse-live` / `pulse:recommend` runs additionally save:

- Per-run position mark snapshot: `runtime-artifacts/pulse-live/<ts>-<runId>/position-mark-snapshot.json`
- Per-run calibration records: `runtime-artifacts/pulse-live/<ts>-<runId>/calibration-ledger.jsonl`
- Global append-only ledger: `runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl`

Each `calibration-ledger.jsonl` row maps to one decision and records decision probabilities, market price, edge, execution status, fill price, filled notional, before/after marks, and pending outcome placeholders. Future backtesting only needs to join resolved outcome / realized PnL back onto the same `decisionKey`.

## Minimum Acceptance Bar For Live Recommendations

- Every market to be traded must have complete rules, exact outcome, exact threshold, current bid/ask, `tokenId`, and side verification.
- Every non-rules-arbitrage trade needs at least two independent external sources; sports, politics, and commodities cannot rely only on Polymarket plus common sense.
- Comment review should cover at least 20 comments or all comments when fewer than 20 exist, with the sampling policy documented.
- The report must record at least one opposing evidence item, or the exact search path that found no opposition.
- New positions below +5pp edge default to watchlist unless the strategy file explicitly allows them and explains why.
- Existing positions with no fresh signal must be labeled `stale-hold / needs-review`, not “still has edge”.
- The run summary must explain post-fill cash, equity, and position-count changes, with both account-level and per-position mark PnL attribution; if “3 fills but positions +2” happens, it must raise a separate warning.
