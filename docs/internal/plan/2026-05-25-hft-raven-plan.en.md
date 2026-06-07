# HFT-Raven Experimental Plan

## Goal

- On experimental branch `HFT-Raven`, design a higher-frequency Raven trading runtime that extends the current daily / single-entry Pulse workflow into a **30-minute decision, quoting, and order-management cycle**.
- The first target is not microsecond colocated HFT. It is a prediction-market **higher-frequency market-making and order-posting runtime**: read books more often, compute fair probability, estimate price impact, decide maker/taker behavior, manage stale orders, and control inventory.
- Core problem: on the Polymarket CLOB, convert event probability estimates into executable limit orders without losing money to stale quotes, wrong probabilities, phantom liquidity, inventory drift, or account/geoblock issues.

## Outcome

- A proposed experimental runtime: `hft-raven`.
- Every 30 minutes it should complete one full cycle:
  1. Read candidate markets, current positions, open orders, order books, and recent trades.
  2. Generate or update fair probability `q`.
  3. Estimate effective price and price impact for candidate buy/sell sizes.
  4. Decide whether to take liquidity, post maker orders, cancel, requote, observe, or pause.
  5. Write auditable artifacts.
- Non-goals:
  - Do not force one fill every 30 minutes. The recommended target is one auditable decision or quote plan every 30 minutes; only execute when after-impact edge is positive and risk gates pass.
  - Do not pursue millisecond latency HFT.
  - Do not bypass existing live-money preflight, market binding, exposure caps, or geoblock/account checks.

## Theory

### 1. Prediction market price as probability

For a binary market, the `YES` price `p` can be read as an approximate implied probability. `NO` is roughly `1 - p`, but on a CLOB the YES and NO token books must be evaluated separately.

If Raven's fair probability is `q`:

- raw edge for buying YES: `q - ask_yes`
- raw edge for buying NO: `(1 - q) - ask_no`
- exits and reductions must use bid-side prices, not mid or last trade.

The executable edge must include size:

```text
effective_buy_price(size) = total_cost_to_fill_size / filled_shares
edge_after_impact = fair_probability - effective_buy_price(size)
```

This extends the existing market-binding guard: probability, token, book, and market identity must match before execution.

### 2. Price impact and convergence horizon

Start with a linear approximation:

```text
expected_price_move = q - mid
impact(size) ~= lambda * signed_size
net_edge(size) = expected_price_move - spread_cost - impact(size) - adverse_selection_buffer
```

Estimate `lambda` from:

- order book slope: how much price moves when consuming `x` shares from current depth;
- realized markout: whether price moves as expected 5 / 15 / 30 / 60 minutes after fills.

The user's “how long until price converges” idea maps naturally to a half-life model:

```text
expected_alpha_per_hour = (q - mid) / convergence_hours
trade_if expected_alpha_over_horizon > cost_and_risk_buffer
```

Each decision should record:

- `q`: Raven fair probability
- `mid / bid / ask`
- `impact(size)`
- `convergence_horizon_minutes`
- `expected_markout_30m`
- `minimum_edge_required`

### 3. Basic market making

Market making should not mean blindly quoting both sides. Quotes should center around an inventory-adjusted reservation probability.

Borrowing the inventory-risk logic from Avellaneda-Stoikov:

```text
r = q - inventory_skew
inventory_skew = gamma * event_variance * time_horizon * inventory_exposure
```

For a binary event, `q * (1 - q)` is a useful first approximation of probability variance. The closer the event is to 50/50, the higher uncertainty and inventory penalty should be.

Basic quotes:

```text
bid_quote = r - half_spread_target
ask_quote = r + half_spread_target
```

For prediction markets, start with conservative **one-sided maker** behavior:

- If Raven is meaningfully bullish YES, provide liquidity only on YES bid or NO ask.
- If Raven is meaningfully bearish YES, provide liquidity only on NO bid or YES ask.
- Two-sided quoting is allowed only when `q` is near mid, the book is wide enough, event information is stable, and inventory is near zero.

### 4. Adverse selection

Glosten-Milgrom-style market microstructure warns that spread compensates the market maker for being hit by better-informed traders. Prediction markets are especially exposed:

- breaking news moves the book before Raven's `q` updates;
- sports, elections, and crypto markets can update faster than daily Pulse;
- thin-book liquidity can disappear before execution.

Required controls:

- quote TTL, for example 60-180 seconds before cancel/requote;
- news / volatility kill switch;
- open-order inventory cap;
- post-fill markout monitoring, widening spreads or pausing after repeated negative markout.

### 5. Kelly sizing is a cap, not a target

For a binary contract bought at price `c` with fair probability `q`, a rough Kelly fraction is:

```text
kelly_yes = (q - c) / (1 - c)
```

HFT-Raven should use this only as an upper bound:

```text
target_size = min(
  quarter_kelly_size,
  orderbook_impact_cap,
  inventory_cap,
  event_cap,
  cash_cap,
  max_order_age_safe_size
)
```

Higher frequency should mean faster discovery and faster cancellation of small executable edges, not larger risk per trade.

## Implementation

### Phase 0: Branch and design-only artifact

- Branch: `HFT-Raven`
- Add this plan only.
- No live code, no scheduling changes, no trading commands.

### Phase 1: Read-only market microstructure recorder

Build a read-only recorder that runs every 30 minutes:

- Inputs:
  - selected market universe
  - CLOB order book snapshots
  - current positions
  - current open orders
  - recent public trades / activity if available
  - latest Pulse fair probability and timestamp
- Outputs:
  - `runtime-artifacts/hft-raven/<ts>/book-snapshot.json`
  - `impact-curve.json`
  - `candidate-scores.json`
  - `cycle-summary.md`

Acceptance:

- No trading credentials required in read-only mode.
- Captures book depth and computes effective buy/sell prices for candidate sizes.
- Produces markout-ready rows for later evaluation.

### Phase 2: Half-hour scoring engine

Implement scoring without execution:

```text
score = edge_after_impact
      + expected_convergence_value
      + spread_capture_value_if_maker
      - adverse_selection_buffer
      - inventory_penalty
      - stale_probability_penalty
```

Candidate actions:

- `observe`
- `cancel`
- `requote`
- `maker_bid`
- `maker_ask`
- `taker_buy`
- `reduce`
- `close`
- `skip`

Acceptance:

- Every decision explains fair probability, market price, impact, spread, expected convergence, and inventory state.
- If no positive expected value exists, the cycle emits `skip` instead of forcing a trade.

### Phase 3: Paper market-making simulator

Add a simulator that replays snapshots and later marks:

- maker quote fill model:
  - conservative default: fill only if later best ask/bid crosses the quote or public trade evidence supports it;
  - do not assume queue priority unless observed.
- taker fill model:
  - use effective price from depth at decision time.
- metrics:
  - fill rate
  - 5m / 15m / 30m / 60m markout
  - adverse selection rate
  - spread capture
  - inventory drift
  - realized vs expected edge
  - cancellation latency

Acceptance:

- At least 7 days of paper cycles before any live maker mode.
- Show whether 30-minute cadence improves expected value versus daily Pulse.

### Phase 4: Shadow live mode

Run against live data and wallet preflight, but do not submit orders:

- Generate exact order intents and cancel intents.
- Validate account, geoblock, collateral, allowance, market binding, and order-size checks.
- Archive “would place / would cancel” output.

Acceptance:

- At least 48 hours shadow run.
- No unbounded candidate churn.
- No stale `q` older than configured max age.
- No market with unknown resolution or thin liquidity enters live candidates.

### Phase 5: Tiny live maker pilot

Only after Phase 4:

- Use a separate env file and wallet from the Pizza production wallet.
- `AUTOPOLY_EXECUTION_MODE=live`
- Maker-only by default: GTC/limit order with short TTL and automatic cancel.
- Start with one market and one side.
- Hard caps:
  - max 1 open maker order per token
  - max 2 live HFT-Raven markets
  - max notional per quote: `$1-$5` until markout is positive
  - max cycle loss and daily loss cap
  - cancel all on stale data / failed preflight / provider timeout / geoblock / state conflict

Acceptance:

- Every live order has linked artifacts: fair probability, quote, TTL, order id, cancel state, fill state, and markout.
- Any failed cancel or unexpected fill moves the system to diagnostic mode.

## Architecture

Suggested modules:

```text
services/orchestrator/src/hft/
  market-universe.ts
  book-snapshot.ts
  impact-model.ts
  fair-probability.ts
  convergence-model.ts
  quote-engine.ts
  inventory-manager.ts
  hft-cycle.ts
  paper-simulator.ts
  artifact-writer.ts

scripts/hft-raven.ts
```

Key artifact shape:

```json
{
  "cycle_id": "hft-...",
  "generated_at_utc": "...",
  "mode": "read-only | paper | shadow | live",
  "market_slug": "...",
  "token_id": "...",
  "fair_probability": 0.62,
  "mid": 0.58,
  "best_bid": 0.57,
  "best_ask": 0.59,
  "impact_curve": [],
  "inventory": {},
  "quote_plan": {},
  "execution_gate": {},
  "markout_targets": ["5m", "15m", "30m", "60m"]
}
```

## User Decisions

- Decision: Is “one trade every 30 minutes” a forced fill target or a decision/quote cycle target?
  - Why it matters: forced fills create trades even when expected value is negative.
  - Recommended default: one decision/quote cycle every 30 minutes; live execution only when `edge_after_impact > threshold`.

- Decision: Which markets are eligible for HFT-Raven?
  - Why it matters: slow macro markets do not need half-hour quoting; sports/crypto/breaking-news politics markets discover prices faster but carry more adverse selection.
  - Recommended default: start with high-liquidity, high-volume, non-restricted markets with stable resolution rules and spread <= 6 cents.

- Decision: Maker-only first or allow taker orders?
  - Why it matters: taker orders validate signals faster but pay spread/impact immediately; maker orders can capture spread but face adverse selection and cancellation risk.
  - Recommended default: Phase 5 maker-only first; taker only after paper markout is positive after costs.

- Decision: Capital allocation.
  - Why it matters: higher cadence multiplies exposure and error frequency.
  - Recommended default: separate test wallet, max `$1-$5` quote size, max 2 markets, daily stop-loss before scaling.

## Risks and Assumptions

- This is a real-money trading project. HFT-Raven must never bypass preflight, account identity checks, market binding, exposure caps, or cancel safety.
- Polymarket CLOB uses offchain matching with onchain settlement; signed orders and cancellation semantics matter operationally.
- Prediction markets are event-driven. News latency and stale fair probabilities are the largest adverse-selection risk.
- Book snapshots can overstate real liquidity; visible quote walls can disappear before execution.
- Half-hour cadence increases operational failures: API rate limits, stale sessions, duplicate orders, failed cancels, and inventory drift.
- Current Pulse probabilities are not automatically calibrated for intraday updates. HFT-Raven needs freshness metadata and markout evaluation before live trading.

## Validation

Minimum validation before live:

- Unit tests:
  - impact curve from book depth
  - effective price calculation
  - quote TTL / cancel plan
  - inventory skew
  - edge-after-impact thresholding
- Backtest / replay:
  - 7 days paper cycles
  - compare daily Pulse vs 30-minute HFT-Raven decisions
  - report markout and adverse-selection metrics
- Shadow:
  - 48 hours live data, no orders
  - all would-order artifacts archived
- Live pilot:
  - one market, maker-only, tiny notional
  - automatic cancel verification
  - manual review after every fill

## References

- Polymarket CLOB docs: https://docs.polymarket.com/developers/CLOB/trades/trades-data-api
- Polymarket order docs: https://polymarket-292d1b1b.mintlify.app/developers/CLOB/orders/create-order
- Avellaneda and Stoikov, “High-frequency trading in a limit order book”: https://math.nyu.edu/inmemoriam/avellaneda/HighFrequencyTrading.pdf
- Kyle, “Continuous Auctions and Insider Trading”: https://people.stern.nyu.edu/lpederse/courses/LAP/papers/Information%2CFundamental/Kyle85.pdf
- Glosten and Milgrom, “Bid, Ask and Transaction Prices in a Specialist Market with Heterogeneously Informed Traders”: https://www.sciencedirect.com/science/article/abs/pii/0304405X85900443

## Execution Gate

- Wait for user review.
- Do not implement `hft-raven` runtime until this plan is accepted or edited.
- Do not add live trading commands until read-only, paper, and shadow phases have artifacts.
