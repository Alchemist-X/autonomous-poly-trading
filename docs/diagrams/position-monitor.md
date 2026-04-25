# 持仓监控器（Position Monitor）

> 独立运行的 model-free 止损守护进程

## 功能

持续轮询 Polymarket 远程持仓，当任意持仓的**未实现亏损超过入场成本的 30%** 时，自动市价卖出该持仓。

## 设计原则

- **Model-free**：纯价格监控，不依赖任何 AI 模型或策略判断
- **无基础设施依赖**：不需要 DB、Redis、BullMQ，只需 `.env` 文件中的钱包凭证
- **独立进程**：可在任何机器上运行，与 pulse:live 互不干扰
- **默认不启用**：需要手动启动

## 启动方式

```bash
# 实盘模式（会真实执行卖出）
ENV_FILE=.env.pizza npx tsx scripts/position-monitor.ts

# 干跑模式（只报警不卖出，用于测试）
ENV_FILE=.env.pizza npx tsx scripts/position-monitor.ts --dry-run
```

## 配置项

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `MONITOR_POLL_SECONDS` | 30 | 轮询间隔（秒） |
| `MONITOR_STOP_LOSS_PCT` | 0.30 | 止损阈值（30% 亏损） |
| `MONITOR_LOG_DIR` | `run-error/` | 止损事件日志目录 |

## 止损计算

```
pnlPct = (currentPrice - avgCost) / avgCost

触发条件: pnlPct <= -MONITOR_STOP_LOSS_PCT
```

- `avgCost`：从 Polymarket CLOB API 获取该 token 所有 BUY 交易的 VWAP（成交量加权均价）
- `currentPrice`：从 CLOB 订单簿获取 bestBid（最佳买价 = 立即可卖价格）

### 示例

| 持仓 | 入场成本 | 触发价格（-30%） | 说明 |
|------|---------|-----------------|------|
| Iran 美军进入 No | $0.863 | $0.604 | 当前 $0.98，远离触发线 |
| Rubio 2028 No | $0.895 | $0.627 | 当前 $0.89，安全 |
| Mets 世界大赛 No | $0.945 | $0.662 | 入场价高，需跌 $0.28 才触发 |
| 麻疹 12500 No | $0.896 | $0.627 | 当前 $0.89，安全 |

## 输出格式

```
[INFO] 2026-03-31T09:00:00Z Cycle #1 | 7 positions
  Iran 美军进入 No                              +12.4%  cost=0.863 now=0.970 shares=55.7
  Rubio 2028 No                                 -0.6%  cost=0.895 now=0.890 shares=34.7
  ...

[ERR]  2026-03-31T09:05:30Z STOP-LOSS TRIGGERED | Example Market | -31.2% loss (threshold -30%)
[OK]   2026-03-31T09:05:31Z SOLD 50.0 shares | orderId=0xabc... | avgPrice=0.59 | proceeds=$29.50
```

## 止损事件日志

每次触发止损都会写入 `run-error/stop-loss-events.jsonl`：

```json
{
  "timestamp": "2026-03-31T09:05:30.123Z",
  "tokenId": "12345...",
  "title": "Example Market",
  "avgCost": 0.863,
  "currentPrice": 0.600,
  "pnlPct": -0.305,
  "shares": 55.7,
  "action": "SELL",
  "orderId": "0xabc...",
  "error": null
}
```

## 架构图

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

## 未来扩展（暂不实现）

预留了更精细的止损策略接口，后续可扩展：
- **1 分钟内跌 5%**：需维护价格时间序列缓存
- **30 分钟内跌 10%**：需维护 30 分钟滑动窗口
- **分级止损**：不同持仓使用不同阈值

当前只保留最简单的"任意时间段内价格下跌超过 30%"逻辑。

## 测试

```bash
npx vitest run scripts/position-monitor.test.ts
```

覆盖 16 个用例：边界值、正/负收益、真实持仓场景。
