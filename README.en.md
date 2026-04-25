<p align="center">
  <img src="assets/predict-raven.png" alt="predict-raven" width="220" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

# Predict Raven

> This is the English README. 中文版见 [README.md](README.md).

Last updated: 2026-04-26 (renamed to predict-raven; runs on Polymarket CLOB V2 SDK)

---

**predict-raven** is an AI Agent that autonomously runs on [Polymarket](https://polymarket.com) — the **first autonomous, continuously-running** trading agent for prediction markets.

Watch live:

- **Decision log / equity curve**: [autopoly-pizza-spectator.vercel.app](https://autopoly-pizza-spectator.vercel.app)
- **On-chain positions / fills (Polymarket profile)**: [`0x6664...614e`](https://polymarket.com/profile/0x6664e32f79aee42639f73633e40b5a842b07614e)

## Quick Start

Driven entirely through an AI Agent (Claude Code / Codex / OpenClaw) in natural language. No commands to memorise.

### 1. Set up

Say to the Agent:

```
build
```

Expected: runs `pnpm install` + `pnpm build`, prints "✅ build passed". No Docker, no real wallet needed.

### 2. Configure funds

Put your Polymarket credentials in `.env.live-test`, then say:

```
preflight with .env.live-test
```

Expected: prints `ENV_FILE`, wallet address, collateral (pUSD) balance. Missing fields fail-fast.

### 3. Recommendations only

Say:

```
pulse, recommendations only
```

Expected: candidate table (market / action / size / edge / monthlyReturn), Summary written to `runtime-artifacts/pulse-live/<ts>-<runId>/`.

### 4. Real-money live trading

Say:

```
rerun the pulse, place real orders
```

Expected: FOK orders, then prints `execution-summary.md` path with fills / rejections / trimming details.

> For concrete pnpm commands, env vars, and archive directories, see [Illustration/dev-reference.md](Illustration/dev-reference.md).

## System design notes

The system is built around a single core component, **Market Pulse**: it lets the AI independently estimate the probability of an event, dynamically gathers evidence from information sources, compares that evidence against the market's implied odds, and issues trading instructions that combine edge with capital return efficiency.

### Why let an Agent do this

1. **Superhuman reasoning on complex tasks** — Agents now match or exceed human-level reasoning on complex problems. Most of the time, the human edge is better information sources rather than reasoning, and engineering can close that gap. The core analytical capability is already in place.
2. **Broad coverage and fast reaction time** — An Agent can monitor thousands of markets 24/7 and spot pricing dislocations no individual could track. When news breaks, the Agent responds in seconds; a human needs at least three minutes. Opportunities like this appear across countless markets.
3. **Prediction markets are still a blue ocean** — Most participants in political and tech prediction markets lack a clear pricing model and broadly fear inventory management and adverse-selection risk. Systematic Agent trading faces very little competition in these areas. Even in sports, there is plenty beyond moneyline markets.

### Core positioning

- Every order the Agent places and its decision reasoning are published on the website
- The Agent runs continuously in the cloud — not as ad-hoc local scripts — with no human in the loop
- Runs on `@polymarket/clob-client-v2` with pUSD as the default collateral; V2 cutover is 2026-04-28 11:00 UTC, see [`Plan/2026-04-28-v2-cutover-runbook.md`](Plan/2026-04-28-v2-cutover-runbook.md) for the runbook

## Architecture Overview

The system has four layers; data flows top to bottom:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 · Research / Pulse                                 │
│  Fetches Polymarket listings, produces the Pulse pool       │
│  Output → runtime-artifacts/reports/pulse/...               │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2 · Decision / Runtime                               │
│  orchestrator turns Pulse + position context → decisions    │
│  Primary: pulse-direct │ Legacy: provider-runtime           │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 · Execution / Risk                                 │
│  Service-layer hard risk trimming → executor order / sync   │
│  FOK market · ≤15% per trade · ≤80% expo · ≥30% halt        │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4 · State / Archive / UI                             │
│  DB / local state / runtime-artifacts archive / apps/web    │
└─────────────────────────────────────────────────────────────┘
```

## Provider Switching

The system is not tied to a single AI framework. Swapping between Codex / Claude Code / OpenClaw is a one-line change:

```bash
AGENT_RUNTIME_PROVIDER=codex        # options: codex / claude-code / openclaw
```

Custom Agents are plugged in via a template command configured through `<PROVIDER>_COMMAND`. See [.env.example](.env.example) for examples and placeholders.

## Decision Engine

There are currently two decision strategies, selected via the `AGENT_DECISION_STRATEGY` environment variable:

### pulse-direct (current default)

```
Pulse markdown → Regex/table parsing → PulseEntryPlan
                                        ↓
Current positions → reviewCurrentPositions → hold/reduce/close
                                        ↓
           monthlyReturn sort (top 4) → 20% batch cap
                                        ↓
                   composePulseDirectDecisions → TradeDecisionSet
```

No external LLM process is needed. Entry candidates are extracted directly from Pulse's structured sections, sorted by `monthlyReturn = edge / monthsToResolution`, the top 4 are taken, and total staking in a single round is capped at 20% of bankroll.

### provider-runtime (legacy comparison)

Spawns an external process (Codex / OpenClaw / Claude Code CLI), passes Pulse + position context to the LLM, and parses stdout into a `TradeDecisionSet`. Still functional, but no longer the default path.

## Risk Controls

**Core principle: risk controls do not rely on prompt engineering — they are service-layer hard rules.** No matter which provider or decision strategy runs upstream, anything entering the orchestrator / executor pipeline is bound by the same constraints: Agent reasoning errors, bad data, and model overreach cannot bypass them. Three tiers of defence plus Pulse-level preflight checks trim everything before orders go out; individual positions that cross the line are force-stopped; a system-wide drawdown breach halts trading immediately, and only an admin can resume (fail-closed).

### System level

| Rule | Threshold | Effect |
| --- | --- | --- |
| Portfolio drawdown halt | NAV drawdown from HWM ≥ **30%** | Enter `halted`, block all new opens |
| Recovery | Admin `resume` only | Fail-closed by design |

### Position level

| Rule | Threshold |
| --- | --- |
| Per-position stop-loss | Unrealized loss ≥ **30%** |
| Stop-loss priority | Higher than regular strategy actions |

### Execution level

| Rule | Default |
| --- | --- |
| Order type | **FOK** market orders |
| Per-trade cap | **15%** of bankroll |
| Max total exposure | **80%** of bankroll |
| Max per-event exposure | **30%** of bankroll |
| Max concurrent positions | **22** |
| Minimum trade notional | **$5** |
| Minimum effective notional | Below threshold → discard |

### Pulse level

- Must come from a real `fetch_markets.py` fetch — no mock fallback
- Stale Pulse (>120 minutes) or too few candidates (<1) is treated as a risk state; no new `open` in that round
- `open` actions' `token_id` must originate from the Pulse candidate set

Full rules: [risk-controls.md](docs/risk-controls.md).

## Environment Variables

Full template: [.env.example](.env.example)

Organised into four groups:

| Group | Key Variables | Purpose |
| --- | --- | --- |
| **Shared** | `AUTOPOLY_EXECUTION_MODE` `DATABASE_URL` `REDIS_URL` `AUTOPOLY_LOCAL_STATE_FILE` | Execution mode (paper/live), infra connections |
| **Web** | `ADMIN_PASSWORD` `ORCHESTRATOR_INTERNAL_TOKEN` | Admin authentication |
| **Executor** | `PRIVATE_KEY` `FUNDER_ADDRESS` `SIGNATURE_TYPE` `CHAIN_ID` | Polymarket wallet and chain config |
| **Orchestrator** | `AGENT_RUNTIME_PROVIDER` `AGENT_DECISION_STRATEGY` `PULSE_*` `CODEX_*` | Provider selection, Pulse fetching, risk parameters |

If your Polymarket credentials live in an adjacent repo, you can set `ENV_FILE=../pm-PlaceOrder/.env.aizen`. For real-money testing, stick to a dedicated `.env.live-test`.

## Wallet and Account Setup

The Polymarket order path needs at least four fields:

- `PRIVATE_KEY` — wallet private key (prefer a Polymarket proxy wallet over your main wallet)
- `FUNDER_ADDRESS` — the Polymarket proxy wallet address (the one that holds collateral)
- `SIGNATURE_TYPE` — `0` or `1`, depending on wallet type
- `CHAIN_ID` — `137` (Polygon mainnet)

Keep these in separate per-purpose files, none of which are committed:

- `.env.live-test` — real-money live-trading credentials
- `.env.<wallet-name>` (e.g. `.env.pizza`) — split by wallet name to avoid mixing them up

Every preflight prints the current `ENV_FILE`, wallet address, and collateral amount. If any of them do not match, it aborts immediately so you never accidentally trade on the wrong wallet.

## External Repository Dependencies

`vendor/manifest.json` pins the following external repos to specific commits:

| Repository | Purpose |
| --- | --- |
| `polymarket-trading-TUI` | Trading terminal and CLOB wiring reference |
| `polymarket-market-pulse` | Pulse research input |
| `alert-stop-loss-pm` | Stop-loss logic reference |
| `all-polymarket-skill` | Backtesting, monitor, resolution skill references |
| `pm-PlaceOrder` | Order placement reference and local credential source |

Run `pnpm vendor:sync` to sync them into `vendor/repos/`. A plain `pnpm build` does not need vendor, but the pulse / trial / live paths must sync first.

## Run Archives

All run artifacts are written to `runtime-artifacts/` (already in `.gitignore`), rooted at `ARTIFACT_STORAGE_ROOT`.

| Path | Contents |
| --- | --- |
| `reports/pulse/YYYY/MM/DD/` | Pulse markdown + JSON |
| `reports/review\|monitor\|rebalance/` | Portfolio reports |
| `reports/runtime-log/` | Decision runtime explanatory logs |
| `pulse-live/<timestamp>-<runId>/` | Pulse Live run artifacts |
| `live-test/<timestamp>-<runId>/` | Stateful run artifacts (includes `error.json` on failure) |
| `checkpoints/trial-recommend/` | Paper recommendation resume checkpoints |
| `local/paper-state.json` | Default paper state file |

Failure archives (per the AGENTS convention) go to `run-error/` with the failing stage, core context, root-cause summary, and next-step command.

## TODO

- [ ] **High priority · logged 2026-04-21** — Manual review and optimisation of the Pulse flow (end-to-end: prompts / skill docs, candidate and archive quality, keeping `Illustration/pulse-live-flow.md` and friends aligned with real runs).

## Doc Index

- [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) — Agent collaboration conventions (required reading)
- [risk-controls.md](docs/risk-controls.md) — Full write-up of the hard risk rules
- [.env.example](.env.example) — Environment variable template
- [Illustration/onboarding-architecture.md](Illustration/onboarding-architecture.md) — Architecture diagram + module map
- [Illustration/trading-modes-flowchart.md](Illustration/trading-modes-flowchart.md) — Trading mode flowchart
- [Illustration/hostinger-vps-deploy-runbook.md](Illustration/hostinger-vps-deploy-runbook.md) — VPS deployment runbook
- [Illustration/dev-reference.md](Illustration/dev-reference.md) — Command cheatsheet / dependency matrix / deployment shapes
- [progress.md](docs/progress.md) — Implementation progress and run-data snapshot
- [rough-loop.md](rough-loop.md) — Rough Loop subsystem entry point

Historical handoff docs and one-off exploration notes are archived under [Wasted/README.md](Wasted/README.md).
