# Pulse Live 完整流程

> 最后更新：2026-04-01

## 一句话概括

`pnpm pulse:live` = 抓市场 → 随机选 20 个 → AI 深度研究 4 个 → 写推荐报告 → 代码提取交易计划 → 风控裁剪 → 实盘下单。

## 流程阶段

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Preflight (5%)                                                  │
│     检查钱包凭证、链上 USDC 余额、执行模式                              │
├─────────────────────────────────────────────────────────────────────┤
│  2. Auto-Redeem (5%)                                                │
│     扫描已结算市场，自动赎回 CTF tokens → USDC                         │
├─────────────────────────────────────────────────────────────────────┤
│  3. Portfolio Load (10%)                                            │
│     从 Polymarket data API 拉取远程持仓 + 链上余额                     │
├─────────────────────────────────────────────────────────────────────┤
│  4. Pulse Fetch (10-16%)           ⏱ ~1 分钟                        │
│     Python fetch_markets.py 抓取 ~8000 个市场                         │
│     → 流动性 + 垃圾过滤 → ~900 个可交易                                │
│     → 随机抽样 20 个候选                                              │
│     → 短期价格市场过滤                                                │
├─────────────────────────────────────────────────────────────────────┤
│  5. Deep Research (20-50%)         ⏱ ~30 秒                         │
│     从 20 个候选中按优先级选 4 个                                      │
│     每个候选：                                                       │
│       - Scrape Polymarket 页面（结算规则 + 评论）                      │
│       - 读取 CLOB 订单簿（bestBid/bestAsk/depth）                    │
│     输出 research JSON (~135KB)                                      │
├─────────────────────────────────────────────────────────────────────┤
│  6. Pulse Report Render (50-68%)   ⏱ 5-10 分钟  ← LLM 介入 #1       │
│     将 research JSON + prompt 模板 + 分析框架                         │
│     喂给 Claude Code (`claude --print`)                              │
│     LLM 输出完整 Markdown 报告：                                      │
│       - 候选池筛选逻辑                                                │
│       - Top 3 推荐（概率评估 + 证据链 + 四维分析）                      │
│       - 仓位建议（Kelly sizing）                                      │
│     超时上限：30 分钟                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  7. Entry Planner (70%)            ⏱ 瞬间  ← 纯代码，无 LLM          │
│     解析 Markdown 报告的 ## 章节                                      │
│     提取：方向 / AI 概率 / 市场概率 / 置信度                            │
│     匹配到 pulse candidates（URL 或标题匹配）                          │
│     重新计算 1/4 Kelly sizing + 手续费 + net edge                     │
│     输出：entry plans[]                                              │
├─────────────────────────────────────────────────────────────────────┤
│  8. Position Review (70%)          ⏱ 瞬间  ← 纯代码，无 LLM          │
│     复审已有持仓（hold / close / reduce）                              │
│     对比当前价格 vs 持仓成本                                           │
├─────────────────────────────────────────────────────────────────────┤
│  9. Decision Compose (70%)         ⏱ 瞬间  ← 纯代码，无 LLM          │
│     合并 entry plans + position reviews → 最终决策集                   │
│     去重（同 token 不重复下单）                                        │
├─────────────────────────────────────────────────────────────────────┤
│  10. Execution Planning (75%)      ⏱ 几秒                           │
│      对每个决策：                                                     │
│        - 读取订单簿（bestBid/bestAsk/minOrderSize）                   │
│        - 风控裁剪（max_trade / total_exposure / event_exposure）       │
│        - 交易所最低下单额检查                                          │
│        - 决定 FOK 或 GTC 订单类型                                     │
│      输出：PlannedExecution[]                                        │
├─────────────────────────────────────────────────────────────────────┤
│  11. Execute Orders (80-95%)       ⏱ 几秒/笔                        │
│      对每笔计划：                                                     │
│        - SELL 前：链上 ERC1155 余额校验                                │
│        - GTC：挂限价单 → 轮询等待 → 超时 fallback FOK                  │
│        - FOK：市价单立即成交                                          │
│        - 记录成交结果                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  12. Summary & Archive (95-100%)   ⏱ 瞬间                           │
│      写入 execution-summary.json                                     │
│      写入 run-summary.md (CN + EN)                                   │
│      追加 equity snapshot                                            │
│      输出终端总结                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## LLM 介入点

整个流程中 **LLM 只在第 6 步介入一次**（pulse-direct 策略下）：

| 步骤 | 是否用 LLM | 说明 |
|------|-----------|------|
| 1-5 | 否 | Python 抓取 + 代码过滤 + API 请求 |
| **6. Pulse Report** | **是** | Claude Code 生成完整分析报告 |
| 7-9 | 否 | 纯代码解析报告 + 计算 Kelly + 合并决策 |
| 10-12 | 否 | 代码执行交易 + 归档 |

## 耗时分布（典型运行）

| 阶段 | 耗时 | 占比 |
|------|------|------|
| Preflight + Redeem + Portfolio | ~15 秒 | 2% |
| Pulse Fetch (Python) | ~1 分钟 | 10% |
| Deep Research (scrape + orderbook) | ~30 秒 | 5% |
| **Report Render (LLM)** | **5-10 分钟** | **70%** |
| Entry Plan + Review + Compose | <1 秒 | 0% |
| Execution Planning + Orders | ~10 秒 | 2% |
| Summary + Archive | <1 秒 | 0% |
| **总计** | **~8-12 分钟** | |

报告渲染是瓶颈，占总耗时 70%。超时上限 30 分钟。

## 关键文件

| 文件 | 职责 |
|------|------|
| `scripts/pulse-live.ts` | 主入口，串联所有阶段 |
| `vendor/.../fetch_markets.py` | Python 抓取 Polymarket 市场 |
| `orchestrator/pulse/market-pulse.ts` | 候选选择 + 过滤 |
| `orchestrator/pulse/full-pulse.ts` | LLM 报告渲染 |
| `orchestrator/runtime/pulse-entry-planner.ts` | 从报告提取交易计划（纯代码） |
| `orchestrator/runtime/pulse-direct-runtime.ts` | 合并 review + entries |
| `orchestrator/lib/execution-planning.ts` | 风控 + 订单类型决策 |
| `executor/lib/polymarket-sdk.ts` | CLOB 下单 / 订单簿 / 余额校验 |

## 订单类型决策（GTC vs FOK）

```
收费市场 + 开仓 + spread < 5%  → GTC 限价单（省手续费）
                                  ↓ 5 分钟未成交
                                  → 取消 → FOK 市价单 fallback

其他所有情况                    → FOK 市价单（立即成交）
```

当前 GTC 默认关闭（`ENABLE_GTC_ORDERS=true` 启用）。

## 命令

```bash
# 实盘（默认）
ENV_FILE=.env.pizza pnpm pulse:live

# 只看推荐不下单
ENV_FILE=.env.pizza pnpm pulse:recommend

# 指定分类
ENV_FILE=.env.pizza pnpm pulse:live -- --category politics

# 复用已有 pulse 快照
ENV_FILE=.env.pizza pnpm pulse:live -- --pulse-json runtime-artifacts/reports/pulse/.../pulse-xxx.json
```
