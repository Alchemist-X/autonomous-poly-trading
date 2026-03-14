# Risk Controls

Chinese version: [risk-controls.md](risk-controls.md)

Last updated: 2026-03-14

## Goal

This document defines hard service-side controls, not prompt suggestions.

Whether the upper runtime uses `codex` or `openclaw`, the orchestrator and executor must enforce these rules.

## 1. System halt rules

- The system enters `halted` when portfolio drawdown from the high-water mark reaches `20%`
- No new `open` actions are allowed while the system is `halted`
- Both `pause` and `halted` are fail-closed states
- Only an explicit admin `resume` allows normal scheduling to continue

## 2. Position-level controls

- A position is stopped out when unrealized loss reaches `30%`
- Stop-loss actions take priority over normal strategy actions
- `flatten` and stop-loss exits can override ordinary holding suggestions
- `hold`, `close`, and `reduce` may only target `token_id` values that exist in current live positions

## 3. Pulse-level constraints

- The runtime no longer uses a mock pulse fallback
- Pulse data must come from the real `fetch_markets.py` output
- A pulse is considered stale when it exceeds the configured max age
- A pulse is considered risky when tradeable candidates fall below the threshold
- A pulse is considered risky when any candidate is missing `clobTokenIds`
- If any pulse risk flag is present, no new `open` actions are allowed
- Any `open` decision must use a `token_id` from the pulse candidate set

## 4. Execution-level sizing constraints

- Only `FOK` orders are allowed
- `notional_usd` may not exceed `bankroll_usd`
- Default max total exposure is `50%` of bankroll
- Default max concurrent positions is `10`
- Default max single trade size is `5%` of bankroll
- `applyTradeGuards()` applies a second pass based on edge, open positions, and exposure
- Open requests below the minimum effective size are dropped

## 5. Provider output constraints

- The provider must emit valid `TradeDecisionSet` JSON
- Provider-supplied `artifacts` are not treated as the source of truth
- The service injects canonical `pulse-report` and `runtime-log` artifacts
- Invalid opens, out-of-scope token ids, and oversize actions are filtered at the service layer
- If the provider command is missing, a skill file is missing, or pulse fetch fails, the run must fail closed without a mock downgrade

## 6. Pulse storage naming

Pulse artifacts must be written into a consistent namespace for public display, debugging, and auditability.

Markdown path:

```text
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.md
```

JSON path:

```text
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.json
```

Where:

- `<timestamp>` uses UTC format `YYYYMMDDTHHMMSSZ`
- `<runtime>` is something like `codex` or `openclaw`
- `<mode>` is something like `full`, `review`, or `scan`
- `<runId>` is the UUID for the run

## 7. Trial-run constraints

- Trial runs validate the chain of “real pulse + provider output + risk filtering”
- Trial runs do not imply live order placement by default
- Any live smoke trade must be explicitly enabled and capped at `$1`
- Real trading is only allowed on allowlisted markets and a dedicated test wallet

## 8. Audit requirements

- This risk document must be maintained in both Chinese and English
- Pulse Markdown, Pulse JSON, and runtime logs must remain traceable
- Risk states, halt states, and admin actions must be persisted or logged
- Any new provider or new skill requires a review against this document first
