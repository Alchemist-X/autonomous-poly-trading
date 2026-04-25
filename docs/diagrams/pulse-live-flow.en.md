# Pulse Live — Full Flow

> Last updated: 2026-04-01

## One-liner

`pnpm pulse:live` = fetch markets → random-sample 20 → AI deep-research 4 → write recommendation report → code extracts trade plans → risk guards → live execution.

## Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Preflight (5%)                                                  │
│     Verify wallet credentials, on-chain USDC balance, exec mode     │
├─────────────────────────────────────────────────────────────────────┤
│  2. Auto-Redeem (5%)                                                │
│     Scan resolved markets, redeem CTF tokens → USDC                 │
├─────────────────────────────────────────────────────────────────────┤
│  3. Portfolio Load (10%)                                            │
│     Fetch remote positions from Polymarket data API + on-chain bal  │
├─────────────────────────────────────────────────────────────────────┤
│  4. Pulse Fetch (10-16%)           ⏱ ~1 min                        │
│     Python fetch_markets.py scrapes ~8000 markets                   │
│     → liquidity + junk filter → ~900 tradeable                      │
│     → random sample 20 candidates                                   │
│     → short-term price market filter                                │
├─────────────────────────────────────────────────────────────────────┤
│  5. Deep Research (20-50%)         ⏱ ~30 sec                       │
│     Pick top 4 from 20 by priority score                            │
│     Per candidate: scrape page + read CLOB order book               │
│     Output: research JSON (~135KB)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  6. Pulse Report Render (50-68%)   ⏱ 5-10 min  ← LLM call #1      │
│     Feed research JSON + prompt template + analysis framework       │
│     to Claude Code (`claude --print`)                               │
│     LLM outputs full Markdown report:                               │
│       - Candidate pool rationale                                    │
│       - Top 3 recommendations (probability + evidence + analysis)   │
│       - Position sizing (Kelly)                                     │
│     Timeout: 30 minutes                                             │
├─────────────────────────────────────────────────────────────────────┤
│  7. Entry Planner (70%)            ⏱ instant  ← code only, no LLM  │
│     Parse Markdown ## sections                                      │
│     Extract: direction / AI prob / market prob / confidence         │
│     Match to pulse candidates (URL or title match)                  │
│     Recompute 1/4 Kelly + fees + net edge                           │
│     Output: entry plans[]                                           │
├─────────────────────────────────────────────────────────────────────┤
│  8. Position Review (70%)          ⏱ instant  ← code only, no LLM  │
│     Review existing positions (hold / close / reduce)               │
├─────────────────────────────────────────────────────────────────────┤
│  9. Decision Compose (70%)         ⏱ instant  ← code only, no LLM  │
│     Merge entry plans + position reviews → final decision set       │
├─────────────────────────────────────────────────────────────────────┤
│  10. Execution Planning (75%)      ⏱ seconds                       │
│      Per decision: read book, apply risk guards, check exchange min │
│      Choose FOK or GTC order type                                   │
│      Output: PlannedExecution[]                                     │
├─────────────────────────────────────────────────────────────────────┤
│  11. Execute Orders (80-95%)       ⏱ seconds/order                  │
│      SELL: on-chain ERC1155 balance verification first              │
│      GTC: place limit → poll → timeout fallback to FOK              │
│      FOK: immediate market execution                                │
├─────────────────────────────────────────────────────────────────────┤
│  12. Summary & Archive (95-100%)   ⏱ instant                       │
│      Write execution-summary.json, run-summary.md (CN+EN)          │
│      Append equity snapshot                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## LLM Involvement

Under pulse-direct strategy, **LLM is called exactly once** (step 6):

| Step | LLM? | Description |
|------|------|-------------|
| 1-5 | No | Python fetch + code filters + API calls |
| **6** | **Yes** | Claude Code generates full analysis report |
| 7-12 | No | Code parses report, computes Kelly, executes trades |

## Typical Timing

| Stage | Duration | Share |
|-------|----------|-------|
| Preflight + Redeem + Portfolio | ~15s | 2% |
| Pulse Fetch (Python) | ~1 min | 10% |
| Deep Research (scrape + book) | ~30s | 5% |
| **Report Render (LLM)** | **5-10 min** | **70%** |
| Plan + Review + Compose | <1s | 0% |
| Execution + Archive | ~10s | 2% |
| **Total** | **~8-12 min** | |

## Commands

```bash
# Live trading (default)
ENV_FILE=.env.pizza pnpm pulse:live

# Recommend only (no execution)
ENV_FILE=.env.pizza pnpm pulse:recommend

# Filter by category
ENV_FILE=.env.pizza pnpm pulse:live -- --category politics

# Reuse existing pulse snapshot
ENV_FILE=.env.pizza pnpm pulse:live -- --pulse-json <path-to-snapshot.json>
```
