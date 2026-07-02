# Agent Handoff — 当前状态 + 待办

> **每次接手项目都先看这份。** 这是 predict-raven 的"会话间共享笔记本"——上一个 agent 干到哪、当前重点是什么、下一步该做啥，都记在这里。
>
> **更新时机**：
> - 每次会话 wrap-up 时（agent 自己更新）
> - 用户说"记一下" / "save this" / "update handoff" 时（agent 立刻更新）
> - 完成 P0 / P1 任务后（marking done + 加新条目）
>
> **更新原则**：保持精简 + actionable，**不是流水账**。具体细节去看 git log / `docs/internal/review/`。
>
> 英文版：[`docs/en/agent-handoff.md`](en/agent-handoff.md)
>
> 最后更新：2026-07-03 by Claude（**Forecast API + MCP 服务上线 GCP 东京 VM**，分支 `claude/bold-shamir-7903ab`，PR #65）。
> 用户指令：把 forecasting agent 抽象成任何人可调用的 hosted API（答案 = 事件概率 + 分析思路 + 证据），交付 PDF + 纯文字两种形态，托管在 Google VPS，并做成 MCP。
> ① **新服务 `services/forecast-api`**（raw node:http 零框架，~10 个小文件）：`POST /v1/forecasts {question}` spawn 现有引擎（与 apps/raven run-manager 同款接缝：`tsx scripts/forecast/cli.ts` + 读 state.json）；`GET /v1/forecasts/:id` = JSON、`/text` = 纯文字、`/pdf` = A4 档案（headless Chromium，pulse-decision-report 同管线，按 state 版本缓存于事件目录 answer.pdf）；`POST /mcp` = 无状态 streamable-HTTP MCP（工具 forecast_start/forecast_status/forecast_result）。token 门（Bearer/x-api-key/?token=，`FORECAST_API_TOKEN` 空值回落 `RAVEN_ACCESS_TOKEN`）；并发 run 上限默认 2（429）；**内部 credibleInterval 全表面不出现**（含 jobLogTail 消毒）。vitest 22/22 + typecheck 绿。
> ② **对抗式评审后加固**（4 lens × 逐条验证）：空 token 回落用 `||`；跨容器状态判定按 recency（旧 error job 不再压住新完成的 state）；PDF 缓存 utimesSync 回写 state 版本防竞态；spawn 前 `.engine-lock` 盖住 framing 窗口防双跑；同问题重发不吃 429；MCP 链接按 Host 派生；错误日志脱敏 ?token=。
> ③ **部署**：deploy/raven compose 加第二个服务共享镜像 `raven-suite` + artifacts 卷（API 发起的 run 网页也能看到）；Dockerfile 预烤 playwright chromium 层；服务器 override 绑 `0.0.0.0:8787`；GCP 防火墙规则 `allow-forecast-api`（tcp:8787，tag `forecast-api` 已加到实例）。**API base = http://34.85.97.32:8787**，token 在 VM `~/predict-raven/deploy/raven/.env` 的 `FORECAST_API_TOKEN`（对话中出现过，视为已泄漏，介意就轮换）。MCP 接入：`claude mcp add --transport http raven-forecast http://34.85.97.32:8787/mcp --header "Authorization: Bearer <token>"`。
> ④ **部署方式踩坑**：VM `~/predict-raven` 不是 git repo（tar 部署）。**不能覆盖式解包**——旧树是 feat 分支产物，残留 main 没有的文件会混进 Docker build context 导致构建失败；正确姿势 = mv 旧树备份 → 干净解包 → 只回拷 `.env` + `docker-compose.override.yml`（备份留在 `~/predict-raven.pre-forecast-api.bak`）。
> ⑤ 公网验收：healthz/401/MCP 握手/真实 claude run（BTC $200k before 2027 题）全过；无 TLS（同 raven，有域名后再上 Caddy）。README（CN/EN）已写 API+MCP 用法与公网暴露注意。**待办**：英文版 handoff 此条待同步翻译；`.engine-lock` 只在 API 侧写（raven app 侧 framing 窗口仍有小概率双跑）。
>
> 最后更新：2026-07-02 by Claude（**Forecast prompt 评审落地：prompt 只引导思考、harness 保证正确性**，分支 `claude/unruffled-jang-622f35`）。
> 背景：用户要求 review「一次跑 3 个市场推荐」流程的全部 prompt（评审文档 [`docs/internal/review/2026-06-17-forecast-prompt-review.md`](internal/review/2026-06-17-forecast-prompt-review.md) + 文风方案 [`docs/internal/forecast-house-style.md`](internal/forecast-house-style.md)），随后指示「把改动都实现，prompt 主要用作引导思考，harness 确保正确实现，去掉对 forecasting 有负面影响的限制，合并 main」。
> ① **确定性闸门（真钱安全）**：`pulse-entry-planner.ts` 新增 `assessPulseReportParseability`/`PULSE_NO_TRADE_MARKER`（导出 `parseRecommendationSections`），`full-pulse.ts` 渲染后 fail-closed 校验——market-scan 报告 0 个 entry-ready 章节且无 `NO-TRADE` 标记→直接抛错（此前概率表解析失败会 `aiProb=marketProb`→edge 0→**静默零交易**）；position-review 降级为响亮警告。5 个新单测。
> ② **4 个 full-pulse prompt 变体重写**：告知模型 harness 真相（「你的概率是唯一进入交易的数字，代码层重算 Kelly」）；方法论/量化参数降级为「默认值，可写明理由偏离」；删「默认只用已给上下文/极少量补充核验」→ 鼓励自主补充检索；强制章节清单缩减为「程序接口」（链接/方向/概率表/置信度/建议仓位/流动性上限/推理逻辑——即 entry-planner 正则实际解析的字段）+ 校准优先的写法要点（结论先行+区间同句、每句硬信息、kill condition、「简洁≠自信,禁止为行文收窄区间」）；Top 3 改「最多 3 个，不凑数，可 NO-TRADE」。
> ③ **SKILL.md（vendored zh）**：7 步「不可跳过」→推荐脚手架；贝叶斯更新幅度/edge 分档/排序公式→默认值可偏离；No 扫描配额→先验提醒；保留认知红线（A0 结算源查验/A1.5 溯源）+ 风控硬门槛（流动性 $5k）。⚠️ **上游 repo `Alchemist-X/polymarket-market-pulse` 需同步此改动**，否则 `pnpm vendor:sync` 会覆盖回旧版。
> ④ **C 端 api-driver prompt**：去黑话（显式禁「节点/贝叶斯/置信区间/先验/后验/edge」）+ 决策优先（首行初步判断、末行最终概率+区间）+ 校准（禁为语气收窄区间）；prescreen SKIP 判据删「already efficiently priced」先验。
> ⑤ **DeepSeek A/B 实证**（`.env.deepseek` key 在 amazing-mcnulty worktree）：同一 fixture，旧 scan prompt 输出 **0 行可解析概率**（概率写成 0.62 小数+「做多 Yes」→交易正则全 miss，静默零交易实锤）；新 prompt **4/4 行全解析** + 文风达标（首句方向+概率+区间、证据带来源日期、显式 kill condition）。C 端：旧 prompt 冒「贝叶斯」+点估计；新 prompt 零黑话+末行区间 55%–80%。
> 验证：orchestrator typecheck 绿、全量 vitest 874/877（3 个失败是 main 上既有的 provider-runtime 测试，与本次无关，已 spawn task）、`pnpm --filter @autopoly/web exec next build` 绿。**待办**：house-style 方案第 4/5 步（few-shot 反向校准示例、离线 grep eval）未做;上游 SKILL.md 同步;两份新文档英文版待同步翻译。英文版 handoff 此条待同步翻译。
>
> 最后更新：2026-07-02 by Claude（**Raven Forecasting Engine 网页 app 全量落地**，分支 `claude/amazing-mcnulty-5c3fca`（基于 `feat/iterative-forecaster`），PR 目标 = `feat/iterative-forecaster`）。
> 按 claude.design 交付稿（Ask → Research → Verdict 三屏，暖棕 #15120c/#ee7130 + Newsreader/IBM Plex Mono）新建 `apps/raven`（端口 3200，`pnpm raven:dev`）：01 提问并起跑真实引擎；02 直播研究过程——证据卡手绘 KEEP/DOUBT 圈注 + 行内笔记 + 分析师假设队列（**真的会注入引擎下一轮 prompt**，消费后打 `consumedRound`/`doubtsHandled` 戳）；03 决策优先档案页（大数字 + 收敛轴 + 置信表 + 三核心信号 + 反向信号 + 带 [NN] 彩色锚点的叙事摘要 + 编号证据书 + 折叠 framing）。GTA6 demo 档案逐字移植（id `gta6-demo`）。
> 引擎侧（`scripts/forecast/`）：`agent.ts` provider 分发（`FORECAST_PROVIDER=claude|deepseek`）；DeepSeek 适配器（OpenAI 兼容、无搜索，伪造引用守卫降级为**引用存活检查**，403/429 反爬拒绝算活）；证据新增 source_type/credibility；summary 新增 why_sentence/quip/[NN] 引用；`FORECAST_MIN_ROUNDS`（app 设 2，防对冲轮 1 假收敛）；resume 无轮可跑不再卡 `open`。测试 62/62 绿；`pnpm --filter @autopoly/raven build` 绿；桌面+375px 移动、dark+light 截图自评通过、0 console error。
> **DeepSeek 测试 key 在 repo 根 `.env.deepseek`（gitignored）**——key 在对话中出现过，按惯例视为已泄漏、建议轮换。run-manager 会自动从该文件回填子进程 env。E2E 已实测：GPT-6 问题 45%→25% 两轮 + 分析师假设被 round 1 消费。英文版 handoff 此条待同步翻译。
> **补充（同日晚）**：① claude provider 解除 API key 硬依赖——支持订阅 token（`claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`），已用订阅无头跑通完整 run（Switch 2 问题，4 源全验真，62%→65.5%）；② 全站邀请 token 门（`apps/raven/proxy.ts`，`RAVEN_ACCESS_TOKEN`）；③ `deploy/raven/` Docker 套件（CN/EN runbook）；④ **已正式部署**到用户 GCP 东京实例 `instance-tokyo-0701-predict-raven`（asia-northeast1-b，`http://34.85.97.32`，80 端口走防火墙规则 `allow-raven-http`/tag `raven-http`）；服务器代码在 `~/predict-raven`，env 在 `deploy/raven/.env`，公网验收（门/`?token=`/API/demo 档案/真 run）全通过。无 TLS（裸 IP），后续给域名再上 Caddy。⑤ 用户订阅 token 已装上服务器、provider 已切 **claude**，线上联网研究实测通过（可折叠 iPhone：13 源全验真 → 82%，对照 deepseek 同题 0 源）。⑥ **全部已合 main（PR #55）**。
> **下一步 P1 = [issue #56](https://github.com/Alchemist-X/predict-raven/issues/56)（用户 2026-07-02 定）**：把 forecasting engine 抽象为独立包 `packages/forecast-engine`——输入任意事件，输出①概率(+判词；**区间只留内部**，用户 2026-07-02 决定校准前不对外提及置信区间) ②分析思路(framing/先验/逐轮 why-changed/summary) ③证据清单(验真+±pp 归因)。方法论保持现有定义不动（贝叶斯逐源归因/审计/簇折扣/验真钳制/disconfirmation/reflection/analyst 钩子），Store 与 provider 可插拔，`scripts/forecast` 留薄壳兼容，raven app 和 CLI 改为消费该包。
>
> 最后更新：2026-06-29 by Claude（新增 **FIFA 八模型预测引擎** `packages/fifa-models`，基于用户给的 Manus《FIFA 淘汰赛预测模型技术报告》；**改动未提交**，working tree）。要点：
> ① **引擎已建好 + 验证**：TS 包 `@autopoly/fifa-models` 复用 `@autopoly/sports-model` 实现报告 8 个模型（Dixon-Coles 贝叶斯 / xG-Elo / PRODEGY / 疲劳 Elo / 战术 mElo / 线穿 GBM / 传球网 RF / 堆叠集成）+ 第 9 个「多校准 8 合 1」forecaster（MCBoost，±12pp 锚定共识防翻盘——合成冒烟时发现 MCBoost 会把 86% 大热门翻成平局，已加 bound 修掉）。`tsc` 绿、`vitest` 79/79、合成数据端到端冒烟通过（9 forecasters × 16 R32 → 归档 + 榜）。入口：[`orchestrator.ts`](../packages/fifa-models/src/orchestrator.ts) / [`cli/forecast.ts`](../packages/fifa-models/src/cli/forecast.ts) / [`extract/fifa_extract.py`](../packages/fifa-models/extract/fifa_extract.py)。
> ② **目标 = 2026 实盘盲测**（用户定，非 2022 回测）：训练用 72 场已公开小组赛 FIFA PMSR PDF，预测 16 场 32 强（封盘后已定、未开打），逐场出结果再打分。9 个 forecaster 全存档（`runtime-artifacts/world-cup/fifa8-forecasts/<fixture>/`：forecasts.json + 中英 forecasting-engine report），未来比较。市场盲测 ✓（只用 FIFA 场上数据 + Elo）。
> ③ **真实预测已生成 + 验证 ✅**：parser 重写成 `extract_text()` 行解析（页 3 真 xG + 比分 + 体能，页 4 phases）；抽全 72 场（`manifest-2026-group.json`，抽完删 PDF，常驻数据在 `runtime-artifacts/world-cup/fifa/2026/team-match-stats.json` 144 条）。**真实 R32 对阵从真实战绩推导**（`bracket.ts` 套 FIFA 固定槽位）——验证 M73 = 南非 vs 加拿大（=用户说的"加拿大打南非"）✅。跑引擎出 **15 场 R32 预测**（跳过已踢的 M73），9 路归档在 `runtime-artifacts/world-cup/fifa8-forecasts/live/`。**两处校准修复**：MCBoost ±12pp 锚定共识（防翻盘）；8合1 共识改**线性 pool**（原 log-pool 被某个 0% 过自信 ML 模型一票否决，把克罗地亚压到 1%→改后 22%，合理）。`tsc` 绿 + `vitest` 82/82。
> ④ **发布三件已建好（用户 2026-06-29 指令「1 2 3 都做」）**：**①** Web 视图 `/world-cup/knockout`（`apps/web/app/[locale]/world-cup/knockout/` + `components/world-cup/fifa8-match-card.tsx` + `fifa8-store.ts`，三语 i18n + 移动端，桌面/移动截图自评过、0 console error、每场头条判断 + 9 模型并排对比 + 展开依据）。**②** `scripts/world-cup/fifa8-baseline-prices.ts` 抓预测时刻 Polymarket 隐含概率 **15/15**（按队名+slug 映射，非腿位；**预测生成全程不碰价**）。**③** `fifa8-results.ts` + `fifa8-performance.ts` 复用 `computePerformance` 给 9 个 forecaster 排行（淘汰赛未结算→settled=0，结算后每日刷）。数据桥 `scripts/world-cup/build-fifa8-web.ts` → `apps/web/lib/world-cup/generated/fifa8-r32.generated.json`。
> ⑤ **关键修正**：自推导的 R32 第三名槽位有 3 场错（推成 德国-波黑/法国-巴拉圭/美国-瑞典），FIFA 官方组合表难复刻（仓库原推导也近似）。改用 **Polymarket 真实对阵结构**（盲测规则允许只取「谁打谁」）→ 真实 德国-巴拉圭/法国-瑞典/美国-波黑；`forecast --data --actual-bracket <file> --skip rsa-can`，用 Polymarket slug 当 fixtureId（baseline/结算直接按 slug 查盘）。**剩**：apps/web build 验证 → PR → **用户确认后部署**（forecasting-agent.com 手动 `gh workflow run wc-results.yml --ref main`）。详见记忆 [[fifa-8model-forecaster]]。
> ⑥ **部署前审查 + 修复（2026-06-30）**：用户「审查后部署」。跑了 3 路并行代码审查（市场盲测/脚本、web、引擎）——**市场盲测全部 PASS**。修了 2 个发布阻塞项：(a) web「为什么」抽屉的 driver 文案是英文未走 i18n → 加 `knDriverConsensus/knDriverBias/knDriverPp` 三语 + 模板化（不再硬编码英文）；(b) 分项百分比各自取整会显示 99–101% → `pct3` 最大余数法凑 100，verdict 也用同一套数。另修几个非阻塞正确性项：`bracket.ts` H2H 改「全 tied-set 迷你表」（原 pairwise 在 3 队循环时非传递）；`fifa8-baseline-prices.ts` 存**原始** vig 价（原来二次归一会虚增 Mock PNL）+ 重跑不再把已抓价覆盖成 null；`fifa8-performance.ts` 容缺结算文件。**留作后续（已 spawn task）**：tree 模型(6/7)对 ensemble(8)/MCBoost(9) 的样本内泄漏 → 用 k-fold OOF 修。build 绿 + 截图复验（中文 drivers + 凑 100 + 真实对阵）。
> ⑦ **淘汰赛详情页 + 模型说明 + 预测时间（2026-06-30，用户要求）**：(a) 每场 `/world-cup/knockout/[id]` 详情页复用 forecasting-engine 版式（决策先行 → FIFA 数据**证据卡**：实力/进攻/防守抗压/控球/逼抢/反击/低位/高强度 → **9 个模型各自的读法** + 方法段）；卡片「为什么」抽屉删掉，改成跳详情页的链接（`withLocale` 是**后缀式** locale，靠 `vercel.json` `^/world-cup/(.+?)/(zh-CN|zh-TW)$` 重写到前缀；**dev 下后缀 URL 会 404 属正常**，prod 重写后正常）。(b) 淘汰赛页新增「ⓘ 模型怎么预测」展开（`fifa8-model-guide.tsx`），逐个讲 9 个模型怎么预测 + 用哪些数据。(c) `WcHero` 加 `metaKey`/`predictedAt` 可选 props → 淘汰赛页显示真实预测时间 **2026-06-29**（不再用全站 06-11）+ 详情页方法段也标。数据管线扩展：CLI 写 `team-stats.json`，`build-fifa8-web` 带上 9 模型完整 rationale + 每队 FIFA 证据（`fifa8-store.ts` 加 TeamStats/getFifa8FixtureById/getFifa8FixtureIds）。Polymarket 定价在预测时刻**静默**留档（baseline 15/15，页面从不显示）。build 绿（45 详情页 prerender）、三语 172 键齐、桌面/移动截图自评、0 console error。
>
> 最后更新：2026-06-21 by Claude（展示界面文案/UX 大精简，面向 decision-maker；dynamic workflow 6 维评审 + 实施。改动**未提交**，working tree）。要点：
> ① 全站精简 + 去术语：冠军页长句→「谁会拿到最后的冠军？」+ 一行法（Elo 模拟+贝叶斯，保留预测时间）；删「对阵」、「边际概率」→「各队打进每一轮的概率」；顶栏去重（删与 tab 重复的 预测/夺冠之路，仅留 本地部署+GitHub+语言）+ 删 GitHub「predict-raven」标签、aria-label→「View source on GitHub」。
> ①b **法务页/页脚全删（2026-06-21 用户决定：内测协议已获用户同意）**：删 `apps/web/app/terms/`、`apps/web/app/privacy/`、`components/world-cup/legal-footer.tsx`、`lib/legal-copy.ts`，并从 WC layout / 自助页 / research 控制台卸掉 `LegalFooter`（页脚现已无内容→整块移除）。i18n 删 footerTerms/footerPrivacy/footerResearchTag/footerAgeGate。⚠️ **OAuth 登录配置若曾填 Terms/Privacy URL，需到 provider 后台同步移除/更新**（否则授权可能被拒）；站点已无任何 18+/免责/隐私声明，后续如需重新合规要自行补回。
> ② 预测效果页重构：4 张精简卡 + 可见「什么时候下注」两行规则（定义 押/反押/跳过/−100%）+ 点击展开「全部预测·32」+ 校准段重命名「校准：概率有多可信」+ 加讲清楚的定义；比分 grid 对称（`minmax(0,1fr) auto` + shrink guard）。
> ③ `/research` 控制台去术语（遵 forecasting-console-style 记忆）：edge→差距/gap、删 Bayesian/credible-interval/node、状态机→进度、treeTitle/ledgerCaption/ciNote 等改人话。④ 自助页 FormulaCard 改可折叠。i18n 三语各 114 键齐（删 navForecasts/navBracket/footerResearchTag/footerAgeGate；新增 perfRule/perfRuleTerms/perfAllToggle/perfBetsWord）。
> ⚠️ **顺手发现并修了数据 bug**：`results.generated.json` 两场 winner 反了——eng-hrv(06-17) 实际**英格兰 4-2 克罗地亚**、che-bih(06-18) 实际**瑞士 4-1 波黑**（ESPN/FIFA/Sky 等 5+ 源一致），却记成客胜(b)。**根因**：这两场落进 Polymarket「Any Other Score」桶 → moneyline-only 结算 `resultFromMoneyline` 按**腿的位置**映射 a/b，但 Polymarket 腿序不保证主队在前（实测客队在前）→ 胜负反了；胜负一反又导致 ESPN 回补因「胜负不一致」被拒（比分也丢）。
> ✅ **已修（结算管线 PR，2026-06-21）**：`settlement.ts` 改为**按队名映射**（用 draw 腿的「(主 vs. 客)」学到朝向，腿序无关）；`espn-results.ts` 的 `norm` 去掉连接词 and（「Bosnia and Herzegovina」=「Bosnia-Herzegovina」）；新增 `scripts/world-cup/results-overrides.json` + `update-results.ts` 末尾应用——**operator 核验结果（搜索为准）覆盖抓取值并跨日重跑持久化**（source=`verified`），实现用户定的「校验不一致以搜索结果为准」。实测整条 `wc:results`：ESPN 7/7 回补、两场 4-2/4-1→a [verified]、settled=32、bestPick 18/32、ECE 10.5%。回归测试 `scripts/world-cup/lib/settlement.test.ts`（注：本机 vitest 配置因 vite7/node20 `ERR_REQUIRE_ESM` 跑不起来，已用 tsx 等价验证 4/4 + 实跑 live Gamma 通过）。
> 验收：`pnpm --filter @autopoly/web build` 绿；桌面/移动 + zh 预览自评、0 console error。
>
> 最后更新：2026-06-19 by Claude（世界杯新增「预测效果」页 + 市场盲测规则细化）。
> 新增第 4 个 WC tab `/world-cup/performance`（预测效果）：把盲测预测对比 Polymarket 预测时刻价格打分——最佳预测命中率、Mock PNL（只显示收益率%）、Brier 技巧分（友好名「相对市场水平」）、校准 ECE，外加逐场「我们 vs 市场」概率条 + 三市场各自的模拟下注（押/反押/跳过，%）。
> 管线：`fetch-baseline-prices.ts` 一次性抓预测时刻 CLOB 价格（固定历史，已 commit `baseline-prices.generated.json`）；`build-performance.ts` 据「预测+结算+价格」重算 `performance.generated.json`，已链入 `wc:results`，随每日结算刷新。改名（zh）：出线名单/对阵 → **夺冠之路**。
> ⚠️ **政策细化（已写进 CLAUDE.md CN+EN + 记忆）**：市场盲测只约束预测*生成*；该 performance 页是*事后*基准评测，允许展示市场隐含概率与对比指标。预测本身仍全程不看价格。bug 教训：Polymarket 队腿顺序不固定，必须按队名映射 a/b（按位置错配会虚增 PNL）。
> typecheck + next build 全绿；桌面/移动 + en/zh 截图自评、0 console error。
> 最后更新：2026-06-18 by Claude（优化 `/research` Forecasting Engine 结果可视化——decision-maker 信息分层；**改动在分支 `claude/great-wing-b09925`，未提交/未 PR**）。要点：
> 用「颜色 + 字号」建立 4 级信息层级（决策 / 模型 / 证据 / 元信息），让 PM 5 秒读出结论。Dynamic Workflow 先出方案（3 设计 lens + synthesis），再 10 轮截图迭代收敛。
> 改动：① 结论卡顶新增 **decision eyebrow**——方向化判定 pill（`Likely No` 等，按 `yesProbability` 5 档派生、非解析文案）+ edge 升为 co-hero（27px，`-57pp 低于市场`）；卡片左侧方向色 5px 边框 + 同色阴影。② **model↔market CI 条**：MODEL/MARKET 标签 + 几何 gap 连接 + "市场落在模型 80% 区间之外＝高把握分歧"读数。③ **条件模型瓶颈标记**：最低概率节点标 amber + ⚠（本例 B|A 15%＝结构性致命点）。④ verdict 首句加粗、edge 升为主卡 / market 降为 ghost、证据账本 top-3 加 rail+底色+影响力条、贝叶斯末点落方向色。
> review 入口：[`result-charts.tsx`](../apps/web/components/research/result-charts.tsx)、[`research.module.css`](../apps/web/components/research/research.module.css)、新 [`call.ts`](../apps/web/lib/research/call.ts)（方向化判定派生器）、[`i18n.ts`](../apps/web/lib/research/i18n.ts)（en/zh 同补）。
> 验收：`pnpm --filter @autopoly/web exec next build` 绿（279 页）；EN/中文 + 桌面/移动截图自评通过。注：`/research` 是用户自填问题的研究控制台、可显示市场价（与 WC 公开预测管线的市场盲测规则无关）。
>
> 最后更新：2026-06-17 by Claude（比分回补 ESPN：补齐 Polymarket 漏给的悬殊比分）。
> 问题：部分已完场比赛页面显示 "–"。根因：Polymarket exact-score 市场只列 ~16 个常见比分 + "Any Other Score" 桶，悬殊比分（7-1/5-1/4-1）落进该桶 → 只得胜负、不得具体比分（已用 Gamma API 实证）。
> 修复（**PR #33**，已合并 + 部署）：新增 `scripts/world-cup/lib/espn-results.ts`，对"已结算但 `score=null`"的场次按 日期+队名 从 **ESPN 免费无密钥 scoreboard** 拉真实比分（定向到 team a/b），集成在 `update-results.ts` 的回补 pass。**仅当 ESPN 胜负与 Polymarket settled winner 一致才采用**（`source="espn"`）；查不到/不一致则保持 winner-only（安全降级）。
> **市场盲测合规**：ESPN 是结果源，代码只读最终进球数 + 完赛状态，**绝不读赔率/价格**（结算映射允许、市场价格禁止）。
> 线上已验收：ger-kor 7-1 / swe-tun 5-1 / usa-par 4-1，0 已结算场次缺分；forecasting-agent.com/world-cup/groups 显示真实比分。今后若有新场次落进 "Any Other Score" 桶，定时任务会自动回补（队名对不上 ESPN 时退回 winner-only，不会报错）。
>
> 最后更新：2026-06-16 by Claude（世界杯比分自动更新已全量上线 + 线上验收通过，无遗留用户待办）。要点：
> ① **已上线**：GitHub Actions `.github/workflows/wc-results.yml`（每日 UTC 07:00/19:00 + 手动触发）跑 `pnpm wc:results`（市场盲测，只取已结算比分）→ 用 `VERCEL_TOKEN` secret 调 `scripts/world-cup/deploy-web.sh`（build + 部署 + `promote` 到 forecasting-agent.com）→ curl 校验线上 200（§8 真实验收）。首次手动触发**全绿**，线上 `/world-cup/groups` 返回 200、16 场 FT 比分在线、无 404。取代原先"Mac `/schedule` 例程、只在 app 开着才跑"。heavy build 跑 GitHub runner（**刻意不在 Hostinger/Manus VPS 构建**——OOM 会拖垮实盘交易容器、违背「web→Vercel」设计；6 方案对抗式评审结论）。
> ② 配套修复：`vercel.json` 加 `check:true`（catch-all 路由不再 404，线上已验证）；`apps/web/lib/prediction-access.ts`(+测试) import 由 `.js` 改 extensionless（修红构建，279 页绿、`vitest` 8/8）；`deploy-web.sh` 的 `vercel promote` 加 `--scope "$VERCEL_ORG_ID"` + 容错（promote 不认 VERCEL_ORG_ID，否则部署成功但报 "different team" 把 run 染红）。
> ③ PR #29（构建修复+比分 4→16+初版工作流）→ #30（改 token 直接部署）→ #31（promote scope + 线上验收）均合并 main；`wc-scores` 分支已删（token 直接部署不需要）；旧 Mac 例程 `world-cup-daily-results` 已暂停（一个调度器原则）。
> ✅ **无遗留用户待办**。调频次/时间改 workflow 的 `cron` 即可；`VERCEL_TOKEN` secret 已配（**安全：凡在对话里出现过的 token 一律视为泄漏，须吊销轮换**）。
> 注：当前 diff-gate 用整文件 `git diff`，因 `generatedAt` 时间戳每次都变 → 实际每次都部署（2 次/天，成本可接受）；若要"无变化不部署"可改成只比 `.results`（小优化，非必需）。
>
> 最后更新：2026-06-15 by Claude（本会话共合并 **PR #18–#27** + 建 **issue #25**；main `ea82839`；全程 typecheck + vitest **713** 全绿）。要点：
> ① **Forecasting Engine `/research` 全量双语化**（EN 默认 + 一键 `中文` toggle，chrome 与流式研究内容一起切；新增 `apps/web/lib/research/locale.ts` + `i18n.ts`，`locale` 从 composer→SSE→route→driver→`buildPredictionDemoRun`/`replayRun` 全链路打通，服务端按语言生成内容）——**PR #18**，已部署 forecasting-agent.com（web 项目 `prj_kPZRC…`，`scripts/world-cup/deploy-web.sh`）并实测 EN/zh 双语 + toggle live、0 console error。/research beta 入口仍 dormant。
> ② 清掉 3 个 open issue：AW setup 文档 + `poly:aw/okx` 别名（**#19** closes #7）、持久化 agent-loop 纯库（**#20**，#6，no live-money）、market-intelligence Python 模块作为可选增强落地（**#21**，#5）。
> ③ 仓库体检（4 维并行审计）后的收尾：统一 3 份分叉 `loadEnvFile`→`@autopoly/contracts/env`（**#22**，**修实盘 ENV_FILE 优先级漂移风险**：ENV_FILE 优先 + override + fail-closed）、加 Prettier 配置（可用）+ 休眠 ESLint flat config（**#23**，ESLint 依赖因沙箱无网未装）、pulse/forecast/autopoly/raven 命名 glossary（**#24**，**未做有风险的全量改名**，artifact 路径迁移会孤立归档）、删 **~5,128 行死 CSS**（**#26**，globals.css 5403→1759，全是 AutoPoly purge 漏删的 preview/bal/dash 族 + 孤儿 module）、apps/web 单测基线 1→4 文件 **+31 测试**（**#27**，把 access-control 纯规则抽到 `prediction-access-rules.ts` 以绕开 next-auth import）。
> ④ market-intelligence 定性 = **issue #25**（框定为 Forecasting Engine 接入外部信息源的基建，3 阶段路线；模块留在 repo 当种子，不删不硬接）。
> ⚠️ **待办**：(a) `scripts/world-cup/deploy-web.sh` 的 promote 步在新版 vercel CLI 下有 bug（见 P2）；(b) ESLint 需有网时跑 `pnpm add -Dw eslint @eslint/js typescript-eslint eslint-config-prettier` 激活 + 加 `lint` 脚本；(c) globals.css base 主题块（~850 行）含 auth 在用的 `:root` token，留待逐选择器审计；(d) `replay`/`use-research-stream`/React 组件仍无测试。
> 此前(2026-06-12)：pulse:*→forecast:* 改名；MC 淘汰赛点球规则偏高待用户拍板（见下"MC 淘汰赛模型核查"）；catch-all 路由部署需补 check:true。

---

## 🏆 世界杯盲测预测冲刺（2026-06-11 · 本分支当前主线，进行中）

**目标**：揭幕战开球（2026-06-11 19:00 UTC = 港时 6/12 凌晨 3:00）前发布全部 **87 个问题**的公开预测（72 场小组赛 + 12 个小组头名 + 八强/四强/冠军三个池子），并把 `/world-cup` 网页上线 Vercel。

**铁律（用户 2026-06-11 拍板，永久）**：**市场盲测** —— 预测管线任何环节不得读取/引用/展示任何市场价格或隐含概率（Polymarket / FanDuel / DraftKings / Kalshi 等全在列），市场数据只许用于事件结构与结算映射。规则在 CLAUDE.md「项目执行要点」；缓存写入层已用 `stripPrices` 强制剥离（`scripts/world-cup/cache-markets.ts` / `check-updates.ts`）。**预测 = 纯 Elo / Monte Carlo + 有界证据调整（单场 ±8pp，带来源）**。

**已完成（都已 commit）**：
- 事件清单 87 题含结算定义（无价格）：`pnpm tsx scripts/world-cup/build-event-list.ts` → `runtime-artifacts/world-cup/event-list/`
- 100k 次纯 Elo Monte Carlo（官方 FIFA 2026 对阵树 + 最佳第三分配）：`runtime-artifacts/world-cup/mc-results.json`。盲测冠军榜：西班牙 37.8% > 阿根廷 24.4% > 法国 12.8% > 英格兰 6.6%
- Elo 查表（48 队 + 别名）：`runtime-artifacts/world-cup/elo-table.json`
- `/world-cup` 网页：卡片（事件+概率条）→ 点开 2-3 条带来源理由 → `/world-cup/forecast/<id>` 完整报告页（CN/EN）。空状态视觉 QA 通过（0 pageerror）
- 导入命令：`pnpm tsx scripts/world-cup/import-predictions.ts`（扫 `runtime-artifacts/world-cup/reports/*/prediction.json` 统一 schema → `apps/web/lib/world-cup/generated/*.json`，**导入后要 commit 这两个生成文件**，Vercel 构建依赖它们）

**进行中（跑在 Aincrad 的 Mac 本地 FleetView 会话里，协作者无法直接接管这个进程）**：
- Workflow `wf_8db95ecb-dc7`（~160 agents）：71 场比赛（预测+对抗校验流水线）、12 组 + 3 池报告、揭幕战 sample 盲测净化、市场盲测专项校验。约 20:46 起跑，ETA ~22:15 HKT
- 监控：`ls runtime-artifacts/world-cup/reports | wc -l`（完成时 ≈ 87 个目录，每个含 report.md / report.en.md / prediction.json）
- ⚠️ `runtime-artifacts/` 是 gitignored：**预测产物只在这台机器上**，直到导入 + commit generated JSON

**✅ 冲刺已完成（2026-06-11 22:45 HKT，开球前 4 小时）**：
- 87/87 题市场盲测预测全部发布并 commit（`runtime-artifacts/world-cup/reports/`），确定性校验 87/87 通过
- **线上**：https://web-one-sand-83.vercel.app/world-cup （Vercel 项目 `web`，prebuilt 部署；已修平台路由 bug：catch-all rewrite 缺 `check:true` 导致动态参数路由 404——`vercel build` 产物 `config.json` 需打该补丁，build 脚本化时要带上）
- 成本账本：`runtime-artifacts/world-cup/run-ledger/`（全部 claude-fable-5；生产 150 万 output tokens；单场中位 264s/14.2k out）
- 对阵图：`bracket-prediction.json`（模态路径：决赛西班牙 56% 胜阿根廷）
- 残余 TODO（已于 22:10-23:10 完成 AutoPoly 全站清除：交易面板页面/API/组件/数据文件 60+ 个文件删除，根路由重定向 /world-cup，R1 品牌元数据替换，线上已验证 14 个旧路由 404）；自定义域名未配；OG 卡未做；每晚 Elo 更新后重跑 MC 的自动化未建

**🔬 MC 淘汰赛模型核查（2026-06-12，协作者质疑 → 已证实，待用户拍板是否修正重发）**：
- **问题确认存在**：淘汰赛 90 分钟 Poisson 出平局后，点球/加时用 **Elo 期望 eA 当 Bernoulli 胜率**（`scripts/world-cup/mc-sim.py` 的 `ko_win_prob`：`win + ea*draw`）→ 强队优势被双重计入（进球模型一次、点球再一次；真实点球大战接近五五开）。叠加 λ 切分（λA=2.6·eA）本身比 Elo 期望分更"果断"，eA=0.70 的强队单轮过关概率被抬到 0.777（**+7.7pp/轮**），五轮淘汰赛复利。
- **量化**（同 seed=20260611、100k 对照重跑）：西班牙冠军 **37.83%（已发布）→ 30.53%（点球=50/50）→ 27.29%（纯 Elo Bernoulli）**；阿根廷 24.41 → 21.27 → 19.44。协作者"怎么算都 <35%"由此完全解释。
- **影响范围**：champion / reach-qf / reach-sf 三个池子 + 对阵图（`bracket-prediction.json`）+ 网站冠军页数字；**12 个组头名和 72 场单场预测不受影响**（前者只依赖小组赛，后者走 Davidson 三路模型）。
- **澄清"平方平均"**：协作者的 Claude 提到的 √ 是单场模型里 Davidson 平局项 ν·√(pA·pB)（几何平均，标准做法，没问题）；MC 点球规则用的是裸 eA，两处是不同公式，别混淆。问题只在后者。
- **MC 代码已补提交**：规范版 `scripts/world-cup/mc-sim.py`（路径已改仓库相对，**同 seed 逐位复现已发布 `mc-results.json`**，跑一次仅 ~5s）；当时的一次性生成脚本（reach-qf/sf 构建、champion 生成、确定性校验器等 9 个）原样归档在 `runtime-artifacts/world-cup/code-archive/`（注意：内含绝对路径，是出处留档不是可复用工具）。
- [ ] **待用户决定**：是否改用 点球=50/50（或加时再给小幅 Elo 倾斜）重跑 MC 并重发 champion/reach-qf/reach-sf + 对阵图 + 网页数字。已发布报告的 局限② 其实自己写了"可能高估头号种子"。

**原计划步骤（已全部执行）**：
1. 等 workflow 完成（自动通知；或看目录数）
2. `pnpm tsx scripts/world-cup/import-predictions.ts` → 检查 WARN（被跳过的题要补）→ commit `apps/web/lib/world-cup/generated/`
3. 视觉 QA（CLAUDE.md §9 强制）：`cd apps/web && pnpm exec next dev -p 3199`；`node scripts/visual-qa.mjs --base http://localhost:3199 --paths /world-cup --out runtime-artifacts/screenshots/<ts>-wc-live`；用 Read 真读 PNG；任何 pageerror = fail
4. 逐预测 token/耗时/模型统计（用户明确要求）：解析 workflow 转录 `~/.claude/projects/-Users-Aincrad-dev-proj-predict-raven/6367ed0b-*/subagents/workflows/wf_8db95ecb-dc7/agent-*.jsonl`（每条 assistant 消息含 model + usage tokens；首末时间戳差 = 耗时；从 prompt 里抓 slug 归属）+ MC 在 `wf_58799d69-b6b` → 产出 `runtime-artifacts/world-cup/run-ledger/{ledger.csv,summary.md}`
5. Vercel 上线：先 `pnpm --filter @autopoly/web build` 本地过；查 `apps/web/.vercel/` 是否已 link；上线后**必须真实验收**（打开线上 URL + 截图 + 对照本地）
6. 清理待办：旧 `/world-cup/[matchId]` 与 leaderboard 路由是市场时代 UI（数据已删、现 404），后续删除或重写


## 🔴 P0 — 现在/今天

- [x] **【P00 · 已实现】pulse-direct market binding 校验**：2026-05-05 已修复。`pulse-entry-planner` 不再用同 event URL 直接绑定多 strike 市场；`execution-planning` 增加 P00 gate：marketSlug / tokenId / outcomeLabel / rule threshold 严格一致，bestBid / bestAsk / decision price 允许 3% 以内误差；`pulse-live` 遇到 `blocked_by_market_binding` 在 live 模式 fail-fast。覆盖测试：`pulse-entry-planner.test.ts` / `execution-planning.test.ts` / 全量 `pnpm test` 392 pass。
- [x] **【P0 · v1 已实现】现有仓位独立研究复审**：2026-05-07 `pulse-live` 会在随机 Pulse 候选之外为每个远端持仓生成 `position-research.json`，抓 Gamma event/market payload + held-token orderbook；`Position Review` 优先消费 `positionResearch`，无覆盖仓位不再默认 stale hold，而是标 `fresh-position-research` / `position-research-refreshed`（near stop-loss 仍 reduce）。**残余缺口**：还没有模型级概率重估、评论/外部来源 crawler；当前是 factual refresh + artifact，不要误当完整外部研究 agent。
- [x] **【P0 · 已实现】已有持仓必须走 position-only Pulse 概率/edge 复审**：2026-05-08 新增 `pnpm forecast:positions`（等价 `forecast:live --recommend-only --positions-only`），只针对当前持仓生成 Pulse 报告，不扫描新市场、不输出新开仓建议；候选 JSON 带当前持仓方向 / 数量 / 均价 / mark / PnL，parser 会保留 Yes/No 两侧概率行（edge 可正可负），`Position Review` 优先用持仓侧 Pulse edge。验证归档：`runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`，7 仓 hold，0 成交，Pulse 复审计划数 12；Crude 因规则/CL 数据不足由 Pulse 明确拒绝估概率，保留 edge=0。
- [x] **【P1 · 已实现】逐仓 PnL 快照 + calibration ledger**：2026-05-07 已实现。`pulse-live` / `forecast:recommend` 会写 `position-mark-snapshot.json`、单轮 `calibration-ledger.jsonl`，并追加 `runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl`；run-summary 会展示逐仓 mark 归因和 unexplained equity residual。
- [x] **【临时限制 · 已实现】Pulse 开仓只推荐 1 个最优仓位且支持固定金额**：2026-05-15 新增 `PULSE_ENTRY_MAX_PLANS` 与 `PULSE_ENTRY_FIXED_NOTIONAL_USD`；临时运行用 inline/env artifact 设置，不写入默认 `.env`。该限制只影响新开仓 entry recommendation；已有仓位 position-only review 不合成新开仓。执行层风控与 Polymarket 最小订单量仍生效，金额太低会被拦截而不是强行下单。
- [x] **【GitHub issue #2 · 已实现待 PR】OKX Agentic Wallet signer + OpenClaw 兼容**：2026-05-22 当前分支 `codex/aw-agentic-wallet-cap` 已把 OnchainOS/OKX EIP-712 signer、Polymarket signing identity、OnchainOS preflight、OpenClaw `openclaw agent` wrapper、`PULSE_ENTRY_*` 限制与公开 equity history 隔离合入同一 PR 范围。新增 `ONCHAINOS_TIMEOUT_MS` fail-fast，OpenClaw 默认不再调用已不兼容的 `openclaw run`。验证：`pnpm test` 50 files / 419 tests pass；`pnpm typecheck` 9 workspace pass；`pnpm --filter @autopoly/executor build` 与 `pnpm --filter @autopoly/orchestrator build` pass；fake OpenClaw wrapper smoke 输出 `wrapped output`。本轮没有运行 `forecast:live` / `daily:forecast`，没有真实下单。
- [ ] **【当前阻塞 · 2026-06-07】当前出口被 Polymarket CLOB 订单 API 按地区限制拒单**：`https://polymarket.com/api/geoblock` 探针显示 `blocked=false country=MY`，但真实 `/order` 返回 `403 Trading restricted in your region`。用户授权后对 `will-satoshi-move-any-bitcoin-in-2026` / `NO` 做 `$1` live-check，订单同样到达 `/order` 后 403，事后复核 Satoshi 持仓为空、collateral 仍 `223.961524 USDC`；归档 `run-error/2026-06-07T043859Z-satoshi-geo-live-check/summary.md`。在用户切换到 Polymarket CLOB 可交易地区前，不要重复发送 live order；只读 Pulse / PDF 可以继续跑。复跑时优先用 direct 命令 `pnpm exec tsx scripts/pulse-live.ts ...`，今日 `pnpm forecast:live -- --recommend-only --json` 曾两次在启动阶段返回 `createOrDeriveApiKey` 空 payload，而 direct 入口正常。
- [ ] **【新主线】Raven Managed Product — Phase 3a 代码全完成，剩 dogfood 启动**。计划全文 [`docs/internal/plan/2026-05-04-raven-managed-product-plan.md`](internal/plan/2026-05-04-raven-managed-product-plan.md) + [`mode-a-phase-3a-plan.md`](internal/plan/2026-05-04-mode-a-phase-3a-plan.md)。**当前 branch = `main`**（HEAD ~`4d417a9`）。
  - ✅ **DB**：Neon PG 17.8 in eu-central-1 (Frankfurt) provisioned 2026-05-05；4 migration 全跑通；连接串写进 `apps/raven-managed/.env.local`（gitignored；密码暴露聊天，dogfood 跑通后 reset）
  - ✅ **Phase 1 + Phase 2 #1-#4**：apps/raven-managed 独立 app + Privy + Safe 推导 + viem 余额 + session signer UI（stub 模式）+ 4 表 schema
  - ✅ **Phase 3a.0**：commit `a6513bc` — Builder code wired into services/executor（**Pizza/no1 别开**：自家钱包大概率被 Polymarket Weekly Rewards Pool 过滤，自引规则）
  - ✅ **Phase 3a.1**：3 commits — `PolymarketRelayerAdapter` 真实现（deploySafe / getBalance / getPositions / placeOrder via session signer + builder code 双重 stamp）
  - ✅ **Phase 3a.2**：commit `2e81400` — `scripts/managed-pulse.ts` + `proposed-decision-mapper.ts`（pulse 桥）
  - ✅ **Phase 3a.3**：commit `7e0b956` — `scripts/managed-pulse-archive.ts` + `services/managed-trading/src/{alerts,risk-events}.ts` + `deploy/managed-pulse.cron.example`
  - ✅ **Tests**：65/65 managed-trading + 全 9 项目 typecheck 绿
  - **Polymarket builder credentials**（active）：address `0x6664...14e` / code `0x30cf...95e` / api key + secret + passphrase 全在 `.env.local`。**fee rate 0%/0% don't change**（头部 builder 全是 0%）

- [x] ~~**Phase 3a.4 paper-mode 端到端 SMOKE TEST**~~ ✅ 2026-05-07 完成，commit `<pending>`：
  - no1 (`0xe14e...dff1`) 通过直接 SQL INSERT 注册成 managed_user `74a27990-300a-4d09-8e7b-af52a5c65906`（跳过浏览器 + Privy 模态——签名只能在 wallet 端做，私钥不应该上服务器）
  - Safe 推导验证：no1 EOA → `0xC78873...2936` ✅ **完全匹配** `.env.no1` 的 FUNDER_ADDRESS，证明 3a.1 PolymarketRelayerAdapter 推导逻辑对
  - 实测 publicnode RPC 读链上余额：no1 Safe = $3.96 USDC.e（之前充的钱还在）
  - 用 `2026-04-26T060306Z` pulse recommendation.json 跑 `managed:forecast --json --recommendation <path>`：3 decisions 全 skip（balanced tier 15% cap → $0.59 < $5 min notional）—— **这是正确的风控行为**，bankroll 太小 AI 即使看到 99% conf 的原油单也不强行下
  - DB 验证：`managed_paper_runs` 写了 1 row（completed，2 秒跑完），`managed_decisions` 写了 3 rows（全 skipped，原因 `blocked_by_min_notional`）
  - 归档：`runtime-artifacts/managed-pulse/2026-05-07T08-23-06Z-484e1667/`
  - **关键发现**：`https://polygon-rpc.com` 公共 RPC 现在返回 401（"API key disabled"），切到 `https://polygon-bor-rpc.publicnode.com`（也有 `drpc.org` / `1rpc.io/matic` 备选）。已写进 `.env.local`

- [ ] **【dogfood 下一步 — 看你想走哪条】**：
  1. **A. 给 no1 Safe 准备 $30+ Polymarket 可用 collateral（V2 之后优先 pUSD / 已迁移余额）** → paper-mode 重跑会真的"keep" 部分 decision，验证完整 happy path（不是只验"被 skip"）。2026-05-15 复查：`.env.no1` 的 CLOB `COLLATERAL balance=0`、onchain pUSD=0，不能直接下单。
  2. **B. 做 Privy 真 connect-wallet 注册流程**（不是直接 INSERT）→ 验证 onboard 端到端 UX。需要你拿 no1 私钥导入 MetaMask 后浏览器走一遍
  3. **C. 直接进 live mode**（拿 1 个真单）→ 需要 Privy dashboard 启用 session signers + 拿 `PRIVY_SESSION_SIGNER_PRIVATE_KEY`，把 `MANAGED_TRADING_MODE=live`。最 risky 但最有信息量
  4. **D. 等几天看 cron 跑通**（搭好 cron 让 paper-mode 每天自动 run）→ 验证 cron 调度 + alert webhook + 归档累积

- [ ] **【可后做不阻塞 dogfood】review 这一轮新建的 6 个文档**：
  - `docs/internal/plan/2026-05-04-raven-managed-product-plan.md`（产品计划主文件）
  - `docs/internal/plan/2026-05-04-mode-a-phase-3a-plan.md`（Mode A 实施计划）
  - `docs/internal/plan/2026-05-04-design-elements-inventory.md`（设计清单 + 5 待拍板方向）
  - `docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md`（betmoar 调研 + CU 选型）
  - `apps/raven-managed/app/page.tsx`（landing 文案 + Lucide icons + raven 品牌 mark）
  - `packages/db/src/migrations/000{2,3}_*.sql`（DB lifecycle / risk_tier 命名）
- [ ] **【用户下次会话亲自做】人为 review 所有本轮新建/重写的中间产生分析文档**：检查格式与内容是否合理。范围至少包括：
  - `docs/agent-onboarding.md` / `docs/agent-handoff.md`（中英）
  - `docs/internal/plan/2026-04-28-v2-cutover-runbook.md`
  - `docs/diagrams/dev-reference.md`（中英）
  - `claude.md` / `AGENTS.md`（中英 4 份）的"项目执行要点"节
  - 主 README.md（含 Quick Start 重写 + 系统设计）
  - 用户特别想 review 的是 **格式 + 内容呈现** 是否符合期望
- [ ] **2026-04-28 11:00 UTC · V2 cutover 当天操作**：暂停所有 cron → 等官方宣布切换完成 → 验证 SDK 连通 → 重启服务。详细步骤见 [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](internal/plan/2026-04-28-v2-cutover-runbook.md)
- [ ] **wrap pizza 钱包的 USDC.e → pUSD**（V2 切换前必做，否则 4/28 之后 preflight 会看到 collateral=0）。手动操作：登 polymarket.com UI 找 "Migrate to pUSD" 入口

## 🟡 P1 — 本周

- [x] ~~**接 Polymarket Builder Code**~~ ✅ commit `a6513bc`（2026-05-04，Phase 3a.0）。executor 现在按 `POLYMARKET_BUILDER_*` 5 个 env 自动给 FOK/GTC 单挂 builderCode。**用户操作**：把 5 个 env vars 抄进 `.env.pizza`（或当前在跑的钱包 env），下次 `forecast:live` 自动开始累积 builder volume
- [x] **【P1 · 已实现】Polymarket 读取默认 in-process + 订单簿去重预取**：2026-05-07 `POLY_CLI_ENABLED` 改成显式 `true` 才走 `pnpm exec tsx scripts/poly-cli.ts`，默认直接用 in-process SDK；`POLY_CLI_STRICT=true` 仍可强制隔离 bridge。`pulse-live` 新增单轮 `readBook` / `computeAvgCost` Promise cache；`buildExecutionPlan` 对 open/close/reduce 的 unique tokenId 做 bounded-concurrency prefetch，避免同一轮重复读 CLOB / 重复 spawn。
- [ ] **wrap pizza 钱包 usdce → pUSD**：V2 cutover 后 collateral=0，必须 wrap。手动登 polymarket.com UI 找 "Migrate to pUSD"
- [ ] **`fees.ts` 接入 V2 SDK 动态费率**：使用已新增的 `fetchDynamicFeeParams(client, conditionID)` helper（见 `services/orchestrator/src/lib/fees.ts:328`），把 sizing 路径里的静态查表替换掉。前置条件：`PlannedExecution` plumb 进 `conditionId` 字段（当前没有）
- [ ] **Mode A 主线 Phase 3a.4（dogfood）**：见 [`docs/internal/plan/2026-05-04-mode-a-phase-3a-plan.md`](internal/plan/2026-05-04-mode-a-phase-3a-plan.md)。
  - ✅ 3a.0 Builder Code (commit `a6513bc`) / ✅ 3a.1 PolymarketAdapter 真实现 / ✅ 3a.2 pulse 桥 (`scripts/managed-pulse.ts` + `proposed-decision-mapper.ts`，2026-05-05) / ✅ 3a.3 cron + 观测 + 报警（2026-05-05，65 tests pass）
  - 下一步：3a.4 dogfood — 用非 Pizza 测试账户走 1 周（用户必须亲自参与）
  - **观测 / 报警入口**：
    - alert webhook env: `MANAGED_TRADING_ALERT_WEBHOOK`（未设静默 no-op）
    - cron 配置 example: [`deploy/managed-pulse.cron.example`](../deploy/managed-pulse.cron.example)（默认 12:30 UTC，artifact-only 不自动启用）
    - 每用户日志: `runtime-artifacts/managed-pulse/<runBatchId>/<userId>/{decisions.json,summary.md}`
    - 顶层 run summary: `runtime-artifacts/managed-pulse/<runBatchId>/run-summary.md`
    - 失败 risk_events: event types `managed_pulse_failure` / `managed_pulse_user_failure`
  - **本地运行新桥**：`pnpm managed:forecast` (paper 默认) / `pnpm managed:forecast --json` / `pnpm managed:forecast --recommendation <path>` 显式指定 pulse 输出
  - **live 模式启用条件**：env `MANAGED_TRADING_MODE=live` + 5 个 `POLYMARKET_BUILDER_*` + `PRIVY_SESSION_SIGNER_PRIVATE_KEY`，缺一在 config 加载时立即抛

## 🟢 P2 — 后续 / 优化项

- [ ] **修 `scripts/world-cup/deploy-web.sh` 的 promote 步**（2026-06-14 发现）：vercel CLI 50.35.0 下 `vercel deploy --prebuilt --prod --archive=tgz` 输出**整个 JSON**（不再是裸 URL），导致 `DEPLOY_URL=$(...)` 拿到 JSON、line 44 `vercel promote "$DEPLOY_URL"` 报 `Can't find the deployment "{`。本次部署侥幸成功是因为 `--prod` 这轮直接 alias 了 production（promote 才会撞 `409 already current`）；但只要哪天 production 又被 `vercel rollback` pin 住，promote 就会真失败、线上不更新。修法：用 `--archive=tgz ... | tail -1` 或 `jq -r .deployment.url`（视输出而定）解析出真实 URL，或显式 `vercel promote <dpl_id>`。`/schedule world-cup-daily-results` 例行部署同样受影响。
- [ ] **Computer Use 集成（监控/事件交易方向）**：用户标注 P2（2026-05-04）。两个候选 pilot 见 [`docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md`](internal/review/2026-05-04-betmoar-and-computer-use-research.md) §D：① UMA 仲裁监控（read-only，比市场早知道 resolution 翻盘 = 提前减仓） ② Privy onboarding QA on testnet。**当前不启动**——等 Mode A 主线跑通再考虑
- [ ] **申请 Polymarket Verified tier**（优化项，不阻塞 MVP）：mail builder@polymarket.com 附 API key `019df336-1894-76e8-bd11-8582cde25c3a` + Pizza dashboard URL 当业绩证明。批下来后才能拿 Weekly Rewards Pool 的 USDC 分成（约 0.5-1% routed volume）。Unverified 也能正常下单 + 走 builder code，只是不进奖励池

- [ ] **Vercel 项目改名** `autopoly-pizza-spectator` → `predict-raven`：Vercel dashboard → Project Settings → Name。改完 README 顶部 spectator URL 也要更新成 `predict-raven.vercel.app`
- [x] **Prediction Engine demo preview + hosted access v1**：2026-06-07 已新增 `/prediction-engine` 自然语言事件概率 demo、`/api/prediction-engine/run` API、Pulse `stage_flow` 机器可读流程字段，以及中英文说明 `docs/diagrams/prediction-engine-stage-flow.{md,en.md}`。API 支持三种模式：本地测试用 `PREDICTION_ENGINE_LOCAL_API_URL` / `PREDICTION_ENGINE_BACKEND_MODE=local` 调本机 host 服务；线上 Vercel 用 `PREDICTION_ENGINE_API_URL` 或 `PREDICTION_ENGINE_API_BASE_URL` 调 VPS；未配置才 fallback demo。前端已加入 Manus-like Run Console，显示 `service`、当前步骤、步骤成果和 artifact label。已接 Auth.js + OIDC 登录骨架、邀请码激活、每日/月度/并发 quota gate、`prediction:invite` 创建脚本和 DB migration `0004_prediction_access.sql`。Vercel preview：`https://web-l6lenq4qs-alchemist-xs-projects.vercel.app`（deployment `dpl_EwPL9EqqVHipQy8mJWpaDdRgeTEw`，Ready）。当前 preview 域名被 Vercel 登录保护拦截，未 promote production；公开验收前需要关闭 preview protection、提供 bypass，或明确切 production。
- [x] **raven-cloud / raven-web private repos 已创建并写入首版代码**：2026-06-07 用 GitHub 账号 `Alchemist-X` 新建两个 private repo 并推送 `main`。`https://github.com/Alchemist-X/raven-cloud`（本地 `/Users/Aincrad/dev-proj/raven-cloud`，latest `10ee63e`）已包含 Fastify API、demo/pulse-command/http-proxy runner、邀请码、quota、CI 和中英文 README；`https://github.com/Alchemist-X/raven-web`（本地 `/Users/Aincrad/dev-proj/raven-web`，latest `1e0fc28`）已包含 Next.js App Router、OIDC/Auth.js、邀请码页、cloud API proxy、Manus-like Run Console、CI 和中英文 README。两边 visibility=PRIVATE；GitHub Actions 最新 CI 均通过。当前仍是首版独立骨架，尚未从 predict-raven monorepo 搬迁真实 Pulse 生产代码。
- [x] **promote prophets-profit 复刻页到 production**：2026-05-10 已切正式 `https://autopoly-pizza-spectator.vercel.app`。当前页面保留 prophets-profit 外观，但数据来自 Pizza Polymarket 公开钱包接口 + bundled Pulse position review 摘要，不再使用源站 Kalshi 静态快照。
- [x] **Pizza snapshot 三套非 production 风格预览**：2026-05-10 已完成，仅部署到 Vercel preview，未 promote production。预览地址：`https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app/previews/pizza-ledger-folio`、`/previews/pizza-ledger-terminal`、`/previews/pizza-ledger-exchange`。最终 preview deploy `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P`，运行时 env 显式指向 Pizza 钱包 `0x6664...614e` + `INITIAL_BANKROLL_USD=500`；中间 preview `dpl_BLwwnqngFevVbmHFSPBQo2LyTyxz` 因 Vercel preview env 指到错误钱包只显示 0 fills，不作为评审入口。
- [ ] **自动刷新 `pulse-position-review.json`**：当前 `apps/web/public/pulse-position-review.json` 是从 2026-05-08 position-only Pulse 归档手动抽取的公开摘要；下次跑 `pnpm forecast:positions` 后应加脚本自动导出并随部署更新，否则 rationale 可能落后于实时持仓。
- [ ] **README banner 升级 1200×630 PNG**：当前是 1254×1254 正方形，Twitter 卡片会上下裁剪。做一张横版替换 GitHub Settings → Social Preview
- [ ] **CONTRIBUTING.md + Google 表单**：用户说后续做
- [ ] **删 `claude.md` 小写、规范化为 `CLAUDE.md` 大写**：macOS 大小写不敏感视为同一文件。用 `git mv -f claude.md _CLAUDE.md && git mv _CLAUDE.md CLAUDE.md` 二步法

## ⛔ 已完成 / 不要重做（决策已定）

- ✅ **Design philosophy §1 重写**（2026-05-04）：[`docs/internal/plan/2026-05-04-design-elements-inventory.md`](internal/plan/2026-05-04-design-elements-inventory.md) §1 由"7 条抽象原则 + 后果列表"改成"4 条具体规则 + ✅长这样/❌不长这样对照"。规则收口为：不做 gamification / 默认展示真数据 / Marketing 和 app 两套规则 / 解释机制不只说 benefit。下游 §2-§9 未动
- ✅ **Polymarket V2 SDK 迁移**（commit `48181a5`）：执行器侧已切到 `@polymarket/clob-client-v2@1.0.2`，构造改 options 形式，SignatureType 兼容，CTF 地址 unchanged。无回归
- ✅ **README 大幅瘦身 + Quick Start 提前**（commit `70aa9c1` `8994ad1`）：从 570 → ~290 行，删掉"三条运行链路"和过长的 manifesto
- ✅ **Repo 重命名 `autonomous-poly-trading` → `predict-raven`** + 本地目录 `~/dev-proj/predict-raven/`（symlink 兼容旧路径）
- ✅ **Repo 根目录瘦身**（commit `24a9b0a`）：33 → 23 entries。`.en.md` 进 `docs/en/`，build configs 进 `config/`，`docker-compose` 进 `deploy/`，`Illustration/` → `docs/diagrams/`，`Plan/` → `docs/internal/plan/`，`Wasted/` → `docs/archive/`，`E2E Test Driven Development/` → `e2e/`
- ✅ **CLAUDE.md / AGENTS.md Tier 2 trim**（commit `abb2c60`）：从 181 → 138 行，加了"项目执行要点"专属节
- ✅ **GitHub Social Preview** 已设成 raven logo
- ✅ **MIT LICENSE** 已加
- ✅ **rough-loop.md 留根目录**（B 方案明确取舍）：3 个 ts 硬编码路径，挪走风险高于收益

## 🪵 仍在用的 git worktree（2026-05-10 整理后保留）

> 主 worktree 是 `/Users/Aincrad/dev-proj/predict-raven`（branch `main`）。下面是别的实验分支留的 worktree——不要 force-remove，里面有未合并价值代码。
> 已清理的 2 个废稿 worktree：`spike/karpathy-autoresearch`（8 周前）+ `exp/pulse-timeout-calibration`（7 周前 base 太旧），分支已删

- **`/Users/Aincrad/dev-proj/predict-raven-aw`** (1.2GB, branch `raven-aw`, 22fa56f)
  - 24 个 modified + 4 个 untracked（最大价值：`services/executor/src/lib/okx-agentic-wallet.{ts,test.ts}` + `docs/agentic-wallet-setup.md`）
  - 状态：**未合并的 OKX agentic-wallet 实验**（独立于 Mode A / Pulse 主线）。2026-05-15 复查：新增 `WALLET_PROVIDER=onchainos`、OnchainOS EIP-712 signer、`poly:aw:check/trade`、root env 搜索修复、`pulse-live` OnchainOS preflight。`pnpm exec vitest run --config config/vitest.config.ts services/executor/src/lib/okx-agentic-wallet.test.ts` 10/10 pass；`pnpm --filter @autopoly/executor typecheck` pass。直接跑 repo `pnpm test -- ...` 会因 AW worktree 缺 `vendor/repos/all-polymarket-skill/.../SKILL.md` 导致 unrelated provider-runtime 3 fail。
  - 2026-05-15 主 worktree 已用 HYCRPG owner `0xb266...fed6` + deposit wallet `0x70aC...d55a` + `@polymarket/clob-client-v2@1.0.6` 跑通 `$5` England NO FOK：CLOB `success=true`、`status=matched`、order `0xec2c...f5a2`、tx `0x841c...b3d1`。下一步：把 `okx-agentic-wallet.ts`、`polymarket-sdk.ts` identity/POLY_1271 解析、`env-file.ts` root env 搜索、`ops/live-check.ts` 只读 check/trade 入口分批 cherry-pick 到 main；不要直接整包合并 AW worktree。

- **`/Users/Aincrad/dev-proj/predict-raven-persistence-plan`** (679MB, branch `codex/persistent-runtime-plan`, d939b6e)
  - 5 modified + 5 untracked（关键：`services/orchestrator/src/runtime/raven-agent-loop.{ts,test.ts}` + `docs/internal/plan/2026-05-04-persistent-runtime-plan.{md,en.md}`）
  - 状态：**部分已合并**——`scripts/agent-persistent-runner.ts` 已经在 main（commit `6d1ca6c`）。`raven-agent-loop` 模块还没合
  - 下一步：把 `raven-agent-loop` 独立 cherry-pick 进 main 或废弃整个 worktree

## 📝 已知踩过的坑（避免重复）

- `claude --print` 子进程偶尔 0 字节挂 5+ 分钟 → 不是失败，等
- 移动 `vitest.config.ts` 到 `config/` 后必须 `root: REPO_ROOT` 否则找不到 `@autopoly/*` workspace 包
- `git mv` 整目录时未追踪文件不会被 git 移动，要手动 `mv`
- 4/24 跑 v2 smoke 时 no1 钱包 USDC.e 有 $3.96 但 pUSD 为 0 → 验证 SDK 接入正常但下单需要先 wrap

## 🔄 上次会话留下的上下文（2026-06-07）

- 用户要求：按图片流程改造 Pulse 主流程，记录未实现缺口和新增 LLM/外部比对成本；抽象成类似 Manus 的前端预测引擎 demo；部署到 Vercel。
- 已实现：`services/orchestrator/src/pulse/stage-flow.ts` 定义 7 阶段流程、实现状态、缺口、外部请求/LLM/token/耗时估算；`full-pulse.ts` 将 `stage_flow` 写入 research context 并要求 LLM 按阶段输出。
- 前端：`apps/web/app/prediction-engine/page.tsx` + `apps/web/components/prediction-engine-demo.tsx` + `apps/web/app/api/prediction-engine/run/route.ts`。API route 支持 local/VPS/demo 三档：本地开发可配 `PREDICTION_ENGINE_LOCAL_API_URL` 或 `PREDICTION_ENGINE_LOCAL_API_BASE_URL`；Vercel 线上应配 `PREDICTION_ENGINE_API_URL` 或 `PREDICTION_ENGINE_API_BASE_URL` 调 VPS；未配置才走 read-only demo。`PredictionEngineRun` 已包含 `service` 和 `progress`，前端 Run Console 会显示服务来源、当前步骤、步骤成果和 artifact label；demo 模式不跑真实 Pulse、不联网抓证据、不下单。
- 文档：新增 `docs/diagrams/prediction-engine-stage-flow.md` 和英文版；`docs/diagrams/pulse-live-flow.{md,en.md}` 已更新跳转。默认 4 候选下，本次 `stage_flow` 预计只新增约 2k-4k input tokens、0 外部请求、0 额外 LLM 调用；严格对齐图片流程预计 +22 到 +46 外部请求、+0 到 +1 LLM 调用、+8.5k 到 +36.2k input tokens、+6.2k 到 +12.8k output tokens、+4 到 +14 分钟。
- 验证：`stage-flow.test.ts` + `full-pulse.test.ts` 4 tests pass；`pnpm --filter @autopoly/web typecheck` pass；`pnpm --filter @autopoly/web build` pass；此前 `pnpm typecheck` 全 9 workspace pass。浏览器本地验收桌面和 390px 移动端均无横向溢出、console error 0；临时 local mock 服务 `127.0.0.1:8787` 通过 `127.0.0.1:3008` 页面确认显示 `Local host`、后端 endpoint、Run Console 和本地步骤成果。Vercel preview Ready：`https://web-l6lenq4qs-alchemist-xs-projects.vercel.app`，但浏览器访问被 Vercel login/SSO protection 重定向，未完成公开页面验收。预测引擎 demo 工作没有运行 `forecast:live` / `daily:forecast`，没有真钱下单。
- 用户随后要求先做 social login 和限量。已新增 `next-auth@5.0.0-beta.31`、`apps/web/auth.ts`、`/api/auth/[...nextauth]`、`/sign-in`、`/invite`、`/api/invite/accept`、`apps/web/lib/prediction-access.ts`。DB 新增 `app_users` / `invite_codes` / `prediction_usage_events`，migration `packages/db/src/migrations/0004_prediction_access.sql`；root 新增 `pnpm prediction:invite` 生成邀请码。默认未配置 auth 时 demo 仍开放；生产启用需配置 OIDC env + `DATABASE_URL` + `PREDICTION_AUTH_REQUIRED=true` 并先跑 migration。验证：`pnpm typecheck` 全 9 workspace pass；`pnpm --filter @autopoly/web build` pass；本地 `/sign-in` 200 且配置缺失提示正常，`/api/prediction-engine/run` 在 auth disabled 下仍返回 demo。
- 用户随后要求先建未来拆分用的两个 private repo，并把对应代码写进去。已创建并推送首版：`raven-cloud` latest `10ee63e`，`raven-web` latest `1e0fc28`。`raven-cloud` 提供 `/healthz`、`/v1/prediction-runs`、`/v1/me/limits`、`/v1/invites/accept`、`/v1/admin/invites`，默认 demo runner 不跑真实 Pulse、不抓实时证据、不下单；`pulse_command` 模式默认拒绝 `forecast:live` / `daily:forecast` / `--trade` / `AUTOPOLY_EXECUTION_MODE=live`。`raven-web` 提供 App Router 控制台、Auth.js OIDC 登录、邀请码页、quota 展示和 cloud proxy。本地验证：cloud `pnpm typecheck` / `pnpm test` / `pnpm build` pass，web `pnpm typecheck` / `pnpm build` pass；启动 `127.0.0.1:8788` + `localhost:3009` 后 Playwright 桌面和 390px 移动端跑通预测，console error 0，移动端无横向溢出；GitHub Actions 最新 CI 两边均 pass。
- 用户要求“今天推荐两个市场，完成下单，并生成 PDF 报告”。按保守实盘口径使用 `.env.pizza`、`AUTOPOLY_EXECUTION_MODE=live`、`AGENT_DECISION_STRATEGY=pulse-direct`、`PULSE_ENTRY_MAX_PLANS=2`、`PULSE_ENTRY_FIXED_NOTIONAL_USD=5`。
- 只读推荐成功：`pnpm exec tsx scripts/pulse-live.ts --recommend-only --json`，runId `118013ab-cef5-4565-95a9-676078767be8`，归档 `runtime-artifacts/pulse-live/2026-06-07T025017Z-118013ab-cef5-4565-95a9-676078767be8/`。PDF：`decision-report.pdf`。Pulse：`runtime-artifacts/reports/pulse/2026/06/07/pulse-20260607T025023Z-claude-code-full-118013ab-cef5-4565-95a9-676078767be8.{md,json}`。
- 推荐出的两个新开仓市场：`will-new-people-nl-gain-the-most-seats-in-the-next-russian-parliamentary-election`（No 侧，AI 估 Yes 25% / No 75%，edge 约 11.65pp，低置信度，$5）和 `will-satoshi-move-any-bitcoin-in-2026`（No 侧，AI 估 No 97%，edge 约 5.05pp，$5）。
- 两个新开仓均被执行层总敞口风控拦截：当前 exposure 约 `$382.96`，上限约 `$364.15`，headroom `$0.00`。同一轮 Position Review 触发 `will-ethereum-dip-to-1400-in-june-2026` close：止损阈值 30%，计划卖出 `59.6943` shares，约 `$32.35`。
- 尝试先执行 ETH close 释放敞口：复用同一 Pulse 产物跑 live，runId `602da344-567c-4e03-9ae6-e5d12231e58a`，归档 `runtime-artifacts/pulse-live/2026-06-07T025942Z-602da344-567c-4e03-9ae6-e5d12231e58a/`。CLOB 拒单：`403 Trading restricted in your region`；`orderId=null`，0 成交；失败 run 也已生成 `decision-report.pdf`。
- 用户随后授权对 `will-satoshi-move-any-bitcoin-in-2026` 做 `$1` 测试。用现有 executor 入口执行：`ENV_FILE=/Users/Aincrad/dev-proj/predict-raven/.env.pizza AUTOPOLY_EXECUTION_MODE=live pnpm --filter @autopoly/executor exec tsx src/ops/live-check.ts --json --slug will-satoshi-move-any-bitcoin-in-2026 --direction no --trade --max-usd 1`。预检读到 `NO` bestAsk `0.920`、`minOrderSize=5`、collateral `223.961524 USDC`；真实 `/order` 仍返回 `403 Trading restricted in your region`，`orderId=null`，0 成交。事后只读复核：`satoshiMatches=[]`，collateral 仍 `223961524` raw。归档：`run-error/2026-06-07T043859Z-satoshi-geo-live-check/summary.md`。
- 本轮没有完成下单，原因是外部 CLOB 地区限制，不是余额或推荐生成失败。下一步：用户切到 CLOB 订单 API 可交易地区后，先复查 `curl -s https://polymarket.com/api/geoblock`，再复用上述 Pulse artifact 先 close ETH，随后重跑同一 Pulse 产物尝试两个 `$5` 新开仓；不要绕过总敞口硬上限。

## 🔄 上次会话留下的上下文（2026-06-05）

- 用户要求修改 repo：Pulse 必须做 web-search；如果尝试 2 分钟失败/超时就继续流程。
- 已新增 `services/orchestrator/src/pulse/web-search.ts`，在 full Pulse context 中写入 `web_search`；默认 `PULSE_WEB_SEARCH_ENABLED=true`、`PULSE_WEB_SEARCH_TIMEOUT_SECONDS=120`。搜索失败/超时只记录 `status=failed/timed_out` 和 `failureReason`，不会阻断报告渲染。
- `full-pulse` prompt 已要求模型必须读取 `web_search`：completed 时纳入证据链/概率/信息源；timed_out/failed/disabled 时明确说明已尝试但失败/超时/关闭，不得写成本次未尝试外部 web-search。
- 验证：targeted Vitest 7 files / 19 tests pass；`pnpm test` 52 files / 426 tests pass；`pnpm typecheck` 全 9 workspace pass。没有运行 `forecast:live` / `daily:forecast`，没有真实下单。
- 已新增泛化概率分析 skill：`skills/probability-analysis/`（中英 SKILL + agents metadata）。核心要求：先理清结算定义，按关键节点设计搜索，收集官方/主流/当事方/第三方/政治/军事证据，做条件概率模型；用户要求排除预测市场价格时不得用市场价格更新概率。
- 本轮按该 skill 重做 US-Iran nuclear deal by 2026-06-30 的只读分析，排除预测市场价格与截图 mock 数据；独立归档：`runtime-artifacts/probability-analysis/2026-06-05-us-iran-nuclear-deal/`，zip：`runtime-artifacts/probability-analysis/2026-06-05-us-iran-nuclear-deal.zip`。结论概率：Yes 24%。按项目规则也跑了 `pnpm forecast:recommend -- --json` 只读 Pulse，归档：`runtime-artifacts/pulse-live/2026-06-04T172726Z-55625808-4a69-46f2-a2d3-82290258042c/`；没有真实下单。

## 🔄 上次会话留下的上下文（2026-06-04）

- 用户明确要求“运行一个新的 pulse 进程，并完成下单”。本轮按真钱 live 路径执行：`pnpm daily:forecast -- --json`，默认 env `/Users/Aincrad/dev-proj/predict-raven/.env.pizza`，`AUTOPOLY_EXECUTION_MODE=live`，`AGENT_DECISION_STRATEGY=pulse-direct`。没有加 `--recommend-only`。
- 启动前检查显示 worktree 在 `HFT-Raven`，代码 HEAD `abf366d`；运行结束后 reflog 显示已切回 `main`，HEAD 仍是同一 commit。当前只有两份未提交 HFT 计划文档和本轮 handoff/equity-history 运行产物，未改交易代码；因此本轮 live Pulse 使用的交易代码等同 `main@abf366d`。
- Preflight 通过：collateral reported/onchain 均约 `$335.66`，remote positions `6`，configured min trade `$1.50`，max trade `10%`，max event exposure `15%`。归档：`runtime-artifacts/pulse-live/2026-06-04T125934Z-c6a045aa-606e-407d-a970-0a83b1f9b5b0/`。
- 成功成交 3 个 FOK BUY / No 订单，CLOB 均返回 `success=true`、`status=matched`：
  - `will-ethereum-dip-to-1400-in-june-2026` No：filled `$48.829998`，size `59.694375`，order `0xd526...faf9`，tx `0x568d...01df`。
  - `will-the-carolina-hurricanes-win-the-2026-nhl-stanley-cup` No：filled `$9.019999`，size `15.288134`，order `0x9329...2bc3`，tx `0xc9b7...2a7`。
  - `will-unrwa-win-the-nobel-peace-prize-in-2026-983` No：filled `$32.289999`，size `35.097825`，order `0xfb85...365`，tx `0x732e...52d`。
- 事后复核：本地 executor `fetchRemotePositions(.env.pizza)` 重新读取远端后显示 9 个持仓，包含本轮 3 个新仓；Polymarket public `activity` 最新 3 条 BUY 与上述 tx hash 一致。运行后 collateral/cash 约 `$244.65`。
- 注意：`run-summary.md` 初次汇总里“实际持仓数变化”显示 `+2`，因为当时 post-run position snapshot 没及时包含 UNRWA；随后 public data API / executor 复核确认 UNRWA No 已进入远端持仓。后续若做自动验收，建议在 live run 后增加一次延迟刷新或 retry。
- 注意：本轮对 Hurricanes 和 UNRWA 打印 fee mismatch warning：本地 estimated feeRate `0`，CLOB `base_fee=1000`；已记录在 `fee-discrepancies.jsonl`。这不阻塞成交，但应推动 `fees.ts` 接入 V2 dynamic fee。
- 用户随后要求把“分析与决策 PDF 报告”固定进每次 Pulse 运行，并推送远端。已新增 `scripts/pulse-decision-report.ts`，`forecast:live` / `daily:forecast` 在 recommend-only、completed、以及已有 recommendation 的 failed run 后都会写 `decision-report.{md,en.md,html,pdf}`；JSON 输出新增 `decisionReportPath` / `decisionReportPdfPath`。报告不写死“高质量来源”白名单，而是按 market question / category / tags / resolution rule 动态生成 source needs，并展示实际来源覆盖、概率判断、证据链和推理摘录。验证：`pnpm exec vitest run --config config/vitest.config.ts scripts/pulse-decision-report.test.ts scripts/pulse-live.test.ts` pass；`pnpm typecheck` pass；artifact-only smoke 在本轮 archive 成功生成 8 页 PDF。

## 🔄 上次会话留下的上下文（2026-05-22）

- 用户要求“修复 GitHub 上的 issue 并 PR”。GitHub open issue 里只有真正的 issue #2：`Integrate OKX Agentic Wallet signer and harden OpenClaw provider compatibility`；#1 是旧 PR。
- 当前分支：`codex/aw-agentic-wallet-cap`，基于 `origin/main`，已有 `Add OKX Agentic Wallet live support`，本轮在其上补齐两个缺口：OnchainOS shell-out timeout（`ONCHAINOS_TIMEOUT_MS`，默认 30000ms）与 OpenClaw 2026.5.x 默认 wrapper（`scripts/openclaw-agent-command.mjs`，调用 `openclaw agent --agent main --message ... --json` 并抽取 `payloads[].text`）。
- 关键文件：`services/executor/src/lib/okx-agentic-wallet.ts`、`services/executor/src/lib/polymarket-sdk.ts`、`services/orchestrator/src/{pulse/full-pulse.ts,pulse/pulse-prescreen.ts,runtime/provider-runtime.ts}`、`scripts/openclaw-agent-command.mjs`、`.env.example`、README 中英。
- 验证已完成：`pnpm exec vitest run --config config/vitest.config.ts services/executor/src/lib/okx-agentic-wallet.test.ts services/orchestrator/src/runtime/provider-runtime.test.ts services/orchestrator/src/runtime/pulse-entry-planner.test.ts` 36 tests pass；`pnpm test` 50 files / 419 tests pass；`pnpm typecheck` pass；executor/orchestrator build pass；fake OpenClaw wrapper smoke pass。
- GitHub connector曾因 `chatgpt.com/backend-api/wham/apps` 连接失败，已 fallback 到 `gh`。`gh auth status` 显示账号 `Alchemist-X` 已登录且有 `repo/workflow` scope。issue list 用 REST API 成功。
- 本轮没有运行 `forecast:live` / `daily:forecast`，没有 recommend/live Pulse，也没有真钱下单。

## 🔄 上次会话留下的上下文（2026-05-15）

- 用户要求重新接手 OKX Onchain OS / Agentic Wallet 适配，先从 No1 链路排查，随后明确改为 HYCRPG Agentic Wallet + Polymarket deposit wallet 路线；最终已用测试资金发出一笔 `$5` England NO live smoke 并成交。
- worktree 现状：主 worktree `/Users/Aincrad/dev-proj/predict-raven` 在 `main`，本轮改了 handoff 文档、`pnpm-lock.yaml`、`services/{executor,managed-trading}/package.json`（CLOB SDK `1.0.2` → `1.0.6`）。旧 OKX 实验在 `/Users/Aincrad/dev-proj/predict-raven-aw` (`raven-aw`)，未合并但有可用代码。OnchainOS CLI 本机版本 `2.2.7`，checksum 匹配；当前 `onchainos wallet status` 是 `loggedIn=true`，active account 为 HYCRPG `Account 1`。
- No1 当前状态：`.env.no1` 是 private-key/proxy 配置，signer `0xE14E...dFF1`，funder/Safe `0xc788...2936`，`SIGNATURE_TYPE=2`。`ENV_FILE=.env.no1 pnpm exec tsx scripts/v2-smoke-balance.ts` 能初始化 SDK，但 CLOB 返回 `COLLATERAL balance=0`、allowances 全 0；`forecast:positions` preflight 也显示 `remotePositionCount=0`、reported/onchain pUSD=0。
- 只读 Raven 链路验证：`ENV_FILE=.env.no1` 直接跑 `pnpm --filter @autopoly/executor ops:check` 会找不到 env，因为 filtered package cwd 在 `services/executor`；改用绝对路径 `ENV_FILE=/Users/Aincrad/dev-proj/predict-raven/.env.no1` 后 check 成功，能读 CLOB、挑市场、读 orderbook，但余额仍为 0，候选还可能是 `restricted=true`。这个 env 解析修复已经在 AW worktree 的 `services/executor/src/lib/env-file.ts`。
- Pulse 只读验证：`AUTOPOLY_EXECUTION_MODE=live ENV_FILE=.env.no1 pnpm forecast:live -- --recommend-only --positions-only --json` 通过 preflight 后失败在 `provider=none`：`.env.no1` 没有 `AGENT_RUNTIME_PROVIDER` / provider command。归档：`runtime-artifacts/pulse-live/2026-05-15T081723Z-pending/`；第一次没带 `AUTOPOLY_EXECUTION_MODE=live` 的 preflight 失败归档：`runtime-artifacts/pulse-live/2026-05-15T081555Z-pending/`。
- 目前阻塞真实下单的最小清单：No1 需要可用 pUSD/Polymarket collateral；`.env.no1` 需要补 runtime provider（可参考 `.env.pizza` 的 `AGENT_RUNTIME_PROVIDER=claude-code` / `AGENT_DECISION_STRATEGY=pulse-direct`）；main 需要合入 AW 的 OnchainOS signer/env 搜索/identity preflight；若走 OKX AW，必须先登录 OnchainOS 并确认 active EOA 与 No1/目标 Polymarket deposit wallet 的 signer/funder 关系。
- 用户随后纠正：不该走 No1 `.env` 私钥路线，应通过 HYCRPG 账号新建 Agentic Wallet 地址来下单。已用 OTP 登录 `hycrpg@gmail.com`，执行 `onchainos wallet add` 新建并自动切到 `Account 2`：accountId `0d3d2176-bea0-468a-b904-774e6321d661`，Polygon/EVM 地址 `0xc8c6af4da50b05f7183418bea68597d3d764b772`，Solana 地址 `Bg3ReK...uJra`。
- `Account 2` 当前状态：`onchainos wallet balance` 显示 total `$0.00`；Polygon pUSD (`0xc011...2dfb`) balance=0；`https://gamma-api.polymarket.com/public-profile?address=0xc8c6...b772` 返回 `profile not found`。EIP-712 签名 smoke 成功：`onchainos wallet sign-message --chain 137 --from 0xc8c6...b772 --type eip712 ...` 返回 signature。
- HYCRPG `Account 1` 仍持有约 `$30.01` pUSD，EVM `0xb266dd8d835e3388d0eaf0bf7efff3bb732dfed6`；Polymarket public profile 同样 `profile not found`。不要擅自转 pUSD 到 Account 2；这是资金操作，需要用户明确确认。
- 用 AW worktree 对 `Account 2` 跑 Raven executor 只读 check（inline `WALLET_PROVIDER=onchainos`, `PRIVATE_KEY=`, `FUNDER_ADDRESS=`, `SIGNATURE_TYPE=0`, `POLY_CLI_ENABLED=false`）能进入 OnchainOS signer 并读到 Polymarket market/orderbook；CLOB 曾打印 `Could not derive api key!`，但 check 最终输出 signer/funder 都是 `0xc8c6...b772`、walletMode=`eoa`、signatureType=0、balance=0。真实下单前仍需解决资金 / Polymarket profile 或 deposit-wallet flow。
- 用户明确授权用测试资金买 `$5` England World Cup Winner 的 NO。先尝试 `Account 1 -> Account 2` 转 `10 pUSD`，失败：`MATICInsufficient balance for network fee`，无转账。随后改用有 pUSD 的 HYCRPG `Account 1` 直接做 Agentic Wallet 下单 smoke：目标市场 `will-england-win-the-2026-fifa-world-cup-937`，NO token `77121637225348873006259930776623502125079210522997384841464684944292365296940`，preflight 读到 CLOB collateral `30`、NO bestAsk 约 `0.887`、min size 5。真实 `/order` 请求被 Polymarket 拒绝：`403 Trading restricted in your region`，`orderId=null`，无成交。事后复核：Account 1 pUSD 仍 `30`，`data-api.polymarket.com/positions` 和 `activity` 对 `0xb266...fed6` 均为空数组。结论：AW 签名 + CLOB 构单已到 `/order`，当前 blocker 是 Polymarket geoblock / allowed-region 环境，不是 Raven signer 组装。
- 用户随后要求用 No1 挂一个不会成交的单再取消，以确认是否仍是 geoblock。2026-05-15T08:44Z 用 `.env.no1` 对 England NO 发起 no-cross GTC：`BUY price=0.001 size=5000`（最大 `$5`，当时 bestAsk `0.887`），preflight 显示 No1 CLOB collateral `$0`、allowances 全 `0`，但 orderbook 可读。请求到达 `/order` 后仍先被 Polymarket 拒绝：`403 Trading restricted in your region`，`orderId=null`，因此没有 cancel 对象；事后复核 No1 collateral 仍 `$0`、public positions `[]`、最新 public activity 早于本次 smoke；`https://polymarket.com/api/geoblock` 显示当前执行环境 `blocked=true`、`country=FR`。归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T0844Z-no1-geoblock/summary.md`。结论：当前执行环境的 Polymarket geoblock 发生在余额不足之前；给 No1 转钱仍是后续 accepted-order smoke 的必要条件，但不会单独解决 geoblock。
- 用户说已切换后要求再测。2026-05-15T09:00Z 复查 `https://polymarket.com/api/geoblock`：`blocked=true`、`country=TW`、`region=TPE`；Polymarket 文档列 `TW Taiwan` 为 close-only，所以 opening BUY 仍不可发。OnchainOS 当前 active 为 HYCRPG `Account 1`（`0xb266...fed6`），Polygon pUSD 约 `$30.01`；AW worktree 只读 check 成功识别 `walletProvider=onchainos`、signer/funder `0xb266...fed6`、walletMode `eoa`、signatureType `0`、CLOB collateral `$30`，England NO book 可读（bestBid `0.886` / bestAsk `0.887`），market `restricted=true`。未重复发真实 opening order。归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T0900Z-hycrpg-tw-close-only-preflight/summary.md`。
- 用户随后切到 JP 要求再测。2026-05-15T08:57Z `geoblock` 返回 `blocked=true`、`country=JP`、`region=13`，但 Polymarket 文档列 JP 为 frontend-only restriction，不是 API blocked；因此按用户先前授权发起 HYCRPG Account 1 `$5` England NO FOK smoke。请求到达 `/order`，不再是 geoblock，改为 `400 maker address not allowed, please use the deposit wallet flow`；`orderId=null`、无成交。复核：Account 1 Polygon pUSD 仍 `30`，public positions/activity `[]`，public profile not found，relayer deployed checks 对 `0xb266...fed6` 的 `SAFE=false`、`WALLET=false`。结论：Agentic Wallet EOA 直签 `signatureType=0` 不可用于这个新 API 账户；下一步必须接 Polymarket deposit wallet：deploy/derive deposit wallet、把 pUSD 放到 deposit wallet、由 deposit wallet 做 approvals、CLOB sync `signature_type=3`、下单用 `POLY_1271` 且 maker/signer 都是 deposit wallet。归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T0857Z-hycrpg-jp-deposit-wallet-required/summary.md`。
- 已继续 deposit wallet flow：为 HYCRPG owner EOA `0xb266...fed6` 派生并部署 deposit wallet `0x70aC00EACb8345B209cdc68e830a18874aEFd55a`；relayer transaction ID `019e2ae0-7cb8-7557-adc6-c01ac0450a6b`，hash `0xd958cb81d53bd874f14c441568b4a4270b6a3d3b277e74201aab619bd03f40b8`，observed `STATE_MINED`，`/deployed?type=WALLET` 返回 `true`。归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T0903Z-hycrpg-deposit-wallet-deployed/summary.md`。
- 用户给 owner EOA 打入 Polygon 原生 gas（当前是 POL；部分钱包仍显示 MATIC）后，按用户确认把 `10 pUSD` 从 owner EOA 转到 deposit wallet。pUSD 转账 hash `0xf2f657f33347472d4294e987a60750f358a411b62d18b62e0f11dfb46358e5f6`；随后通过 relayer 让 deposit wallet 对 3 个 CLOB spender 做 max approve，relayer tx ID `019e2b05-0301-7155-b5aa-34b56a8d2464`，onchain hash `0xb4f861bdb4c791ec51a8deeeb3da60b438c06407dd962206949e9bdcc9f2d1c7`。CLOB `balance-allowance/update?signature_type=3` 后显示 deposit wallet collateral `10000000`，allowance 全 max。
- 第一次 `POLY_1271` 下单尝试失败在本地 SDK 版本：`@polymarket/clob-client-v2@1.0.2` 生成的订单是 `maker=deposit wallet` 但 `signer=owner EOA`，CLOB 返回 `400 the order signer address has to be the address of the API KEY`，无成交。已将 `services/executor` 与 `services/managed-trading` 的 `@polymarket/clob-client-v2` 升级到 `1.0.6`；该版本会在 `POLY_1271` 下生成 `maker=signer=deposit wallet`，并输出 ERC-7739 wrapped signature。
- 成功 smoke：2026-05-15T09:55Z 用 HYCRPG Agentic Wallet owner `0xb266...fed6` 签名、deposit wallet `0x70aC...d55a` 出资，对 England World Cup Winner NO 发 `$5` FOK BUY。订单 preview：`maker=signer=0x70aC...d55a`、`signatureType=3`、signature length `636`、`makerAmount=5000000`、`takerAmount=5636970`。CLOB 返回 `success=true`、`status=matched`、order ID `0xec2c54cbc318321068630669f92c531db3cc7b5bc9829d06b977157f781cf5a2`、tx `0x841cc5185ec02cb230ff242bc3931ea6b284c20da015e34cd5f146c61572b3d1`。
- 事后复核：Polygon receipt `status=0x1`；deposit wallet pUSD `4.983052`、owner EOA pUSD `20`、deposit wallet England NO ERC-1155 balance `5.636977`；Polymarket public positions/activity 均能看到 `Will England win the 2026 FIFA World Cup?` / `No` / size `5.6369` / avgPrice `0.8869`。验证：`pnpm --filter @autopoly/executor typecheck` pass；`pnpm --filter @autopoly/managed-trading typecheck` pass。归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T0955Z-hycrpg-poly1271-smoke/summary.md`。
- 用户要求临时限制：只推荐一个最优仓位，下单金额先是 `$5`，随后因 15% 单笔上限改为 `$1`。已在主 worktree 实现 `PULSE_ENTRY_MAX_PLANS=1` + `PULSE_ENTRY_FIXED_NOTIONAL_USD=<amount>` 路径，并在 `forecast:live` preflight/归档里显示这两个约束。验证：`pulse-entry-planner.test.ts` / `pulse-direct-runtime.test.ts` / `okx-agentic-wallet.test.ts` 32 tests pass；`pnpm typecheck` 全 9 workspace pass。代码归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T1020Z-pulse-entry-limit/summary.md`。
- 已用一次性 env `runtime-artifacts/okx-aw-smoke/2026-05-15T1026Z-aw-pulse-one-best/aw-pulse.env` 跑真实 AW `forecast:live`（不是 recommend-only）：`PULSE_ENTRY_MAX_PLANS=1`、`PULSE_ENTRY_FIXED_NOTIONAL_USD=1`、`MIN_TRADE_USD=1`。结果：preflight 通过，signer `0xb266...fed6`、funder `0x70aC...d55a`、signatureType=3、collateral `4.983052 pUSD`、远端持仓 1；Pulse 选出唯一新开仓 `bun-b04-hsv-2026-05-16-hsv` / `No` / `$1`，但 execution plan 被 Polymarket 最小订单量拦截：`5 shares @ $0.92 ask => $4.60 minimum`，所以 `executedOrders=0`，没有下单成交。归档：`runtime-artifacts/pulse-live/2026-05-15T103127Z-8447b494-9a42-4f95-8dab-976c56048f31/`；AW 摘要：`runtime-artifacts/okx-aw-smoke/2026-05-15T1026Z-aw-pulse-one-best/summary.md`。
- 用户确认临时把 AW 单笔 cap 设为 50%，从 ACC1 `0xb266...fed6` 把全部 `20 pUSD` 转入 deposit wallet `0x70aC...d55a`，并 live 买入 `bun-b04-hsv-2026-05-16-hsv` / `No` / `5 shares`。执行：OKX 先返回 contract-recipient 确认，用户二次确认后用 raw `20000000` pUSD base units 转账，tx `0x42552c...979e`；随后 FOK BUY `5` shares @ `0.92`，notional `$4.60`，order `0x10ec...a093`，tx `0x06b5...13ef`，CLOB status `matched`。事后复核：owner pUSD `0`，deposit wallet CLOB collateral `20.372012 pUSD`，public activity / positions 均显示 HSV No `5` shares。归档：`runtime-artifacts/okx-aw-smoke/2026-05-15T1245Z-aw-hsv-no-5shares/summary.md`。
- 已修复 public equity history 污染：此前 `forecast:live` 成功路径无条件调用 `appendEquitySnapshot()`，会把 AW 小账户净值追加到 `apps/web/public/equity-history.json`。现在默认只有 active env 文件名是 `.env.pizza` 才会写 Pizza public chart；AW/No1/artifact env 只写 run archive。可用 `PUBLIC_EQUITY_HISTORY_ENABLED=true/false` 明确覆盖。验证：`scripts/equity-snapshot.test.ts` 3 tests pass；`pnpm typecheck` pass。

## 🔄 上次会话留下的上下文（2026-05-10）

- 用户要求“风格和原版网站不一样、信息和布局基本不变、先做三个版本预览、不要直接投 production”。已新增三个 preview route：`/previews/pizza-ledger-folio`（纸面研究简报）、`/previews/pizza-ledger-terminal`（深色 operator terminal）、`/previews/pizza-ledger-exchange`（清爽券商看板）。实现方式是 `ProphetsProfitSnapshot` 支持 `variant="folio" | "terminal" | "exchange"` 和 preview-only `as="div"`，避免在 preview shell 的 `<main>` 内嵌套 `<main>`；首页默认仍是 `variant="original"`。
- Preview 部署：最终可评审 URL 是 `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app`（deploy `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P`，`target=preview`，`status=Ready`）。没有执行 `vercel deploy --prod`，正式 alias `https://autopoly-pizza-spectator.vercel.app` 未切换。
- 验证：`pnpm --filter @autopoly/web typecheck` pass；`pnpm --filter @autopoly/web build` pass；本地 `http://localhost:3007` 和 Vercel preview 三条 route 全部 Playwright 通过，console/page error 为 0，手机宽度 `overflowPx=0`，并确认显示 Pizza 标记 `$500.00` starting capital / `34 fills`。实时 mark 验收时 preview 显示 `ending_nav≈$554.25`、`roi≈+10.85%`。截图：`output/playwright/pizza-preview-{folio,terminal,exchange}.png` 和 `output/playwright/pizza-preview-live-{folio,terminal,exchange}.png`。
- 用户确认切正式并要求适配自己的数据。`apps/web` 根路径 `/` 仍使用 prophets-profit 的 "Live Trading Snapshot" 外观，但数据源已改为 `GET /api/public/trading-snapshot`，由 `apps/web/lib/trading-snapshot.ts` 聚合 Polymarket public wallet `overview / positions / closed-positions / activity`、`public/equity-history.json`、`public/pulse-position-review.json`。
- 已删除源站 Kalshi 静态 `paper-trades.json`，避免线上混用。新增 `apps/web/public/trading-snapshot-config.json`，用于 production 环境没有 `INITIAL_BANKROLL_USD` 时把 Pizza 起始资金固定为 `$500`；否则线上会误用 equity history 第一条 `$20` 计算 ROI。
- 当前 production 数据口径：正式 API 返回 `starting_capital=$500`、`ending_nav≈$556.98`、`net_pnl≈+$56.98`、`roi≈+11.40%`、`34` fills、`20` markets、`7` open。`pulse-position-review.json` 来自 `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/recommendation.json`，只包含公开 review 摘要和来源链接。
- Production deploy：`dpl_8is51ocvNuE2H1pxkpBe5UEiEES1`，正式 alias `https://autopoly-pizza-spectator.vercel.app`；中间旧 production `dpl_3uM7bQnMp3p3G6U22wSuKVXvtNLR` 曾暴露过 `$20` 起始资金口径，已由最终部署修正。
- 验证：`pnpm --filter @autopoly/web typecheck` pass；`pnpm --filter @autopoly/web build` pass；本地 `http://localhost:3007` 和 production Playwright 首屏/筛选/搜索/展开 Delcy rationale 通过；production `/api/public/trading-snapshot` 返回 200；Playwright console error 0。截图：`output/playwright/pizza-adapted-local.png`、`output/playwright/pizza-adapted-production.png`。
- 本轮没有运行 `forecast:live` / `daily:forecast`，没有真实下单；只读取现有 Pulse 归档和 Polymarket 公开接口。

## 🔄 更早会话留下的上下文（2026-05-08）

- 2026-05-08 用户明确要求：任何事件概率 / fair probability / edge 必须调用 Pulse 流程；review 当前持仓时是“用 Pulse 分析已有持仓”，不是扫市场找新标的。`AGENTS.md` / `claude.md` / `docs/en/AGENTS.md` / `docs/en/CLAUDE.md` 已同步写入这条规则。
- `pnpm forecast:positions` 已落地：入口在 `scripts/pulse-live.ts`，positions-only 强制 recommend-only；`market-pulse.ts` 生成 existing-position snapshot；`pulse-direct-runtime.ts` 不合成新开仓，只把已有持仓 review 决策写入 final decisions；`pulse-entry-planner.ts` position-only 模式保留所有概率行，不因负 edge / Kelly=0 丢掉。
- 最近一次只读复审：`ENV_FILE=.env.pizza pnpm forecast:positions -- --json` 成功，归档 `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`；Pulse 报告 `runtime-artifacts/reports/pulse/2026/05/08/pulse-20260508T021044Z-claude-code-full-245b4933-880f-47d7-ae86-75d5ffb8b81e.md`。没有下单。
- 当前 7 仓全部 No / hold；有正 edge 的 6 仓：Delcy +9.5pp、Finland +4.15pp、Measles +4.0pp、France +2.85pp、England +2.05pp、Leclerc +1.45pp；Crude edge=0 是因为 Pulse 明确写“AI 概率未评估，规则/CL 数据不足”，下次优先补抓规则和 WTI/CL 数据。
- 验证：`pnpm test -- services/orchestrator/src/runtime/pulse-entry-planner.test.ts services/orchestrator/src/runtime/pulse-direct-runtime.test.ts services/orchestrator/src/review/position-review.test.ts` 实际跑完整 suite，48 files / 402 tests pass；`pnpm typecheck` pass。

## 🔄 更早会话留下的上下文（2026-05-07）

- pulse 质量本轮新增：`scripts/pulse-evaluation-ledger.ts` 负责逐仓 mark attribution + calibration ledger；`scripts/pulse-live.ts` 在 recommend-only/live 成功路径写入对应 artifact；`scripts/live-run-summary.ts` 显示逐仓 PnL 归因。
- 现有仓位复审 v1 已有独立研究入口：`scripts/pulse-position-research.ts` 逐仓抓 Gamma event/market + held-token orderbook，`scripts/pulse-live.ts` 写 `position-research.json`，`position-review` 对未被随机 Pulse 覆盖的仓位标 `fresh-position-research`。仍缺：模型级概率重估、评论/外部来源 crawler。
- Polymarket 性能本轮改动：默认 in-process SDK；poly-cli 变成显式 opt-in fallback；`pulse-live` 单轮缓存 book/avgCost；`buildExecutionPlan` 对 unique tokenId 并发预取订单簿。
- 验证：`pnpm typecheck` 通过；`pnpm test -- services/orchestrator/src/review/position-review.test.ts services/orchestrator/src/review/position-research.test.ts services/orchestrator/src/lib/execution-planning.test.ts` 实际跑完整 vitest suite，47 files / 400 tests 通过。没有跑 `forecast:live`，没有真实下单。

## 🔄 更早会话留下的上下文（2026-05-04）

- 用户决策（plan §0 锁定）：Privy / 一路推到 Phase 3 / **MVP 仅靠 Polymarket Weekly Rewards Pool**（不向用户收 builder fee） / 新建独立 app `apps/raven-managed/`（不动 `apps/web`）
- 营收模型修正：原方案"收 builder fee"是错的。头部 70% 市占率的 betmoar / Based Prediction / Stand.trade 全是 \$0。靠 Polymarket Weekly Rewards Pool（约 0.5-1% of routed volume）赚钱
- 设计原则锁定：**产品界面内不用 AI 生图**（crypto-native 用户对 Midjourney 出来的东西敏感）；off-product marketing 才用 AI 生图。详见 design-elements-inventory §3
- 已有 6 commit on `builder-raven`：`c51cea5` Phase 1 / `22fa56f` revenue model / `11a5554` Safe / `40a7678` viem balance / `ec8c15c` managed-trading skeleton / `11e64f5` design inventory / `1a3406b` build+typecheck fixes
- ⚠️ **worktree 拓扑陷阱**：`/Users/Aincrad/dev-proj/autonomous-poly-trading` 是 `predict-raven` 的 symlink；`/Users/Aincrad/dev-proj/predict-raven-aw` worktree 上有别的 session 的 WIP，**不要强删**
- 历史上下文（2026-04-26）：实盘跑了 `daily:forecast` 3 单全成（finland eurovision / crude oil / france world cup），net $548 → $529

## 📌 引用速查

| 我想知道... | 去看 |
| --- | --- |
| 第一次接手项目（仅一次） | [`docs/agent-onboarding.md`](agent-onboarding.md) |
| 风控完整规则 | [`docs/risk-controls.md`](risk-controls.md) |
| 命令速查 / 部署 | [`docs/diagrams/dev-reference.md`](diagrams/dev-reference.md) |
| 历史 review / decision | [`docs/internal/review/`](internal/review/) |
| 最近一次 pulse-live 跑了啥 | `runtime-artifacts/pulse-live/` 下最新目录 |
