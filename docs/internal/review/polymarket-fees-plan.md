# Polymarket 手续费研究与执行计划

## 一、费率结构（2026-03-30 生效）

### 公式

```
fee_usdc = C × p × feeRate × (p × (1 - p))^exponent
```

- `C` = 交易份额数
- `p` = 份额价格（0-1）
- `feeRate` / `exponent` = 按市场类别决定

### 各类别费率

| 类别 | feeRate | exponent | Maker 返还 | 峰值有效费率(p=0.5) |
|------|---------|----------|-----------|-------------------|
| **Geopolitics** | **0** | — | — | **0%** |
| Sports | 0.03 | 1 | 25% | 0.75% |
| Tech | 0.04 | 1 | 25% | 1.00% |
| Politics | 0.04 | 1 | 25% | 1.00% |
| Finance | 0.04 | 1 | 50% | 1.00% |
| Economics | 0.03 | 0.5 | 25% | 1.50% |
| Culture | 0.05 | 1 | 25% | 1.25% |
| Weather | 0.025 | 0.5 | 25% | 1.25% |
| Crypto | 0.072 | 1 | 20% | 1.80% |
| Mentions | 0.25 | 2 | 25% | 1.56% |
| Other | 0.2 | 2 | 25% | 1.25% |

### 关键特性

- **仅对 Taker 收费**：限价单如果作为 Maker 成交则不收费，还能获得 Maker 返还
- **买单收份额、卖单收 USDC**：USDC 等价金额相同
- **峰值在 p=0.5**：价格越偏离 0.5，手续费越低
- **Geopolitics = 0 费率**：当前我们大部分持仓（伊朗相关）属于此类

### API 端点

```
GET https://clob.polymarket.com/fee-rate?token_id={token_id}
```

返回 `{ "base_fee": 0 }` 或 `{ "base_fee": 1000 }`。`base_fee=0` 表示免费，非零值需要结合类别参数计算实际费率。

## 二、对当前持仓的影响

### 当前持仓费率检查（实测）

| 市场 | 类别 | base_fee | 影响 |
|------|------|----------|------|
| US Forces Enter Iran (Mar/Apr) | Geopolitics | 0 | **免费** |
| Iranian Regime Fall | Geopolitics | 0 | **免费** |
| US-Iran Ceasefire | Geopolitics | 0 | **免费** |
| England Win WC | Sports | 0 | **免费**（可能是旧市场未迁移） |
| Bitcoin Dip 65k | Crypto | 0 | **免费**（可能是旧市场未迁移） |
| Newsom Nomination/President | Politics | 未检查 | 预计 1.00% 峰值 |

### 费用示例计算

以 **Politics 市场**为例（feeRate=0.04, exponent=1）：

**买入 100 shares @ $0.50**：
```
fee = 100 × 0.50 × 0.04 × (0.50 × 0.50)^1
    = 100 × 0.50 × 0.04 × 0.25
    = $0.50 (1.00% of notional)
```

**买入 100 shares @ $0.80**（我们常见的价位）：
```
fee = 100 × 0.80 × 0.04 × (0.80 × 0.20)^1
    = 100 × 0.80 × 0.04 × 0.16
    = $0.512 (0.64% of notional)
```

**买入 100 shares @ $0.90**（高概率事件）：
```
fee = 100 × 0.90 × 0.04 × (0.90 × 0.10)^1
    = 100 × 0.90 × 0.04 × 0.09
    = $0.324 (0.36% of notional)
```

## 三、盈利性分析

### 进出都要付费

一笔完整交易包含：
1. **进场费** = 买入时的 taker fee
2. **出场费** = 卖出时的 taker fee（如果主动卖出）
3. **结算** = 如果持有到期，赢家结算获得 $1/share，**无额外手续费**

### 总成本 = 进场费 + 出场费（或 0 如果持有到结算）

**策略 A：持有到结算（推荐）**
- 只付一次进场费
- 如果判断正确：profit = (1 - entry_price) × shares - entry_fee
- **总手续费 = 仅进场费**

**策略 B：中途卖出**
- 进场费 + 出场费
- profit = (exit_price - entry_price) × shares - entry_fee - exit_fee
- **总手续费 = 两次费用**

### 盈利门槛计算

**Politics 市场 @ $0.80 entry**（feeRate=0.04, exponent=1）：
- 进场费率: 0.64%
- 出场费率（假设 exit @ $0.85）: 0.51%
- 总成本: 1.15%
- **需要 edge > 1.15% 才能盈利**

**Crypto 市场 @ $0.50 entry**（feeRate=0.072, exponent=1）：
- 进场费率: 1.80%
- 出场费率（同 $0.50）: 1.80%
- 总成本: 3.60%
- **需要 edge > 3.60% 才能盈利**

**Geopolitics 市场**（feeRate=0）：
- 总成本: **0%**
- **任何正 edge 即可盈利**

## 四、执行层面建议

### 1. 按类别调整最低 edge 门槛

当前系统只有一个全局的 edge 门槛。应该按类别设置不同的最低 edge：

| 类别 | 峰值费率 | 往返成本（策略B） | 建议最低 edge |
|------|---------|------------------|-------------|
| Geopolitics | 0% | 0% | 1%（保持现有） |
| Sports | 0.75% | 1.50% | 3% |
| Tech | 1.00% | 2.00% | 4% |
| Politics | 1.00% | 2.00% | 4% |
| Crypto | 1.80% | 3.60% | 6% |

### 2. 优先持有到结算

持有到结算只付一次进场费，成本减半。系统应该：
- 对高确信度的持仓，倾向持有到结算而非中途卖出
- 只在 edge 反转时才主动卖出（承受双重手续费）

### 3. 在 Pulse 报告中显示费用

每个推荐应该包含：
- 进场手续费（USDC）
- 持有到结算的总成本
- 中途退出的预估总成本
- **扣除手续费后的净 edge**

### 4. 优先交易 Geopolitics 类别

当前我们的持仓大部分在 Geopolitics（0 费率），这是最优的选择。在同等 edge 下，应该优先选择低费率类别。

## 五、需要实施的代码改动

| 改动 | 文件 | 说明 |
|------|------|------|
| 获取市场费率 | `fetch_markets.py` 或 execution-planning | 调用 `/fee-rate` API 获取每个候选的费率 |
| 计算手续费 | `pnl-calculator.ts` / `execution-planning.ts` | 实现 fee 公式 |
| 显示在 Pulse 报告中 | `full-pulse.ts` prompt | 让 AI 在推荐中考虑手续费 |
| 调整 edge 门槛 | `pulse-entry-planner.ts` | 按类别设置最低 edge |
| 持仓决策考虑费用 | `position-review.ts` | reduce/close 时评估双重手续费是否值得 |

## 六、需要确认的决策

1. **是否按类别设置不同的最低 edge？** 还是用一个全局值（比如 3%）？
2. **是否优先持有到结算？** 当前 position review 可能会在 edge 变弱时主动卖出，但考虑到双重手续费，可能应该更宽容地持有。
3. **Maker vs Taker**：是否值得实现限价单（Maker 0 费用），还是继续用 FOK 市价单（Taker）？
