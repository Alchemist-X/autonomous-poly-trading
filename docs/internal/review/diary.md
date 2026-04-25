# Claude Diary — 工作日志与反思

持续累积每次 session 的工作记录、决策背景和教训。

---

## 2026-03-29 Session

### 完成
- 交易透明化：`applyTradeGuardsDetailed()` 返回具体约束分解
- 动态 bankroll：去掉静态 `INITIAL_BANKROLL_USD` cap，改用远程 API 实际余额
- Provider 架构：framework-free，任意 agent 可作为 provider
- Phase 1 阈值调整：7 个参数放宽
- Monthly Return 排序 + 20% batch cap
- 前端暗色仪表盘上线
- 项目架构审计、历史失败分析

### 反思
- **改动未推送 = 未完成**：所有代码改动必须 commit + push + 验证部署后才算完成
- **recommend-only ≠ 实盘下单**：测试时必须明确区分
- **先验证再扩展**：先确保一笔交易能跑通，再做架构改进
- **.env 配置是生命线**：provider 配置必须正确设置

---

## 2026-03-30 Session

### 完成
- 实盘下单成功（2 笔伊朗市场 + 1 笔 Apr 30 市场）
- Fallback 删除：deterministic fallback 导致方向完全相反的交易，已移除
- Claude Code 作为 provider 跑通完整 Pulse 渲染
- 统一模板命令（去掉 codex 特殊分支）
- `live:test:stateless` → `pulse:live` 全局重命名
- PNL 曲线改用现金流口径计算
- 中英文切换上线
- 投资理念文案更新（README + 网页）
- Polymarket 手续费研究文档
- GTC+FOK 混合下单提案
- 市场筛选 filter 功能（JSON 配置 + CLI override）
- 渲染超时 20min → 30min，报告注入耗时统计

### 反思
- **Fallback 是危险的**：跟随市场共识 + 固定上调 10% 的假 edge，导致了方向完全相反的实盘交易。AI 分析失败时必须停止而不是降级
- **手续费改变了盈利门槛**：Geopolitics = 0% 是最优类别；Crypto 往返 3.6% 意味着需要 >6% edge 才能盈利
- **渲染超时是真实问题**：Claude Code 处理 40k token prompt 需要 5-20 分钟
- **PNL 不能用权益差值**：入金会被算成利润，必须用 cash_in - cash_out + current_value

### 未完成
- 手续费集成到交易代码（仅文档，未改代码）
- ~~用 `--category sports/tech` 实际跑一次 recommend~~ → Done（filter 前置后待再验证）
- ~~PNL 曲线历史段修复~~ → Done
- VPS 定时部署（仅文档）
- ~~市场筛选 Phase B-D~~ → Phase B/C done，Phase D 待做

---

## 2026-03-31 Session

### 完成
- 手续费完整集成：fees.ts 计算模块 + netEdge 排序 + 报告显示 + CLOB API 验证 + 费率不一致日志
- PNL 曲线修复：图表用 equity-history 画线（正确），headline 用现金流（正确），消除 -$150
- Filter 前置：category/tag 过滤移到候选选择之前，小众类别（tech/sports）不再被挤出
- Phase B 类型权重：politics/tech 1.5x，crypto 0.3x，影响候选排序
- 短期价格市场自动过滤：<7 天 crypto/stock 涨跌直接移除
- Phase C AI 预筛选：TRADE/SKIP 分类（默认关闭，`PULSE_AI_PRESCREEN=true` 启用）
- 231 个测试（从 153 增长到 231）

### 反思与发现的缺点

**架构层面：**
- **Filter 位置设计失误**：最初把 filter 放在 post-selection（选完再过滤），导致小众类别永远被挤出。这是典型的"先做了再想对不对"的错误。应该在设计时就考虑过滤应该发生在哪一步。
- **equity-history.json 作为 PNL 数据源有局限性**：静态文件需要每次跑完 push 才能更新线上图表。如果跑了但没 push，网页数据就是旧的。长期应该用数据库或 API 存储。
- **AI 预筛选（Phase C）还没实测**：写了代码但默认关闭。需要用真实数据验证它的分类质量，否则可能误杀好的候选。

**交易层面：**
- **地缘政治高度集中**：当前 7 个持仓里 5 个是伊朗相关市场。同一事件驱动因素太集中，一旦伊朗局势突变，所有仓位同时受影响。类型权重解决不了这个问题，需要事件级别的分散化。
- **费率验证是事后的**：当前的 CLOB API 对比是在下单前做的，但如果发现不一致，仍然继续下单（只记录日志）。如果我们严重低估了费率，可能会在不知不觉中亏钱。
- **没有跟踪实际执行滑点**：FOK 成交的 avgPrice 和预期 bestAsk 之间的差异没有被记录和分析。

**改进方向：**
1. 事件敞口分散化 — 不只是按类别分散，还要按底层事件分散（同一个伊朗冲突不应占超过 30% 的总仓位）
2. 执行质量监控 — 记录每笔交易的 expected price vs actual price，积累数据后分析滑点模式
3. 实测 AI 预筛选 — 跑 10 轮 recommend-only 对比有/无预筛选的候选质量差异
4. 考虑动态 equity-history API — 替代静态 JSON 文件的方案
