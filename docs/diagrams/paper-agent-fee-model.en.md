# Paper Agent Fee Model (Polymarket's documented schedule)

> Last updated: 2026-09-08 | Chinese canonical version: [`paper-agent-fee-model.md`](./paper-agent-fee-model.md)
>
> Code: `services/paper-agent/src/fees.ts` (formula, category table, env overrides) · `polymarket.ts` (Gamma tags) · `book-sim.ts` (fill simulation)

## 1. The problem and what it affected

Before 2026-09-08 the paper book used `shares × (taker_base_fee / 10000) × min(p, 1 − p)`, taking the rate straight from the CLOB market object's `taker_base_fee` (1000 bps on every fee-enabled market). That does not match Polymarket's documentation, and it produced:

| Metric (7-book Huginn fleet ledgers, 2026-08-23 → 2026-09-07) | Old model | Documented formula               |
| ------------------------------------------------------------- | --------- | -------------------------------- |
| Total fees charged                                            | $6,476    | $2,234 (old model 2.9× too high) |
| Tokens priced under $0.20: fee as % of notional               | 10.0%     | about 3.6%                       |
| Limit (maker) fills charged a fee                             | 32        | should be 0                      |

**Those historical ledgers carry PnL computed under the old model; recompute fees with the new formula before comparing performance across the change.**

## 2. The documented formula (exchange-wide since 2026-07-01)

Sources: docs.polymarket.com/polymarket-learn/trading/fees and help.polymarket.com article 13364478.

```
fee = C × feeRate × p × (1 − p)      C = shares, p = share price
```

Worked example from the docs: 100 shares at $0.50 in Crypto (0.07) → 100 × 0.07 × 0.5 × 0.5 = **$1.75**.

- **Only takers pay** (market orders, the side that lifts resting liquidity). Makers pay 0 and receive daily rebates of 15–25% of taker fees by category; the paper book models rebates as 0.
- The fee is a parabola in price: highest at p = 0.5, vanishing toward the bounds (100 shares × 0.07 at p = 0.01 ≈ $0.07).

## 3. Where the rate comes from

| Category (Polymarket) | feeRate | Gamma tag slugs (exact match)                                                                                                          |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Politics              | 0.04    | `politics` `elections` `world-elections` `us-presidential-election` `trump` `trump-presidency`                                         |
| Finance               | 0.04    | `finance` `stocks` `ipos`                                                                                                              |
| Tech                  | 0.04    | `tech` `ai` `spacex`                                                                                                                   |
| Mentions              | 0.04    | `mentions` `mention-markets`                                                                                                           |
| Sports                | 0.05    | `sports` `soccer` `football` `nba` `nfl` `mlb` `nhl` `ncaa` `tennis` `wta` `esports` `formula1` `chess` `baseball` `league-of-legends` |
| Economics             | 0.05    | `economics` `economy` `economic-policy` `fed-rates` `fed` `fomc` `inflation`                                                           |
| Culture               | 0.05    | `culture` `pop-culture` `music` `awards` `eurovision` `movies` `entertainment`                                                         |
| Weather               | 0.05    | `weather` `temperature` `climate`                                                                                                      |
| Other (default)       | 0.05    | any tag that matches nothing                                                                                                           |
| Crypto                | 0.07    | `crypto` `bitcoin` `ethereum` `solana` `xrp` `crypto-prices` `airdrops` `defi`                                                         |
| Geopolitics           | 0       | `geopolitics` `middle-east` `foreign-policy` `ukraine` `ukraine-peace-deal` `strait-of-hormuz`                                         |

Only after every exact match fails are substring aliases tried (`politic` / `election` / `sport` / `league` / `crypto` / `bitcoin` / `econ` / `weather` / `culture` / `mention` / `geopolitic` …; the full list is `TAG_ALIASES` in `fees.ts`). Short substrings such as `ai` or `war` are deliberately excluded because they hit `ukraine` and `warriors`.

Tag sources (`polymarket.ts`): the Gamma market row's `category` field (usually empty) → the row's `tags[].slug` → the embedded parent event's `tags[].slug`; when all three are empty, one extra GET to `/events/<eventId>`. Markets surfaced by the auto-scan also append their scan category (`PAPER_CATEGORIES`) as a lowest-priority hint.

### Decision rule (`buildFeeParams`)

1. CLOB `taker_base_fee == 0` → **fee-free**, category ignored (this is what Geopolitics markets report in practice).
2. `taker_base_fee > 0` and a tag maps to a category with a rate > 0 → that category's rate (`rateSource = "category"`).
3. `taker_base_fee > 0` but no tag matched, or the matched category has rate 0 (e.g. a geopolitics-tagged market the CLOB flags as fee-enabled) → the default rate 0.05 (`rateSource = "default"`). **The exchange's own fee flag beats our tag mapping; the paper book never assumes a free trade the exchange says it charges for.**
4. The CLOB's 1000 bps is never used as a multiplier.

Each position's stored `fees` keeps the raw CLOB values (`takerBps` / `makerBps` / `tickSize`) next to the resolved result (`feeRate` / `category` / `rateSource`), and buy rows in the ledger record `feeRate` / `feeCategory` / `feeRateSource` for audits. Positions from older books without `feeRate` are normalised on load per rules 1/3, and the next evaluation cycle's `refreshFees` re-resolves them from tags.

### Env overrides (`deploy/raven/.env.example`)

```
PAPER_FEE_RATES=crypto=0.07,sports=0.05   # per-category override, format <category>=<0 ≤ rate < 1>
PAPER_FEE_DEFAULT_RATE=0.05               # rate when no tag matches
```

Malformed entries log a WARN and are ignored; they never silently zero a fee.

## 4. Effect on the policy

Net-edge maths in `policy.ts` (entry `fair − ask − fee`, hold-vs-exit `fair − (bid − fee)`) is unchanged; only the per-share fee plugged in is smaller, and the resting-limit half of an exit no longer pays. The 50/50 hybrid exit, stop-loss and saturated-hold rules are untouched.
