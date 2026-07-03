# recommendation.json 操作地图（统一 zod schema 前置调研）

> 目的：在给 `recommendation.json` 立"统一 schema"之前，先把**谁写、谁读、各碰哪些字段、加严格校验会不会误伤**盘清楚。
> 来源：2026-07-04 五路并行只读测绘（13 个站点）。英文版待同步翻译。

## 0. 最重要的纠正：文件真实形状 ≠ tradeDecisionSetSchema

之前计划里把 recommendation.json 当成 contracts 的 `tradeDecisionSetSchema`（顶层 snake_case：`run_id/runtime/generated_at_utc/bankroll_usd/mode/decisions/artifacts`）。**实际写盘的不是这个**。

真实产物（`scripts/pulse-live.ts:1185` 唯一 writer）是一个 **camelCase 外壳**：

```jsonc
{
  "runId": "...",                    // camelCase！不是 run_id
  "executionMode": "pulse-live",
  "envFilePath": "...",
  "collateralBalanceUsd": 223.9,
  "overview": { /* OverviewResponse: cash_balance_usd/total_equity_usd/... */ },
  "pulseMarkdownPath": "...", "pulseJsonPath": "...", "runtimeLogPath": "...",
  "promptSummary": "...", "reasoningMd": "...",
  "decisions":       [ /* TradeDecision[]，snake_case：action/market_slug/ai_prob/... */ ],
  "executablePlans": [ /* PlannedExecution[]，camelCase：marketSlug/notionalUsd/bestAsk/... */ ],
  "skipped":         [ /* SkippedDecision[]：action?/marketSlug/tokenId?/reason */ ]
}
```

**同一个文件里有两套命名同时存在**：顶层 + `executablePlans[]` 是 camelCase，`decisions[]` 是 snake_case。这是设计 schema 时最容易踩的坑——不能一刀切成一套命名。

## 1. 站点总表（13 个）

| 文件 | 角色 | 对文件做什么 | schema 风险 |
| --- | --- | --- | --- |
| `scripts/pulse-live.ts` | **唯一 writer** | L1185 `writeJsonArtifact` 把上述外壳对象 `JSON.stringify` 落盘，无任何校验 | **高**：外壳 camelCase 且无 run_id/mode/artifacts 顶层字段；照搬 tradeDecisionSetSchema 去 parse 会直接判非法 |
| `scripts/pulse-decision-report.ts` | **磁盘 reader ①** | 唯一真读磁盘内容之一：`readOptionalJson` → 软取顶层 `runId/pulseJsonPath/pulseMarkdownPath`（camelCase）+ `decisions[]`（snake_case），逐条 `normalizeDecision` | **高**：normalizeDecision 现在"缺字段就整条丢弃"，严格 required 会升级成"整份 parse 抛错" |
| `scripts/managed-pulse.ts` | **磁盘 reader ②** | 唯一真读磁盘内容之二：`findLatestRecommendationFile` + `JSON.parse` + **unsafe cast**（不校验），只读顶层 `runId`，其余转给 mapper | **中高**：此处若插严格 parse 会成整条托管下单链的强闸门；顶层读的是 camelCase `runId` |
| `services/managed-trading/.../proposed-decision-mapper.ts` | mapper（核心读取+改名） | 把 `executablePlans[]`（下单量）与 `decisions[]`（概率/edge）按 tokenId join，重声明成 dispatcher wire shape；防御式规范化 | **高（最主要误伤点）**：双 casing；`.strict()` 会因上游多余字段报错；现在 skip/未知值是"优雅丢弃/兜底"，改抛错=语义倒退阻断下单 |
| `services/orchestrator/.../execution-dispatch.ts` | mapper（内存→订单） | 内存对象非磁盘；`buildDecisionKey` **故意同时接受 camel+snake**，配 decision↔plan，下单写队列/DB | **中高**：收敛命名或 `.strict()` 会让 key 静默失配→"本该下的单不下"；cloneDecisionForPlan 覆写后仍须满足 decisionSchema |
| `scripts/pulse-live-helpers.ts` | mapper（产 overview） | `buildPulseLiveOverview` 产出被嵌进文件 `overview` 字段的 OverviewResponse | 低-中：`overview` 应直接复用 contracts 的 `OverviewResponse` schema，别新写；此处 drawdown 恒 0、last_run_at 恒 null，strict 范围约束会误伤 |
| `scripts/live-run-summary.ts` | mapper | 不读磁盘；用本地 camelCase Summary* 结构，只把 recommendation 路径当链接展示 | 低：只耦合"一个路径字符串" |
| `scripts/live-run-summary-builders.ts` | mapper（类型锚点） | 纯内存 snake→camel 翻译；`Pick<TradeDecision, ...>` 是**唯一在编译期锚定 decisions[] 真实字段名的地方** | 中（类型层双源）：统一 schema 应让 `TradeDecision` 由该 schema infer，否则两处字段改名不同步。注意它只 Pick 7 个字段——别假设所有 consumer 要全字段 |
| `services/orchestrator/.../ops/trial-recommend.ts` | reader（展示） | 只读内存 `TradeDecisionSet`；paper 模式经 `persistPaperRecommendation` 落 local state | 低-中：真正 strict 风险转嫁到 persistPaperRecommendation，建议校验放 provider-runtime 解析层、此处透传 |
| `scripts/pulse-live.ts`（另 5 处） | 路径 passthrough | L1310/1357/1455/1504/1569 只把路径字符串塞进别的产物 | 无 |
| `scripts/pulse-live-pulse.ts` | 无关 | 读的是 pulse snapshot 不是 recommendation | 无 |
| `services/orchestrator/.../pulse/stage-flow.ts` | 无关 | 只在 prose 里提了文件名（L247） | 无 |
| `apps/web/lib/prediction-engine-demo.ts` | 无关 | 自包含 demo，两处 recommendation 字样是文案 | 无 |

## 2. 关键风险点（做统一 schema 前必须先处理）

1. **命名双轨**：顶层 + `executablePlans[]` = camelCase，`decisions[]` = snake_case。schema 必须分别建模两套命名，`.strict()` 会因跨层多余字段误伤。
2. **只有 2 个磁盘 reader**（pulse-decision-report、managed-pulse），且都是**软取/unsafe cast、无校验**。真正加运行时校验的正确位置是**写盘前**（pulse-live）或**provider-runtime 解析层**——在这两个 reader 里加 `.parse()` 会把"优雅降级"变成"整份抛错"。
3. **降级语义不能变**：normalizeDecision 缺字段丢一条、mapper 把 skip/未知归 unmappable、confidence 未知兜底 medium、概率 clamp01、edge 兜底 0——这些是**有意的容错**。换成严格 zod 抛错会阻断实盘/托管下单，是语义倒退。
4. **nullable/optional 一大片**：`executablePlans[]` 的 bestAsk/bestBid/minOrderSize/gtcLimitPrice/categorySlug 可为 null，outcomeLabel 可 undefined；`overview` 的 last_run_at/latest_risk_event 恒 null。schema 必须显式允许。
5. **default 双源**：TradeDecision 的 stop_loss_pct/resolution_track_required 有 zod `.default()`；新 schema 若对同字段设不同 default 会造成两处不一致——应让 `@autopoly/contracts` 的 `TradeDecision` 由统一 schema infer，而不是各写一份。

## 3. 建议落地路径（低风险顺序）

1. **第一步只做编译期类型统一，不加运行时校验**：定义 `recommendationFileSchema`（camelCase 外壳），内嵌复用现有 `decisionSchema`（snake_case）+ 为 PlannedExecution/SkippedDecision 各建独立 schema；让 `TradeDecision` 由它 infer。把 `live-run-summary-builders.ts`、`proposed-decision-mapper.ts` 等本地重声明的 interface 换成从统一 schema 取类型。**零运行时行为变化**。
2. **第二步再考虑运行时校验，且用 `.safeParse()` + 告警而非 `.parse()` 抛错**，落点选**写盘前的 pulse-live** 或 **provider-runtime 解析层**（单点），不要下沉到两个磁盘 reader。观察一段确认无误伤，再决定是否收紧。
3. **overview 字段直接复用 contracts 的 `OverviewResponse` schema**，不新写。
4. **保留 mapper 的规范化/unmappable 分流**，schema 用 loose/passthrough，不把校验前移成 fail-fast。

> 结论：recommendation.json 的统一 schema **可以安全地做第一步（类型统一）**，但**运行时严格校验是高风险动作**，必须走 safeParse + 单点 + 观察，否则会把"优雅降级"变成"实盘 run 中途抛错"。
