# Polymarket Available Category Tags Reference

> Snapshot: 2026-03-31T04:22Z | Source: Polymarket Gamma API

## Data Source

These tags **come from the official Polymarket Gamma API** (`gamma-api.polymarket.com/events`), not invented by us.

How primary category is determined:
1. **Preferred**: `event.category` (official Polymarket category field)
2. **Fallback**: `event.tags[0]` (first official tag on the event)
3. In practice, most markets use the `first-tag` fallback path (Polymarket's `category` field is often empty)

The tags themselves are official Polymarket data. The "which tag becomes the primary category" logic is our code's decision (pick the first one).

---

## Usage

```bash
# Filter to a specific category
pnpm pulse:recommend -- --category <slug>

# Examples
pnpm pulse:recommend -- --category politics
pnpm pulse:recommend -- --category tech
pnpm pulse:recommend -- --category sports
```

---

## All Tags (sorted by tradeable candidate count)

| slug | Label | Fetched | Tradeable | AI Type Weight |
|------|-------|---------|-----------|---------------|
| `sports` | Sports | 1851 | 266 | 1.0x |
| `politics` | Politics | 856 | 109 | 1.5x |
| `bitcoin` | Bitcoin | 140 | 41 | 0.3x |
| `crypto` | Crypto | 171 | 32 | 0.3x |
| `pop-culture` | Culture | 229 | 27 | 1.0x |
| `soccer` | Soccer | 265 | 22 | 1.0x |
| `ethereum` | Ethereum | 92 | 20 | 0.3x |
| `geopolitics` | Geopolitics | 66 | 19 | 1.5x |
| `tennis` | Tennis | 274 | 19 | 1.0x |
| `iran` | Iran | 42 | 16 | 0.8x |
| `trump` | Trump | 94 | 13 | 1.5x (→ politics) |
| `yearly` | Yearly | 18 | 13 | 0.8x |
| `middle-east` | Middle East | 138 | 12 | 0.8x |
| `ipos` | IPOs | 33 | 12 | 1.2x (→ finance) |
| `commodities` | Commodities | 29 | 12 | 0.8x |
| `esports` | Esports | 506 | 11 | 1.0x |
| `elections` | Elections | 207 | 10 | 1.5x (→ politics) |
| `finance` | Finance | 75 | 9 | 1.2x |
| `nfl` | NFL | 17 | 9 | 1.0x (→ sports) |
| `football` | football | 17 | 9 | 1.0x |
| `tech` | Tech | 116 | 8 | 1.5x |
| `comex-gold-futures` | COMEX Gold Futures | 38 | 8 | 0.8x |
| `israel` | Israel | 30 | 8 | 0.8x |
| `metadao` | Metadao | 27 | 8 | 0.8x |
| `world-elections` | World Elections | 256 | 7 | 1.5x (→ politics) |
| `games` | Games | 109 | 7 | 0.8x |
| `eurovision` | Eurovision | 100 | 7 | 0.8x |
| `world` | World | 55 | 7 | 0.8x |
| `mlb` | MLB | 45 | 7 | 1.0x (→ sports) |
| `american-league` | American League | 22 | 7 | 0.8x |
| `recurring` | Recurring | 31 | 6 | 0.8x |
| `bundesliga-2` | Bundesliga 2 | 6 | 6 | 0.8x |
| `music` | Music | 90 | 5 | 0.8x |
| `wta` | WTA | 74 | 5 | 0.8x |
| `fed-rates` | Fed Rates | 15 | 5 | 1.2x (→ finance) |
| `chess` | Chess | 14 | 5 | 0.8x |
| `business` | Business | 13 | 5 | 0.8x |
| `ncaa` | NCAA | 90 | 4 | 0.8x |
| `trump-machado` | Trump-Machado | 63 | 4 | 1.5x (→ politics) |
| `economy` | Economy | 57 | 4 | 1.2x (→ finance) |
| `brazil` | Brazil | 32 | 4 | 0.8x |
| `us-presidential-election` | US Election | 24 | 4 | 1.5x (→ politics) |
| `mojtaba` | Mojtaba | 6 | 4 | 0.8x |
| `khamenei` | Khamenei | 5 | 4 | 0.8x |
| `awards` | Awards | 71 | 3 | 0.8x |
| `formula1` | Formula 1 | 33 | 3 | 0.8x |
| `ai` | AI | 28 | 3 | 1.5x |
| `economic-policy` | Economic Policy | 9 | 3 | 1.2x (→ finance) |
| `airdrops` | Airdrops | 8 | 3 | 0.3x (→ crypto) |
| `spacex` | SpaceX | 7 | 3 | 1.5x (→ tech) |
| `starmer` | Starmer | 6 | 3 | 0.8x |
| `fomc` | fomc | 5 | 3 | 1.2x (→ finance) |
| `inflation` | Inflation | 18 | 2 | 0.8x |
| `ath` | ATH | 4 | 2 | 0.8x |
| `nba` | NBA | 56 | 1 | 1.0x (→ sports) |
| `league-of-legends` | league of legends | 35 | 1 | 1.0x (→ esports) |
| `baseball` | baseball | 17 | 1 | 0.8x |
| `pandemics` | Pandemics | 9 | 1 | 0.8x |
| `trump-presidency` | Trump Presidency | 8 | 1 | 1.5x (→ politics) |
| `strait-of-hormuz` | Strait of Hormuz | 3 | 1 | 0.8x |
| `foreign-policy` | Foreign Policy | 2 | 1 | 0.8x |
| `houthi` | houthi | 2 | 1 | 0.8x |
| `denmark` | Denmark | 1 | 1 | 0.8x |
| `fed` | Fed | 1 | 1 | 1.2x (→ finance) |
| `reza-pahlavi` | Reza Pahlavi | 1 | 1 | 0.8x |
| `ukraine-peace-deal` | Ukraine Peace Deal | 1 | 1 | 0.8x |

### Tags with 0 tradeable candidates (filtered by short-term price filter or liquidity threshold)

| slug | Label | Fetched | Reason |
|------|-------|---------|--------|
| `nhl` | NHL | 241 | Short-term sports events |
| `up-or-down` | Up or Down | 194 | Short-term price prediction |
| `weather` | Weather | 110 | Low weight 0.5x + short-term |
| `hide-from-new` | Hide From New | 75 | System tag |
| `crypto-prices` | Crypto Prices | 20 | Short-term price prediction |
| `temperature` | Daily Temperature | 22 | Short-term weather |
| `nymex-crude-oil-futures` | NYMEX Crude Oil | 29 | Short-term commodity price |
| `solana` / `xrp` | Solana / XRP | 18 / 17 | Short-term crypto price |
| 20+ others | — | — | Insufficient liquidity or short expiry |

---

## Type Weight Explanation

Type weight affects candidate ranking score (`score = log10(liquidity) * log10(volume24h) * typeWeight`).

| Weight | Categories | Meaning |
|--------|-----------|---------|
| **1.5x** | politics, geopolitics, tech, ai, elections, trump | AI has edge, long-horizon reasoning |
| **1.2x** | economics, finance, fed, fomc | AI has moderate edge |
| **1.0x** | sports, esports, culture | Baseline |
| **0.5x** | weather | Low AI edge |
| **0.3x** | crypto, bitcoin, ethereum | Near-zero AI edge (random walk) |
| **0.8x** | all others | Default weight |

---

## Fee Calculation During Recommendation

For each candidate market, the system calculates trading fees as part of the recommendation flow:

1. **Determine fee category**: from the market's `categorySlug` (e.g. politics, sports, crypto) and `negRisk` flag
2. **Look up fee parameters**: find `feeRate` and `exponent` in `CATEGORY_FEE_PARAMS`
3. **Calculate entry fee**: `entryFee = shares × price × feeRate × (price × (1 - price))^exponent`
4. **Calculate exit fee**: same formula with exit price (free if held to settlement)
5. **Calculate net edge**: `netEdge = grossEdge - entryFeePct` (hold to settlement) or `grossEdge - entryFeePct - exitFeePct` (early exit)

### Fee Rate Table (updated 2026-03-31)

| Category | feeRate | exponent | Peak Fee @ 0.5 | Applicable Tags |
|----------|---------|----------|---------------|-----------------|
| **neg-risk markets** | **0** | 0 | **0%** | All multi-outcome events (elections, FIFA, etc. with `negRisk=true`) |
| geopolitics | 0 | 0 | 0% | Geopolitics |
| sports | 0.03 | 1 | 0.75% | Sports |
| economics | 0.03 | 0.5 | 0.75% | Economics |
| tech | 0.04 | 1 | 1.0% | Tech, AI |
| politics | 0.04 | 1 | 1.0% | Politics (non-neg-risk binary markets) |
| finance | 0.04 | 1 | 1.0% | Finance |
| culture | 0.05 | 1 | 1.25% | Culture |
| crypto | 0.072 | 1 | 1.8% | Crypto |
| other | 0.20 | 2 | 5.0% | Uncategorized |

**Key finding**: Multi-outcome `negRisk=true` markets (election nominations, World Cup winner, etc.) have **zero taker fees** on Polymarket. Verified via live trade (2026-03-31).

### Fee Impact on Edge — Example

Suppose AI estimates a politics market Yes probability at 55%, current market price 40%:
- Gross edge = 55% - 40% = **15%**
- If `negRisk=true` (e.g. election nomination): net edge = 15% - 0% = **15%** (no drag)
- If `negRisk=false` (plain political binary): entry fee = 0.04 × (0.4 × 0.6) = 0.96% → net edge = 15% - 0.96% = **14.04%**

Code location: `services/orchestrator/src/runtime/pulse-entry-planner.ts:329-334`

---

## Notes

- Tradeable candidate counts change dynamically with Polymarket market activity. This table is a point-in-time snapshot.
- `--category` uses **exact match** on slug (case-sensitive).
- You can also use `--tag` to filter by tag (a market can have multiple tags but only one primary category).
