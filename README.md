<p align="center">
  <img src="assets/predict-raven.png" alt="predict-raven" width="220" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

# Predict Raven

> English is the primary README. 中文版见 [docs/README.zh-CN.md](docs/README.zh-CN.md).

Last updated: 2026-08-20

---

**predict-raven** is an open-source **forecasting agent framework**: it lets an AI agent estimate the probability of real-world events, gather and weigh evidence continuously, and act on the result. The same agent core powers a family of applications today:

- **Autonomous prediction-market trading** — the first autonomous, continuously-running trading agent on [Polymarket](https://polymarket.com). It estimates fair probabilities, compares them to market-implied odds, and trades the edge under hard, service-layer risk controls.
- **Market-blind public forecasting** — transparent, Brier-scored probabilities for all 48 teams at the 2026 World Cup, deliberately produced **without ever reading a market price**. Live at **[forecasting-agent.com](https://forecasting-agent.com/world-cup)**, scored in public on the [track record page](https://forecasting-agent.com/world-cup/performance).
- **Hosted Forecasting Engine** — the same iterative forecaster as hosted products: an interactive research console at [/engine](https://forecasting-agent.com/engine), the Raven Delta news-impact engine at [/delta](https://forecasting-agent.com/delta), and a forecast API + MCP service (probability + reasoning + evidence as JSON, plain text, or PDF). See [Forecasting Engine (hosted)](#forecasting-engine-hosted).
- **Autonomous paper trading** — a simulation-only twin of the trading agent running unattended in the cloud: market-blind position evaluations three times a day, net-edge exits, and a daily self-review with a Brier skill score against the market. See [Autonomous paper trading](#autonomous-paper-trading-simulation).

Watch live:

- **World Cup forecasts (market-blind)**: [forecasting-agent.com/world-cup](https://forecasting-agent.com/world-cup) · [track record](https://forecasting-agent.com/world-cup/performance)
- **Forecasting Engine console**: [forecasting-agent.com/engine](https://forecasting-agent.com/engine) (browsing is public; new runs are invite-gated)
- **Raven Delta news-impact engine**: [forecasting-agent.com/delta](https://forecasting-agent.com/delta) (invite-gated)
- **Paper-trading book review**: [forecasting-agent.com/live-predict-raven](https://forecasting-agent.com/live-predict-raven) (invite-gated, live VM snapshot)
- **Trading decision log / equity curve**: [autopoly-pizza-spectator.vercel.app](https://autopoly-pizza-spectator.vercel.app)
- **On-chain positions / fills (Polymarket profile)**: [`0x6664...614e`](https://polymarket.com/profile/0x6664e32f79aee42639f73633e40b5a842b07614e)

## ⚠️ Known issue — search evidence quality (priority fix, flagged 2026-08-23)

The forecaster's web-search layer silently degraded and contaminated past outputs. Flagged by the user for a dedicated fix next session; actionable checklist lives in [docs/agent-handoff.md](docs/agent-handoff.md) (P0).

- **What broke**: both search paths scraped keyless DuckDuckGo, and DDG now serves HTTP-200 CAPTCHA pages that parsed as "search succeeded, 0 results" — runs were told "no evidence exists" when the search never ran. Measured 2026-08-22: 4 of 6 queries blocked.
- **Contamination window**: the paper-trading agent's *entire* lifetime (its DeepSeek tool loop shipped 2026-07-03 on this backend; first recorded DDG 403 on 2026-07-02) — its Brier skill scores and daily reflections were produced while many evaluations were effectively offline and must be re-assessed. The final live-trading day (2026-06-10) had 6–8 of 12 pulse news queries return empty per run (vs 1/16 on 06-07). World Cup forecasts and Delta PM are **not** affected (different pipelines).
- **Fixed so far**: DuckDuckGo removed entirely; search now runs on Exa (`EXA_API_KEY`, preferred) or Tavily, and fails loudly with no key (PR #108). Production deployed 2026-08-23: the VM's paper-agent/forecast-api run the fix with a working key (in-container Exa call verified). Pending: VM archive audit + re-scoring the contaminated reports.

## System Design

The trading side is built around a single core component, **Market Pulse**: it lets the AI independently estimate the probability of an event, dynamically gathers evidence from information sources, compares that evidence against the market's implied odds, and issues trading instructions that combine edge with capital return efficiency.

The same evidence-gathering core is packaged as a standalone engine ([`packages/forecast-engine`](packages/forecast-engine)) and also runs in a **market-blind** mode that never reads odds at all — used for the public World Cup forecasting product (see [Market-blind forecasting](#market-blind-forecasting) below) and the hosted Forecasting Engine surfaces.

### Why let an Agent do this

1. **Superhuman reasoning on complex tasks** — Agents now match or exceed human-level reasoning on complex problems. Most of the time, the human edge is better information sources rather than reasoning, and engineering can close that gap. The core analytical capability is already in place.
2. **Broad coverage and fast reaction time** — An Agent can monitor thousands of markets 24/7 and spot pricing dislocations no individual could track. When news breaks, the Agent responds in seconds; a human needs at least three minutes. Opportunities like this appear across countless markets.
3. **Prediction markets are still a blue ocean** — Most participants in political and tech prediction markets lack a clear pricing model and broadly fear inventory management and adverse-selection risk. Systematic Agent trading faces very little competition in these areas. Even in sports, there is plenty beyond moneyline markets.

### Core positioning

- Every order the Agent places and its decision reasoning are published on the website
- The Agent runs continuously in the cloud — not as ad-hoc local scripts — with no human in the loop
- Runs on `@polymarket/clob-client-v2` with pUSD as the default collateral; V2 cutover is 2026-04-28 11:00 UTC, see [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](docs/internal/plan/2026-04-28-v2-cutover-runbook.md) for the runbook

## Market-blind forecasting

The same agent powers a **probability-research** product that is deliberately decoupled from the trading side: it forecasts events **without reading any betting or prediction-market price**, so the output is an independent estimate rather than a re-statement of the market consensus.

The 2026 World Cup deployment is the public showcase — 87 questions (champion, group winners, group matches, knockout qualifiers) for all 48 teams:

- **Statistical prior**: live Elo ratings feed a Davidson three-way model for single matches; tournament questions run 100,000 Monte-Carlo simulations over the official bracket.
- **Bayesian update**: key evidence (injuries, lineups, form, venue/altitude/weather) is converted into a bounded adjustment on the prior — at most ±8 percentage points per match, and nothing moves without a cited source.
- **Public scoring**: every forecast is Brier-scored in public after the match settles; wrong calls stay on the record. The [track record page](https://forecasting-agent.com/world-cup/performance) benchmarks the blind forecasts *after the fact* against Polymarket's implied probabilities at forecast time — Mock PNL, Brier skill score vs the market, calibration (ECE), and hit rate — for both the group stage and the knockout round of 32.

Market data is used only for event structure and settlement mapping (slug / conditionId / resolution rules); price fields are stripped at cache-write time. Code lives in `scripts/world-cup/`, `packages/sports-data/`, `packages/sports-model/`, and `apps/web/app/world-cup/`. This is probability research, not betting advice.

## Forecasting Engine (hosted)

The evidence-gathering core is packaged as a reusable **iterative event forecaster** in [`packages/forecast-engine`](packages/forecast-engine): given a binary question, it frames the event, runs bounded evidence rounds with cited sources, and produces a traceable probability plus a decision-first report. Correctness guardrails are built in — a framing audit, a model self-estimated prior, independence-aware evidence aggregation (cluster discounting), a mandatory disconfirmation pass, consequential source verification, and an explicit `saturated` status when a probability pins at the engine's floor/ceiling. A market-blind mode (`FORECAST_MARKET_BLIND=1`) bans betting-market prices from prompts, search, and evidence weighting.

Three hosted surfaces run this engine on a cloud VM, all under [forecasting-agent.com](https://forecasting-agent.com):

| Surface | What it is | Code |
| --- | --- | --- |
| [`/engine`](https://forecasting-agent.com/engine) | Interactive research console (EN / 中文) — watch a run unfold step by step: plan checklist, evidence cards, verdict dossier | `apps/raven` |
| [`/delta`](https://forecasting-agent.com/delta) | **Raven Delta** news-impact engine — paste a news item, get an attention verdict (with first-seen timing), 0–5 impacted US stocks with direction / magnitude / confidence, and a trading plan; email + WebSocket push | `apps/raven-delta` |
| Forecast API + MCP | `POST /v1/forecasts {question}` → probability + reasoning + evidence as JSON, plain text, or a PDF dossier; also exposed as MCP tools (`forecast_start` / `forecast_status` / `forecast_result`) | `services/forecast-api` |

Engine runs are metered: a daily quota plus file-backed invite codes with per-code limits and usage metering.

## Autonomous paper trading (simulation)

A **simulation-only** twin of the trading agent ([`services/paper-agent`](services/paper-agent)) runs a $10k paper book unattended on the same VM — zero private keys, zero order endpoints; its only network surface is public market-data reads:

- **Market-blind evaluations, 3×/day** — each position is re-forecast by an isolated engine process that sees only the market question and settlement rules — never the position, cost basis, or order book.
- **Net-edge exits + model-free stop-loss** — a position is closed when its fee-adjusted edge turns negative; a hard stop-loss overrides the model. Saturated winners (price pinned at the ceiling on the position's favorable side) are held to resolution instead of ceiling-sold.
- **Realistic fills** — simulated orders walk the real order book (real slippage) and pay real per-market CLOB fees, with entry fees folded into round PnL; exits use a hybrid 50% market + 50% maker-limit split.
- **Daily reflection** — the agent writes a daily self-review: counterfactual exit alpha, Brier calibration, and a **Brier skill score vs the market** — the standing answer to "is the agent actually beating the market?".

The book is reviewed publicly at [forecasting-agent.com/live-predict-raven](https://forecasting-agent.com/live-predict-raven) (invite-gated): a live snapshot pulled from the VM at request time, the equity curve, the closed-round table, and the effective run parameters.

## Quick Start

Driven entirely through an AI Agent (Claude Code / Codex / OpenClaw) in natural language. No commands to memorise.

> **Prerequisite**: install either [Claude Code](https://claude.com/claude-code) or [Codex CLI](https://github.com/openai/codex), `git clone` this repo, and start the Agent inside the repo directory before going through the 4 steps below.

### 1. Set up

Say to the Agent:

```
install the dependencies for predict-raven
```

Expected: the Agent runs `pnpm install` + `pnpm build` and tells you whether the environment is ready. If you don't have Node.js / pnpm yet, it'll install those first. No Docker, no real wallet required at this stage.

### 2. Configure funds

Predict-Raven supports multiple capital-management modes, including social login (Google, Telegram) and OKX Agentic Wallet.

In private-key mode, get your Polymarket wallet credentials from polymarket.com → Settings → Export Wallet. Create a new `.env.live-test` (use `.env.example` as the template) and fill in these 5 fields:

- `WALLET_PROVIDER=private-key`
- `PRIVATE_KEY` — the wallet private key
- `FUNDER_ADDRESS` — the Polymarket proxy wallet address
- `SIGNATURE_TYPE` — signature type (`0` or `1`)
- `CHAIN_ID` — `137` (Polygon mainnet)

OKX Agentic Wallet mode does not need `PRIVATE_KEY`, but you must log in with `onchainos wallet login/verify` first and set `WALLET_PROVIDER=onchainos`, `FUNDER_ADDRESS` (the Polymarket deposit/proxy wallet with collateral/allowance), `SIGNATURE_TYPE=3`, and `CHAIN_ID=137`.

Then say:

```
configure my wallet
```

Expected: the Agent reads your `.env.live-test`, confirms the wallet can talk to Polymarket, and prints the wallet address and current balance. If any field is missing, it tells you exactly which one.

### 3. Recommendations only (also fine if you haven't funded yet)

Say:

```
recommend some trades, no actual orders
```

Expected: the Agent lists a few suggested trades — each with the market, side, stake size, and its estimated edge and capital return efficiency. The full reasoning is also written to disk as markdown so you can review it later. **No orders are placed in this step**, so you can run it end-to-end even without USDC in the wallet.

### 4. Real-money live trading

Say:

```
run the pulse with real money
```

Expected: the Agent places real orders based on the recommendations from step 3 and tells you which ones filled and which got rejected.

> For concrete pnpm commands (`forecast:*`; the old `pulse:*` names remain as compatibility aliases), env vars, and archive directories, see [docs/diagrams/dev-reference.md](docs/diagrams/dev-reference.md).

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

## Capability Tiers — Norns (Urd / Verdandi / Skuld)

Model capability is named in three tiers after the Norse Norns, so "which model" is one memorable choice instead of a raw model id scattered across env vars:

| Tier | Norn | Use | Anthropic | OpenAI |
| --- | --- | --- | --- | --- |
| **Urd** | past / origin | light & fast — prescreen, high-frequency calls | `claude-haiku-4-5-20251001` | `gpt-4o-mini` |
| **Verdandi** | present | balanced default | `claude-sonnet-4-6` | `gpt-4o` |
| **Skuld** | future | flagship — deepest reasoning, highest quality | `claude-opus-4-8` | `gpt-4o` |

This is a thin **alias / mapping layer** (`@autopoly/norns`), not a rewrite. Anywhere a model id is read, a tier name may be used instead and is resolved to a concrete model for that provider family. **Raw model ids and empty defaults pass through unchanged**, so every existing config keeps working — behaviour changes only when a tier name is explicitly used. Each tier also carries soft depth knobs (token budget, evidence/pass counts) that drivers can scale by.

Where it applies:

- **Trading engine / provider-runtime**: `CODEX_MODEL` / `CLAUDE_CODE_MODEL` / `OPENCLAW_MODEL` accept a tier name (e.g. `CLAUDE_CODE_MODEL=skuld`), resolved per provider family (codex → openai, claude-code / openclaw → anthropic).

The tier table is the single source of truth in [`packages/norns/src/index.ts`](packages/norns/src/index.ts); all model ids are env-overridable.

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

Full rules: [docs/risk-controls.md](docs/risk-controls.md).

## Environment Variables

Full template: [.env.example](.env.example)

Organised into four groups:

| Group | Key Variables | Purpose |
| --- | --- | --- |
| **Shared** | `AUTOPOLY_EXECUTION_MODE` `DATABASE_URL` `REDIS_URL` `AUTOPOLY_LOCAL_STATE_FILE` | Execution mode (paper/live), infra connections |
| **Web** | `ADMIN_PASSWORD` `ORCHESTRATOR_INTERNAL_TOKEN` | Admin authentication |
| **Executor** | `WALLET_PROVIDER` `PRIVATE_KEY` `FUNDER_ADDRESS` `SIGNATURE_TYPE` `CHAIN_ID` `ONCHAINOS_BIN` | Polymarket wallet and chain config |
| **Orchestrator** | `AGENT_RUNTIME_PROVIDER` `AGENT_DECISION_STRATEGY` `PULSE_*` `CODEX_*` | Provider selection, Pulse fetching, risk parameters |

If your Polymarket credentials live in an adjacent repo, you can set `ENV_FILE=../pm-PlaceOrder/.env.aizen`. For real-money testing, stick to a dedicated `.env.live-test`.

## Wallet and Account Setup

The Polymarket order path supports two signer modes.

Private-key mode needs:

- `WALLET_PROVIDER=private-key`
- `PRIVATE_KEY` — wallet private key (prefer a Polymarket proxy wallet over your main wallet)
- `FUNDER_ADDRESS` — the Polymarket proxy wallet address (the one that holds collateral)
- `SIGNATURE_TYPE` — `0` or `1`, depending on wallet type
- `CHAIN_ID` — `137` (Polygon mainnet)

OKX Agentic Wallet / OnchainOS mode needs:

- `WALLET_PROVIDER=onchainos` (`okx-agentic` remains a compatibility alias)
- `ONCHAINOS_BIN` — defaults to `onchainos`
- `FUNDER_ADDRESS` — Polymarket deposit/proxy wallet address with collateral/allowance
- `SIGNATURE_TYPE=3` — deposit wallet / POLY_1271
- `CHAIN_ID=137`

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
| `world-cup/` | Market-blind forecast archive, event list, Elo / Monte-Carlo backbone |
| `paper-agent/` | Paper-trading book: ledger, dossiers, daily reflection reports |
| `raven-delta/runs/` | Raven Delta news-impact analysis archive |
| `local/paper-state.json` | Default paper state file |

Failure archives (per the AGENTS convention) go to `run-error/` with the failing stage, core context, root-cause summary, and next-step command.

## Doc Index

- [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) — Agent collaboration conventions (required reading)
- [docs/risk-controls.md](docs/risk-controls.md) — Full write-up of the hard risk rules
- [.env.example](.env.example) — Environment variable template
- [docs/diagrams/onboarding-architecture.md](docs/diagrams/onboarding-architecture.md) — Architecture diagram + module map
- [docs/diagrams/trading-modes-flowchart.md](docs/diagrams/trading-modes-flowchart.md) — Trading mode flowchart
- [docs/diagrams/dev-reference.md](docs/diagrams/dev-reference.md) — Command cheatsheet / dependency matrix / deployment shapes
- [docs/internal/plan/2026-06-09-world-cup-special-plan.md](docs/internal/plan/2026-06-09-world-cup-special-plan.md) — World Cup forecasting product plan

Historical handoff docs and one-off exploration notes are archived under [docs/archive/README.md](docs/archive/README.md).
