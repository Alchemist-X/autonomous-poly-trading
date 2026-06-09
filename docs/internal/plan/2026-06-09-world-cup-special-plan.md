# World Cup Forecasting Harness — 统一开发 + 增长执行计划（`world-cup-special`）

> 最后更新：2026-06-09 · 分支：`world-cup-special`
> 来源：7-agent 规划 workflow（harness / model-routing / data / product / marketing / compliance + 综合），已对照真实仓库校验。
> 参考材料：用户提供的两份 Kimi PDF（《Kimi 将公开预测 104 场世界杯赛事：德国队或爆冷夺冠》方法论文章 + 301 页《Kimi 2026 World Cup Report》）。对标分析见 §11。
> 事实锚点（`runtime-artifacts/world-cup-market-list/latest/metadata.json`）：**113 events / 998 active markets / 72 game events（216 game markets）/ 41 prop events（782 prop markets）**。配额默认实测 **5/日、50/月、1 并发**（`apps/web/lib/prediction-access.ts:167-169`）。今天 2026-06-09，揭幕 6/11，决赛 7/19。

---

## 1. 一句话目标 + 范围

**目标：** 在世界杯 40 天窗口内，把现有 7 阶段超级预测框架特化为足球概率研究产品，**公开、可审计、用 Brier 记分**，对比 Polymarket 真实盘口找 edge，借赛事流量做获客与私域沉淀。

**定位红线（合规决定，不可妥协）：** 对外是 **probability research / 概率研究工具**，不是 trading agent、不是 tipster、不喊单、不内嵌下单、不给美国/中国流量任何博彩资金通道。

| 这次要做（IN） | 明确不做 / 后置（OUT） |
|---|---|
| NOW 池 ~450 市场：`match_result`(216) + `team_group_winner`(48) + `team_advance_group`(48) + `tournament_winner`(48) + `continent_winner`(6) + `player_top_scorer`(140，归一化启发式) | O/U 2.5、BTTS、correct-score、player goal/assist prop（需 Dixon-Coles 双泊松，→ Phase 2） |
| Elo 单场模型 + Monte Carlo 赛程模拟（夺冠/出线） | Dixon-Coles 比分矩阵、GBM/props 模型（→ Phase 2/3） |
| cached 报告（公开 SSG，0 登录）+ OG 卡 + PDF 导出 + leaderboard | S3/CDN、付费分层（Pro tier）、`/account` 用量页、113 场全覆盖 |
| 合规体系：独立 metadata、disclaimer、`/terms`、`/privacy`、同意勾选 | 真钱自动下单（与本产品完全解耦，永远人控） |
| EN/CN X + Website + Discord 私域 + 邀请码裂变 | 付费投放、复杂机器人、App Store 上架 |

---

## 2. 现状盘点（复用清单）

| 已有能力 | 路径 | 怎么用 |
|---|---|---|
| **7 阶段框架** | `services/orchestrator/src/pulse/stage-flow.ts` | import 不 fork；通过新 `sports/stage-specializer.ts` 注入足球语义。本产品恰好补它自标的两个 gap：stage 1 resolution 未 typed、stage 5 条件模型非 machine-readable |
| **编排/render/timeout/心跳** | `pulse/full-pulse.ts` | 机制照搬到 `sports/football-pulse.ts`，改调 model-router |
| **证据收集** | `pulse/web-search.ts` | stage 3 原样用；新增 `sports-data` 结构化证据并行喂入 |
| **市场抓取 & 价格** | `pulse/market-pulse.ts`（`PulseCandidate`，含 `negRisk`/`outcomePrices`/`clobTokenIds`）+ `services/executor/src/lib/polymarket-sdk.ts`（Gamma/CLOB） | stage 7 价格对比 + market-mapper 的 outcome↔腿映射 |
| **edge/Kelly/风控** | `runtime/pulse-entry-planner.ts`（`aiProb`，~270 行起）+ `lib/risk.ts` + `runtime/*` | 融合输出喂 `aiProb`，edge/净 edge/Kelly 1/4 仓全部复用，**不重写下单** |
| **决策契约** | `packages/contracts/src/index.ts`（`decisionSchema`/`TradeDecision`） | 足球决策走同一契约，只新增 model-breakdown zod，不改决策结构 |
| **归档** | `lib/artifacts.ts` + `runtime-artifacts/` | 报告落 `runtime-artifacts/sports/` 与 `runtime-artifacts/world-cup/reports/` 子目录 |
| **PDF 报告生成器** | `scripts/pulse-decision-report.ts`（Playwright chromium，产 `decision-report.{md,en.md,html,pdf}`） | 预生成时一并产 PDF；前端只 serve 缓存文件，不在请求时 launch chromium |
| **前端 demo + Manus 阶段 UI** | `apps/web/app/prediction-engine/page.tsx` + `apps/web/lib/prediction-engine-demo.ts`（`PredictionEngineRun` 类型） | 作承接页；cached 报告复用其数据结构与视觉；改 `DEFAULT_PREDICTION_EVENT` 为一场 WC 比赛、接 `?event=` query |
| **auth / invite / quota 三表** | `packages/db/src/migrations/0004_prediction_access.sql`（`app_users` / `invite_codes` / `prediction_usage_events`）+ `prediction-access.ts`（5 mode + `consumePredictionRunQuota`）+ `scripts/prediction-invite.ts`（`rvn-*` 码） | cached 报告**绕过** gating；只有 live custom run 走登录→邀请→配额。邀请码即私域门票 |
| **市场清单数据** | `runtime-artifacts/world-cup-market-list/latest/`（113 events / 998 markets，带 slug/liquidity/volume/end_date/url） | 直接喂 classifier、hub 页、内容日历。matchId = `event_slug` |

---

## 3. 系统架构总览（数据流）

```
SOURCES (新连接器 packages/sports-data/providers/)
  football-data.org(赛程,免费10/min) · eloratings.net(国家队Elo) · clubelo.com(CC-BY)
  · the-odds-api(赔率聚合,免费500/月) · open-meteo(天气,免费) · API-Football(付费,首升)
  · StatsBomb open-data(仅离线建模,CC-BY-NC-SA) + Polymarket Gamma/CLOB(复用) + web-search(复用)
        │
        v
INGESTION  services/sports-feed/ (Fastify+BullMQ worker) → Redis热缓存(TTL) + Postgres(append-only时序)
  归一化 adapter (每源一文件,Zod parse,不可变) · entity resolution (canonical FIFA码 + alias表)
        │
        v
FEATURES  services/orchestrator/src/sports/feature-builder.ts → ModelInput
        │
        v
CLASSIFY  event-classifier.ts: PulseCandidate(998个) → EventClass + fixtureId
        │
        v
7-STAGE HARNESS (football-pulse.ts, 复用 stage-flow 骨架)
  1 resolution(typed) → 2 必要条件query → 3 evidence(web+sports-data) → 4 weighting
        │
        v
MODEL ROUTER + ENSEMBLE (核心新增)
  router.ts: EventClass×数据可用性×距开赛 → 选引擎
  统计引擎(elo/dixon-coles/tournament-mc) 给 p_stat
  → LLM 有界调整(clamp delta, 无证据归零) 给 p_llm
  → LogOP 对数意见池融合 p_stat/p_llm/p_mkt
        │
        v
  5 structured model = 调具名模型  6 bayesian update(evidence delta调prior)  7 conclusion
        │
        v
MARKET COMPARE  market-mapper.ts → edge = P_ens − P_market
  + negRisk 一致性 gate(tournament/topscorer: sum≈1) + 风控(risk.ts/runtime, Kelly 1/4)
        │
        v
REPORT  runtime-artifacts/sports/<date>/ + forecast_reports表(JSON) + PDF
        │
        v
PRODUCT  /world-cup hub(SSG) → /world-cup/[matchId] → /report → OG卡 → CTA → prediction-engine(gated run)
GROWTH   OG卡裂变 → X/Discord → 缓存报告钩子 → 社交登录 → 邀请码 → beta run → leaderboard飞轮
```

---

## 4. 模块清单

### 4.1 `packages/sports-data/`（数据接入，纯 I/O 归一化）— **新建**
- **目标：** 为 stage 3/4 提供归一化、可追溯、可缓存的足球数据。
- **怎么做：** 双层。`packages/sports-data`（`@autopoly/sports-data`，纯类型 + 归一化 + entity 解析，无副作用，web/orchestrator 共用）；`services/sports-feed`（`@autopoly/sports-feed`，Fastify+BullMQ，实际抓取/调度/写库，复用现有 Redis）。每源一个 adapter，Zod `parse()`，返回新对象不 mutate。
- **关键文件：** `packages/sports-data/src/{schema,normalize,entity}/*`、`services/sports-feed/src/{fetchers,jobs,cache}/*`、`scripts/seed-team-aliases.ts`（从 `markets.json` 抽 47 个真实 pm_triglyph 种子别名表）。
- **依赖：** `packages/db`、Redis/BullMQ。
- **关键约束（实体解析）：** Polymarket 用 ISO alpha-3（`hrv/nld/prt`），FIFA/Elo 用 IOC（`CRO/NED/POR`），**必须显式 alias 表，禁算法推断**（注意 `tur`≠`tun`、`cdr`=刚果金、`cvi`=佛得角）。slug 主客顺序是赛事内部排序、**不可假设为真实主客** → 用「无序队对 + 日期 ±1 天」join 到 fixture。未 join 的进 `sports_market_unmapped` 待人工复核。

### 4.2 `services/orchestrator/src/sports/`（编排，粘合 Pulse 与模型）— **新建**
- **目标：** 分类 → 路由 → 把模型插进 stage 5，注入足球语义。
- **关键文件：** `event-classifier.ts`（`PulseCandidate→EventClass`）、`model-router.ts` / `router.ts`（核心路由，纯查表易测）、`resolution/{match-resolution,advance-rules}.ts`（typed 结算 / best-third 规则）、`stage-specializer.ts`、`feature-builder.ts`、`football-pulse.ts`、`market-mapper.ts`、`pulse/sports-evidence.ts`（被 stage 3/4 消费）。
- **复用还是新建：** 净新；但 import stage-flow / web-search / market-pulse / risk。
- **依赖：** sports-data、sports-model、pulse。

### 4.3 `packages/sports-model/`（数学模型，纯函数可单测）— **新建**
- **目标：** 填上 stage 5 唯一真正的 gap（现状 LLM 自由写概率）。
- **关键文件：** `elo-logistic.ts`（兜底默认引擎，三路 1X2）、`group-montecarlo.ts`、`bracket-montecarlo.ts`（N≥10k，夺冠 50k）、`negrisk-normalize.ts`（多腿归一 sum=1）、`calibration.ts`（Brier/log-loss）；Phase 2：`dixon-coles.ts`（双泊松→O/U/BTTS/比分）、`props-gbm.ts`。
- **依赖：** 无（纯函数）。Monte Carlo 结果缓存 `runtime-artifacts/sports/mc/<date>/`，每日重跑，不每请求跑。

### 4.4 Product / Frontend funnel — **新建为主**
- **目标：** cached 报告 0 登录可 SEO 可分享；登录墙后移到「自己跑新 run」。
- **关键文件（MVP）：** `apps/web/app/world-cup/{page,[matchId]/page,[matchId]/report/page,[matchId]/opengraph-image}.tsx`、`apps/web/components/world-cup/{match-summary,report-view,try-it-cta}.tsx`、`apps/web/app/api/world-cup/reports/{route,[matchId]/route,[matchId]/pdf/route}.ts`、`scripts/world-cup/generate-reports.ts`（`pnpm wc:reports`，VPS 批量跑 7-stage，先跑 ~20 场热门小组赛）。
- **改现有：** `prediction-engine/page.tsx`（接 `?event=`）、`prediction-engine-demo.ts`（`DEFAULT_PREDICTION_EVENT` 换 WC 比赛）。
- **依赖：** `forecast_reports` 表、`getForecastReports`/`getForecastReport` query。
- **Later：** `/world-cup/leaderboard`、`/account`、Pro 分层。

### 4.5 Account / Quota / Report — **复用为主**
- **目标：** beta gating + 计量，全部现成。
- **怎么做：** cached 报告浏览不计费、不写 usage event；只有 custom run 走 `consumePredictionRunQuota()`。`PREDICTION_INVITE_REQUIRED=true` 开邀请门控；发码 `pnpm tsx scripts/prediction-invite.ts --max-uses 500 --label wc-beta --expires-at 2026-07-19`。
- **关键文件：** `apps/web/lib/prediction-access.ts`（原样）、`scripts/prediction-invite.ts`（原样）、`packages/db/src/migrations/0004_prediction_access.sql`（计量表原样）。
- **Pro 分层（Later）：** `app_users.metadata.jsonb` 存 `{tier:'pro'}`，`quotaForUser()` 按 tier 选不同 env key。

### 4.6 数据库迁移 — **新建**
> **合并冲突解决：** 两份稿各提了 `0005`。统一为两个迁移，避免编号撞车：
- `packages/db/src/migrations/0005_sports_data.sql` — `sports_teams/team_aliases/players/fixtures/ratings/xg/odds_snapshots/pm_snapshots/market_map/injuries/lineups/weather`（+ `pg_trgm`，append-only 时序表）。
- `packages/db/src/migrations/0006_world_cup_reports.sql` — `forecast_reports`（`match_slug` UNIQUE = event_slug、`report_json jsonb`、`yes_probability`/`ci_low`/`ci_high`/`edge`/`resolved_outcome`/`kickoff_at`/`pdf_path`）。
- Drizzle 定义追加到 `packages/db/src/schema.ts`，query 加到 `packages/db/src/queries.ts`。

---

## 5. 模型选择策略

### 路由表（EventClass → 引擎 + LLM tier）
> 引擎命名以 routing 稿 registry 为准（`elo`/`tournament_mc`/`dixon_coles`/`props_gbm`），harness 的 `stage-specializer` 适配。

| EventClass | 路由 | 统计引擎 | LLM tier | delta 上限(high/med/low pp) |
|---|---|---|---|---|
| `match_result`(1X2) >6h | `stat_plus_llm` | `elo` | `claude-sonnet-4-6` | 8/5/3 |
| `match_result` <6h(首发已出) | `stat_plus_llm`(LLM 权重升) | `elo` | `claude-sonnet-4-6` | 8/5/3 |
| `tournament_winner`/`team_advance_group`/`team_group_winner`/`continent_winner` | `stat_plus_llm` | `tournament_mc`(≥10k，夺冠 50k) | `claude-opus-4-8` | 4/2/1 |
| `player_top_scorer` | `stat_plus_llm` | `tournament_mc`(归一化排序) | `claude-sonnet-4-6` | 6/4/2 |
| `over_under`/`btts`/`score`(Phase2) | `stat_plus_llm` | `dixon_coles` | `claude-sonnet-4-6` | 6/4/2 |
| `player_prop` 样本足(Phase3) | `stat_plus_llm` | `props_gbm` | `claude-sonnet-4-6` | 10/6/3 |
| 任何 sparse / 冷门 prop / 临近<1h | `market_anchored` | — | `claude-haiku-4-5` | — |
| 足球外结构化 prop | `llm_only`(走通用 pulse 7-stage) | — | `claude-sonnet-4-6` | — |
| 事件分类/dead-rubber 打标(998 个要扫，必须便宜) | — | — | `claude-haiku-4-5` | — |

### LLM 调整边界（硬约束，服务层强制）
- LLM **不产基准概率**，只产 `deltaPp`（百分点），按上表 clamp。
- **无证据 → delta=0**（接 stage 4 evidence ledger，引用不了证据不许动数）。
- LLM 只负责统计模型结构上看不到的：伤停/停赛、首发官宣、dead-rubber 轮换、战术克制、墨西哥城 2240m 海拔/北美高温/旅行。
- 落点：`services/orchestrator/src/sports/llm/adjustment-contract.ts`，clamp 在 executor 层校验（与现有风控硬上限同级）。

### Ensemble 公式（对数意见池 LogOP，非简单加权）
```
p_ens = Π pᵢ^wᵢ / [ Π pᵢ^wᵢ + Π (1−pᵢ)^wᵢ ]   即 logit 空间加权平均后 sigmoid
```
初始权重（`config/sports/ensemble-weights.json`，回测后覆写）：

| 路由 | w_stat | w_llm | w_mkt |
|---|---|---|---|
| stat_plus_llm(>6h) | 0.45 | 0.20 | 0.35 |
| stat_plus_llm(<6h) | 0.35 | 0.30 | 0.35 |
| market_anchored | 0.15 | 0.10 | 0.75 |
| llm_only | 0 | 0.55 | 0.45 |
| 临近<1h(closing line 最 sharp) | 0.20 | 0.15 | 0.65 |

任一路缺失则其余权重重归一化。融合输出 → `pulse-entry-planner.ts` 的 `aiProb`。

### 校准指标（回测目标，`runtime-artifacts/sports/backtests/<date>/`）
| 指标 | 目标 | 备注 |
|---|---|---|
| Brier（单场 1X2） | **< 0.20**（0.19 接近市场） | 纯随机三选一≈0.22 |
| Brier（O/U 二元） | < 0.21 | |
| Log loss（二元） | < 0.62 | 盲猜 0.693 |
| ECE | **< 0.05** | reliability diagram 10 桶；偏离则 Platt/isotonic 后处理 |
| CLV vs Pinnacle | 平均 **> +1.5%**，beat-close **> 52%** | 长期盈利最强先行指标 |
| **铁律** | 融合必须严格优于任一单路 | 否则 ensemble 无价值 / 有 bug |
- 回测 harness `sports/eval/backtest.ts`：用 `football-data.co.uk` 历史赔率+赛果，**时间切割严防泄漏**（每场只用 kickoff 前数据），网格搜索权重最小化验证集 log loss 写回 config。

### Model Registry
`config/sports/model-registry.json`（zod 校验，加载器 `sports/registry.ts`）。真实 model id：`claude-opus-4-8`（夺冠/多因素）/`claude-sonnet-4-6`（主力单场/prop）/`claude-haiku-4-5`（分类/打标/dead-rubber）。统计引擎全免费/纯算力，是承重墙。

---

## 6. 产品与增长

**Funnel（cached 报告 0 登录，登录墙后移）：**
| # | 阶段 | Route | gating |
|---|---|---|---|
| 1 | 匿名落地（搜索/OG 卡转发） | `/world-cup`、`/world-cup/[matchId]`（SSG） | 无 |
| 2 | 浏览缓存报告（P/CI/模型拆解/edge） | `/world-cup/[matchId]/report` | 无 |
| 3 | "自己跑一个" CTA | `<TryItCta>` → `/prediction-engine?event=<slug>` | 此处开始 gate |
| 4 | 社交登录 | NextAuth → `/sign-in?next=` | unauthenticated |
| 5 | 邀请激活 | `/invite` + `POST /api/invite/accept` | pending_invite |
| 6 | beta 配额 run | `POST /api/prediction-engine/run` | 5/日 50/月 1 并发 |
| 7 | 留存/转化(Later) | `/account` + 429 upsell | tier |

**cached-report 机制：** DB 为主（`forecast_reports`，build 时一次查全量、ISR 按 slug 查单条、leaderboard 用 SQL 聚合）+ `runtime-artifacts/world-cup/reports/<slug>/` 副本（JSON+PDF）。**不上 CDN**（113 报告 <50MB，过早优化）。预生成 `scripts/world-cup/generate-reports.ts` 在 VPS 跑真实 7-stage，**不在 Vercel build 跑**。

**Tiers（落现有 env，MVP 同档）：**
| Tier | gating | daily/monthly/concurrent |
|---|---|---|
| Anonymous | 无登录 | cached 无限看，run=0 |
| Free Beta | 邀请码 | 5 / 50 / 1（现有默认） |
| Pro(Later) | invite+metadata.tier | 按 env 分档 |
| Admin | `PREDICTION_ADMIN_EMAILS` | bypass |

**Beta hosting：** Web→Vercel（cached SSG/ISR + OG edge + run route 作 proxy）；Forecast worker / live run backend / chromium PDF→**VPS**（现有 orchestrator host，`PREDICTION_ENGINE_VPS_URL`）；PG/Redis 现有。**Vercel 不跑 chromium、不跑长任务、不下真单。**

**增长循环（4 环互喂）：** ① OG 预测卡（`next/og` `ImageResponse`，比赛/我们P/市场P/edge/@handle）= 传播环；② 邀请码裂变（`rvn-*`，KOL `--max-uses 5`、爆款帖限量 `--max-uses 50 --expires-at`）；③ 「回复/私信发缓存报告」= 线索捕获→社交登录→发码；④ **公开 leaderboard 记分牌 = 可信度飞轮**（最重要，每条预测帖回链）。

---

## 7. 营销与私域

**渠道定位（单向漏斗 EN/CN X → Website → Discord）：**
| 渠道 | 定位 | 节奏 |
|---|---|---|
| **EN X** | Polymarket/Kalshi 圈、xG 数据派、crypto 量化；钩子="where's the edge + 公开校准" | 比赛日 3–5 条，非赛日 1–2；赛前 T-8h 卡、赛后 T+1h 复盘 |
| **CN X / 私域** | 复用存量 followers + 技术围观；钩子="AI 把推理全摊开 + 记分牌 + 内测名额" | 比赛日 2–3 条；EN 二创非翻译；独有"AI agent 怎么干活"幕后 |
| **Website** | 承接 + 可信度沉淀（demo + leaderboard） | 不日更，每场后更 leaderboard |
| **Discord** | 私域/留存；`#announcements`/`#daily-forecasts`/`#leaderboard`/`#request-a-report`/`#beta`/`#general` | 机器人自动播报 + 人工每天露面 1 次 |

**40 天内容日历（贴赛程）：** 每场 = 赛前 T-8h 预测卡（素材 `markets.csv` 的 `match_moneyline`）+ 赛后 T+1h 复盘记分（**输错照发=可信度**）；每 3 天累计 Brier 线程（飞轮，风雨无阻）；每周 1 次"7 阶段全摊开"深度帖 EN/CN；prop 长线 call（夺冠 48 腿/金靴 140，持续更新概率漂移）。
- **W1(6/9–6/15)** 揭幕周：揭幕战 `fifwc-mex-rsa-2026-06-11`、`fifwc-kr-cze` 建基线，铺记分牌底座。
- **W2–W3(6/16–6/27)** 小组赛收尾：`fifwc-bra-mar`/`fifwc-arg-alg`/`fifwc-fra-sen`/`fifwc-esp-ksa`，流量峰值，抓反共识冷门。
- **W4–W6(6/28–7/19)** 淘汰赛：每场高制作深度帖，决赛收官 + Brier 总结。

**分工 human vs agent：** Agent 自主——出赛前/赛后帖草稿(EN+CN)、生成 OG 卡、定时 Discord 播报、维护记分牌 JSON + 重算 Brier、FAQ 自动答、配额异常报警。Human 必管——发布键/语气定稿（尤其"我们错了"复盘）、KOL 关系、预算决策、邀请码发放策略、任何真钱动作。

**Week-1 上线清单：**
- D0(6/9)：EN/CN X bio（定位 + landing + "transparent/Brier-scored/18+"）；建 Discord 6 频道 + Rules Screening。
- D1(6/10)：`DEFAULT_PREDICTION_EVENT` 换 WC 比赛；为 2–3 场跑 `pulse-decision-report.ts` 存好 PDF；确认线上 NextAuth 可登；发首批码 `--max-uses 50 --label wc-week1`。
- D2(6/11)：揭幕战预测卡（手动出图也行）+ 置顶"我们是谁/怎么记分"；CN 二创"私信发完整报告"；Discord 同步。
- D3–D7：跑通 ≥3 场全链路（赛前卡→复盘→记分）；验证一次完整漏斗（私信要报告→发 PDF→登录→发码→激活→成功跑一次 run）；上线 `/world-cup/leaderboard` 哪怕 3 条。
- **不做：** OG 自动渲染打磨、付费分层、复杂机器人、投放。能手动先手动。

**KPI：**
| 阶段 | 北极星 | 获客 | 私域 | 可信度 |
|---|---|---|---|---|
| Launch W1 | 闭环跑通 | EN+CN ≥300 关注，首帖 ≥20 转 | Discord ≥50，≥10 报告发出 | 记分牌上线，≥10 条已结算 |
| Scale W2–3 | 走量+记分斜率 | ≥1,500 关注，≥1 条 ≥100 转爆帖 | Discord ≥250，beta ≥40 | ≥60 条，**Brier<0.25** |
| Knockout W4–6 | 留存+付费验证 | ≥4,000 关注 | Discord ≥600，beta ≥150，首批付费 ≥10 | ≥120 条，**vs Polymarket edge 为正** |

健康度：报告→登录 ≥30%，登录→激活 ≥50%，beta 周活 ≥40%，预测准时率 ≥90%。**唯一不可妥协：Brier 公开且不造假。**

---

## 8. 合规与风险

**最高风险 3 项（上线前必处理）：**
| # | 风险 | 证据 | 动作 |
|---|---|---|---|
| **R1** | 全站品牌="Trading Agent" | `apps/web/app/layout.tsx:7-20` title/OG 写死 "AutoPoly — Autonomous Polymarket Trading Agent / trading on Polymarket"（已核实） | WC 子产品**独立 metadata**，定位 probability research，去掉 "trading agent/下注/包赢" |
| **R2** | US×Polymarket 已实测被封 | `run-error/2026-06-07T043859Z-satoshi-geo-live-check/summary.md`：真实 `/order` 返回 `403 Trading restricted in your region` | 产品**不内嵌下单、不给美国流量 Polymarket 充值/下注链接**，只展示概率与 edge |
| **R3** | 零 disclaimer + 中国渠道刑事敏感 | 全仓无任何免责字样，无 `/privacy`/`/terms` | 上线前必须有 disclaimer 体系；中文渠道**绝不**用赌/博彩/稳赚/必中 |

**Do say：** 概率估计 / 80% 可信区间 / edge / 方法论 / 研究教育 / "Forecasts are probabilities, not certainties" / "Not financial or betting advice. 18+." / "我们不接受也不撮合任何投注"。
**Don't say：** 稳赚/必中/包赢/锁单/回血/guaranteed/lock / 今日推荐/荐单/跟单/tips/picks / 下注/押/赌 / bookmaker 或 Polymarket 充值或 affiliate 链接 / "帮你交易/自动替你下单" / profit share。

**必须出现的免责声明（集中到 `apps/web/lib/legal-copy.ts`，导出 `DISCLAIMER_SHORT/FULL` 中英文）：**
> 本工具提供基于公开数据的**概率估计与研究分析**，**不构成任何金融、投资或投注建议**。所有预测均为**概率而非确定性结果**；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 **18 岁**。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。

**落点：** 全站页脚（新建 `components/site-footer.tsx` 挂 `layout.tsx`）、`prediction-engine/page.tsx` 结果区常驻、`pulse-decision-report.ts` 每页印、`api/prediction-engine/run/route.ts` 响应加 `disclaimer` 字段、新建 `app/terms/page.tsx` + `app/privacy/page.tsx`、X bio、Discord `#rules`（入群勾选同意，记录到 `app_users.metadata`）。

**法域约束：** US→不暗示 Polymarket，要指平台只指 Kalshi（CFTC 注册 DCM）且仅作信息、不做 affiliate；CN→只谈方法论/概率/数据，禁博彩词；全球→统一 research 口径。**数据源合规：** 优先 licensed API（the-odds-api / API-Football / football-data.org）；FBref/Understat/Sofascore/StatsBomb 仅离线建模、缓存不再分发、不进生产实时管道。**变现：** Stripe 商品描述用 "probability research & analytics"，绝不出现 bet/tips/picks；不做 profit share；先做 Web 订阅绕开商店赌博审核。**隐私：** `event_text` 含用户自由输入 = PII，需保留期 + 删除路径 + 隐私政策。

---

## 9. 40 天分阶段路线图

### Phase 0 — 本周最小可上线 MVP（6/9–6/11，**目标：揭幕日有产出**）
- **交付物：** `0006_world_cup_reports.sql` + `getForecastReports/getForecastReport` query；`scripts/world-cup/generate-reports.ts`（先 ~20 场热门小组赛）；`/world-cup` hub + `[matchId]` + `/report`（SSG）；OG image；PDF serve route；`?event=` 接缝 + `DEFAULT_PREDICTION_EVENT` 换 WC；**合规最小集**（`legal-copy.ts` + `site-footer.tsx` + 独立 metadata + `/terms` + `/privacy` + 同意勾选）；beta 码 `--max-uses 500`。MVP 报告先只显示 LLM + market 两源（stat 模型 Phase 1 接入）。
- **负责人：** Frontend/合规路由 = **agent**（明确范围）；揭幕日发布键/语气 + 邀请码策略 = **human**。

### Phase 1 — 小组赛走量（6/11–6/27，绑小组赛）
- **交付物：** `packages/sports-data` + `services/sports-feed`（免费栈：football-data.org / eloratings / clubelo / the-odds-api / open-meteo / Polymarket）+ `0005_sports_data.sql` + `seed-team-aliases.ts`；`packages/sports-model` 的 `elo-logistic` + `group-montecarlo` + `bracket-montecarlo` + `negrisk-normalize`；`sports/` 编排（classifier/router/football-pulse/market-mapper）；三模型拆解卡接真实 stat；回测 harness 跑出初始权重；leaderboard 接 `resolved_outcome` 回填。NOW 池 ~450 市场全覆盖。
- **负责人：** sports-data/model/harness = **agent**（纯函数可单测，适合自动）；API-Football/Pinnacle 是否付费 = **human 拍板**。

### Phase 2 — 小组赛收尾→淘汰赛（6/28–7/8，绑 R32/R16）
- **交付物：** `dixon-coles.ts` 双泊松上线 → O/U 2.5 / BTTS / 比分进 NOW 池；校准达标（Brier<0.20，ECE<0.05）；CLV vs Pinnacle 评估（若付费接入）；淘汰赛 bracket 每日重跑；`/account` 用量页。
- **负责人：** 模型/校准 = **agent**；付费数据决策 = **human**。

### Phase 3 — 淘汰赛深水区→决赛（7/9–7/19，绑 QF/SF/Final）
- **交付物：** `props-gbm`（若样本足，否则市场锚定）；Pro 付费分层（`metadata.tier`）；决赛全程深度报告 + Brier 总结作对外引用资产；首批付费验证。
- **负责人：** 付费分层 + Stripe 措辞 = **human**；模型/内容 = **agent**。

---

## 10. 人类 review 入口 + Open Questions

**最该先看的 6 个文件/决策：**
1. `apps/web/app/layout.tsx:7-20` — R1 "Trading Agent" metadata，确认 WC 子产品用独立 metadata（合规第一优先）。
2. `run-error/2026-06-07T043859Z-satoshi-geo-live-check/summary.md` — R2 实测 `403`，确认产品不内嵌下单的决策。
3. `services/orchestrator/src/pulse/stage-flow.ts`（stage 5/6 gap 描述）+ `services/orchestrator/src/sports/router.ts`（待建路由表）— 确认模型层正补这两处 gap、且"数据薄让位市场"纪律到位。
4. `services/orchestrator/src/sports/llm/adjustment-contract.ts`（待建）— delta clamp + "无证据归零"是否在服务层强制。
5. `runtime-artifacts/world-cup-market-list/latest/metadata.json` — subtype 计数（113/998/72/41），确认 taxonomy 与真实市场对齐 + NOW 池 ~450 的取舍。
6. `apps/web/lib/prediction-access.ts:167-169`（配额 5/50/1）+ `scripts/prediction-invite.ts` — 确认 beta gating 与发码策略。

**需要用户拍板的 Open Questions（编号）：**
1. **是否付费接 API-Football（$25–39/mo，实时阵容/伤停/比分）与 Pinnacle 收盘赔率？** CLV 评估强依赖 Pinnacle；不付费可用 football-data.org + eloratings + Polymarket 先跑通 Phase 0/1。
2. **是否引入 Python sidecar 跑 LightGBM（props_gbm）？** 否则 props 先用纯 TS 逻辑回归起步（Phase 3 才需要，可暂缓）。
3. **MVP 报告范围：~20 场热门小组赛 vs 全 72 场 game events？** 建议先 20 场抢揭幕流量，全覆盖后置。
4. **是否在揭幕日(6/11)前完成合规最小集？** 这是硬阻塞——R1/R3 未处理则不应对外发任何带品牌的内容。
5. **Discord/X 账号谁来注册与持有？** 涉及私域所有权与发布键归属，需人确认。
6. **leaderboard 数据源 MVP 用手动 JSON 还是直接接 `forecast_reports.resolved_outcome`？** 影响 W1 能否准时上线（手动 JSON 更快但需后续迁移）。
7. **变现时点：** 40 天内是否真要上 Stripe 订阅，还是 beta 全程免费、决赛后再说？影响 Phase 3 是否投入付费分层。

---

## 11. 对标 Kimi（已读两份参考 PDF）

> 来源：《Kimi 将公开预测 104 场世界杯赛事：德国队或爆冷夺冠》（方法论文章，月之暗面 2026-06-08）+《Kimi 关于 2026 年世界杯赛事分析和预测报告（专业修订版）》（224 页，v1.0，编制 2026-06-05）。
> **一句话结论：我们的设计与 Kimi 的方法几乎完全一致——这是强验证，不是抄袭。** Kimi 用的正是 Elo/FIFA + Poisson/Dixon-Coles/Bivariate Poisson + xG/xT + Monte Carlo + 贝叶斯动态更新 + 市场偏差，与本计划 §5 独立得出的栈一一对应。Kimi 还白送了我们一批可直接用的起始参数和一套堪称模板的合规话术。

### 11.1 方法论逐项对照

| 维度 | Kimi 做法 | 我们的对应 | 行动 |
|---|---|---|---|
| 整体范式 | 300 个子 Agent × 20 维度并行，层级化(strategy/tactical/execution) + Queen-led Swarm + 拜占庭 2/3 多数 | 7 阶段 harness + model-router + ensemble；每事件路由少量 agent，**持续运行而非一次性** | 我们不堆 300 agent（成本），靠"统计引擎承重 + LLM 有界调整"达到同等严谨、单场成本低一个量级 |
| 模型栈 | 20–22 异质模型：3 评级(Elo/FIFA SUM/538 SPI) + 4 进球(Poisson/Dixon-Coles/Bivariate/ZIGP) + 2 过程(xG/xT) + 2 ML(CatBoost/RF) + 11 情境 | §5 路由表：`elo`/`dixon_coles`/`tournament_mc`/`props_gbm` + LLM 情境调整 | **采用 Kimi 的"多样性优先"理念**；MVP 先 Elo+MC，Phase 2 补 Dixon-Coles，情境因子由 LLM 有界调整承担（不必拆成 11 个模型） |
| **起始参数（直接抄）** | xG 增强 `α=0.7`(λ=0.7·xG+0.3·G)；Dixon-Coles `ξ=0.0065`(半衰期 2 年)/`ρ=-0.05`；Elo `K=60, s=600`；HOME_ADV 按场馆(墨西哥城 1.25 / 温哥华 1.05) | `packages/sports-model/*` 的默认参数 | **直接用作初值**，省掉一轮调参；回测后再覆写 `config/sports/ensemble-weights.json` |
| 数据分层/优先级 | 7 层(L1 结果/L2 评级/L3 Opta-StatsBomb 事件/L4 追踪/L5 市场/L6 Transfermarkt/L7 环境)；优先级 P0 近期国家队(30%)>P1 俱乐部 xG/xT(25%)>P2 Elo(15%)>P3 市场(15%)>P4 历史(10%)>P5 估值(5%) | §4.1 `packages/sports-data` 归一化 schema | **采用这套优先级权重**作为 `feature-builder` 的默认数据权重；国家队样本少→用俱乐部 xG 按出场时间加权作代理（Kimi 同款解法） |
| 数据质量门 | Data Availability Quadruple-Check(来源/粒度/样本量/时效) + 三级 QC(完整性>30%缺失降级 / 一致性 / 时序 no-look-ahead walk-forward) | 目前缺 | **新增 `sports-data/quality/` 实现这两道门**，正好补我们 stage 3/4 的可审计性 |
| Monte Carlo | 最少 10 万次迭代(1 万为门槛)，SE<0.5%；base/bull/bear 三情景并行 | §4.3 `bracket-montecarlo`(我们写 ≥10k，夺冠 50k) | **上调到 10 万次**(夺冠/出线，离线每日跑)；**采纳三情景(乐观/基准/悲观)输出**——这正好是报告里最好看的部分 |
| 融合 | 线性池 `P=Σwᵢ·Pᵢ`，权重按"近期验证准确率 × 情境适配 × 模型间协方差(降相关模型权重)"动态调 | §5 我们用对数意见池 LogOP | **保留 LogOP**(对概率更稳健)，但**吸收 Kimi 的"降低高相关模型权重"**思想到权重设定 |
| 市场角色 | **市场赔率 = "共识偏差研究变量"，不作预测直接依据**(白纸黑字) | §5 把 `p_mkt` 进 ensemble + §6 "edge vs Polymarket" | ⚠️**关键张力见 11.3**：Kimi 的措辞是我们的合规护身符，但我们产品卖点是 edge。解法：对外一律称"模型 vs 市场的偏差信号 / research signal"，不称"投注 edge" |
| 校准/回测 | 2002–2022 五届世界杯 + 2024 欧洲杯/美洲杯；walk-forward + CPCV；准确率自报 1X2 60–65%、出线 85–95%、夺冠以分布呈现(上限~25%) | §5 Brier/log-loss/ECE/CLV + 回测 harness | **采纳其准确率分层**作我们对外的诚实预期；**置信度三档(高 85–90% / 中 55–65% / 低≈随机)**直接用于报告与记分牌 |

### 11.2 报告格式对标（直接决定我们的 per-match 报告 UX）

Kimi 每支球队/每场的输出结构非常清晰，**我们的 cached 报告应镜像它**（`prediction-engine-demo.ts` 的 evidence/model/updates 已经接近）：

1. **基础实力画像**（Elo / FIFA 排名 / 近 3 年战绩）
2. **阵容深度评估**（QDR 指数：Quality-Depth-Reliability）
3. **核心球员依赖度**（xG 贡献占比 / 伤停风险 / 战术不可替代性）
4. **战术体系与相克分析**
5. **乐观 Agent 论证**（夺冠/取胜路径）← 对应我们的 `support` 证据
6. **悲观 Agent 论证**（出局/失利触发条件）← 对应我们的 `oppose` 证据
7. **模型综合输出**：情景概率表（乐观 / 基准 / 悲观 / **市场隐含** 四行 × 概率区间 × 置信度）+ Monte Carlo 路径表

> **我们要加的、Kimi 没有的两栏**：① **edge = 我们 P − Polymarket P**（作 research signal）；② **该预测在公开 Brier 记分牌上的历史命中**。这两栏是我们相对一份静态 PDF 的核心差异化。
> **IP 红线**：镜像"结构"，**不得复制其文字/表格/224 页内容**；我们的数字必须自产。

### 11.3 竞争与协同定位（最重要的战略结论）

**Kimi 是什么：** 巨头一次性发布的 224 页静态报告（6/5 截稿、6/8 公布预测）+ 自有 App 巨大流量 + 1 万亿 Token 瓜分活动 + 为足球公益捐 Token + 真实目的是推 **Kimi Work** 客户端。分发碾压，但产品形态是**静态报告**。

**我们是什么：** 小团队，但做的是 Kimi 没做的**实时、持续、可交互产品**。

| 维度 | Kimi | 我们（差异化） |
|---|---|---|
| 形态 | 静态 PDF（发布即定格） | **持续更新**：阵容/赔率变动后重算 per-match 报告 |
| 市场 | 仅作"研究变量"提一句 | **产品化模型 vs Polymarket 实时偏差**（research signal） |
| 交互 | 只读 | **用户可对任意事件自己跑一次**（`/prediction-engine?event=`） |
| 可信度 | 报告内自述 + 赛后复盘 | **公开实时 Brier 记分牌**（输了照记，飞轮） |
| 留存 | 无（看完即走） | **私域社区**（Discord + 邀请码） |

**协同打法——骑 Kimi 的浪：** Kimi 在文章里**明确"真诚邀请其他 AI 模型参与公开预测"**。这是现成的入场券：
- 定位一句话：**"一个独立 AI 超级预测器，应 Kimi 之邀公开应战——同台、对市场、对 Kimi，全部公开记分。"**
- 王牌内容角度：**三方对照记分牌**——我们 P vs Kimi 公布的 P vs Polymarket 市场 P，逐场结算 Brier，看谁更准。这是天然的、自带话题的获客内容。
- 现成钩子：Kimi 头条是"**德国队被低估，+3.6pp**"（模型 11.3% vs 市场 7.4%）。我们独立跑一遍德国夺冠概率，**公开赞同或反驳**，就是第一条爆款帖。
- **红线**：不得自称是 Kimi 或与其关联；不得转载其报告；对照其公开数字时注明出处。

### 11.4 对其余章节的修订（落到行动）

- §5：`packages/sports-model` 默认参数改用 Kimi 起始值（α=0.7 / ξ=0.0065 / ρ=-0.05 / K=60 / s=600 / 场馆级 HOME_ADV）；MC 迭代上调到 10 万；输出加 base/bull/bear 三情景。
- §4.1：`feature-builder` 默认数据权重采用 P0–P5（30/25/15/15/10/5）；新增 `sports-data/quality/`（四问校验 + 三级 QC + walk-forward 防泄漏）。
- §6 报告 UX：按 11.2 七段式 + 情景表重构 `report-view`；加 edge 与 Brier 两栏。
- §8 合规：**直接采用 Kimi 话术**——市场数据统一称"共识偏差研究变量"；中性表述"模型输出显示/历史数据表明"；明令禁用"推荐/稳胆/必中"；所有概率带置信区间；本计划 §8 的 disclaimer 与 Kimi 风险提示一致，可对齐措辞。
- §7 营销：新增"三方对照记分牌"内容支柱 + "回应德国队 +3.6pp"首发帖。
- §10 Open Questions 新增：**Q8 — 是否在记分牌公开追踪 Kimi 的预测做三方对照？**（建议做，是最强差异化内容，但需注明数据出处、避免关联声明）。
