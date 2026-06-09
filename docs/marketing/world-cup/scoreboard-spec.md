# 三方对照 Brier 记分牌 · 规格（scoreboard-spec）

> 英文版见 [scoreboard-spec.en.md](scoreboard-spec.en.md)。
> 用途：公开三方记分牌的产品/内容规格（仅 docs/content，不写 app 代码；前端由别人实现）。渠道：Website + Discord。
> 来源：`docs/internal/plan/2026-06-09-world-cup-special-plan.md` §6（leaderboard 飞轮）、§11.3（三方对照）、§5（Brier 校准）、§8（合规口径）。

---

## 1. 这是什么 / 为什么

记分牌是我们唯一的信用证明：把**三方的概率**摆在一起，逐场用 **Brier 分数**结算，公开、可审计、**输了照记**。它是增长飞轮里最重要的一环（plan §6）——每条预测都回链到它。

三方：
- **Us** — 我们独立 7 阶段引擎的概率。
- **Kimi** — Kimi 公开发布的预测概率（注明出处，仅引用对照）。
- **Market** — Polymarket 盘口隐含概率，定位为**"共识偏差研究变量"**（plan §11.1，不是预测直接依据，也不是我们撮合的下注对象）。

---

## 2. 每场比赛跟踪什么（per-match tracked fields）

| 字段 | 说明 | 来源 |
|---|---|---|
| `match_slug` | 比赛唯一标识 = event_slug（如 `fifwc-mex-rsa-2026-06-11`） | `forecast_reports`（plan §4.6） |
| `market_question` | 跟踪的结算问题（先做 `match_result` 1X2；夺冠等长线 prop 单列） | 市场清单 |
| `kickoff_at` / `resolved_at` | 开赛 / 结算时间 | fixtures |
| `p_us` | 我方该结果的概率 | 我方报告 `yes_probability` |
| `p_us_ci` | 我方 80% 置信区间 | 我方报告 |
| `p_kimi` | Kimi 公布的该结果概率（无则 N/A） | Kimi 公开发布，引用 |
| `p_market` | 市场隐含概率（结算前快照，注明快照时间） | Polymarket Gamma/CLOB 快照 |
| `resolved_outcome` | 实际结果（0/1，或 1X2 的命中维度） | 赛果回填 |
| `brier_us` / `brier_kimi` / `brier_market` | 三方该场 Brier | 结算后计算 |
| `status` | `pending` / `resolved` | — |

> 范围（MVP）：先只记 `match_result`（1X2）单场，最稳、最快出量；夺冠/出线等长线 prop（如德国夺冠）单独一张"长线追踪"小表，按概率漂移更新、随对应阶段结算。

---

## 3. Brier 怎么算、怎么展示

**定义（人话）：** Brier 衡量"概率预测的准度"，= 预测概率与实际结果（发生=1/未发生=0）差值的平方。**越低越准**，范围 0–1（二元）。

**公式：**
- 二元事件：`Brier = (p − outcome)²`，`outcome ∈ {0,1}`。
- 多类（1X2 三选一，主胜/平/客胜）：`Brier = Σ_k (p_k − o_k)²`，`o_k` 为该类是否发生的 one-hot。多类 Brier 范围 0–2。

**参照线（plan §5，给读者理解"好不好"）：**
- 纯随机三选一 ≈ **0.22**（1X2 多类 Brier 量纲下的直观基准是"瞎猜"水平，记分牌上标一条"random baseline"参照线）。
- 我们的回测目标：单场 1X2 Brier **< 0.20**（0.19 已接近市场）。
- 唯一不可妥协：**Brier 公开且不造假**（plan §7）。

**展示方式：**
- **每场行：** 三方各自 Brier + 谁本场最低（最准）高亮；附实际结果与各方预测概率。
- **累计区：** 三方至今的**平均 Brier**、已结算场次数、近 N 场趋势（折线）。这是头条数字。
- **诚实标注：** 我们输的场次不隐藏；如某场我们 Brier 高于市场，照常显示（plan §7："输错照发=可信度"）。
- **置信度分档（plan §11.1）：** 报告侧可标"高/中/低"置信度三档，帮读者理解我们对该场把握；记分牌仍以实际 Brier 为准。

---

## 4. 数据来源与出处声明（attribution caveats — 合规关键）

| 列 | 来源 | 必须标注的 caveat |
|---|---|---|
| **Us** | 我方 `forecast_reports`，预生成于 VPS 真实 7 阶段（plan §6） | 概率含 80% 置信区间；非确定性结果 |
| **Kimi** | Kimi 公开发布的预测值 | **必须注明出处："Kimi 公布数据，引用对照"**；无公开数字的场次 = N/A；不复制其报告正文/表格；不声称关联（plan §11.3 IP 红线） |
| **Market** | Polymarket 盘口隐含概率，结算前快照 | 定位为**"共识偏差研究变量"**，非投注对象；标快照时间；**页面不含任何 Polymarket 充值/下注/affiliate 链接**（plan §8 R2） |
| **Outcome** | 公开赛果 | 以官方结算口径为准 |

**口径硬约束（plan §8）：**
- 全程称"概率 / 偏差 / research signal"，**不称"投注 edge / 跟单 / 推荐"**。
- 市场列是研究参照，**不是**导流到任何博彩平台的入口。
- 我们不接受、不撮合任何投注。

---

## 5. 渲染 + 自动播报

**网站（`/world-cup/leaderboard`）：**
- 累计三方平均 Brier 置顶（头条数字）+ 趋势折线。
- 可滚动的逐场表（按 `kickoff_at` 倒序），每行可点开到该场比赛报告。
- 顶部一句定位 + 底部免责声明常驻。
- MVP 数据源：手动 JSON 或直接接 `forecast_reports.resolved_outcome`（plan §10 Open Question Q6，影响 W1 准时上线；建议先手动 JSON 抢时间，后迁移）。

**Discord（`#leaderboard`，bot 自动播报，详见 discord-setup §5）：**
- **赛后 T+1h：** 单场结算复盘（实际结果 + 三方 Brier + 命中与否）。
- **每周一次：** 累计三方平均 Brier 复盘 + 趋势。
- bot 只读记分牌数据渲染消息，**不调用任何下单/资金接口**。

**飞轮（plan §6）：** 每条赛前预测帖、每篇比赛报告都回链记分牌；记分牌是可信度的中心枢纽。

---

## 免责声明（MANDATORY — 记分牌页脚 + Discord 播报均须带）

> 本记分牌提供基于公开数据的**概率估计与研究分析**，**不构成任何金融、投资或投注建议**。所有预测均为**概率而非确定性结果**；过往表现不代表未来。市场概率仅作"共识偏差研究变量"参照，非投注对象。Kimi 数据来自其公开发布，仅作对照，我们与 Kimi 无隶属关系。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。18+。
