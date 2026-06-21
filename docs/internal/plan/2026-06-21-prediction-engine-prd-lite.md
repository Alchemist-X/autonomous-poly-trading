# 预测引擎 — 精简实现版（Lean Spec）

> 2026-06-21 · 只列要实现的功能，去掉细节/例子/论证。完整版见同目录 `prediction-engine-prd.md`。
> 形态一句话：**左流右文档的活报告控制台**——左边实时活动流（看着它推理、随时插话），右边一份会自我更新的结论文档。基于现有 `/research` + Pulse/forecast 引擎**增量扩展，不重写**。
>
> **本次新增硬要求**：① 屏幕上专业名词（贝叶斯更新、条件概率、先验/后验、可信区间…）必须**就地有解释**；② 证据走**真实多源 web search，不准写死**；③ 登录用 **Privy 社交登录（Google / Twitter-X）**。

---

## 1. 一个架构决策（一切的地基）

把**同步流**改成**异步 run + 可重连流**：

- `POST /runs` 秒回 `runId`（不阻塞 12–15min）
- `GET /runs/{id}/stream` 独立订阅 SSE，断线靠 `Last-Event-ID` 续传
- `GET /runs/{id}` 拉快照（刷新 / 历史 / 分享）

一步解决：长任务断网恢复、运行中加 context、刷新恢复、历史/分享。SSE 协议不变，只给每帧加 `seq` + 加几类新事件。

---

## 2. 必做功能清单

### 后端（实现重点）

| 功能 | 说明 | 工作量 |
| --- | --- | --- |
| 异步 run + 可重连流 | 上面那 3 个端点 + run 状态机（queued/running/done/error） | 大（核心） |
| run 持久化 | 先落 `apps/web` + `packages/db`，后迁 `raven-cloud` | 中 |
| SSE 新事件 | `run.queued` / `run.heartbeat` / `context.applied` / `followup.*`，每帧带 `seq` | 小 |
| 心跳发送 | 每 10–15s 一帧（带当前阶段 + 已耗时 + 预计区间） | 小 |
| 加 context 接口 | `POST /runs/{id}/context`，引擎在**阶段边界**读取并采纳 | 中 |
| 控制接口 | `POST /runs/{id}/control`：cancel / pause / resume / pin / drop evidence | 中 |
| followup 子 run | 追问 = 继承父 run 证据池的独立子 run（带 `parentRunId`） | 中 |
| 引擎适配器 | 把 Pulse 7 阶段 / `recommendation.json` 翻成 `PredictionEngineRun` | 大 |
| 模型按 schema 出结构化结果 | api driver 让模型吐 `evidence/model/conclusion`（zod 校验）——"数字变真"的关键 | 大 |
| **证据检索 = 多源聚合 web search** | 搜索 API + 模型内置搜索 + 站点专采，三源合并、实时检索、去重、可引用；**不写死**任何固定证据列表；mock 仅供 demo/QA | 大 |
| **登录 = Privy 社交登录** | Privy 开 Google + Twitter(X)；内测期叠加邀请码白名单（登录后仍需邀请码）做双闸，后续放开 | 中 |
| **用量计量** | 每 run 累计 token（in/out）+ 搜索调用量/抓取内容量；UI 透明展示"本次用了多少"；配额 = 用量预算 | 中 |
| VPS 超时改 ≥18min | 现 120s 与 12–15min 冲突 | 小 |
| 盲测双闸 | context 注入处 web 层 + 引擎层校验：市场价只进事后对比、拒进生成 | 小 |
| **计费 = 按用量计量** | 按实际消耗计费：token + 搜索量（**非**按 run / 按问题固定计）；followup / 局部重算照实计入 | 中 |

### 前端

| 功能 | 说明 | 复用/新建 |
| --- | --- | --- |
| 左流右文档双栏外壳 | 整体布局 | 新建 |
| 流式渲染时机 | 从 complete-only 改成 streaming-growing（第 10s 起铺骨架） | 改 |
| 实时活动流 | 已完成阶段收一行、当前阶段展开吐旁白+产出 | 复用 `StageTimeline` |
| 活报告五块 | 结论卡 / 条件概率树 / 贝叶斯瀑布 / 证据台账 / 局限 | 复用 5 张结果卡 |
| "仍在工作"心跳指示器 | 把静默翻译成"仍在【X】· 已 Nm" | 新建 |
| 常驻插话框 | 运行中可用 + 乐观回显"你说了…" → `context.applied` 回流 | 新建 |
| 证据台账可交互 | 每条忽略/降权/提权 → **前端秒级重算**概率与区间（0 token） | 新建（交互层） |
| 节点/来源/局限可展开 + url 可点 | 报告从只读升级为可对话 | 改 |
| **专业名词就地解释** | 贝叶斯更新 / 条件概率 / 先验·后验 / 可信区间 / Brier 等：hover tooltip + 可展开术语卡，首次出现内联一句话 | 新建 |
| 断线重连 + 刷新恢复 | `Last-Event-ID` 续传 + 快照拉取 | 新建 |
| 报告版本 + 版本对比 | 冻结成 `versions[]`，diff 两版概率 | 新建 |
| i18n / 移动端 / a11y | en/zh 两语；双栏移动端坍缩；关键结论纯文本可读 | 改 |

---

## 3. 数据契约（字段名级，无例子）

- **`PredictionEngineRun`**：`runId, status, eventText, tier, locale, stages[], conclusion{yesProbability, ci80, marketRef?}, evidence[], model[], updates[], limitations[], versions[], contextLog[], parentRunId?`
- **新增 SSE 事件**：`run.queued / run.accepted(带 stages[]) / run.heartbeat / context.applied / followup.progress / followup.answer`（沿用现有 `ResearchEvent` 判别联合）
- **`ContextItem`**：`kind(note|url|evidence_override|param_override), value, stance?, targetNodeId?, targetEvidenceId?, weightHint?`
- **`versions[]`**：`{versionId, atSeq, yesProbability, conclusionSnapshot, triggeredBy}`

---

## 4. 里程碑

- **MVP**：异步 run + 可重连流 + 心跳 + 活报告骨架 + 证据台账前端即时重算 + 加 context 轻档。引擎可先用 mock/现有 driver。
- **v1**：引擎接真（api/vps driver 吐真结构化数字）+ 局部重算 + followup + 版本对比 + 持久化落库。
- **v2**：迁 `raven-cloud` 承载 + 计费 + （可选）扩 zh-TW。

---

## 5. 决策记录（已定）

| # | 决策 | 已定 |
| --- | --- | --- |
| ★1 | run 承载 / 持久化 | **先 apps/web + 现有 DB 跑通，再迁 raven-cloud**（低风险优先，见下方人话解释） |
| ★2 | web search 来源 | **多源聚合**：搜索 API + 模型内置搜索 + 站点专采 |
| ★3 | Privy 登录 | **Google + Twitter/X 都开 + 保留邀请码**（内测双闸） |
| ★4 | 计费单位 | **按用量计量**：token 消耗 + 搜索内容量（非按 run / 按问题固定计） |
| 5 | 局部重算上线 | v1 先上"忽略证据→前端秒级重算"(0 成本)，"加新料重算"待实测 |
| 6 | i18n 范围 | 先 en/zh |
| 7 | 名词解释形式 | hover tooltip + 可展开术语卡 |

> **★1 用人话**：问的是"这个要跑十几分钟的预测任务，住在哪、进度存哪"。网页请求几十秒就结束、但任务要跑十几分钟，还要支持刷新/断网接回——所以任务不能挂在一次网页请求上、进度必须存数据库。**先放现有网站 `apps/web` + 现有数据库**（最快跑通），验证体验后再迁到独立云 `raven-cloud`（更干净但前期重）。要一步到位上独立云就告诉我。
>
> **待实测风险（非决策）**：现 Pulse 单次 1200s 超时、无中间状态恢复，"几分钟局部精修"须先实测引擎成本再承诺。
