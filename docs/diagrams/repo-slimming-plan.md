# 仓库瘦身与重构讨论稿

本文把上一轮讨论整理成可手动编辑的 Markdown 草稿，方便你直接修改、删改、批注。

建议使用方式：

- 直接修改勾选项
- 在每一节下面补充你的判断
- 删掉你不认可的部分
- 保留你想继续推进的部分

## 当前目标

当前默认目标是：

- 把系统主路径收敛得更清晰
- 找出真正长期不用或只是占位的模块
- 区分：
  - 核心模块
  - 可合并模块
  - legacy / experimental 模块
  - 应删除或下线的部分

## 一、模块取舍 Checklist

请按你的想法修改下面的状态：

- `[保留]`
- `[合并]`
- `[降级]`
- `[删除]`
- `[待定]`

### 1. 主交易链路

- [ ] `Pulse` 市场扫描与报告生成
  - 当前建议：`保留`
  - 原因：这是 `daily pulse` 的信息源

- [ ] `pulse-direct` 决策模式
  - 当前建议：`保留`
  - 原因：可作为唯一主决策模式

- [ ] `provider-runtime`
  - 当前建议：`降级`
  - 原因：可保留作对照实验、回放、兼容层，但不再作为主路径

- [ ] `live:test`
  - 当前建议：`合并`
  - 原因：和 `pulse:live` 大量逻辑重叠

- [ ] `pulse:live`
  - 当前建议：`合并`
  - 原因：和 `live:test` 大量逻辑重叠

- [ ] `paper` 本地测试盘
  - 当前建议：`保留`
  - 原因：本地验证和人工确认仍然有价值

- [ ] `trial:recommend / trial:approve / trial:reset-paper`
  - 当前建议：`合并`
  - 原因：建议变成统一 core 上的 paper 包装层

### 2. 执行与风控

- [ ] executor 下单适配层
  - 当前建议：`保留`
  - 原因：真实执行底座

- [ ] `sync portfolio`
  - 当前建议：`保留`
  - 原因：组合状态同步与 monitor 的核心

- [ ] `stop-loss`
  - 当前建议：`保留`
  - 原因：真实风险控制逻辑

- [ ] `flatten`
  - 当前建议：`保留`
  - 原因：是明确有用的人工/系统级清仓能力

- [ ] 分散在脚本里的 preflight
  - 当前建议：`合并`
  - 原因：应收敛为共享 probe 模块

- [ ] 分散在脚本里的错误摘要与终端渲染
  - 当前建议：`合并`
  - 原因：应统一走 `terminal-ui`

### 3. 报告与归档

- [ ] `run-summary`
  - 当前建议：`保留`
  - 原因：已经比较贴近你的使用偏好

- [ ] `review-report`
  - 当前建议：`待定`
  - 原因：schema / UI 已经有概念，但 producer 还不完整

- [ ] `portfolio-monitor-report`
  - 当前建议：`新增并保留`
  - 原因：有执行面，但还缺人类可读产物

- [ ] `rebalance-report`
  - 当前建议：`新增并保留`
  - 原因：未来 daily pulse 很需要结构化说明

- [ ] `backtest-report`
  - 当前建议：`降级`
  - 原因：当前实现偏占位

- [ ] `resolution-report`
  - 当前建议：`保留`
  - 原因：它是独立且真实的长期功能

### 4. 外围与实验面

- [ ] `openclaw`
  - 当前建议：`降级`
  - 原因：当前更像预留 provider，而不是正在使用的主能力

- [ ] `rough-loop`
  - 当前建议：`保留`
  - 原因：是一个需要实践进去的标准

- [ ] README 中对多入口并列主架构的描述
  - 当前建议：`重写`
  - 原因：当前文档会放大系统边界，影响后续判断

## 二、当前发现的主要冗余

### 1. 双 live 脚本过重

目前大文件如下：

- `scripts/live-test.ts`：约 `809` 行
- `scripts/pulse-live.ts`：约 `1269` 行
- `scripts/live-run-summary.ts`：约 `453` 行

当前问题：

- preflight、archive、summary、context rows、错误输出存在重复
- 两条 live 路径都像“完整产品入口”，而不是复用同一核心流程

### 2. 双决策架构并存

- `services/orchestrator/src/runtime/provider-runtime.ts`：约 `828` 行
- `services/orchestrator/src/runtime/pulse-direct-runtime.ts`：约 `325` 行

当前问题：

- 如果最终主路径只想保留 `pulse-direct`，那 `provider-runtime` 继续作为主功能会拉高复杂度
- runtime 的 artifact、reasoning、summary 逻辑分散

### 3. 多套命令只是换壳，没有真正分层

当前表面上有：

- `trial:*`
- `live:test`
- `pulse:live`
- orchestrator + executor + web

问题是：

- 很多分歧其实只是 state backend / execution backend 不同
- 但现在表现成多套顶层命令、多套脚本、多套流程控制

## 三、重构方案草稿

以下是“当前建议方案”，你可以直接删改。

### 方案目标

把系统收敛成：

- 一个主用例：`daily pulse`
- 一个主决策模式：`pulse-direct`
- 一组共享核心模块
- 一层 paper/live 的适配器

### 方案结构

#### 1. 一个共享 run core

统一主流程：

是的 甚至很多流程都在复用 Pulse 的分析隐含赔率和预估赔率的流程，包含 monitor、marketer review，还有 backtesting 的模块。

对于你这个修改计划，记得把我们 backtesting 的也给加上，这个之前在 `all-polymarket-scale` 里面 backtesting 中有写。

然后 P&L 计算要严格按照我之前规定的内容：

1. load portfolio
2. generate pulse
3. pulse direct decisions
4. apply guardrails
5. build execution plan
6. execute or preview
7. sync state
8. write summary / reports / archive

建议：

- `trial:*`
- `live:test`
- `pulse:live`

都调用同一个 core，而不是各自维护完整流程。

#### 2. 拆成 adapter，而不是继续分叉脚本

建议适配层：

- `state adapter`
  - `paper-local`
  - `db-state`
  - `remote-live snapshot`

- `execution adapter`
  - `paper`
  - `live-direct`
  - `live-queue`

- `report adapter`
  - `run-summary`
  - `monitor-report`
  - `review-report`
  - `rebalance-report`

#### 3. 决策层收口

建议：

- `pulse-direct` 成为唯一主决策入口
- `provider-runtime` 降级为：
  - 回放工具
  - 对照实验
  - legacy 兼容

职责划分：

- Pulse：负责“买什么、为什么、建议仓位”
- 风控：负责“是否允许、裁剪到多少”
- 执行层：负责“怎么下单、怎么同步”

#### 4. 报告层统一

建议统一报告模型，至少支持：

- `run-summary`
- `portfolio-monitor`
- `portfolio-review`
- `portfolio-rebalance`

共享字段建议：

- run metadata
- actions / blocked / skipped
- portfolio before / after
- reasoning summary
- model reflection
- artifact links

## 四、建议的分阶段推进顺序

### Phase 1

- 合并 `live:test` 和 `pulse:live` 的共享部分
- 先不改外部命令名，只抽出 core

### Phase 2

- 收口到 `pulse-direct`
- 把 `provider-runtime` 标记为 legacy

### Phase 3

- 统一 preflight / archive / terminal error / summary

### Phase 4

- 把 `review / monitor / rebalance` 的 Markdown 产物正式接入执行链路

### Phase 5

- 清理外围 experimental：
  - `openclaw`
  - `rough-loop`
  - 占位型 `backtest`
  - 未落地的 report 类型

## 五、需要你明确拍板的点

请你直接在下面填写或改掉我的默认判断。

### 1. 你的主路径定义

- 当前默认：`daily pulse`
- 你的修改：保留，继续施工

### 2. 你是否要保留 `provider-runtime`

- 当前默认：保留，但降级为 legacy
- 你的修改：

### 3. 你是否要保留 `rough-loop` 在主仓库中

- 当前默认：保留代码，
- 你的修改：是一定要用的工作流程

### 4. 你是否要保留 `openclaw`

- 当前默认：保留
- 你的修改：后续一定会基于这个开源生态做开发

### 5. `backtest` 你是想继续做，还是暂时下线

- 当前默认：保留，实盘运营后这个就是最重要的
- 你的修改：

## 六、我建议你手动编辑时重点看这几段

- `一、模块取舍 Checklist`
- `三、重构方案草稿`
- `五、需要你明确拍板的点`

如果你改完，我下一轮就可以基于你修改后的版本继续细化，而不是重新从头猜。
