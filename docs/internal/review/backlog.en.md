# Backlog — Prioritized Task List

Last updated: 2026-04-14 (after the neg-risk fee fix was completed)

---

## P0 — Must Do Immediately

(No current P0 items)

## P1 — Should Be Done This Round

- [x] ~~Fix neg-risk fee bug: fee-enabled multi-outcome markets now read Gamma `fees_enabled/fee_schedule`, with net edge / GTC routing / fee verification updated accordingly~~
- [x] ~~Re-validate filters with `--category tech` and `--category sports` (pre-filter confirmed: sports=266, tech=8 candidates available)~~
- [x] ~~Redeploy to Vercel (production build succeeded, online page + API verification passed)~~

## P2 — Next Round

- [ ] Better information gathering: combine 6551MCP, Word Monitor, Formula-style news APIs, and related sources
- [ ] **Resolution Improvement Initiative**: see dedicated section below
- [ ] **Independent Position Review Initiative**: see dedicated section below

- [x] ~~Auto-redeem: automatically redeem tokens for resolved markets (winners back to USDC, losers cleaned up)~~
- [x] ~~Neg-risk order book validation: `py-clob-client` already handles neg-risk complements correctly; no fix needed (raw CLOB API is wrong but our code does not use it)~~
- [ ] Enable position-monitor: run in dry-run mode for one week, then turn it on for live trading
- [ ] VPS scheduled deployment: implement the systemd timer plan (docs already prepared in `claude-review/vps-scheduling-plan.md`)
- [ ] Market filtering Phase D: AI analysis for return timeline (catalyst timing, edge durability window)
- [x] ~~Hybrid GTC + FOK order flow: fee>0 + open + spread<5% -> GTC limit order, 5-minute fallback to FOK~~
- [x] ~~Validate on-chain ERC1155 balance before SELL (CTF `balanceOf` via Polygon RPC, fail-open)~~
- [ ] Enable `PULSE_AI_PRESCREEN=true` and validate the effect in practice

## Independent Position Review Initiative

> Core issue: **Re-evaluating existing positions should not depend on whether the pulse sampler happened to pick that market.**

### Problem

The current position-review module only gets a fresh AI probability when pulse independently analyzed the same market in the same run. Otherwise the code simply copies `market_prob` into `ai_prob`, edge becomes 0, and the result is always hold. In practice this means:

- Positions may go **weeks or even months without being re-evaluated**
- Runtime logs keep saying `"No contradictory pulse recommendation was produced..."`
- Close/reduce thresholds (±5% edge) never trigger
- **"No fresh evidence" is incorrectly treated as "the position is still justified"**

This means even if the resolution-source data has clearly flipped, the system may never notice.

### Planned Improvements

- [ ] **Force-review all existing positions on every pulse**: during step 3 (information gathering), run A0 (live resolution-source check) + A1 (information gathering) + A2 (reasoning) for every position, independently from the sampled candidate list
- [ ] **Independent position-review agent (zero context)**: spawn a separate zero-context agent for each position, reason directly from the resolution rule, and alert if the new AI probability differs from the original opening probability by more than 10%
- [ ] **Periodic resolution-source checks**: on every pulse, directly query all position resolution-source URLs (CDC / FIDE / AP, etc.), record the current state, and report "last checked at + current state" even when there is no new edge
- [ ] **Dedicated Position Review section in the pulse report**: list, for each position:
  - original thesis
  - independently re-estimated AI probability for this run
  - current resolution-source state
  - time remaining to settlement
  - recommended action (hold / close / reduce) with reasoning
- [ ] **Stale thesis flagging**: if a key fact from the original thesis (for example "the South Carolina measles outbreak has ended") is no longer true in the latest check, automatically mark the thesis as stale and lower confidence in the position

### Core Principle

**Position review must be proactive, independent, and periodic**. It cannot just be a side effect of pulse candidate sampling.

## Resolution Improvement Initiative

> Core principle: **You are estimating the probability that the Resolution Rule trigger will be satisfied, not the probability that the real-world event happens in a colloquial sense.**

### Problem

The model reads the resolution rule, but its reasoning often drifts away from the literal trigger conditions and starts estimating the probability that "the event" will happen in plain language terms.

General rule:

```text
❌ Wrong: estimate whether "the event itself" will happen in the real world
✅ Correct: estimate whether the specific trigger defined in the resolution rule will be satisfied
```

Those are often not the same answer. The resolution rule can be much looser or much stricter than the event itself:
- **Looser**: the rule may only require "a social media post", while the underlying event is much more complex
- **Stricter**: the rule may require "AP + Fox + NBC consensus confirmation", even if the event already happened
- **Time window**: the event may happen after the deadline
- **Definition mismatch**: the rule’s definition of "happened" may differ from common-sense usage

### Planned Improvements

- [ ] **Prompt hard rule**: add an explicit reasoning step to the SKILL.md prompt — when the resolution trigger is easier than the real-world event (for example a single post is enough), the model must separately estimate the trigger behavior itself rather than the underlying event
- [ ] **Deep resolution-rule reading**: require the model to break down each trigger condition (who / what / channel / what counts and what does not / deadline) and list it explicitly as evidence item 0
- [ ] **Stronger resolution-specific search**: do not stop at `rules.description` from the Polymarket page; proactively query the external data sources named by the resolution source (AP, official websites, data APIs, etc.) to verify current status
- [ ] **Resolution-threshold labels**: classify each market by trigger type (low threshold: statement/post | medium threshold: official data release | high threshold: multi-source consensus/legal ruling) and use a different reasoning frame per class
- [ ] **Backtest validation**: evaluate the improved reasoning against historical resolved markets, especially cases with low-threshold resolution triggers

### Resolution-First Reasoning Framework (to be written into the prompt)

```text
1. Break down each resolution-rule trigger condition (who / what / which channel / what counts and what does not / deadline)
2. Compare: trigger condition vs. underlying event. What is the gap?
   - Is the trigger looser than the event itself? (for example: a post is enough vs. actual military action ending)
   - Is the trigger stricter than the event itself? (for example: requires three-source confirmation even if the event already happened)
   - Is the time window sufficient?
3. Estimate the probability that the trigger condition is satisfied, not the probability that the underlying event happens
4. Check the external data sources named by the resolution source
5. Use the underlying event only as an adjustment, not as a substitute for trigger evaluation
6. Final probability = trigger probability as anchor + adjustment from underlying-event dynamics
```

## poly-pulse Skill Packaging Initiative

> Goal: after installing the `poly-pulse` skill into any Claude Code instance, a single `/poly-pulse` command should execute the full flow of "fetch markets -> AI analysis -> live order placement".

### Product Definition

- Name: `poly-pulse`
- Trigger: `/poly-pulse` or the user says "run pulse" / "analyze markets" / "place trades"
- Behavior: default is live order execution, not recommend-only
- Output: print recommendations, fills, and position changes in the terminal

### Modules to Decouple

| Module | Current Location | Skill Form |
|------|---------|-----------|
| Market fetch | `vendor/.../fetch_markets.py` | standalone Python script bundled with the skill |
| AI analysis report | `full-pulse.ts` -> `claude --print` | switch to direct Claude invocation inside the skill |
| Trade plan extraction | `pulse-entry-planner.ts` | extract into a standalone TS module |
| Risk controls | `execution-planning.ts` + `risk.ts` | extract into a standalone module |
| CLOB order placement | `polymarket-sdk.ts` | extract into a standalone module that only depends on `@polymarket/clob-client` |
| Fee schedule logic | `fees.ts` | extract into a standalone module |
| Position fetch | `fetchRemotePositions` | extract into a standalone function |

### Dependencies to Remove

- ❌ DB / Redis / BullMQ
- ❌ monorepo workspace structure
- ❌ orchestrator / executor service split
- ❌ queue-worker / stateful path

### Dependencies to Keep

- ✅ `@polymarket/clob-client` (npm package)
- ✅ Python 3 (`fetch_markets.py`)
- ✅ `.env` file (wallet credentials)
- ✅ Claude Code (skill host)

### Expected Directory Structure

```text
~/.claude/skills/poly-pulse/
├── SKILL.md                    # Skill definition + trigger phrases
├── package.json                # Dependencies
├── scripts/
│   ├── fetch-markets.py        # Market fetch
│   ├── pulse-run.ts            # Main entry: fetch -> analyze -> plan -> execute
│   ├── clob-sdk.ts             # CLOB interaction (orders / book / positions)
│   ├── entry-planner.ts        # Plan extraction from the analysis report
│   ├── risk-guard.ts           # Risk logic
│   └── fees.ts                 # Fee lookup
├── prompts/
│   ├── pulse-analysis.md       # AI analysis prompt template
│   └── analysis-framework.md   # Analysis framework
└── references/
    └── output-template.md      # Report output template
```

### Implementation Phases

- [ ] Phase 1: extract core modules into standalone files with no monorepo imports
- [ ] Phase 2: package the skill directory structure and write SKILL.md
- [ ] Phase 3: local validation in a clean Claude Code instance
- [ ] Phase 4: add `/poly-pulse --dry-run` and `/poly-positions`

## P3 — Later Considerations

- [ ] Phase 2 architecture simplification: remove the stateful path, provider-runtime, and BullMQ
- [ ] Simplify preflight: keep only credentials + collateral checks
- [ ] Structured trade logging: a single `run-log.jsonl` instead of 8 separate artifact files
- [ ] Maker rebate tracking: measure daily Maker rebates received from Polymarket
- [ ] Multi-wallet support

---

## Completed

- [x] Fee integration (`fees.ts` + net-edge ranking + Pulse report display + CLOB verification)
- [x] Filter validation (sports/tech tests)
- [x] Filter moved before candidate selection (pre-selection filtering)
- [x] PNL curve fix (equity snapshots for the chart + cashflow headline)
- [x] Market filtering Phase B: type-weighted ordering (politics/tech 1.5x, crypto 0.3x)
- [x] Market filtering Phase C: AI prescreen (TRADE/SKIP, disabled by default with `PULSE_AI_PRESCREEN`)
- [x] Automatic filtering for short-term price markets (<7 day crypto/stock up/down markets)
- [x] Trade transparency: `applyTradeGuardsDetailed()` returns specific binding constraints
- [x] Dynamic bankroll: remove static cap and use real remote equity from the API
- [x] Framework-free provider: any agent can act as the provider
- [x] Phase 1 threshold adjustments: 7 parameters relaxed
- [x] Monthly Return ordering + 20% batch cap + `resolutionSource` annotation
- [x] Frontend dark dashboard + Chinese/English toggle + investment-principles section
- [x] Vercel deployment succeeded
- [x] Vercel deployment verification (2026-03-31, page + API checked online)
- [x] Filter pre-selection validation (`--category tech/sports`, 59 unit tests + data validation)
- [x] Live orders succeeded (3 Iran market trades)
- [x] Fallback removed
- [x] Claude Code provider completed full Pulse rendering
- [x] Unified template commands (removed codex-specific branch)
- [x] Global rename from `live:test:stateless` to `pulse:live`
- [x] PNL curve switched to cashflow accounting
- [x] Render timeout increased to 30 minutes + report generation timing injected
- [x] Polymarket fee research doc + GTC+FOK proposal
- [x] Market-filter feature (JSON config + CLI override)
- [x] Filter moved before candidate selection
- [x] Project architecture audit + historical failure analysis
- [x] VPS scheduling doc + market-filtering strategy plan
- [x] Candidate selection switched to random sampling of 20 markets (removed liquidity ranking formula)
- [x] Neg-risk market 0% fee path (full `negRisk` propagation at event level)
- [x] SELL `avgPrice` parsing fix (computed from `takingAmount/makingAmount`)
- [x] `extractProbabilities` regex fix (match Yes/No with Chinese annotations)
- [x] Live exit orders for Newsom (2 trades) + fee verification (actual $0 vs estimated $0.013)
- [x] Live entry orders (measles, Rubio, Mets)
- [x] Polymarket category/tag reference doc (98 tags + fee-rate table)
- [x] Independent position monitor (`position-monitor`, 30% stop-loss, model-free, disabled by default)
- [x] Fee module test coverage completed (5 new tests for negRisk lookup/verify/netEdge)
