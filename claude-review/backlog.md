# Backlog — 按优先级排列的待办清单

最后更新：2026-04-14（neg-risk 手续费修复完成后）

---

## P0 — 必须立即做

（当前无 P0）

## P1 — 本轮应做

- [x] ~~neg-risk fee bug 修复：fee-enabled 多结果市场改为读取 Gamma `fees_enabled/fee_schedule`，并同步修正 net edge / GTC 判断 / fee verify~~
- [x] ~~用 `--category tech` 和 `--category sports` 重新验证 filter（前置过滤已确认：sports=266、tech=8 候选可用）~~
- [x] ~~Vercel 重新部署（production 构建成功，线上页面 + API 验证通过）~~

## P2 — 下一轮

- [ ] 更好的信息收集能力：结合 6551MCP、Word Monitor 以及方程式新闻 API 等
- [ ] **Resolution 提升专项**：见下方独立章节
- [ ] **持仓独立复审专项**：见下方独立章节

- [x] ~~Auto-redeem：到期市场自动赎回 tokens（赢家拿 USDC，输家清理持仓）~~
- [x] ~~neg-risk 订单簿读取验证：py-clob-client 已正确处理 neg-risk complement，无需修复（raw CLOB API 有问题但代码不用它）~~
- [ ] 启用 position-monitor：先 dry-run 验证一周，确认无误后切实盘
- [ ] VPS 定时部署：systemd timer 方案实施（文档已就绪 `claude-review/vps-scheduling-plan.md`）
- [ ] 市场筛选 Phase D：回报时间线 AI 分析（催化事件、edge 持续窗口）
- [x] ~~GTC + FOK 混合下单：fee>0 + open + spread<5% → GTC 限价单，5 分钟 fallback FOK~~
- [x] ~~卖出前校验链上 ERC1155 余额（CTF balanceOf via Polygon RPC，fail-open）~~
- [ ] 启用 `PULSE_AI_PRESCREEN=true` 并实测效果

## 持仓独立复审专项

> 核心问题：**现有持仓的 edge 重新评估不应依赖 pulse 随机抽样是否恰好选中它们。**

### 问题

当前 position-review 模块只在 pulse 刚好为某个持仓对应的市场做过独立分析时，才会产生新的 AI 概率。否则代码直接复制 `market_prob` 作为 `ai_prob`，edge=0，永远返回 hold。实际结果：

- 持仓可能**几周甚至几个月不被重新评估**
- runtime log 里每个持仓都是 `"No contradictory pulse recommendation was produced..."`
- close/reduce 阈值（±5% edge）永远不触发
- **"没有新证据"被错误地等同于"仓位合理"**

这意味着即使一个持仓的 resolution source 数据已经反转，系统也不会主动发现。

### 待实施改进

- [ ] **每次 pulse 强制复审所有现有持仓**：在第 3 步（信息搜集）阶段，对每个持仓单独跑 A0（resolution source 实时查验）+ A1（信息搜集）+ A2（推理），不依赖本轮候选抽样
- [ ] **持仓独立分析 agent（零上下文）**：对每个持仓单独 spawn 一个 agent，零上下文从 resolution rule 出发独立估概率。和原始开仓时的 AI 概率对比，差距 >10% 就报警
- [ ] **Resolution Source 周期性查验**：每次 pulse 直接访问所有持仓的 resolution source URL（CDC / FIDE / AP 等），抓当前状态并记录。即使没有新 edge，也要在报告中列出"上次查验时间 + 当前状态"
- [ ] **Position Review 报告独立章节**：pulse 报告里新增"持仓复审"章节，列出每个持仓的：
  - 原始开仓理由
  - 本次独立重估的 AI 概率
  - resolution source 当前状态
  - 距结算剩余时间
  - 建议动作（hold / close / reduce）+ 理由
- [ ] **失效 thesis 标记**：如果原始开仓 thesis 中引用的关键事实（如"SC 麻疹爆发已结束"）在新一轮查验中不再成立，自动标记为 "stale thesis"，降低对该持仓的置信度

### 核心原则

**持仓复审必须是主动的、独立的、周期性的**，不是 pulse 候选抽样的副作用。

## Resolution 提升专项

> 核心原则：**你评估的是 Resolution Rule 中规定的事件会发生的概率，不是语言直觉上"这件事"会发生的概率。**

### 问题

当前模型会读取 resolution rule，但推理时经常偏离 rule 的字面定义，转而评估"语言直觉上这件事会不会发生"。

泛化原则：

```
❌ 错误：评估"这件事在现实中会不会发生"
✅ 正确：评估"resolution rule 中定义的具体触发条件会不会被满足"
```

这两个问题的答案可以完全不同。Resolution rule 的触发条件经常比事件本身宽松或严格得多：
- **宽松**：规则只要求"一条社交媒体帖子"，但事件本身很复杂
- **严格**：规则要求"AP + Fox + NBC 三方共识确认"，即使事件已发生也可能不结算
- **时间窗口**：规则有截止日期，事件可能发生但在截止后
- **定义偏差**：规则对"发生"的定义可能和常识理解不同

### 待实施改进

- [ ] **Prompt 硬规则**：在 SKILL.md 中增加强制推理步骤——"当 resolution rule 的触发门槛低于事件本身复杂度时（如社交媒体帖子即可触发），必须单独评估触发行为的概率，而非底层事件的概率"
- [ ] **Resolution Rule 深度阅读**：对每个候选市场的 resolution rule，要求模型逐条拆解触发条件（谁、做什么、通过什么渠道、什么算/什么不算），并在证据链第 0 条明确列出
- [ ] **Resolution 相关信息搜索强化**：不仅抓 Polymarket 页面的 rules.description，还要主动搜索 resolution source 指定的外部数据源（如 AP、官方网站、数据 API）来验证当前状态
- [ ] **Resolution 门槛分类标签**：给每个市场标注 resolution 门槛类型（低门槛：声明/帖子 | 中门槛：官方数据发布 | 高门槛：多源共识/法律判决），不同类型采用不同推理框架
- [ ] **回测验证**：用历史已结算市场验证改进后的推理准确率，特别是低门槛 resolution 的案例

### Resolution-First 推理框架（待写入 prompt）

```
1. 逐条拆解 resolution rule 的触发条件（谁 / 做什么 / 什么渠道 / 什么算什么不算 / 截止时间）
2. 对比：触发条件 vs 事件本身，差距在哪？
   - 触发条件比事件宽松？（如：帖子就行 vs 实际军事行动结束）
   - 触发条件比事件严格？（如：需要三方确认 vs 事件已经发生）
   - 时间窗口足够吗？
3. 评估"触发条件被满足的概率"，而非"事件本身的概率"
4. 搜索 resolution source 指定的外部数据源验证当前状态
5. 底层事件动态仅作为辅助修正，不能替代触发条件评估
6. 最终概率 = 触发条件概率为锚 + 底层动态修正
```

## poly-pulse Skill 封装专项

> 目标：任意 Claude Code 安装 `poly-pulse` skill 后，一条命令 `/poly-pulse` 即完成"抓市场 → AI 分析 → 实盘下单"全链路。

### 产品定义

- 名称：`poly-pulse`
- 触发：`/poly-pulse` 或用户说"跑 pulse"/"分析市场"/"下单"
- 行为：默认实盘下单（不是 recommend-only）
- 输出：终端打印推荐 + 成交结果 + 持仓变化

### 需要解耦的模块

| 模块 | 当前位置 | Skill 形态 |
|------|---------|-----------|
| 市场抓取 | `vendor/.../fetch_markets.py` | 独立 Python 脚本，skill 自带 |
| AI 分析报告 | `full-pulse.ts` → `claude --print` | 改为 skill 内直接调用 Claude（无需子进程） |
| 交易计划提取 | `pulse-entry-planner.ts` | 提取为独立 TS 模块 |
| 风控 | `execution-planning.ts` + `risk.ts` | 提取为独立模块 |
| CLOB 下单 | `polymarket-sdk.ts` | 提取为独立模块，仅依赖 `@polymarket/clob-client` |
| 费率表 | `fees.ts` | 提取为独立模块 |
| 持仓查询 | `fetchRemotePositions` | 提取为独立函数 |

### 去掉的依赖

- ❌ DB / Redis / BullMQ
- ❌ monorepo workspace 结构
- ❌ orchestrator / executor 服务拆分
- ❌ queue-worker / stateful 路径

### 保留的依赖

- ✅ `@polymarket/clob-client`（npm 包）
- ✅ Python 3（fetch_markets.py）
- ✅ `.env` 文件（钱包凭证）
- ✅ Claude Code（skill 宿主）

### 目录结构（预想）

```
~/.claude/skills/poly-pulse/
├── SKILL.md                    # Skill 定义 + 触发词
├── package.json                # 依赖声明
├── scripts/
│   ├── fetch-markets.py        # 市场抓取
│   ├── pulse-run.ts            # 主入口：fetch → analyze → plan → execute
│   ├── clob-sdk.ts             # CLOB 交互（下单/读书/查持仓）
│   ├── entry-planner.ts        # 从报告提取计划
│   ├── risk-guard.ts           # 风控逻辑
│   └── fees.ts                 # 费率查表
├── prompts/
│   ├── pulse-analysis.md       # AI 分析 prompt 模板
│   └── analysis-framework.md   # 分析框架
└── references/
    └── output-template.md      # 报告输出模板
```

### 分阶段实施

- [ ] Phase 1：提取核心模块为独立文件（不依赖 monorepo imports）
- [ ] Phase 2：打包为 skill 目录结构，写 SKILL.md
- [ ] Phase 3：本地测试——在一个干净的 Claude Code 实例上安装并跑通
- [ ] Phase 4：加 `/poly-pulse --dry-run` 模式和 `/poly-positions` 查持仓

## P3 — 后续考虑

- [ ] Phase 2 架构简化：删除 stateful 路径、provider-runtime、BullMQ
- [ ] 简化预检：只保留凭证 + 抵押品检查
- [ ] 结构化交易日志：单个 `run-log.jsonl` 替代 8 个产物文件
- [ ] Maker 返还追踪：统计每日从 Polymarket 获得的 Maker rebate
- [ ] 多钱包支持

---

## 已完成

- [x] 手续费集成（fees.ts + netEdge 排序 + Pulse 报告显示 + CLOB 验证）
- [x] Filter 验证（sports/tech 测试）
- [x] Filter 前置到候选选择前（pre-selection filtering）
- [x] PNL 曲线修复（equity snapshots 画线 + 现金流 headline）
- [x] 市场筛选 Phase B：类型权重排序（politics/tech 1.5x, crypto 0.3x）
- [x] 市场筛选 Phase C：AI 预筛选（TRADE/SKIP，默认关闭 `PULSE_AI_PRESCREEN`）
- [x] 短期价格市场自动过滤（<7 天 crypto/stock 涨跌）
- [x] 交易透明化：`applyTradeGuardsDetailed()` 返回具体约束分解
- [x] 动态 bankroll：去掉静态 cap，用远程 API 实际余额
- [x] Framework-free provider：任意 agent 可作为 provider
- [x] Phase 1 阈值调整：7 个参数放宽
- [x] Monthly Return 排序 + 20% batch cap + resolutionSource 标注
- [x] 前端暗色仪表盘 + 中英文切换 + 投资理念板块
- [x] Vercel 部署成功
- [x] Vercel 部署验证（2026-03-31，线上页面 + API 正常）
- [x] Filter 前置过滤验证（--category tech/sports，59 个单元测试 + 数据验证）
- [x] 实盘下单成功（伊朗市场 3 笔）
- [x] Fallback 删除
- [x] Claude Code provider 跑通完整 Pulse 渲染
- [x] 统一模板命令（去掉 codex 特殊分支）
- [x] `live:test:stateless` → `pulse:live` 全局重命名
- [x] PNL 曲线改用现金流口径
- [x] 渲染超时 30min + 报告注入耗时统计
- [x] Polymarket 手续费研究文档 + GTC+FOK 提案
- [x] 市场筛选 filter 功能（JSON 配置 + CLI override）
- [x] Filter 前置到候选选择前
- [x] 项目架构审计 + 历史失败分析
- [x] VPS 定时方案文档 + 市场筛选策略计划文档
- [x] 候选选择改为随机抽样 20 个（去掉流动性排序公式）
- [x] neg-risk 市场 0% 手续费（negRisk 字段全链路 + event 级别传播）
- [x] SELL avgPrice 解析修复（从 takingAmount/makingAmount 计算）
- [x] extractProbabilities regex 修复（中文注释 Yes/No 匹配）
- [x] 实盘平仓 Newsom 2 笔 + 手续费验证（实际 $0 vs 估算 $0.013）
- [x] 实盘下单 3 笔（麻疹、Rubio、Mets）
- [x] Polymarket 分类标签速查文档（98 个标签 + 手续费率表）
- [x] 独立持仓监控器 position-monitor（30% 止损，model-free，默认关闭）
- [x] 手续费模块测试补全（negRisk lookup/verify/netEdge 5 个新测试）
