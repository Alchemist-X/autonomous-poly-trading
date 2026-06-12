---
name: daily-pulse
description: "Run the daily pulse main flow in the autonomous-poly-trading repository. Use when the user asks to run daily pulse or generate current portfolio review / monitor / rebalance reports. The default primary route is live real-money execution, with .env.pizza as the preferred test wallet environment; only downgrade to --recommend-only when the user explicitly asks for preview-only behavior."
---

# Daily Pulse

In this repository, the unified entrypoint for the daily pulse recommendation flow is:

`pnpm daily:forecast`

## When to use

- The user asks to “run daily pulse”
- The user wants one portfolio review / monitor / rebalance cycle
- The user wants the latest daily pulse recommendation
- The user wants to rerun daily pulse quickly from existing pulse artifacts

## Default behavior

- Default command:
  - `pnpm daily:forecast`
- Primary defaults:
  - Uses `forecast:live` internally
  - Does not add `--recommend-only`
  - Defaults `ENV_FILE` to `.env.pizza`
  - Defaults `AGENT_DECISION_STRATEGY` to `pulse-direct`
  - Defaults `AUTOPOLY_EXECUTION_MODE` to `live`
  - Treats real-money live flow as the main route

Only when the user explicitly asks for preview-only behavior, use:

- `pnpm daily:forecast -- --recommend-only`

## Common variants

- JSON output:
  - `pnpm daily:forecast -- --json`
- Reuse existing pulse artifacts and skip pulse regeneration:
  - `pnpm daily:forecast -- --pulse-json <path> --pulse-markdown <path>`
- Explicit preview-only downgrade:
  - `pnpm daily:forecast -- --recommend-only --json`
- Force the legacy provider review path:
  - `AGENT_DECISION_STRATEGY=provider-runtime pnpm daily:forecast`

## Pre-run checks

- If `ENV_FILE` is not specified, `.env.pizza` is the default
- Interpret the main route as real-money execution
- Only add preview-only mode when the user explicitly asks for it:
  - `pnpm daily:forecast -- --recommend-only --json`

## What to report back

After the run, report at least:

- Which env was used
- Whether it was `recommend-only` or `execute`
- `runId`
- archive directory
- paths for recommendation / execution / review-report
- key outcomes:
  - new positions
  - suggested reductions / exits
  - items blocked by guardrails

## Key artifact locations

- `runtime-artifacts/pulse-live/<timestamp>-<runId>/`
- `runtime-artifacts/reports/pulse/...`
- `runtime-artifacts/reports/review/...`
- `runtime-artifacts/reports/monitor/...`
- `runtime-artifacts/reports/rebalance/...`
