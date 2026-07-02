# Raven 10x 路线图（2026-07-02）

> English version: [`en/raven-10x-roadmap.md`](en/raven-10x-roadmap.md)
>
> 产出方式：4 个独立视角（产品 / 预测科学 / 交易与变现 / 平台）基于真实代码各自提案（22 项），
> 再由对抗式审计逐项核对代码依据、评分、合并去重，最后人工裁决。被砍掉的提案见文末。

## 北极星

把 Raven 从"一次性问答工具"变成**可信的、自我更新的、被公开记分的预测系统**。三个飞轮咬合：

```
研究引擎（已有） → 记分/校准（Phase 1） → 公开信誉（Phase 4）
        ↘ 持续监控（Phase 2） ↘ 交易边缘（Phase 3，实盘需逐次确认）
```

一句话判断标准：**没被记分的预测只是观点**。当前代码库最大的未兑现资产，是引擎已经把记分需要的一切都写进了 `state.json`（resolutionDate/settlementSource/证据账本），却没有任何东西去收账。

---

## Phase 0 — 地基（先行，约 1–2 周）

### 0.1 引擎库化（= issue #56，已立项）

任意事件 → {概率+判词, 分析思路, 证据清单}，Store/provider 可插拔。后续一切的 API 基础。
（**不确定性区间只留引擎内部**——现实现是未校准的启发式，用户决定 2026-07-02：校准前对外不提及置信区间。）

### 0.2 截止期概率衰减（正确性修复，零 LLM 成本）

"X 在 DATE 前发生"类问题，窗口收窄而无确认性新闻时，P(YES) 应确定性地向 NO 漂移。今天旧预测的数字冻结到有人手动重跑为止——会同时毒化 watchlist、edge scanner 和公开台账。`resolutionDate` 已在 frame 里，`bayes.ts` 是纯函数，这是确定性的引擎更新。

**验收**：
- [ ] 对带 resolutionDate 的档案，`staleness(P, daysLeft, lastRunAt)` 输出衰减后的展示概率，与原始 P 并存、可审计（不改写 state）
- [ ] 衰减曲线有单测（临期无新证 → 趋向事件未发生方向；无 resolutionDate → 不衰减）
- [ ] Verdict/列表页展示衰减值时明确标注"含时间衰减"，原始值一键可见

### 0.3 单飞行运行队列 + 全局预算仲裁器

审计确认的真实风险：`run-manager` 的内存 job 表 + 10 分钟 mtime 启发式在有任何调度器后会双跑同一事件；而 Phase 2/3 的五类调度（watchlist/scanner/持仓复审/ensemble/手动）竞争同一个订阅用量窗口，各自设上限会互相饿死。

**验收**：
- [ ] 同一 eventId 全局单飞行（文件锁或 journal），服务重启后不重复 spawn（现有 ORPHAN_RUN_FRESH_MS 启发式替换为确定性机制）
- [ ] 所有调度来源经一个优先级队列 + **全局**日预算（round 数计），超预算产生可见的 skip 记录，绝不静默
- [ ] 预算与优先级可在 env/配置调整；手动发起 > 持仓复审 > watchlist > scanner

### 0.4 零结算依赖的有效性检查（本周就能跑，几分钱一组）

不等几个月的 Brier：问题反转（P(YES)+P(补集)≈1？）、同义改写稳定性、跨 provider 一致性。用 DeepSeek 档位批量跑，立即得到引擎可靠性的第一批量化数据。

**验收**：
- [ ] `pnpm forecast:validity -- <question>` 跑 反转/改写×3/双provider 五连测，输出一致性报告（偏差 pp）
- [ ] 对 10 个样例问题的基线报告入库 `docs/internal/`，作为引擎改动的回归参照

---

## Phase 1 — 记分闭环（Track Record）〔审计最高分 9/10〕

**内容**：到期 → 解决判定（agent 提案 + 人工确认）→ 只追加台账 → 公开 /track-record 页。
吸收合并：公开日历台账 + track-record-as-product 两案。

**依据**：`EventFraming.resolutionDate/settlementSource` 已存在；`ForecastStatus` 里 `"resolved"` 枚举**从未被赋值**；`scripts/world-cup/lib/performance.ts` 已有 Brier/ECE/skill 全套实现可提炼共用；WC performance 页是现成的视觉语言。世界杯内容引擎 ~3 周后枯竭，这是公开信任面的接续。

**验收**：
- [ ] resolutionDate 过期触发 resolution job：提案 YES/NO/VOID + 引用结算源 URL；**人工在 apps/raven 一键确认前不入账**（拒绝全自动记分——错误自评会毒化整个信任面）
- [ ] 确认后写入只追加 JSONL 台账，记分概率的冻结规则（如"结算前最后一轮的 P"）印在页面上
- [ ] forecasting-agent.com/track-record 公开：全量 N、Brier、校准分箱 + ECE，每条链接到 dossier；未解决/VOID 也列出（无幸存者偏差）
- [ ] Brier/ECE 提炼为共享库，WC performance 页与新页共用同一实现，不可漂移
- [ ] 台账不可从产品路径删除/编辑；更正 = 新条目 + 可见的 supersedes 链接

---

## Phase 2 — 活的预测（Watchlist + 每日 Delta 简报）〔7/10〕

**内容**：显式 opt-in 跟踪问题；调度器按日重跑（走既有 resume 路径）；产品面变成 delta 流（"GTA6 slip：62%→71%，driver：X 报道，+6pp"）+ 每日一页简报（单一投递渠道即可）。
吸收合并：belief 时间序列 + watches 两案。

**审计修正**（照做）：resume 到 maxRounds 后是 no-op——调度器必须按 session 提升 `--max-rounds`（小引擎语义改动）；"震荡 = 有争议"标记直接回应 ROADMAP 里已知的失败样例；简报渠道不预设 Lark（该资产不存在，审计抓出的编造项）——一个 markdown 简报投一个用户选定的渠道。

**验收**：
- [ ] 标记 track 的问题按日程经 resume 重跑；跨调度 run 的连续性不变量（round N prior == N-1 posterior）有测试
- [ ] Watchlist 屏：按 |Δpp| 排序，每行当前 P / Δ / whyChanged 主驱动一行 / 链接 dossier
- [ ] 低于阈值（默认 2pp）显示"无实质变化"且不进简报
- [ ] 每日简报 markdown：每个跟踪问题的 P/Δ/一行驱动/链接；全平静也生成（"all quiet"）
- [ ] 连续两次重跑方向翻转超阈值 → 打"contested（震荡）"标记
- [ ] 全部走 0.3 的预算仲裁器；预算尽 → 可见 skip

---

## Phase 3 — 边缘栈（Edge Stack）〔8/10〕

顺序固定：**隔离层 → 扫描器 → 成本分层 → 持仓复审 → 审批路由**。

### 3.1 市场盲测隔离的机器强制（先建，全栈共用）

审计评语："22 个提案里最好的单一机制"——把神圣规则从约定变成代码。`claude-agent.ts` 已捕获真实搜索 trace，可做事后审计；`scripts/forecast` 今天没有价格域屏蔽。

**验收**：
- [ ] `--market-blind` 模式：价格域黑名单（polymarket/kalshi/赔率站）注入 prompt 禁令 + **trace 事后审计**（搜索结果 URL 出现价格域 → run 作废并标记）
- [ ] 通过审计的 run 在 state.json 写入"隔离证书"（含 trace 摘要哈希）；边缘扫描与交易路由**只消费带证书的 run**
- [ ] 现有引擎测试全绿；证书逻辑有独立单测

### 3.2 Raven 边缘扫描器（盲测预测 × 事后比价）

对 pulse 快照里前 ~30 个高流动性二元市场，只喂问题文本（剥价）跑引擎，然后按 `fetch-baseline-prices.ts` 的既有模式在**预测时间戳**比对市场隐含概率。三鸟一石：系统性边缘发现、Polymarket 当结算 oracle（解掉 ROADMAP 的 no-oracle 反对）、给校准快速攒 N。

**验收**：
- [ ] `forecast:scan` 每日对 N 个市场产出带隔离证书的预测 + 冻结的同刻市场价，入 runtime-artifacts 归档
- [ ] 边缘榜：|Raven P − 市场 P| 排序，注明流动性/spread/费率（来自既有 PulseCandidate 字段）
- [ ] 市场结算即自动记分入 Phase 1 台账（oracle = Polymarket 结算）
- [ ] 全程无价格进入生成侧（3.1 证书验证），有端到端测试

### 3.3 成本分层（DeepSeek 粗筛 → Claude 深研）

扫描器/watchlist 在订阅预算下不分层跑不起。粗筛档**永不交易、永不发布**（tier 隔离是承重安全细节）。审计修正：87 个 WC 预测出自 Elo 管线不是本引擎，分层对比基准须用扫描器自己攒的已结算事件。

**验收**：
- [ ] 扫描先跑 deepseek 粗筛；|粗筛 P − 市场| ≥ 阈值才升级 claude 深研
- [ ] state.json 记录 tier；粗筛结果不得进入台账/公开页/交易路由（有代码级拦截 + 测试）
- [ ] 成本报告：分层前后每日 round 消耗对比

### 3.4 持仓复审（薄封装，不另起系统）

= 扫描器机器对准 `forecast:positions` 的持仓列表 + 既有退出规则表。让"净 edge < 0 → 卖出"机械可查。

**验收**：
- [ ] 每持仓事件产出带证书的最新 P + 对市场价的净 edge（扣费）；edge<0 高亮
- [ ] 输出并入现有 positions 报告格式；不自动下单

### 3.5 审批路由（⚠️ 每次实盘动作需用户确认）

高确信分歧 → 复用 `pulse-live --recommend-only` 的既有门控管线生成建议单。默认 recommend-only；陈旧边缘在下单前强制重读市场价复核。

**验收**：
- [ ] 扫描器候选可一键送入 recommend-only 管线，产出与现有 pulse 建议同格式的评估
- [ ] 任何越过 recommend-only 的执行都走现有 preflight + 用户逐次确认；无静默路径
- [ ] 下单前强制刷新市场价，边缘缩水超阈值 → 自动撤回建议

---

## Phase 4 — 分发（在台账有"收据"之后）〔6/10〕

**Publish-to-web dossiers**：一键把 dossier 冻结成 forecasting-agent.com/f/\<slug\> 静态页 + OG 卡（大号概率 + 问题）。发布保持人工挑选；**不建**公开自助提问（成本/滥用/信任稀释）、评论、账号体系。

**验收**：
- [ ] Publish 产出无 VM 运行时依赖的冻结快照页（概率轨迹/证据书/验真标记原样保留——信任标记不得在公开渲染中洗掉）
- [ ] OG 卡在 X/Slack 预览正确渲染
- [ ] 页面显示冻结时间；再发布 = 新版本 + 可见版本链，不原地改
- [ ] 一个轻量公开列表页作为内容脊柱，与 /track-record 互链

---

## 持续线（条件触发）

| 项 | 触发条件 | 要点 |
| --- | --- | --- |
| **校准回填拟合**（7/10） | 台账 N≥~50 | 零 LLM 重放已存账本，拟合 MAX_ABS_LLR/UNVERIFIED_MAX/CLUSTER_DECAY 等手调常数；先只出报告，**改常数需用户确认** + 归档拟合报告（带数据集哈希） |
| **Ensemble 分歧区间**（6/10） | 高价值问题 opt-in | 3 路独立 run 的分歧作为真实不确定性度量（内部/校准用；对外恢复展示区间须先过覆盖率校准）；3 倍成本，分层就绪前不默认 |
| **Fermi 分解** | 砍掉，留 1 行便宜版 | framing 审计加一句：复合问题标记 "conjunctive — 整体估计易偏高" 进 framingCaveats |

## 明确砍掉的（审计裁决，避免重议）

- **Scoped API keys / 多用户**（2/10）：为不存在的用户群建设；第二个共享 token 足矣
- **Forecast API v1 + HMAC webhooks**（4/10）：solo 场景下 #56 的进程内调用 + 一个幂等内部端点就够
- **SQLite 台账**（4/10）：夜间脚本扫 state.json 汇总即可，不给 Docker 镜像加原生依赖
- **Analyst 影响台账**（4/10）：打磨演示时刻而非改变产品本质；记分上线后作为 dossier 小节重议
- **基率库**（5/10）：人工维护 20-30 个参照类对 solo 运营者是真实负担；等已结算语料能自动播种再说

## 需要你拍板的两件事

1. **世界杯接续**（审计指出的盲点）：公开站的内容引擎（87 个盲测预测、每日结算）~3 周后随小组赛枯竭。/track-record 是记分牌不是内容管线——下一个公开盲测流选什么域（宏观/科技发布/体育季/扫描器精选）、什么节奏、是否先于交易公开？
2. **公开与交易的时序冲突**：预告边缘（发布 dossier）可能移动你要交易的市场。先交易后发布、只发布不交易的域、还是全公开——需要一个明确政策。

---

*来源：22 提案 × 4 视角 + 对抗审计（grounding 全核对，1 项编造资产被抓出）。原始材料见 workflow 归档。*
