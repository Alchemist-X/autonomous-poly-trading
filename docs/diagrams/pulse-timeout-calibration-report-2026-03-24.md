# Pulse Timeout 校正实验报告

日期：2026-03-24

## 1. 结论先说

这轮实验回答了一个关键问题：

- 旧的 `180s` `pulse-direct` 内部 render fallback 明显过紧
- 在 5 路并发真实运行下，链路可以稳定跑到 `333.86s` 到 `511.62s`
- 5 条样本全部成功结束，没有一条触发 fallback
- 长尾主要出现在 full pulse render 阶段，不在 preflight

基于这轮结果，实验最初建议的默认设置是：

- `PULSE_FETCH_TIMEOUT_SECONDS=120`
- `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS=600`
- `PULSE_TIMEOUT_MODE=default`
- `PULSE_REPORT_TIMEOUT_SECONDS=0` 保持不变

后续为了给 live 长尾再留更宽余量，当前仓库默认值已经进一步放宽为：

- `PULSE_FETCH_TIMEOUT_SECONDS=300`
- `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS=1200`

## 2. 背景

用户指出当前代码里存在一个硬限制：

- [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) 中原先的 `DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS = 180`

它的实际效果是：

- 当 `PULSE_REPORT_TIMEOUT_SECONDS <= 0` 且策略是 `pulse-direct` 时
- 系统不会无限等待 full pulse render
- 一旦超过内部阈值，就会进入 deterministic fallback

这会带来一个问题：

- 链路看上去“没死”
- 但真实的 render 长尾被 fallback 掩盖

## 3. 本轮目标

本轮实验的目标是：

1. 列出这条链路里的硬 timeout
2. 在不施加 timeout 限制的前提下，做 5 路并行真实运行
3. 根据真实耗时，回推新的宽松默认值

## 4. 硬 timeout 清单

### 4.1 当前主链真正相关的 timeout

| 项目 | 位置 | 旧默认值 | 说明 |
| --- | --- | --- | --- |
| Pulse fetch timeout | [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) + [`services/orchestrator/src/pulse/market-pulse.ts`](../services/orchestrator/src/pulse/market-pulse.ts) | `60s` | 用于 `fetch_markets.py` 子进程 |
| Pulse report timeout | [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) + [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) | `0` | 正数时会限制 `scrape-market.ts` / `orderbook.ts` / render |
| pulse-direct 内部 render fallback | [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) | `180s` | `PULSE_REPORT_TIMEOUT_SECONDS` 未显式设正数时会自动启用 |

### 4.2 旁路 timeout

| 项目 | 位置 | 说明 |
| --- | --- | --- |
| `PROVIDER_TIMEOUT_SECONDS` | [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) | 这轮 `pulse-direct` 主链不靠它卡住 |

## 5. 实验设计

### 5.1 执行方式

- 使用独立 worktree：`/Users/Aincrad/dev-proj/autonomous-poly-trading-timeout-exp`
- 使用 5 个 sub-agent 并行执行
- 所有实验都跑真实 `pulse:live --recommend-only`
- 所有实验都写入独立 artifact root，避免互相污染

### 5.2 无 timeout 限制模式

为了保证“这一轮不施加任何 timeout 限制”，先在实验 worktree 中加入了显式实验模式：

- `PULSE_TIMEOUT_MODE=unbounded`

它的行为是：

- 禁用 Pulse fetch timeout
- 禁用 Pulse research 子命令 timeout
- 禁用 pulse-direct 内部 render fallback
- 保持默认生产行为不变，只有显式启用时才进入 unbounded

### 5.3 实验命令

5 条样本都使用相同命令，只更换 `ARTIFACT_STORAGE_ROOT`：

```bash
ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.pizza \
AUTOPOLY_EXECUTION_MODE=live \
AGENT_DECISION_STRATEGY=pulse-direct \
PULSE_TIMEOUT_MODE=unbounded \
PULSE_FETCH_TIMEOUT_SECONDS=0 \
PULSE_REPORT_TIMEOUT_SECONDS=0 \
PROVIDER_TIMEOUT_SECONDS=0 \
ARTIFACT_STORAGE_ROOT=<per-run-artifact-root> \
/usr/bin/time -p \
/Users/Aincrad/dev-proj/autonomous-poly-trading/node_modules/.bin/tsx \
scripts/pulse-live.ts --recommend-only --json
```

## 6. 5 路并行实验结果

### 6.1 单次样本

| Run | real(s) | user(s) | sys(s) | preflight(s) | context(s) | markdown(s) | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| run01 | `339.47` | `17.09` | `4.49` | `12` | `101` | `326` | 成功，无 fallback |
| run02 | `333.86` | `18.53` | `5.20` | `11` | `76` | `319` | 成功，无 fallback |
| run03 | `511.62` | `16.93` | `4.41` | `11` | `94` | `499` | 成功，无 fallback |
| run04 | `473.90` | `17.65` | `4.62` | `10` | `76` | `464` | 成功，无 fallback |
| run05 | `418.99` | `16.73` | `4.20` | `22` | `71` | `405` | 成功，无 fallback |

说明：

- `preflight`：根据 `preflight.json` 落盘时间反推
- `context`：根据 `pulse.json` 落盘时间反推，表示 research context 已写出
- `markdown`：根据 `pulse.md` 落盘时间反推，表示 render 已完成

### 6.2 统计汇总

| 指标 | total(s) | context(s) | markdown(s) |
| --- | --- | --- | --- |
| min | `333.86` | `71` | `319` |
| median | `418.99` | `76` | `405` |
| mean | `415.57` | `83.60` | `402.60` |
| p80 | `481.44` | `95.40` | `471.00` |
| max | `511.62` | `101` | `499` |

### 6.3 关键观察

1. `180s` render timeout 明显不够
   - 5 条样本里最短 render 完成时间也有 `319s`
   - 最长 render 完成时间达到 `499s`

2. preflight 不是主要问题
   - 5 条样本的 preflight 都在 `10s` 到 `22s`

3. 长尾主要集中在 full pulse render
   - `context` 阶段在 `71s` 到 `101s`
   - `markdown` 阶段才真正把总时长拉长到 `319s` 到 `499s`

4. 5 条样本全部成功结束
   - 没有被旧的 `60s fetch timeout` 截断
   - 没有被旧的 `180s render fallback` 截断
   - 最终被拦下来的原因是正常风控和交易所最小门槛，不是 timeout

## 7. 新默认值为什么这样定

### 7.1 Render timeout

本轮实验最初建议把 `pulse-direct` 内部 render timeout 从 `180s` 调整到 `600s`，原因是：

- 实测 `markdown max = 499s`
- `p80 = 471s`
- 如果只设到 `480s` 左右，仍会被长尾样本打穿
- `600s` 给了大约 `20%` 到 `27%` 的安全余量

### 7.2 Fetch timeout

本轮实验最初建议把默认 Pulse fetch timeout 从 `60s` 调整到 `120s`，原因是：

- 当前 artifact 只能可靠反推出 `context` 时间，而不是纯 fetch-only 时间
- `context` 阶段落在 `71s` 到 `101s`
- 这说明旧的 `60s` 已经偏紧，不适合作为保守默认值
- `120s` 是偏保守的宽松值，不会像 `600s` 那样过度放大 fetch 等待

这部分要特别说明：

- `120s` 是基于当前可观测前段耗时做的保守推断
- 它不是纯 fetch-only 直接测量值
- 如果后续要更精确校 fetch，需要增加阶段级时间埋点

### 7.3 当前仓库默认值

实验结束后，当前仓库默认值又进一步放宽到：

- `PULSE_FETCH_TIMEOUT_SECONDS=300`
- `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS=1200`

这一步不是实验直接测出来的最小必要值，而是人为选择更宽松的运行余量。

## 8. 已落地的代码改动

### 8.1 新增实验模式

- 在 [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) 中加入 `PULSE_TIMEOUT_MODE=default|unbounded`

### 8.2 Fetch timeout 语义修正

- 在 [`services/orchestrator/src/pulse/market-pulse.ts`](../services/orchestrator/src/pulse/market-pulse.ts) 中增加 `resolvePulseFetchTimeoutMs`
- `unbounded` 模式下不再设置 `setTimeout`

### 8.3 Render timeout 可配置

- 在 [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) 中加入 `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS`
- 在 [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) 中改为通过配置读取
- 当前默认值已调到 `1200`

### 8.4 Research timeout 统一走配置

- 在 [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) 中增加 `resolvePulseResearchTimeoutMs`
- `scrape-market.ts` / `orderbook.ts` / `npm install` 的 timeout 行为统一

### 8.5 配置样例更新

- 已更新 [`.env.example`](../.env.example)

## 9. 验证

本轮修改后，已通过以下测试：

```bash
/Users/Aincrad/dev-proj/autonomous-poly-trading/node_modules/.bin/vitest run \
  services/orchestrator/src/pulse/full-pulse.test.ts \
  services/orchestrator/src/pulse/market-pulse.test.ts \
  services/orchestrator/src/runtime/provider-runtime.test.ts \
  services/orchestrator/src/jobs/daily-pulse-core.test.ts \
  services/orchestrator/src/ops/trial-recommend-checkpoint.test.ts
```

结果：

- `5` 个测试文件全部通过
- `11` 个测试全部通过

## 10. 产物目录

本轮实验总归档目录：

- `/Users/Aincrad/dev-proj/autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration`

5 条样本的主目录：

- [run01](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd)
- [run02](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29)
- [run03](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee)
- [run04](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95)
- [run05](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844)

## 11. 推荐下注是怎么形成的

这一轮 timeout 实验里，真实的“思考下注”链路不是单一文件，而是下面这 5 步：

1. `pulse-*.json`
   - 这是原始研究包，也是最接近“证据底稿”的文件。
   - 最值得看的字段是 `research_candidates`、`selected_candidates`、`risk_flags`、`total_fetched`、`total_filtered`。
   - `research_candidates[*]` 里包含了 `priorityScore`、`market`、`scrapeResult.rules`、`scrapeResult.market_context.annotations`、`comments.sampled_items`、`orderbooks`，能直接看到规则、评论、盘口和候选优先级是怎么被拼起来的。

2. `pulse-*.md`
   - 这是把研究包整理成人能读懂的推理文档。
   - 最值得人工 review 的段落是 `候选池与筛选思路`、每个市场下的 `证据链`、`推理逻辑`、`仓位建议`、`信息源`、`评论区校验`。
   - 如果你想判断“推荐有没有讲人话、有没有把规则与概率错配说清楚”，先看这个文件最快。

3. `reports/runtime-log/*.md`
   - 这是 `pulse-direct` 把新开仓候选和已有仓位复审合并时的运行日志。
   - 它会直接写出 `Pulse Entry Planner -> Position Review -> Decision Composer` 这条合并链路，以及最终落地到每条 decision 的 JSON。
   - 如果你想判断“中间研究结果是如何变成最终推荐的”，这个文件最关键。

4. `recommendation.json`
   - 这是最终给执行层的机器可读结果。
   - 最值得看的字段是 `promptSummary`、`reasoningMd`、`overview`、`decisions[*].thesis_md`、`skipped[*].reason`。
   - 它还会反向记录 `pulseJsonPath`、`pulseMarkdownPath`、`runtimeLogPath`，方便从最终推荐回跳到中间文件。

5. `run-summary.md`
   - 这是执行前最后一层对人说明。
   - 本轮全部是 `recommend-only`，所以没有真实成交；这里最值得看的部分是“未执行/被拦截项与原因”，能直接看到是交易所最小门槛、策略最小交易额还是风险上限挡住了建议。

补一个这轮实验里很容易误会的点：

- `pulse markdown` 和 `pulse json` 不在每个 run 的主目录里，而在对应 run 的 `reports/pulse/...` 下面。
- `review / monitor / rebalance / runtime-log` 也不在主目录里，而在对应 run 的 `reports/...` 子目录。
- 本轮 5 条样本都成功结束，因此没有 `execution-summary.json`，也没有 `error.json`。

## 12. 当前限制

这份报告仍有一个已知限制：

- 当前仓库产物里没有 fetch-only 的直接阶段埋点
- 因此实验建议的 `PULSE_FETCH_TIMEOUT_SECONDS=120` 是保守推断，不是纯 fetch-only 的直接测量值
- 当前仓库实际默认值 `PULSE_FETCH_TIMEOUT_SECONDS=300` 更宽松，但同样不是 fetch-only 的直接测量值

如果下一轮要把 fetch timeout 也校得更精确，建议补一层阶段级埋点：

- fetch start
- fetch end
- research end
- render end

这样下次不需要再靠文件落盘时间反推。

## 13. 人工 Review 入口

先说明边界：

- 下面展示的是系统已经落盘、可审计的 reasoning trail
- 它能回答“系统依据什么给出这个推荐”
- 它不包含模型未输出的内部思维

建议按这个顺序看：

1. `preflight.json`
   - 先确认这次运行的真钱约束到底是什么，例如执行模式、钱包资金、远端仓位数、bankroll cap、最小交易额、风险参数。
   - 样例入口：[run01 preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json)
2. `pulse.json`
   - 看原始候选池和深研包。这里能看到抓取后的候选市场、规则原文、评论抽样、订单簿深度、annotations 等原始证据。
   - 样例入口：[run01 pulse.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json)
3. `pulse.md`
   - 看“为什么最终进入 Top 3”“证据链”“概率评估”“推理逻辑”“仓位建议”。这是最接近“怎么思考推荐下注”的人类可读文件。
   - 样例入口：[run01 pulse.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
4. `runtime-log.md`
   - 看 Pulse Entry Planner、Position Review、Decision Composer 三段怎么合并成最终决策集。
   - 样例入口：[run01 runtime-log.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
5. `recommendation.json`
   - 看最终结构化决策，包括 `ai_prob`、`market_prob`、`edge`、`confidence`、`thesis_md`，以及真正被拦截的原因。
   - 样例入口：[run01 recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json)
6. `review/monitor/rebalance/run-summary`
   - 这几份文件是对同一轮决策的不同压缩视角，适合人工快速核对“组合层面发生了什么”。
   - 样例入口：[run01 review.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)，[run01 monitor.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)，[run01 rebalance.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)，[run01 run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md)

## 14. 真实推荐形成链路拆解

下面用 `run01` 做完整拆解，因为它的文件最齐、结构也最典型。

### 14.1 先看 Preflight 在约束什么

- 入口：[run01 preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json)
- 关键事实：
  - `executionMode=live`
  - `decisionStrategy=pulse-direct`
  - `collateralBalanceUsd=496.3488`
  - `remotePositionCount=3`
  - `bankrollCapUsd=20`
  - `configuredMinTradeUsd=1`
  - `maxTradePct=0.2`
  - `maxEventExposurePct=0.3`

这一步的意义是：

- 钱包里虽然有约 `$496.35` 可交易抵押金
- 但策略真正允许本轮拿来做风险分配的 bankroll 只有 `$20`
- 所以后面你看到的推荐仓位天然会很小，这也是“建议有了，但执行被门槛拦住”的前置原因

### 14.2 再看 Pulse 是怎么从大池子筛到 Top 3 的

- 原始结构入口：[run01 pulse.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json)
- 人类可读入口：[run01 pulse.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)

这一步在真实产物里能看到：

- `total_fetched=1566`
- `total_filtered=90`
- `selected_candidates=12`
- `research_candidates=4`

也就是说，系统不是直接从全市场挑 3 个下注，而是走了：

1. 全量抓取
2. 过滤出可交易候选
3. 选出 12 个待研究市场
4. 对其中 4 个做深度研究包
5. 最后形成 Top 3

### 14.3 `pulse.json` 里存的是真实证据，不只是结论

在 `run01 pulse.json` 的 `research_candidates` 里，能直接看到这些原始材料：

- `market`
  - 市场问题、流动性、24h 成交、Yes/No 价格、token id、bid/ask、spread
- `scrapeResult.rules.description`
  - 结算规则原文
- `scrapeResult.market_context.annotations`
  - 市场上下文注释
- `scrapeResult.comments.sampled_items`
  - 评论区抽样
- `orderbooks`
  - 每个 outcome 的订单簿深度、价差、2% 滑点容量

这意味着你人工 review 时，可以直接检查：

- 系统有没有把规则看错
- 评论区有没有被过度解读
- 盘口深度和推荐仓位是否匹配

### 14.4 `pulse.md` 里能看到“怎么下注”的成文版本

以 `run01 pulse.md` 为例，你会直接看到这些段落：

- 候选池与筛选思路
- 被筛掉或未进入 Top 3 的候选
- 为什么最终进入 Top 3
- 每个 Top 3 市场的 `概率评估`
- 每个 Top 3 市场的 `证据链`
- 每个 Top 3 市场的 `推理逻辑`
- 每个 Top 3 市场的 `仓位建议`

也就是说，真正给下注建议时，系统至少显式输出了这几层：

1. 为什么这个市场值得研究
2. 为什么它能进入 Top 3
3. 市场价是多少，AI 估算是多少，edge 多大
4. 证据来自规则、市场上下文、评论区还是订单簿
5. 最后为什么给这个仓位而不是更大或更小

### 14.5 `runtime-log.md` 里能看到最终组合器怎么收口

- 入口：[run01 runtime-log.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)

这份文件不是市场研究，而是最终决策日志。它明确写了：

1. 使用 Pulse Entry Planner 解析新的开仓候选
2. 使用独立 Position Review 模块复审已有仓位
3. 使用 Decision Composer 合并 review + entries

在 `run01` 里，最后合成出的结构是：

- `hold 3`
- `open 3`
- 总决策数 `6`

### 14.6 `recommendation.json` 里能看到“建议”和“没下成”的真实原因

- 入口：[run01 recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json)
- 摘要入口：[run01 run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md)

`run01` 的最终结构化建议是：

- hold 3 个已有仓位
- 新开仓 3 个市场：
  - `us-forces-enter-iran-by-march-31...`
  - `us-x-iran-ceasefire-by-march-31`
  - `will-england-win-the-2026-fifa-world-cup-937`

但最后没有实际可执行计划，原因不是研究失败，而是执行约束拦住了：

- 伊朗地面进入市场：`blocked_by_exchange_min`
- 停火市场：`blocked_by_strategy_min_trade`
- 英格兰夺冠市场：`blocked_by_strategy_min_trade`

所以人工 review 时，你应该把“研究质量”和“执行可行性”分开看：

- 研究质量主要看 `pulse.json` / `pulse.md`
- 执行可行性主要看 `preflight.json` / `recommendation.json` / `run-summary.md`

## 15. 所有样例方案概览

5 条样本有一个稳定结论：

- 3 个旧仓位在所有 run 里都被复审为 `hold`
- 新开仓候选大多集中在两个地缘短期市场
- 第三个名额在不同 run 间会漂移，说明长尾候选仍有一定随机性

### run01

| 项目 | 内容 |
| --- | --- |
| 持仓复审 | will-bitcoin-dip-to-65k-in-march-2026；will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568；will-gavin-newsom-win-the-2028-us-presidential-election |
| 开仓候选 | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.92, market=0.805, edge=0.115, usd=2.94)；us-x-iran-ceasefire-by-march-31 (ai=0.93, market=0.855, edge=0.075, usd=2.58)；will-england-win-the-2026-fifa-world-cup-937 (ai=0.94, market=0.871, edge=0.069, usd=2.68) |
| 被拦截原因 | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.81 ask => $4.05 minimum)；us-x-iran-ceasefire-by-march-31: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails；will-england-win-the-2026-fifa-world-cup-937: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails |

### run02

| 项目 | 内容 |
| --- | --- |
| 持仓复审 | will-bitcoin-dip-to-65k-in-march-2026；will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568；will-gavin-newsom-win-the-2028-us-presidential-election |
| 开仓候选 | us-x-iran-ceasefire-by-march-31 (ai=0.96, market=0.855, edge=0.105, usd=3.62)；us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.93, market=0.805, edge=0.125, usd=3.2)；will-england-win-the-2026-fifa-world-cup-937 (ai=0.95, market=0.871, edge=0.079, usd=3.06) |
| 被拦截原因 | us-x-iran-ceasefire-by-march-31: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.86 ask => $4.30 minimum)；us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.81 ask => $4.05 minimum)；will-england-win-the-2026-fifa-world-cup-937: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails |

### run03

| 项目 | 内容 |
| --- | --- |
| 持仓复审 | will-bitcoin-dip-to-65k-in-march-2026；will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568；will-gavin-newsom-win-the-2028-us-presidential-election |
| 开仓候选 | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.92, market=0.805, edge=0.115, usd=2.94)；us-x-iran-ceasefire-by-march-31 (ai=0.94, market=0.855, edge=0.085, usd=2.94)；will-england-win-the-2026-fifa-world-cup-937 (ai=0.91, market=0.871, edge=0.039, usd=1.52) |
| 被拦截原因 | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_risk_cap: exchange minimum $4.05 exceeds current risk-limited cap $2.40；us-x-iran-ceasefire-by-march-31: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails；will-england-win-the-2026-fifa-world-cup-937: blocked_by_risk_cap: total exposure, event exposure, max positions, bankroll cap, or edge scaling reduced the maximum executable notional to zero |

### run04

| 项目 | 内容 |
| --- | --- |
| 持仓复审 | will-bitcoin-dip-to-65k-in-march-2026；will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568；will-gavin-newsom-win-the-2028-us-presidential-election |
| 开仓候选 | us-x-iran-ceasefire-by-march-31 (ai=0.96, market=0.855, edge=0.105, usd=3.62)；us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.94, market=0.805, edge=0.135, usd=3.46) |
| 被拦截原因 | us-x-iran-ceasefire-by-march-31: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.86 ask => $4.30 minimum)；us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.81 ask => $4.05 minimum) |

### run05

| 项目 | 内容 |
| --- | --- |
| 持仓复审 | will-bitcoin-dip-to-65k-in-march-2026；will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568；will-gavin-newsom-win-the-2028-us-presidential-election |
| 开仓候选 | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.92, market=0.805, edge=0.115, usd=2.94)；us-x-iran-ceasefire-by-march-31 (ai=0.93, market=0.855, edge=0.075, usd=2.58)；will-there-be-no-change-in-fed-interest-rates-after-the-april-2026-meeting (ai=0.0515, market=0.0515, edge=0, usd=0.42) |
| 被拦截原因 | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_risk_cap: exchange minimum $4.05 exceeds current risk-limited cap $2.40；us-x-iran-ceasefire-by-march-31: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails；will-there-be-no-change-in-fed-interest-rates-after-the-april-2026-meeting: blocked_by_risk_cap: total exposure, event exposure, max positions, bankroll cap, or edge scaling reduced the maximum executable notional to zero |

## 16. 所有样例文件索引

每个 run 都保留了完整的人工 review 入口。下面把这 5 个 run 的真实文件全部列出来，方便逐个点击核对。

### run01

- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json)
- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json)
- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.en.md)
- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json)
- [reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md)
- [reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)

### run02

- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/preflight.json)
- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/recommendation.json)
- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.en.md)
- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.json)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md)
- [reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023155Z-pulse-direct-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/runtime-log/2026/03/24/runtime-log-20260324T023155Z-pulse-direct-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)

### run03

- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/preflight.json)
- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/recommendation.json)
- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.en.md)
- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.json)
- [reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md)
- [reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023501Z-pulse-direct-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/runtime-log/2026/03/24/runtime-log-20260324T023501Z-pulse-direct-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)

### run04

- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/preflight.json)
- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/recommendation.json)
- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.en.md)
- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.json)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md)
- [reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023422Z-pulse-direct-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/runtime-log/2026/03/24/runtime-log-20260324T023422Z-pulse-direct-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)

### run05

- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/preflight.json)
- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/recommendation.json)
- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.en.md)
- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.json)
- [reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md)
- [reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023340Z-pulse-direct-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/runtime-log/2026/03/24/runtime-log-20260324T023340Z-pulse-direct-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
