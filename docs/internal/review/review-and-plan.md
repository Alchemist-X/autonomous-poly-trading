# CloudReview：项目审计与简化计划

## 一、当前问题：为什么交易会失败

### 1.1 交易拦截链：7 层限制串联

系统设计了 **7 层风控限制**，交易必须全部通过才能执行。任何一层失败，交易都会被静默跳过，只留下一条模糊的拒绝原因。这就是"莫名其妙不能交易"的根源。

```
Pulse 风险标志            -> 任何一个标志触发 = 所有开仓封杀
  |
系统状态 (halt/pause)     -> 停机状态 = 所有开仓封杀
  |
Kelly 仓位计算            -> aiProb <= marketProb 则返回 0
  |
applyTradeGuards()        -> 5 个上限取最小值，级联压缩到 0
  |
交易所最低下单量           -> 被风控压小后 < Polymarket 最低限额
  |
订单簿可用性              -> CLOB 没有可执行的卖单
  |
持仓止损                  -> 浮亏 >= 30% 自动卖出
```

### 1.2 最常见的"神秘"拦截原因

| 拦截原因 | 触发条件 | 发生频率 | 可见度 |
|---------|---------|---------|-------|
| `pulse.tradeable = false` | Python 抓取市场不足 5000 个（默认阈值） | **非常频繁** — 抓取经常不够数 | 藏在风险标志里 |
| `blocked_by_risk_cap` | `min(请求金额, 5%bankroll, 流动性上限, 总敞口余额, 事件敞口余额)` 压到 0 | **频繁** — 已有持仓时尤其常见 | 错误信息模糊 |
| `blocked_by_exchange_min` | 风控压小订单 + 低于 Polymarket 最低下单量 | **频繁** — 双重处罚 | 两层拒绝混在一起 |
| Kelly = 0 | `aiProb <= marketProb`（检测不到正向优势） | 中等 | 在 entry planner 里静默跳过 |
| Drawdown halt（回撤停机） | 组合从高水位回撤 >= 20% | 偶尔 | 需要手动 admin resume |
| Pulse 过期 | 快照超过 30 分钟 | 重试时 | 封杀所有开仓 |

### 1.3 过度保守的默认阈值

| 参数 | 默认值 | 影响 | 评估 |
|------|-------|------|------|
| `MAX_TRADE_PCT` | 5% | $10k bankroll 下单笔最多 $500 | 非常保守 |
| `MAX_TOTAL_EXPOSURE_PCT` | 50% | 永远只有一半资金能被部署 | 限制资金效率 |
| `MAX_EVENT_EXPOSURE_PCT` | 30% | 单事件最多 $3k | 合理但与上面叠加 |
| `MAX_POSITIONS` | 10 | 持仓满 10 个后封杀所有开仓 | 小仓位时容易撞上 |
| `PULSE_MIN_FETCHED_MARKETS` | 5000 | 要求 Python 抓到 5000 个市场 | **不切实际，经常达不到** |
| `PULSE_MIN_TRADEABLE_CANDIDATES` | 5 | 需要 5 个可交易候选 | 市场选择窄时容易失败 |
| `PULSE_MAX_AGE_MINUTES` | 30 | Pulse 过期太快 | 强制频繁重新生成 |
| `DRAWDOWN_STOP_PCT` | 20% | 硬停机，需要手动恢复 | 波动市场下太激进 |
| Quarter Kelly | Full Kelly 的 25% | 非常保守的下注尺寸 | 经常算出低于最低下单额的金额 |

### 1.4 架构复杂度问题

| 问题 | 描述 |
|------|------|
| 3 条执行路径 | paper、pulse:live、live:test — 不知道用哪个 |
| 2 套决策策略 | `provider-runtime`（LLM）和 `pulse-direct` — 死代码增加维护负担 |
| 2 个独立服务 | orchestrator + executor 之间用 BullMQ 通信 — 单用户场景没必要 |
| 预检仪式 | 6 个门禁检查，任何一个失败都不能交易 |
| 产物爆炸 | 每次运行生成 5-8 个 JSON/MD 文件，按日期嵌套目录 |
| DB + Redis 依赖 | stateful 路径需要数据库和消息队列基础设施 — 对单钱包交易者太重 |

### 1.5 代码质量问题

| 文件 | 问题 |
|------|------|
| `pulse-live.ts` | 984 行，功能过于集中 |
| `execution-planning.ts` | `buildExecutionPlan` 是一个 160 行的函数，嵌套循环 |
| `position-review.ts` | 383 行，分支逻辑复杂 |
| `risk.ts:applyTradeGuards` | 一个函数用 5 层级联 `min()` 应用上限 — 无法调试是哪个上限卡住了 |

---

## 二、简化计划："Live House Only"

### 目标

一条命令（`pnpm live`）完成所有操作：
1. 从 Polymarket 获取当前持仓状态
2. 生成 Pulse（市场候选列表）
3. 做出决策（开仓/平仓/持有）
4. 直接在 Polymarket 执行
5. 输出结果报告

不需要 DB，不需要 Redis，不需要队列，不需要 paper mode，不需要 provider-runtime。

---

### Phase 1：立即缓解（调参 + 透明化）

> 优先修复最常见的静默拦截，最快见效。

#### 1.1 放宽 Pulse 风险标志
- `PULSE_MIN_FETCHED_MARKETS`：5000 -> 500（或直接移除）
- `PULSE_MIN_TRADEABLE_CANDIDATES`：5 -> 2
- `PULSE_MAX_AGE_MINUTES`：30 -> 120
- 移除 CLOB token ID 风险标志（过滤掉坏候选就行，不要封杀所有交易）

#### 1.2 放宽风控上限
- `MAX_TRADE_PCT`：5% -> 15%（允许有意义的仓位大小）
- `MAX_TOTAL_EXPOSURE_PCT`：50% -> 80%（部署更多资金）
- `MAX_EVENT_EXPOSURE_PCT`：30% -> 50%
- `MAX_POSITIONS`：10 -> 20
- `MIN_TRADE_USD`：10 -> 5（避免交易所最低限额悬崖）

#### 1.3 让 `applyTradeGuards` 透明化
- 返回具体是哪个约束在卡你的订单
- 日志示例："请求 $200，被总敞口限制压到 $150，再被交易所最低限额拦截（$8.50 < $10）"
- 光做这一项就能消除"莫名其妙"的感觉

#### 1.4 回撤停机自动恢复
- 不再硬停机等手动 admin 恢复，改为带冷却期的自动恢复
- 或者把 `DRAWDOWN_STOP_PCT` 从 20% 提高到 35%

---

### Phase 2：简化为单进程

#### 2.1 删除 Stateful 路径
- 只保留 `pulse-live.ts` 作为唯一执行路径
- 重命名为 `live-house.ts`
- 移除 agent-cycle.ts、queue-worker.ts 依赖

#### 2.2 移除 Provider Runtime
- 删除 `provider-runtime.ts` 及所有 LLM 调用代码
- 硬编码 `pulse-direct` 为唯一策略
- 移除 `AGENT_DECISION_STRATEGY` 和 `AGENT_RUNTIME_PROVIDER` 配置

#### 2.3 内联执行
- 移除 BullMQ 任务队列
- 在主循环中直接执行交易（pulse-live 路径已经是这么做的）
- 不再需要单独的 executor 服务

#### 2.4 简化预检
- 只保留：凭证检查 + 抵押品检查
- 移除：执行模式 env var 检查、env-file 检查、exchange-sizing 提示
- 钱包有钱 + 密钥有效 = 直接开始

---

### Phase 3：更好的可观测性（可选）

#### 3.1 结构化交易决策日志
- 每个决策一行 JSON：`{ action, market, requested, capped_to, binding_constraint, executed, result }`
- 用一个 `run-log.jsonl` 替代 8 个产物文件

#### 3.2 简洁汇总
- 执行后：一张表显示计划了什么、执行了什么、被拦截了什么以及具体原因
- 不再需要单独的 recommendation/execution/error 产物文件

---

## 三、实施优先级

```
Phase 1.1（Pulse 标志）    -> 30 分钟  -> 解除大部分"神秘"拒绝
Phase 1.2（风控上限）      -> 15 分钟  -> 只改环境变量
Phase 1.3（透明化）        -> 1 小时   -> applyTradeGuards 返回详细分解
Phase 1.4（自动恢复）      -> 30 分钟  -> 移除硬停机或加冷却期
Phase 2.1-2.4（简化架构）  -> 3 小时   -> 结构性重构
Phase 3（可观测性）        -> 2 小时   -> 锦上添花
```

## 四、Phase 1 需要修改的文件

| 文件 | 改动 |
|------|------|
| `services/orchestrator/src/config.ts` | 调整默认值 |
| `services/orchestrator/src/pulse/market-pulse.ts` | 放宽 `evaluatePulseRiskFlags` |
| `services/orchestrator/src/lib/risk.ts` | `applyTradeGuards` 返回详细分解 |
| `services/orchestrator/src/lib/execution-planning.ts` | 使用详细分解显示拒绝原因 |
| `.env.pizza`（或当前活跃的 env 文件） | 覆盖阈值 |

## 五、Phase 2 需要删除的文件

| 文件/目录 | 原因 |
|----------|------|
| `services/orchestrator/src/runtime/provider-runtime.ts` | 死路径 |
| `services/orchestrator/src/jobs/agent-cycle.ts` | 仅 stateful 使用 |
| `services/executor/src/workers/queue-worker.ts` | 基于队列的执行 |
| `services/orchestrator/src/ops/paper-trading.ts` | paper mode |
| 所有 BullMQ 配置/初始化代码 | 不再需要队列 |



我的想法

PULSE_MIN_FETCHED_MARKETS      │ 5000       │ 5000 保留不变     │            │
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤
  │ PULSE_MIN_TRADEABLE_CANDIDATES │ 5          │ 1                   │            │                     
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤
  │ PULSE_MAX_AGE_MINUTES          │ 30         │ 120                 │            │                     
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤                     
  │ MAX_TRADE_PCT                  │ 5%         │ 15%                 │            │
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤                     
  │ MAX_TOTAL_EXPOSURE_PCT         │ 50%        │ 80%                 │            │
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤
  │ MAX_EVENT_EXPOSURE_PCT         │ 30%        │ 30%                 │            │
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤
  │ MAX_POSITIONS                  │ 10         │ 22                  │            │
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤
  │ MIN_TRADE_USD                  │ $10        │ $5                  │            │
  ├────────────────────────────────┼────────────┼─────────────────────┼────────────┤                     
  │ DRAWDOWN_STOP_PCT              │ 20%        │ 30%（或改自动恢复） │            │
  └────────────────────────────────┴────────────┴─────────────────────┴────────────


  1. fetch_markets.py       → 从 Polymarket API 抓市场列表（纯机械） 这里应该也加入AI分析。比如筛选掉一些没有必要的市场，然后应该一直累积。

像这种 5 分钟、10 分钟的涨跌市场，AI 的 reasoning 根本没有 edge。我想要的是发挥 AI 在 long horizon reasoning 的能力，因为我相信它已经某种程度上可能和人类做得一样好，而且它能盯所有的市场。

这句话（即我想传达的一个理念）同时也要加到网页上：
1. 人不能实时地盯着这个市场
2. 哪怕 AI 的能力比人类弱一些，但它在数量上和及时性上弥补了这一点
  2. full-pulse.ts          → 用 LLM (Codex/OpenClaw) 分析候选市场，
                               生成研究报告 + 方向推荐 + AI概率（AI 参与）
  3. pulse-entry-planner.ts → 解析报告里的方向和概率，计算 Kelly（纯机械）
  4. monthlyReturn 排序     → 按资金效率排 top 4（纯机械）这一步关于投资回报比的计算，也应该有 AI 介入，而且在 Pulse 里面就应该已经完成了。
这里提到的排序只是机械执行，但之前的分析——关于回报到底如何，也应该由 AI 来完成。
  5. applyTradeGuards       → 风控裁剪（纯机械）
  6. executeMarketOrder     → Polymarket 下单（纯机械）

  问题是： 你刚才把 provider 改成了 "none" 默认，如果没有配置 Codex/OpenClaw 的命令和 API key，第 2 步的
  LLM 研究报告就无法生成，Pulse 会缺少方向推荐，导致 entry planner 解析不到任何有效候选 → 没有交易。
我希望你能改一下这个环境。我现在想要的是：
1. 把 Codex/OpenClaw 部署在远程一个 VPS 上执行。
2. 定时不断地去执行这个任务。

你需要把运行的这个范式做成 API Key-free 的模式，也就是让一个框架在跑这个东西，而不是说用一个具体的 API Key 在跑。

它的运用应该像一个 Skill 一样，你去跑通整个框架并运用。但这又比 Skill 复杂，应该是一个 Agentic 的模式。
  要让系统真正工作，你需要：
  1. 配置一个 LLM provider（在 .env.pizza 或环境变量中设置 AGENT_RUNTIME_PROVIDER=codex + CODEX_COMMAND +
   CODEX_MODEL）
  2. 或者用 Claude Code / OpenClaw 作为 provider

  你目前 .env.pizza 里配的是哪个 provider？这决定了系统能不能真正做研究和下单。