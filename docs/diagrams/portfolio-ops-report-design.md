# Portfolio Monitor / Review / Rebalance 产物设计

本文说明 3 类组合相关能力应该产出怎样的 Markdown、其中“模型反思”应该写什么，以及建议如何归档。

这是一份面向人类验收和后续实现的设计说明。它区分：

- 当前仓库里已经存在的执行逻辑
- 建议新增的人类可读 Markdown 产物

## 一、三类能力分别在回答什么问题

### 1. Portfolio Monitor

回答的是：

- 当前仓位有没有异常变化
- 有没有触发止损、回撤停机、仓位消失、价格异常
- 哪些风险需要立刻提醒人类

它偏向“监控与告警”。

### 2. Portfolio Review

回答的是：

- 现有仓位是否还值得继续持有
- 原 thesis 是否仍然成立
- 哪些仓位应该 `hold / reduce / close / rotate`

它偏向“持仓复盘与再判断”。

### 3. Rebalance

回答的是：

- 当前组合和目标组合相比哪里失衡了
- 需要通过哪些交易把仓位调整回目标结构
- 哪些交易因为风控或流动性约束不能执行

它偏向“结构性调整”。

## 二、当前仓库里已经有什么

当前仓库并不是 3 个独立服务，而是 3 段能力分散在不同模块中：

- `monitor`
  - 真实落点：executor 的 `sync portfolio + stop-loss + snapshot`
  - 代码位置：
    - [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts#L120)
- `review`
  - 真实落点：runtime 决策与 pulse 结果整合
  - 代码位置：
    - [services/orchestrator/src/runtime/pulse-direct-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/pulse-direct-runtime.ts#L216)
    - [services/orchestrator/src/runtime/provider-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/provider-runtime.ts)
- `rebalance`
  - 当前只落了两部分：
    - 新开仓时的风控裁剪
    - `flatten` 全平仓
  - 代码位置：
    - [services/orchestrator/src/lib/risk.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/lib/risk.ts#L48)
    - [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts#L215)

结论：

- 当前有执行能力，但还没有为这三类能力分别沉淀完整 Markdown 报告。
- 因此下面的内容是“推荐的最终可读产物设计”。

## 三、Portfolio Monitor 应该产出的 Markdown

### 目标

让人类一眼看懂：

- 本轮监控看到了什么
- 有哪些仓位变化
- 是否触发了自动动作
- 哪些点需要人类立刻介入

### 建议文件名

- 中文：
  - `runtime-artifacts/reports/portfolio-monitor/YYYY/MM/DD/portfolio-monitor-<timestamp>-<wallet>.md`
- 英文：
  - `runtime-artifacts/reports/portfolio-monitor/YYYY/MM/DD/portfolio-monitor-<timestamp>-<wallet>.en.md`

### 建议板块

1. 运行概览
2. 组合快照
3. 仓位变化
4. 风险告警
5. 自动动作
6. 模型反思
7. 需要人类确认的点

### 推荐示例

```md
# 组合监控报告

## 运行概览

- 钱包：pizza
- 监控时间：2026-03-17 15:00:00 CST
- 数据来源：Polymarket remote positions + local snapshot
- 系统状态：running

## 组合快照

- Cash：15.99 USDC
- Open Positions：4
- Total Equity：19.42 USD
- Drawdown：2.8%

## 仓位变化

| 市场 | 方向 | 上次仓位 | 当前仓位 | 变化 |
| --- | --- | --- | --- | --- |
| Bitcoin dip to 65k | No | 0 | 1.34 | 新开仓 |
| Gavin Newsom nomination | No | 0 | 1.32 | 新开仓 |
| Fed cut by June | No | 1.00 | 1.00 | 无变化 |

## 风险告警

- 无仓位触发 stop-loss。
- 无组合级 drawdown halt。
- 无 remote/local position mismatch。

## 自动动作

- 本轮未执行自动卖出。
- 本轮未执行 flatten。

## 模型反思

- 本轮监控没有做新的方向判断，只做了状态核对和风险扫描。
- 当前最有价值的信号是：远端仓位与本地快照一致，说明执行回写链路正常。
- 当前最大的盲点是：没有检测挂单变化，也没有检测同主题过度集中。
- 下一轮建议补查：同类政治事件总暴露是否超过上限。

## 需要人类确认的点

- 是否要为政治类市场单独设置主题暴露上限。
- 是否要把“仓位消失但未记录成交”设为 critical alert。
```

### Monitor 的“模型反思”应该写什么

Monitor 不是重新下注，因此反思不应该写“我看多/看空”，而应该写：

- 本轮最可靠的监控信号是什么
- 本轮未覆盖的风险盲区是什么
- 哪些异常暂时未触发，但值得下轮重点复查
- 哪些问题需要升级为人工告警

## 四、Portfolio Review 应该产出的 Markdown

### 目标

让人类清楚知道：

- 每个现有仓位现在该怎么处理
- 判断依据是什么
- 如果继续持有，理由是什么
- 如果减仓或平仓，为什么

### 建议文件名

- 中文：
  - `runtime-artifacts/reports/review/YYYY/MM/DD/portfolio-review-<timestamp>-<runId>.md`
- 英文：
  - `runtime-artifacts/reports/review/YYYY/MM/DD/portfolio-review-<timestamp>-<runId>.en.md`

### 建议板块

1. 运行概览
2. 当前持仓清单
3. 单仓评审结果
4. 组合层面结论
5. 不建议继续持有的仓位
6. 模型反思
7. 需要人类审核的点

### 推荐示例

```md
# 组合复审报告

## 运行概览

- Run ID：8c1f79e9-37f3-4706-8009-4dd6924def96
- 决策策略：pulse-direct
- 评审范围：当前全部 open positions
- Pulse 报告：reports/pulse/2026/03/17/...

## 当前持仓清单

| 市场 | 方向 | 当前仓位 | 当前价格 | 未实现盈亏 | 初步结论 |
| --- | --- | --- | --- | --- | --- |
| Bitcoin dip to 65k | No | 1.34 | 0.74 | +0.03 | Hold |
| Gavin Newsom nomination | No | 1.32 | 0.76 | -0.01 | Review |

## 单仓评审结果

### 1. Bitcoin dip to 65k

- 结论：`hold`
- 原因：
  - 原 thesis 未被破坏
  - 当前价格尚未反映新的反向证据
  - 持仓规模较小，不构成组合风险

### 2. Gavin Newsom nomination

- 结论：`reduce`
- 原因：
  - 目前缺乏新的硬证据支持继续加仓
  - 同类政治事件暴露开始堆积
  - 该仓位预期收益/时间效率偏低

## 组合层面结论

- 当前组合仍可持有，但政治类主题集中度偏高。
- 若需要腾挪资金，优先从低边际收益仓位开始减仓。

## 不建议继续持有的仓位

- Gavin Newsom nomination
  - 原因：主题重复、证据密度不足、资金占用效率偏低

## 模型反思

- 本轮 review 的核心不是“再算一次市场价格”，而是检查 thesis 是否仍成立。
- 本轮最容易出错的地方是：把“没有新证据”误判成“继续持有是正确的”。
- 当前缺失的外部信息包括：更细的民调、资金流向、相关竞品市场的联动。
- 如果允许人类审核，优先复核被我判为 `reduce` 或 `close` 的仓位。

## 需要人类审核的点

- 是否接受“低时间效率”作为减仓理由。
- 是否对政治类仓位设置更严格的主题集中上限。
```

### Review 的“模型反思”应该写什么

Review 的反思必须围绕“判断为什么成立或可能错在哪里”：

- 本轮结论最依赖哪些证据
- 哪些证据仍然缺失
- 哪一笔仓位最可能被误判
- 哪些结论应当交给人类做二次审核

## 五、Rebalance 应该产出的 Markdown

### 目标

让人类知道：

- 当前组合偏离目标结构多少
- 系统准备怎么调仓
- 为什么某些建议最终没有执行

### 建议文件名

- 中文：
  - `runtime-artifacts/reports/rebalance/YYYY/MM/DD/portfolio-rebalance-<timestamp>-<runId>.md`
- 英文：
  - `runtime-artifacts/reports/rebalance/YYYY/MM/DD/portfolio-rebalance-<timestamp>-<runId>.en.md`

### 建议板块

1. Rebalance 概览
2. 当前结构 vs 目标结构
3. 拟执行调仓
4. 被风控拦截的调仓
5. 执行后预期结构
6. 模型反思
7. 人类审批项

### 推荐示例

```md
# 组合再平衡计划

## Rebalance 概览

- 目标：降低政治主题集中度，补回现金缓冲
- 当前 Open Positions：4
- 当前主题暴露：Politics 62%, Macro 18%, Crypto 20%

## 当前结构 vs 目标结构

| 维度 | 当前 | 目标 | 偏差 |
| --- | --- | --- | --- |
| Politics | 62% | <= 40% | +22% |
| Single Position Max | 21% | <= 20% | +1% |
| Cash Buffer | 12% | >= 20% | -8% |

## 拟执行调仓

1. `reduce` Gavin Newsom nomination
   - 理由：政治类主题拥挤，边际收益较低
2. `hold` Bitcoin dip to 65k
   - 理由：与当前主题去集中方向不冲突

## 被风控拦截的调仓

- `open` New politics market
  - 原因：同类事件暴露会超过 30%
- `open` Large single position
  - 原因：单仓会超过 20%

## 执行后预期结构

- Politics：46%
- Cash Buffer：18%
- 仍需下一轮继续去集中

## 模型反思

- 本轮 rebalance 最可靠的判断来自组合结构本身，不来自单一市场观点。
- 当前最可能错的地方是：目标结构设置过于静态，没有考虑短期高 conviction 的机会。
- 如果不执行 rebalance，组合的主要风险是同主题回撤同步放大。
- 如果反向继续加仓政治主题，组合会变得更脆弱，而不是更高效。

## 人类审批项

- 是否接受本轮以“降低集中度”为优先，而不是“最大化单仓 edge”。
- 是否允许在高 conviction 情况下临时突破主题上限。
```

### Rebalance 的“模型反思”应该写什么

Rebalance 反思不是讨论单一市场，而是讨论组合结构：

- 当前目标结构是否合理
- 组合风险是否因为同主题集中而被放大
- 如果不调仓，最坏情况是什么
- 哪些调仓建议是“理论正确但现实不可执行”的

## 六、建议统一的反思字段

无论是 monitor、review 还是 rebalance，建议都统一保留下面这些字段：

- `本轮最重要结论`
- `本轮最依赖的证据`
- `本轮最大的盲点`
- `本轮最可能错在哪里`
- `如果不动作，会发生什么`
- `需要人类二次审核的点`

这样做的好处是：

- 人类每次都能用同一套框架读报告
- 后面可以自动比较不同轮次的反思质量
- 更容易把“模型结论”和“人类审批结论”分开归档

## 七、建议归档结构

建议统一放到 `runtime-artifacts/reports/` 下，而不是混进聊天说明文档：

```text
runtime-artifacts/reports/
  portfolio-monitor/YYYY/MM/DD/
    portfolio-monitor-<timestamp>-<wallet>.md
    portfolio-monitor-<timestamp>-<wallet>.en.md
    portfolio-monitor-<timestamp>-<wallet>.json
  review/YYYY/MM/DD/
    portfolio-review-<timestamp>-<runId>.md
    portfolio-review-<timestamp>-<runId>.en.md
    portfolio-review-<timestamp>-<runId>.json
  rebalance/YYYY/MM/DD/
    portfolio-rebalance-<timestamp>-<runId>.md
    portfolio-rebalance-<timestamp>-<runId>.en.md
    portfolio-rebalance-<timestamp>-<runId>.json
```

建议每次都保存：

- Markdown 主文件
- 英文副本
- JSON 结构化结果
- 关联的 pulse / runtime-log / execution-summary 路径

## 八、最小可落地版本

如果你要先做一个最小版本，我建议按这个顺序：

1. 先做 `review-report`
   - 因为它最接近当前已有的 pulse/runtime 决策链路
2. 再做 `portfolio-monitor-report`
   - 因为 sync/stop-loss 已经有执行逻辑
3. 最后做 `rebalance-report`
   - 因为当前 rebalance 还没有完整的“目标结构引擎”

## 九、这份文档的用途

这份文档不是执行日志，而是：

- 人类验收标准
- 后续实现模板
- 未来自动化产物的蓝图

如果下一步继续做代码，最自然的落点是：

- 先新增统一 Markdown renderer
- 再把 `monitor / review / rebalance` 的结构化结果接进去
