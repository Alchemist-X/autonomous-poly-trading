# Forecasting Agent Evaluation（eval）评分流程

最后更新：2026-05-07

本目录用于固定 forecasting agent 的质量评价流程。`evaluation/` 是正式目录名，日常简称 `eval`。

## 人工 review 入口

- 本次样例评分：[`runs/2026-04-26-5f9b3d43.md`](runs/2026-04-26-5f9b3d43.md)
- Eval 质量 TODO：[`backlog.md`](backlog.md)
- 同步英文副本：[`README.en.md`](README.en.md)、[`backlog.en.md`](backlog.en.md)、[`runs/2026-04-26-5f9b3d43.en.md`](runs/2026-04-26-5f9b3d43.en.md)
- 原始 run 总结：`runtime-artifacts/pulse-live/2026-04-26T060306Z-5f9b3d43-56b9-481b-a593-a5f64863e26a/run-summary.md`
- Pulse 原始报告：`runtime-artifacts/reports/pulse/2026/04/26/pulse-20260426T060323Z-claude-code-full-5f9b3d43-56b9-481b-a593-a5f64863e26a.md`
- 机器可读归档：`runtime-artifacts/pulse-live/2026-04-26T060306Z-5f9b3d43-56b9-481b-a593-a5f64863e26a/recommendation.json` 和 `execution-summary.json`

## 总分结构

总分 100 分。评分对象是 agent 的可复盘预测质量，不是单次盈亏。

| 维度 | 权重 | 评价问题 |
| --- | ---: | --- |
| Agentic Search 信息搜寻 | 45 | 是否找到足够好的信息，并把信息组织成可验证证据链 |
| Long-horizon Reasoning 长程推理 | 45 | 是否能把证据转成概率、场景、仓位和未来状态预演 |
| Trading / Archive Integrity 交易与归档一致性 | 10 | 研究对象、下单对象、成交结果和 run 总结是否一致 |

## 硬性红线与分数上限

这些不是普通扣分，而是最终分数上限。若多个红线同时触发，取最低上限。

| 红线 | 上限 | 说明 |
| --- | ---: | --- |
| 研究对象与实际 `marketSlug` / `tokenId` / outcome / 阈值不一致，并进入 live 执行 | 49 | 这是真钱实盘的 P00 问题。研究的是 A 市场、下单的是 B 市场时，edge、仓位、成交解释全部失效 |
| 已执行交易缺失明确结算规则或 resolution source | 60 | 不能确认结算标准，就不能让预测变成可执行交易 |
| 可交易推荐主要依赖不可核验常识，且没有独立外部来源支撑 | 75 | 尤其适用于体育、政治、商品、宏观事件 |
| 已有仓位没有 fresh signal，却在报告里标记为“仍有 edge” | 80 | 可以 hold，但必须标成 stale-hold / needs-review，不能伪装成已刷新 edge |
| 成交后账户状态、仓位数、净值变化存在不一致且未解释 | 85 | run-summary 必须让人能看懂真实发生了什么 |

## A. Agentic Search 信息搜寻（45 分）

| 子项 | 分值 | 满分标准 |
| --- | ---: | --- |
| A1 候选发现与覆盖 | 8 | 清楚记录扫描范围、过滤规则、候选池规模；深研覆盖足以支持最终交易，不只挑少数样本 |
| A2 Research Rule 遵循 | 8 | 每个可交易决策都有规则原文、结算源、价格/盘口、评论区、缺口记录 |
| A3 信息源定位 | 8 | 能精准找到 primary source、权威数据、独立外部来源；避免只用 Polymarket 页面和泛泛常识 |
| A4 评论区挖掘 | 6 | 说明评论抽样方法，覆盖最新/最高赞/持仓者/反方观点，提炼可影响概率的信息 |
| A5 可信度与 citation | 8 | 每条关键证据有来源、获取时间、可信度等级、观点归属；必要时保留短原文引用 |
| A6 信息组装与缺口暴露 | 7 | 把证据、反证、缺口组装成一盆菜；明确哪些信息不足以支持下单 |

## B. Long-horizon Reasoning 长程推理（45 分）

| 子项 | 分值 | 满分标准 |
| --- | ---: | --- |
| B1 概率模型清晰度 | 8 | 有 base rate、市场价、AI 估算、edge，且人类能看懂概率从哪里来 |
| B2 证据到概率的更新链 | 8 | 每个证据如何上调/下调概率讲清楚，避免拍脑袋式 +/- |
| B3 场景预演与时间路径 | 10 | 预演未来关键节点、触发条件、反向情景、到期前价格路径 |
| B4 校准、敏感性与阈值 | 7 | 展示 edge 对关键假设的敏感性；低 edge 时有明确跳过/降级规则 |
| B5 组合层推理 | 6 | 检查相关性、方向拥挤、同类风险、已有仓位 fresh edge、事件敞口 |
| B6 可读性与去冗余 | 6 | 推理足够详尽但不重复，结论、证据、行动之间一一对应 |

## C. Trading / Archive Integrity 交易与归档一致性（10 分）

| 子项 | 分值 | 满分标准 |
| --- | ---: | --- |
| C1 市场绑定一致性 | 4 | 报告标题、规则阈值、marketSlug、tokenId、outcomeLabel 必须完全一致；bestBid/bestAsk、decision price 允许 3% 以内误差 |
| C2 仓位与风控一致性 | 3 | Kelly、实盘裁剪、最小订单、事件敞口、最终下单金额都有解释 |
| C3 成交后状态可解释 | 3 | 现金、净值、仓位数、订单、未入账/未显示仓位、异常差异都有说明 |

## 标准 eval 流程

1. 收集同一 `runId` 的 `run-summary.md`、Pulse Markdown/JSON、review/monitor/rebalance 报告、`recommendation.json`、`execution-summary.json`。
2. 做一致性 preflight：核对 `runId`、执行模式、钱包/env、时间戳、候选数、决策数、成交数、成交后仓位数。
3. 建一张 decision evidence sheet：每条决策记录 action、exact `marketSlug`、`tokenId`、outcome、阈值、价格、AI 概率、市场概率、edge、来源、评论样本、缺口、置信度。
4. 逐条检查市场绑定：研究文本里的市场和实际下单市场必须是同一个 outcome，尤其是同一 event 下的不同 strike / candidate / team。
5. 按 A/B/C 三大维度打原始分。
6. 应用硬性红线分数上限，得到最终分。
7. 输出 P00/P0/P1/P2/P3 finding：P00 阻止 live，P0 是下一轮 live 前优先修，P1 是本周质量提升，P2 是报告与证据优化，P3 是长期数据源 TODO。
8. 给出下次 run 的最小验收清单，而不是只给抽象评价。

## Calibration / Backtesting 数据

2026-05-07 之后的 `pulse-live` / `pulse:recommend` run 会额外保存：

- 单轮逐仓 mark 快照：`runtime-artifacts/pulse-live/<ts>-<runId>/position-mark-snapshot.json`
- 单轮校准记录：`runtime-artifacts/pulse-live/<ts>-<runId>/calibration-ledger.jsonl`
- 全局追加 ledger：`runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl`

`calibration-ledger.jsonl` 的每一行对应一条 decision，记录 decision 概率、市场价、edge、执行状态、成交价、成交金额、运行前后 mark、待结算 outcome 占位。后续 backtesting 只需要把 resolved outcome / realized PnL 补回同一 `decisionKey`。

## Live 推荐最低验收线

- 每个准备下单的市场必须有完整规则、精确 outcome、精确阈值、当前 bid/ask、`tokenId` 和成交侧校验。
- 每个非纯规则套利交易至少需要 2 个独立外部来源；体育/政治/商品不能只靠 Polymarket 与常识。
- 评论区至少覆盖 20 条或全量评论（若不足 20 条），并标明抽样口径。
- 必须记录至少一个反方证据或“未找到反方证据”的搜索路径。
- 低于 +5pp edge 的新开仓默认进入 watchlist，除非策略文件明确允许并解释为什么。
- 已有仓位没有 fresh signal 时只能标为 `stale-hold / needs-review`，不能标为“仍有 edge”。
- run-summary 必须解释成交后现金、净值、仓位数变化，并给出账户级 + 逐仓 mark PnL 归因；若“3 单成交但仓位只 +2”，必须单独告警。
