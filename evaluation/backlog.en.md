# Forecasting Eval Backlog

Last updated: 2026-05-07

## Current Overall Plan Status

The repo currently has one lightweight overall entry point: [`docs/agent-handoff.md`](../docs/agent-handoff.md), maintained as P0 / P1 / P2 current project work. More specific product or engineering plans live under `docs/internal/plan/`. There is no single global plan that currently maintains P00 / P0 / P1 / P2 / P3 across the whole repo.

This file only tracks forecasting-agent / eval quality backlog and uses the P00 / P0 / P1 / P2 / P3 classification.

## P00 — Must Fix Before Any Live Run

- [x] **Market binding identity validation**: implemented on 2026-05-05. `marketSlug`, `tokenId`, `outcomeLabel`, and rule threshold must match exactly between report and execution plan; different strikes / teams / candidates under the same event must not bind by `eventSlug` alone.
- [x] **Price tolerance validation**: implemented on 2026-05-05. bestBid/bestAsk, decision price, and expected fill price may differ within 3%; above 3%, re-quote or require human review.

## P0 — Prioritize Before The Next Live Run

- [ ] **Real external-evidence review for existing positions**: on 2026-05-07, review output was structured as `freshEvidence` / `adverseSignals` / `stopOrReduceTriggers` / `pnlSnapshot`, but existing positions without Pulse coverage are still explicitly marked `not-refreshed`. Next step: make the pulse research stage pull rules, comments, external sources, and orderbooks for every held position, not only the current mark.
- [x] **Per-position PnL attribution + calibration ledger**: implemented on 2026-05-07. `pulse-live` now saves `position-mark-snapshot.json`, per-run `calibration-ledger.jsonl`, and appends the global `runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl` for future backtesting / single-run review.

## P1 — This Week Quality Improvements

- [ ] **Deep-research threshold**: live open decisions must have rules, resolution source, comments, orderbook, and source citations; incomplete research can only enter watchlist.
- [ ] **Low-edge policy**: trades below the strategy threshold must either skip/watchlist or explicitly explain why the strategy allows small edge.

## P2 — Report Readability And Evidence Quality

- [ ] **Structured citations**: key claims should use source / retrieved_at / credibility / viewpoint / short quote.
- [ ] **Comment-section sampling**: cover latest, top-liked, holder, and opposition comments; record whether each comment changes probability.

## P3 — Sports Data Collection TODO

- [ ] **Football / World Cup sources**: add or manually collect FIFA ranking, Elo / SPI-style ratings, bookmaker odds, injuries and squad news, schedule path, and sibling-market probability totals.
- [ ] **Eurovision sources**: add or manually collect Eurovisionworld / bookmaker odds, song-release reactions, semifinal draw, running order, media coverage, and community reactions.
- [ ] **Sports-market sensitivity**: for low-edge sports positions, show whether edge survives changes in external odds / Elo / injury assumptions.
