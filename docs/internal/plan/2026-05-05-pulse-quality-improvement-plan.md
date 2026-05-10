# Pulse 质量提升流程计划

最后更新：2026-05-05

英文版：[`2026-05-05-pulse-quality-improvement-plan.en.md`](2026-05-05-pulse-quality-improvement-plan.en.md)

## Goal

- 把这次 eval feedback 转成 `pulse` 的标准执行流程。
- 提升 forecasting agent 的实盘质量，重点不只是找到新机会，而是避免错单、复审已有仓位、解释盈亏。
- 在下一次 `pulse:live` 前加入必要的 P00 / P0 质量门槛。

## Outcome

- `pulse:live` 前会先过 market identity 校验，避免 `$200 thesis -> $115 order` 这类错绑。
- 已有仓位不再默认 stale hold，而是输出 fresh evidence / adverse signal / reduce-close 条件。
- run-summary 能解释现金、净值、仓位数和 PnL 变化。
- 体育数据源补强进入 P3 TODO，不阻塞当前 P00/P0 修复。

## Implementation

### 1. P00：Market Binding Gate

目标：任何 live 下单前，研究对象和执行对象必须严格一致。

必须严格一致的字段：

- `marketSlug`
- `tokenId`
- `outcomeLabel`
- rule threshold / strike / candidate / team
- report market title 和 execution plan question 能互相对上

允许 3% 误差的字段：

- `bestBid`
- `bestAsk`
- `decision price`
- expected fill price

执行逻辑：

1. Pulse report 生成结构化 `selected_decisions`。
2. Entry planner 生成 execution plan。
3. 在下单前跑 `validateDecisionBinding(reportDecision, executionPlan)`。
4. identity 字段不一致时 fail-fast，禁止下单。
5. price 字段超过 3% 时重新 quote；仍超出则进入人工复核或 skip。

验收：

- 同一 event 下 `$115 / $130 / $200` strike 不会互相串单。
- run-summary 记录 binding gate 通过/失败结果。

### 2. P0：Existing Position Review Gate

目标：已有仓位必须被真实复审，而不是因为“没有反向 pulse”就自动 hold。

每个已有仓位必须输出：

- 当前 thesis 是否仍成立
- fresh evidence：新增支持证据
- adverse signal：新增反向证据
- edge 状态：active edge / stale edge / no edge / unknown
- action：hold / reduce / close / review_required
- stop-loss / take-profit / reduce trigger
- PnL 状态：浮盈亏、成本、当前 mark、变化原因

流程调整：

1. Position Review 先于新开仓推荐运行。
2. 没有 fresh evidence 时只能标 `stale-hold`，不能标 `still has edge`。
3. 如果仓位接近止损、事件临近结算、或 thesis 缺 fresh evidence 超过 N 天，强制 `review_required`。
4. Composer 合并决策时，已有仓位 review 的风险优先级高于新开仓。

验收：

- review 报告不再出现 `仍有 edge：是` 但 `edge=0` 的矛盾口径。
- 每个 hold 都能回答“为什么现在不 reduce/close”。

### 3. P1：PnL Attribution Summary

目标：run-summary 解释净值变化，而不是只列 before/after。

需要新增的 PnL 归因块：

- 运行前 cash / equity / open positions
- 新成交 notional、avgPrice、immediate mark、spread/slippage
- 已有仓位 mark-to-market 变化
- fees / gas / trading fee / rounding
- 仓位数变化：expected delta vs actual delta
- 异常项：例如 3 fills 但 positions 只 +2

验收：

- `净值 $548.13 -> $529.01` 这类变化必须有原因分类。
- 如果原因无法确定，明确标 `unexplained_delta`，并输出要查的 artifact 路径。

### 4. P1：Deep Research Coverage Policy

目标：明确“预扫描”和“可 live 下单”的区别。

建议规则：

- Pre-scan 可以只深研 Top N。
- Live open 决策必须完整深研：rules、resolution source、comments、orderbook、external source、known gaps。
- 未完整深研的候选只能进入 watchlist，不能进入 executable plan。

验收：

- 报告能清楚标注 `tradable` / `watchlist` / `insufficient_research`。
- `4/20 deep research` 可以存在，但不能直接伪装成完整 live 研究覆盖。

### 5. P2：Citation And Comment Evidence

目标：让证据可复盘。

改动：

- key claim 统一记录 `source / retrieved_at / credibility / viewpoint / short quote`。
- 评论区抽样至少分 latest、top-liked、holder、opposition 四类。
- 评论只在影响概率时进入证据链；否则放到 comment audit。

验收：

- 人类能从报告反查每个关键判断的来源。
- 不再用“公开常识”“博彩共识”替代 citation。

### 6. P3：Sports Data Collection TODO

目标：后续提升体育市场 forecast，但不阻塞当前 P00/P0。

Football / World Cup：

- FIFA ranking
- Elo / SPI 类评分
- 博彩公司赔率
- 伤病与大名单
- 赛程路径
- 同事件兄弟市场概率总和

Eurovision：

- Eurovisionworld / bookmaker odds
- 歌曲发布反馈
- 半决赛抽签
- 出场顺序
- 媒体与社区反应

验收：

- 低 edge 体育仓位必须做 sensitivity：外部赔率 / Elo / 伤病假设变化后 edge 是否仍存在。

## User Decisions

- Decision: 是否把 P00 market binding gate 作为下一次 `pulse:live` 的硬阻塞。
  - Why it matters: 这是避免真钱错单的最小保护。
  - Recommended default: 是。

- Decision: Existing Position Review 的强制刷新周期。
  - Why it matters: 太短会增加搜索成本，太长会让 stale hold 积累风险。
  - Recommended default: 每次 live 都复审；如果资源不足，至少复审 PnL 绝对值最大、接近止损、临近结算的仓位。

- Decision: 价格容差是否固定 3%。
  - Why it matters: 容差太小会误伤正常盘口波动，太大会放过实际错价。
  - Recommended default: 先用 3%，后续根据 fill / quote 偏差数据校准。

## Risks And Assumptions

- 假设当前 pulse report / recommendation / execution plan 都能暴露足够字段用于 binding validator。
- 风险：如果 report 仍是纯 Markdown，binding validator 会依赖不稳定解析；应优先结构化 decision JSON。
- 风险：Position Review 需要额外搜索时间，可能拉长 pulse runtime。
- 风险：PnL attribution 需要可靠 mark snapshot；如果成交后持仓刷新不稳定，必须先标 `unexplained_delta`，不能硬解释。

## Execution Gate

- 等用户 review 或修改本计划。
- 不在本计划生成的同一轮直接实现。
- 用户确认后，优先实现 P00 market binding gate，然后实现 P0 existing-position review gate，再补 PnL attribution。
