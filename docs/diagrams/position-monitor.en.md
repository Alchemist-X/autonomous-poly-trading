# Position Monitor

> Standalone model-free stop-loss guardian process

## What it does

Continuously polls Polymarket remote positions. When any position's **unrealized loss exceeds 30% of entry cost**, it automatically executes a market sell.

## Design principles

- **Model-free**: Pure price monitoring, no AI model or strategy involved
- **No infrastructure**: No DB, Redis, or BullMQ — only needs wallet credentials in `.env`
- **Standalone process**: Runs independently from pulse:live
- **Disabled by default**: Must be started manually

## How to run

```bash
# Live mode (will execute real sells)
ENV_FILE=.env.pizza npx tsx scripts/position-monitor.ts

# Dry-run mode (alerts only, no trades)
ENV_FILE=.env.pizza npx tsx scripts/position-monitor.ts --dry-run
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MONITOR_POLL_SECONDS` | 30 | Polling interval (seconds) |
| `MONITOR_STOP_LOSS_PCT` | 0.30 | Stop-loss threshold (30% loss) |
| `MONITOR_LOG_DIR` | `run-error/` | Stop-loss event log directory |

## Stop-loss calculation

```
pnlPct = (currentPrice - avgCost) / avgCost

Trigger condition: pnlPct <= -MONITOR_STOP_LOSS_PCT
```

- `avgCost`: VWAP of all BUY trades for the token from the CLOB API
- `currentPrice`: bestBid from the CLOB order book (immediate sell price)

## Architecture

```
┌─────────────────────────────┐
│   position-monitor.ts       │
│                             │
│  setInterval(30s)           │
│    │                        │
│    ├─ fetchRemotePositions  │──→ data-api.polymarket.com/positions
│    │                        │
│    ├─ computeAvgCost        │──→ CLOB API (trade history VWAP)
│    │                        │
│    ├─ readBook (bestBid)    │──→ CLOB API (order book)
│    │                        │
│    ├─ shouldTriggerStopLoss │    pnl <= -30%?
│    │   │                    │
│    │   ├─ NO → log + next   │
│    │   └─ YES ↓             │
│    │                        │
│    └─ executeMarketOrder    │──→ CLOB API (FOK sell)
│       └─ logStopLossEvent   │──→ run-error/stop-loss-events.jsonl
└─────────────────────────────┘
```

## Future extensions (not implemented yet)

More granular stop-loss strategies can be added later:
- **1-minute 5% drop**: Requires price time-series cache
- **30-minute 10% drop**: Requires sliding window buffer
- **Per-position thresholds**: Different stop-loss for different risk profiles

Currently only the simplest rule is implemented: price drop > 30% from entry at any time.

## Tests

```bash
npx vitest run scripts/position-monitor.test.ts
```

16 test cases covering edge values, positive/negative returns, and real portfolio scenarios.
