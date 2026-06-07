# HFT-Raven 实验计划

## Goal

- 在实验分支 `HFT-Raven` 上设计一个更高频的 Raven 交易运行时，把当前偏“日频单点择时”的 Pulse 流程扩展为 **每 30 分钟一轮决策 / 报价 / 挂单管理**。
- 第一阶段目标不是传统意义上的微秒级 HFT，而是 prediction-market 上的 **higher-frequency market making and order-posting runtime**：更频繁读取盘口、计算 fair probability、估计 price impact、选择 maker / taker 行为、管理未成交挂单和库存。
- 核心问题：在 Polymarket CLOB 上，如何把“事件概率估计”转成可执行的限价挂单，同时避免因为 stale quote、错误概率、流动性幻觉、库存堆积和地区/账户限制导致真钱亏损。

## Outcome

- 输出一个实验性 runtime 方案：`hft-raven`。
- 支持每 30 分钟至少完成一次完整循环：
  1. 读取候选市场、当前持仓、open orders、order book、recent trades。
  2. 生成或更新 fair probability `q`。
  3. 估计买入/卖出不同 size 的 effective price 和 price impact。
  4. 决定是否主动吃单、被动挂单、撤单、调价、只观测或暂停。
  5. 写入可复盘 artifact。
- 非目标：
  - 不承诺每 30 分钟强制成交一笔。建议目标是“每 30 分钟产生一次可审计交易决策或挂单计划”；只有当 after-impact edge 为正且通过风控时才真实下单。
  - 不做低延迟 colocated HFT，不追求毫秒级抢单。
  - 不绕过现有真钱 preflight、market binding、仓位上限和 geoblock / account checks。

## Theory

### 1. Prediction market price as probability

对于二元市场，`YES` 价格 `p` 可近似理解为市场隐含概率；`NO` 价格约为 `1 - p`，但实际 CLOB 上要分别看 YES/NO token 的 bid/ask 和深度。

如果 Raven 的 fair probability 是 `q`：

- 买 YES 的 raw edge：`q - ask_yes`
- 买 NO 的 raw edge：`(1 - q) - ask_no`
- 卖/减仓时要用 bid，而不是 mid 或 last trade。

这里不能只看 `q - price`，必须用可成交价格和 size 后的 effective price：

```text
effective_buy_price(size) = total_cost_to_fill_size / filled_shares
edge_after_impact = fair_probability - effective_buy_price(size)
```

这一步延续现有 `market binding` 思路：决策概率、token、盘口和真实市场必须一致，否则禁止执行。

### 2. Price impact and convergence horizon

先采用线性近似：

```text
expected_price_move = q - mid
impact(size) ~= lambda * signed_size
net_edge(size) = expected_price_move - spread_cost - impact(size) - adverse_selection_buffer
```

`lambda` 可以从两类数据估计：

- order book slope：用当前深度计算吃掉 `x` shares 需要推高多少价格；
- realized markout：成交后 5 / 15 / 30 / 60 分钟价格是否朝预期方向移动。

用户提出的“预计价格会在多长时间内收敛”可以写成半衰期模型：

```text
expected_alpha_per_hour = (q - mid) / convergence_hours
trade_if expected_alpha_over_horizon > cost_and_risk_buffer
```

因此 HFT-Raven 每笔交易都必须记录：

- `q`: Raven fair probability
- `mid / bid / ask`
- `impact(size)`
- `convergence_horizon_minutes`
- `expected_markout_30m`
- `minimum_edge_required`

### 3. Basic market making

市场做市不是“看到正 edge 就挂两边”，而是围绕一个 inventory-adjusted reservation probability 报价。

借鉴 Avellaneda-Stoikov 的库存风险思想，把 fair probability `q` 调整为 reservation probability `r`：

```text
r = q - inventory_skew
inventory_skew = gamma * event_variance * time_horizon * inventory_exposure
```

对于二元事件，可以用 `q * (1 - q)` 近似事件概率方差；越接近 50/50，概率不确定性越高，库存惩罚越大。

基础报价：

```text
bid_quote = r - half_spread_target
ask_quote = r + half_spread_target
```

但 prediction market 上建议从更保守的 **one-sided maker** 开始：

- Raven 明显看多 YES：只在 YES bid 或 NO ask 侧提供流动性，不同时双边做市。
- Raven 明显看空 YES：只在 NO bid 或 YES ask 侧提供流动性。
- 只有在 `q` 接近 mid、盘口较宽、事件信息稳定、库存接近 0 时，才允许双边 maker。

### 4. Adverse selection

Glosten-Milgrom 类模型的核心提醒是：spread 不只是手续费，它补偿做市商被更快信息流击中的风险。Prediction market 更容易出现这种情况：

- 突发新闻先打到盘口，Raven 的 `q` 仍旧 stale。
- 体育 / 选举 / 加密市场的短期信息更新比日频 Pulse 快。
- 薄盘口里的大挂单可能撤得很快，真实可成交 liquidity 低于快照。

因此做市策略必须有：

- quote TTL：例如 60-180 秒自动撤单或重报；
- news / volatility kill switch；
- open-order inventory cap；
- fill 后 markout 监控，发现连续负 markout 立即扩大 spread 或暂停。

### 5. Kelly sizing is a cap, not a target

二元合约买入价格为 `c`、fair probability 为 `q` 时，Kelly fraction 可近似：

```text
kelly_yes = (q - c) / (1 - c)
```

这只能作为理论上限。HFT-Raven 应使用更保守的：

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

高频不是更激进下注，而是更快发现“可执行小 edge”并更快撤销坏报价。

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

- No trading credentials required for read-only mode.
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

- Every candidate decision explains the math: fair probability, market price, impact, spread, expected convergence, inventory state.
- If no positive expected value exists, the cycle emits `skip` rather than forcing a trade.

### Phase 3: Paper market-making simulator

Add a simulator that replays snapshots and later marks:

- maker quote fill model:
  - conservative default: fill only if later best ask/bid crosses the quote or public trade supports it;
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
- Show whether half-hour cadence improves expected value versus daily Pulse.

### Phase 4: Shadow live mode

Run against live data and wallet preflight, but do not submit orders:

- Generates exact order intents and cancel intents.
- Validates all account, geoblock, collateral, allowance, market binding and order-size checks.
- Archives “would place / would cancel” output.

Acceptance:

- At least 48 hours shadow run.
- No unbounded candidate churn.
- No stale `q` older than configured max age.
- No market with unknown resolution or thin liquidity enters live candidates.

### Phase 5: Tiny live maker pilot

Only after Phase 4:

- Separate env file and wallet from Pizza production wallet.
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

- Every live order has linked artifact: fair probability, quote, TTL, order id, cancel state, fill state, markout.
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

- Decision: Is “每半小时交易一笔” a forced fill target or a decision/quote cycle target?
  - Why it matters: forced fills will create trades even when expected value is negative.
  - Recommended default: define it as one decision/quote cycle every 30 minutes, with live execution only when `edge_after_impact > threshold`.

- Decision: Which markets are eligible for HFT-Raven?
  - Why it matters: slow macro markets do not need half-hour quoting; sports/crypto/politics-breaking-news markets have faster price discovery but higher adverse selection.
  - Recommended default: start with high-liquidity, high-volume, non-restricted markets with stable resolution rules and spread <= 6 cents.

- Decision: Maker-only first or allow taker orders?
  - Why it matters: taker orders validate signal faster but pay spread/impact immediately; maker orders can capture spread but face adverse selection and cancellation risk.
  - Recommended default: Phase 5 maker-only first; taker only after paper markout proves positive after costs.

- Decision: Capital allocation.
  - Why it matters: higher cadence can multiply exposure and error frequency.
  - Recommended default: separate test wallet, max `$1-$5` quote size, max 2 markets, daily stop-loss before scaling.

## Risks and Assumptions

- This is a真钱 trading project. HFT-Raven must never bypass preflight, account identity checks, market binding, exposure caps, or cancel safety.
- Polymarket CLOB is offchain matching with onchain settlement; signed orders and cancellation semantics matter operationally.
- Prediction markets are event-driven. News latency and stale probability estimates are the biggest adverse-selection risk.
- Book snapshots can overstate real liquidity; quote walls may disappear before execution.
- Half-hour cadence increases operational failures: API rate limits, stale sessions, duplicate orders, failed cancels, and inventory drift.
- The current Pulse probability engine is not automatically calibrated for intraday updates. HFT-Raven needs freshness metadata and markout evaluation before live trading.

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
