# Paper Agent 手续费模型（Polymarket 官方费率表）

> 最后更新：2026-09-08 | 英文版：[`paper-agent-fee-model.en.md`](./paper-agent-fee-model.en.md)
>
> 代码：`services/paper-agent/src/fees.ts`（公式、分类查表、env 覆盖）· `polymarket.ts`（Gamma 标签）· `book-sim.ts`（成交模拟）

## 1. 问题是什么、影响了什么

2026-09-08 之前，模拟盘用的公式是 `shares × (taker_base_fee / 10000) × min(p, 1 − p)`，费率直接取 CLOB 市场对象的 `taker_base_fee`（所有收费市场都返回 1000 bps）。这和 Polymarket 官方文档不符，导致：

| 指标（Huginn 7 本模拟盘账本，2026-08-23 → 2026-09-07） | 旧模型 | 官方公式                  |
| ------------------------------------------------------ | ------ | ------------------------- |
| 总手续费                                               | $6,476 | $2,234（旧模型高估 2.9×） |
| 价格 < $0.20 的 token：手续费占名义金额                | 10.0%  | 约 3.6%                   |
| 限价（maker）成交被收费                                | 32 笔  | 应为 0                    |

**这些历史账本的 PnL 是按旧模型记的，对比前后表现时必须按新公式重算。**

## 2. 官方公式（2026-07-01 起全站生效）

来源：docs.polymarket.com/polymarket-learn/trading/fees、help.polymarket.com 文章 13364478。

```
fee = C × feeRate × p × (1 − p)      C = 股数，p = 成交价
```

文档示例：Crypto 分类（0.07）以 $0.50 买 100 股 → 100 × 0.07 × 0.5 × 0.5 = **$1.75**。

- **只有 taker 付费**（市价单、吃掉挂单的一方）。maker（挂单被动成交）费用为 0，且每日按分类拿 15–25% 的 taker 手续费返还；模拟盘把返还记为 0。
- 费率随价格呈抛物线：p = 0.5 时最高，两端趋近 0（p = 0.01 时 100 股 × 0.07 ≈ $0.07）。

## 3. 费率从哪来

| 分类（Polymarket 官方） | feeRate | 对应 Gamma 标签（精确匹配）                                                                                                            |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Politics                | 0.04    | `politics` `elections` `world-elections` `us-presidential-election` `trump` `trump-presidency`                                         |
| Finance                 | 0.04    | `finance` `stocks` `ipos`                                                                                                              |
| Tech                    | 0.04    | `tech` `ai` `spacex`                                                                                                                   |
| Mentions                | 0.04    | `mentions` `mention-markets`                                                                                                           |
| Sports                  | 0.05    | `sports` `soccer` `football` `nba` `nfl` `mlb` `nhl` `ncaa` `tennis` `wta` `esports` `formula1` `chess` `baseball` `league-of-legends` |
| Economics               | 0.05    | `economics` `economy` `economic-policy` `fed-rates` `fed` `fomc` `inflation`                                                           |
| Culture                 | 0.05    | `culture` `pop-culture` `music` `awards` `eurovision` `movies` `entertainment`                                                         |
| Weather                 | 0.05    | `weather` `temperature` `climate`                                                                                                      |
| Other（默认）           | 0.05    | 任何未匹配到的标签                                                                                                                     |
| Crypto                  | 0.07    | `crypto` `bitcoin` `ethereum` `solana` `xrp` `crypto-prices` `airdrops` `defi`                                                         |
| Geopolitics             | 0       | `geopolitics` `middle-east` `foreign-policy` `ukraine` `ukraine-peace-deal` `strait-of-hormuz`                                         |

精确匹配都失败后再试子串别名（`politic` / `election` / `sport` / `league` / `crypto` / `bitcoin` / `econ` / `weather` / `culture` / `mention` / `geopolitic` 等，完整列表见 `fees.ts` 的 `TAG_ALIASES`）。故意不用 `ai`、`war` 这类会误伤（`ukraine`、`warriors`）的短子串。

标签来源（`polymarket.ts`）：Gamma 市场行的 `category` 字段（经常为空）→ 市场行 `tags[].slug` → 内嵌父事件的 `tags[].slug`；三者都没有时额外 GET 一次 `/events/<eventId>`。自动扫描发现的市场会再把扫描分类（`PAPER_CATEGORIES`）作为最低优先级的提示附在后面。

### 决策规则（`buildFeeParams`）

1. CLOB `taker_base_fee == 0` → **免费**，不看分类（Geopolitics 市场实测就是这种情况）。
2. `taker_base_fee > 0` 且标签命中费率 > 0 的分类 → 用该分类费率（`rateSource = "category"`）。
3. `taker_base_fee > 0` 但没有标签命中、或命中的分类费率是 0（例如标签是 geopolitics 却被 CLOB 标记收费）→ 用默认费率 0.05（`rateSource = "default"`）。**交易所自己的收费标志优先于我们的标签映射，模拟盘绝不假设交易所声明收费的交易是免费的。**
4. CLOB 的 1000 bps 从不当作费率参与乘法。

每个持仓上保存的 `fees` 字段同时记录原始 CLOB 数值（`takerBps` / `makerBps` / `tickSize`）和解析结果（`feeRate` / `category` / `rateSource`），买入的 ledger 行也会写入 `feeRate` / `feeCategory` / `feeRateSource`，方便事后审计。旧账本里没有 `feeRate` 的持仓在加载时按规则 1/3 补齐，下一轮评估的 `refreshFees` 会用标签重新解析。

### env 覆盖（`deploy/raven/.env.example`）

```
PAPER_FEE_RATES=crypto=0.07,sports=0.05   # 逐分类覆盖，格式 <分类>=<0 ≤ 费率 < 1>
PAPER_FEE_DEFAULT_RATE=0.05               # 未命中标签时的默认费率
```

写错的条目会打 WARN 并忽略，不会把费率悄悄变成 0。

## 4. 对策略的影响

净 edge 的计算（`policy.ts`：进场 `fair − ask − fee`、持有 vs 卖出 `fair − (bid − fee)`）没有改动，只是代入的每股手续费变小、且限价退出那一半不再扣费。50/50 混合退出、止损、饱和持有等规则都不变。
