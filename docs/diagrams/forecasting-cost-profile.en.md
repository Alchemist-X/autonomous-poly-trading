# Forecasting Pipeline Cost Profile

> Principle: expectations for time and tokens are **measured, not folklore**. Append each session's numbers here; raw per-step CSVs live in `runtime-artifacts/pulse-live-cost-ledger/`, World Cup batch data in `runtime-artifacts/world-cup/run-ledger/`.
>
> 中文版：[`forecasting-cost-profile.md`](forecasting-cost-profile.md)
>
> Last updated: 2026-06-12

## Shape of one full live forecasting run (measured 2026-06-10, 3 complete runs)

| Stage | Measured time | Tokens | Notes |
| --- | --- | --- | --- |
| geoblock / positions read / order-gate probe | 1–2s each | 0 | probes total < 5s |
| **Research + render (the bulk)** | **719–750s (~12 min)** | **~41–42k in + ~5k out per run** | ~95% of the run; a **silent 0-byte stretch of 5+ min during `claude --print` rendering is normal**, internal timeout 30 min |
| Decision parse + risk trim + orders | seconds | 0 | common blocks: P00 price-drift gate, liquidity floor |

**Per-session reference** (2026-06-10: 3 full runs + 2 fix replays): 61 minutes, ~125k in + ~15k out tokens, 9 deep-dive samples, 2 real fills.

Derived rules of thumb:

- Budget a live run at **12–15 min and ~50k tokens**; three runs ≈ one hour
- Rendering is the only slow stage — optimization belongs there (typed pipeline / leaner templates), not in probes or execution
- Silence ≠ failure: do not kill the process under 5 minutes of 0-byte output; investigate past 15 minutes

## World Cup market-blind batch pipeline (measured 2026-06-11/12, all 87 questions)

| Unit | n | Median time | Median tokens (out) |
| --- | --- | --- | --- |
| Single-match forecast agent | 71 | 264s | ~14.2k |
| Group-winner writer | 12 | 317s | ~19k |
| Pool writer (QF/SF/champion) | 3 | 651s | ~34k |
| 100k Monte-Carlo simulation | 1 | 296s | ~22k |

Full 87-question run (10 concurrent): ~75 minutes, ~1.5M production output tokens. Details in `runtime-artifacts/world-cup/run-ledger/summary.md`.

## Append rules

- After each live session: add that day's CSV under `runtime-artifacts/pulse-live-cost-ledger/` and update the table above when numbers deviate by more than ±50%
- If render time consistently exceeds 15 minutes, treat it as a performance regression and file an issue instead of raising tolerance
