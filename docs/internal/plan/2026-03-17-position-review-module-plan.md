# Position Review 独立模块改造计划

最后更新：2026-03-17

## Summary

目标不是把已有仓位复审逻辑继续塞进 `pulse-direct`，而是新增一个独立的 `Position Review` 模块。

正确的职责关系应当是：

- `Pulse`
  - 负责市场研究、候选、赔率、edge 输入
- `Position Review`
  - 负责复审当前 portfolio 里的已有仓位
- `Pulse Entry Planner`
  - 负责从 pulse 研究结果中提取新的 `open / skip`
- `Decision Composer`
  - 负责把 `review + entries` 合并成统一 `TradeDecisionSet`

也就是说：

- `Position Review` 不是 `pulse-direct` 的子函数
- 它是一个独立模块
- 只是复用 `pulse` 的研究结果和 edge 信息

## 当前问题

当前默认主路径里：

- `pulse-direct` 对已有仓位是固定 `hold`
- 没有真正判断“这个仓位是否仍然拥有 edge”
- 也没有允许 AI 对已有仓位主动给出 `close / reduce`
- `review-report` 当前只是把现成决策汇总，不是真复审报告

因此当前结构还不满足：

1. 思考现在的仓位是否还拥有 edge
2. 如果有则继续运行
3. AI 可以判断仓位不好并自己卖掉
4. 必须同时产出结论

## 目标行为

每一轮 `daily pulse` 里，已有仓位的处理逻辑应为：

1. 读取当前 portfolio
2. 读取 pulse 研究结果
3. 对每个当前持仓复审：
   - thesis 是否仍成立
   - 当前 edge 是否仍存在
   - 是否有反向证据
   - 是否接近或触发止损
   - 是否值得继续占用仓位
4. 输出每个仓位的结论：
   - `hold`
   - `reduce`
   - `close`
5. 对每个结论写明：
   - `still_has_edge`
   - `reason`
   - `confidence`
   - `human_review_flag`
6. 与新开仓建议一起合并成一份统一决策集
7. 自动产出 `review-report`

## 拟新增模块

### 1. `services/orchestrator/src/review/position-review.ts`

职责：

- 输入：
  - `overview`
  - `positions`
  - `pulse snapshot`
  - 已解析的 pulse recommendations
  - config
- 输出：
  - 每个已有仓位一条 review result
  - 包含：
    - `action`
    - `stillHasEdge`
    - `humanReviewFlag`
    - `reason`
    - `confidence`
    - `decision`

### 2. `services/orchestrator/src/runtime/pulse-entry-planner.ts`

职责：

- 解析 pulse markdown / pulse candidates
- 生成新的开仓候选
- 输出：
  - `open`
  - `skip`
- 不负责已有仓位

### 3. `services/orchestrator/src/runtime/decision-composer.ts`

职责：

- 合并：
  - `position review results`
  - `pulse entry plans`
- 处理去重
- 避免对已有 token 直接重复 `open`
- 输出统一 `TradeDecisionSet["decisions"]`

## 新主流程

调整后主流程应为：

1. load portfolio
2. generate pulse
3. parse pulse entry plans
4. run position review
5. compose decisions
6. apply guardrails
7. build execution plan
8. execute or preview
9. sync state
10. write summary / reports / archive

## 报告要求

`review-report` 不再只是罗列非 `hold` 决策，而要明确回答：

- 哪些已有仓位仍值得持有
- 哪些已有仓位建议减仓
- 哪些已有仓位建议卖出
- 每个仓位是否仍有 edge
- 哪些结论应该让人类重点复核

建议固定板块：

1. 本轮复审概览
2. 已有仓位复审结果
3. 新开仓建议
4. 仍有 edge 的仓位
5. 已失去 edge 的仓位
6. 人类重点审核项
7. 模型反思

## 实施顺序

### Phase 1

- 新增 `position-review.ts`
- 先支持：
  - `hold`
  - `close`
- 每个已有仓位必须有结论

### Phase 2

- 抽出 `pulse-entry-planner.ts`
- 从 `pulse-direct-runtime.ts` 迁出 pulse 解析逻辑

### Phase 3

- 新增 `decision-composer.ts`
- 用 composer 合并 review 与 entries

### Phase 4

- 重构 `pulse-direct-runtime.ts`
- 让它只做：
  - 调 review
  - 调 entry planner
  - 调 composer
  - 生成 logs / artifacts

### Phase 5

- 升级 `review-report`
- 写入 `still_has_edge / human_review_flag / reason`

## 验收标准

- 已有仓位不再默认固定 `hold`
- AI 可以对已有仓位输出 `close`
- 每个已有仓位都有复审结论
- `review-report` 能直接读出：
  - 持有
  - 卖出
  - 原因
  - 是否仍有 edge

## 当前执行决定

本轮先落地：

- 独立 `Position Review` 模块
- 独立 `Pulse Entry Planner`
- 独立 `Decision Composer`
- `pulse-direct-runtime` 改成薄包装
- `review-report` 接入现有仓位 edge 结论
