# Delta PM 运维手册 — Setup 清单 · 工作流走查 · Token 实测

> 最后更新:2026-08-23 · 英文版:待同步翻译
> 面向:操作员(你)。目的:①你把外部依赖 setup 好;②你能人工检查系统每一步在干什么(全部用**真实运行数据**填充,不是示意);③回答"这个是不是很消耗 token"。
> 系统现状:Phase 0 影子模式,正式账本在东京 VM(2026-08-23 06:33 UTC 起),本机 soak 已停用(见 §1.4)。

---

## 0. Token 消耗:先说答案——不贵

**单次 LLM 调用实测**(2026-08-23,VM 容器内,gate1 级 prompt):

| 项 | 实测值 |
| --- | --- |
| 新输入 token | 2,578 |
| 系统 prompt 缓存写 | 11,909(claude CLI 自带开销,1 小时内后续调用变缓存读) |
| 缓存读 | 22,914 |
| 输出 token | 1,152 |
| 耗时 | 12.8 秒 |

**折算**:每次调用"新" token ≈ 15.6k;一条深分析新闻 = gate1 + M2 两次调用 ≈ **30k 新 token + ~45k 缓存读**。

**频率实测**:VM 上线 75 分钟消化 30 条真实新闻,共 **15 次 claude 调用**(约一半新闻被规则预筛零成本归档,不花 LLM)。按工作日 8–15 条新闻 + 持仓复审,预估 **每天 10–25 次调用 ≈ 15–25 万新 token**——对订阅额度毫无压力,比 forecast-engine 一轮 live run(12–15 分钟多轮检索)轻一个数量级。系统性省钱开关:`DELTAPM_PROVIDER=deepseek`(接口已留好,配 `DEEPSEEK_API_KEY` 即切)。

设计上便宜的原因:①池外新闻在规则层就归档(标题/别名匹配,零 LLM);②每次调用单发单收、不联网检索;③重复新闻靠指纹去重拦在 LLM 之前。

---

## 1. 你要 setup 的清单(按优先级)

### 1.1 The Information 付费订阅 + newsletter 解析邮箱(激活"完整原文"第 2 层)

1. **建一个专用收件邮箱**(推荐新建 Gmail,比如 `raven.delta.ingest@gmail.com`)——这是机器解析信箱,不做人用。
2. 用**你自己的名字**付费订阅 The Information(ToS 严禁共享账号,订阅主体保持单一自然人)。
3. 在 https://www.theinformation.com/newsletters 把**免费三档**直接用专用邮箱订阅:The Briefing(每周 5 期)、The Information AM(工作日晨)、The Weekend。
4. 订阅者专属的 **AI Agenda**(每周 4 期)与 **Dealmaker**(每周 2 期):在你自己的订阅邮箱里设置自动转发到专用邮箱(Gmail:设置 → 转发和 POP/IMAP → 添加转发地址)。
5. 给专用 Gmail 开 **IMAP + 应用专用密码**(Google 账户 → 安全 → 两步验证 → 应用专用密码)。
6. **凭证直接写进 VM 的 `deploy/raven/.env`**(SSH 上去自己加,不要贴进任何对话):

```
DELTAPM_MAIL_IMAP_HOST=imap.gmail.com
DELTAPM_MAIL_IMAP_USER=raven.delta.ingest@gmail.com
DELTAPM_MAIL_IMAP_PASS=<应用专用密码>
```

邮箱轮询器代码在你建好后我来接(半天工作量);它只做上下文补充与次日对账,永远不是触发路径。

### 1.2 官方内容授权(激活"完整原文"第 4 层,一劳永逸)

入口:https://www.theinformation.com/corporate 的 Content Licensing 表单。建议措辞(可直接复制):

> We operate an internal research system for our own trading desk. We'd like to license machine-readable full-text access to The Information's articles and briefings for internal analysis (including LLM-assisted summarization — no redistribution, no training). Could you share licensing terms and technical delivery options?

### 1.3 Hyperliquid API 凭证(Phase 2 真钱前才需要)

用 **agent/API wallet** 模式:主钱包在 https://app.hyperliquid.xyz/API 生成 agent wallet(只有交易签名权、无提币权),把 agent 私钥写 VM `.env`,**主钱包私钥永不上服务器**。Phase 2 前我会先在 testnet 完成全动作族验证。

### 1.4 本机 claude CLI 重新登录(已坏,影响的只是本机)

2026-08-23 实测本机 claude OAuth token **已被吊销**(401 revoked)——本机 soak 因此只剩 rules 引擎,我已把它停了(**正式账本在 VM,不受影响**,VM 用独立凭证)。想恢复本机跑:老 keychain 顽疾,先清再登:

```bash
security delete-generic-password -s "Claude Code-credentials"
```

```bash
claude auth login
```

### 1.5 raven-labs 装 claude CLI(将来并发测试前)

美西机器(30G 内存、空载)适合当并发测试场,但目前只有 Codex 凭证。跑 LLM 并发测试前需要:`npm i -g @anthropic-ai/claude-code` + `claude setup-token`(用你的订阅)。

---

## 2. 工作流人工走查(真实上下文,非示意)

### 案例 A:真实新闻,规范拒单(最能看出系统性格)

**新闻**(The Information 真实 scoop,feed 抓取):
> *Nvidia AI Chip Prices to Rise About 17%, Server Makers Tell Customers* — published 2026-08-22T23:45:39Z

**① M1 闸门 1(重要性,claude 引擎)**:判定 tradeable、事件类别 `supply_chain/order_contract` 族、主体 NVDA、方向 bullish、粗估影响档 medium。
**② M1 闸门 2(已定价)**:t0 = 23:45 UTC(周六,weekend 时段桶,置信度自动降档);拉 NVDA 与 XYZ100 的 1 分钟 K 线算 β 调整后超额 → **已实现 +0.65%**。
**③ M2(盲测影响分析)**:输入先做价格反应清洗,分析师被禁止看 t0 后走势。产出的真实推理链(thesis 文件原文摘录):

> 渠道调研(2 家服务器厂商,非公司确认)指 GB300 代提价 ~17% → 假设该代产品占 NVDA 总收入 ~45% → 毛收入增量 45%×17% ≈ +7.7% → 假设 45–55% 被 HBM4/CoWoS 成本上涨吃掉 → 净流转 ~50% → 利润当量 +3.8% → EPS 修正 **+3~5%(区间 +1%~+8%)**,因二手信源再打折 → fairImpact = {min +1%, point +3%, max +6.5%},horizon 72h,confidence medium,污染 none。
> falsifiers(可检验):一周内 OEM 或 Nvidia 官方否认/修正 17%;一周内 TrendForce/DigiTimes 级渠道报告给出显著不同(<5% 或 >25%)的数字。

**④ M3(PM 决策)**:保守端 residual = min 1% − 已实现 0.65% = **0.35% < 门槛 1.19%**(门槛 = max(3×往返成本, 0.5×日波动×持有期折算))→ **no_trade**。
**一句话品评**:市场已经把保守情形吃掉大半,剩余边际不够付成本——这正是"不追已定价新闻"的设计在真实数据上生效。

### 案例 B:注入测试,完整开仓路径

SNDK "$9B 独家 NAND 合同"(手动注入):gate1 tradeable 88 分 → gate2 未定价 → M2 给 {min 3%, point 7%, max 13%} → M3 residual 6.00% ≥ 门槛 5.64% → **纸面开仓 long $3,000**,止损按 ATR 菜单 1,580.4、硬地板 1,282.08(−20% 用户红线)、tier-1 上限裁剪记账(意图风险 1% → 实现 0.42%)。

### 你的自查入口(全部现成)

| 想看什么 | 去哪看(VM 上;先 `gcloud compute ssh` 或做 SSH 隧道) |
| --- | --- |
| 系统此刻在干嘛 + 持仓 | `curl -s localhost:8792/status`(或隧道后浏览器开 `localhost:3400` 控制台,有进度条) |
| 每日校准报告 | `curl -s localhost:8792/reflection`;文件在 `runtime-artifacts/delta-pm/reports/` |
| 每条新闻的完整判定 | `runtime-artifacts/delta-pm/signals/<id>.json`(含 firstSeen 依据、已定价数字、Δt) |
| 每份分析师推理原文 | `runtime-artifacts/delta-pm/theses/<id>.json`(impactPath 逐步、falsifiers、limitations) |
| 每个决策为什么开/不开 | `runtime-artifacts/delta-pm/ledger.jsonl` 里 `"type":"decision"` 行(含裁剪与 binding constraint) |
| 系统实际发给 LLM 的 prompt | 代码即真相:`services/delta-pm/src/gate.ts`(GATE1_SYSTEM)、`src/analyzer.ts`(M2_SYSTEM + 清洗规则) |
| 自己注入一条新闻测试 | `curl -X POST localhost:8792/ingest -H "x-delta-pm-token: <VM .env 里的 DELTAPM_INGEST_TOKEN>" -H "content-type: application/json" -d '{"mode":"manual_news","title":"...","text":"..."}'` |
| 补全某条新闻的原文(控制台"补全原文"框,或 curl `{"mode":"paste_full_text","newsId":"...","fullText":"..."}`) | **语义 = 对原信号的重跑,不是新信号**(2026-08-23 修):news id 不变、t0 保持原始 published 时间、标题/URL 从 `runtime-artifacts/delta-pm/news/` 存档(source of truth)回填;原始记录找不到时 404 拒绝(绝不猜 t0=粘贴时刻),可带 `title`+`publishedAtUtc` 强制 |
| 闸门 1 的跨源既有报道检索 | 每条池内新闻分析前先花 ~15s 搜"有没有人更早报过"(`"type":"coverage_check"` ledger 行 + signal 的 `priorCoverage` 字段);发现更早同故事 → t0 前移(安全方向)。需要 VM `.env` 有 `EXA_API_KEY`(或 TAVILY);无 key 记可见跳过,`DELTAPM_COVERAGE_CHECK=0` 可关 |

### 检查时建议盯的四个点(按价值排序)

1. **thesis 的 impactPath 是否在编数**——每步假设有没有写明来源/是假设;limitations 是否诚实(现在共识基线缺失,分析师都标注了)。
2. **priced-in 的 realized 数字**是否与你看盘感受一致(周末/盘外时段置信度应自动降档)。
3. **decision 的 reason**——每个 no_trade 都有带数字的理由,没有黑箱。
4. **反思报告的错杀列**(archivedFullReverse)——被判"已定价/反向"而归档的新闻,24 小时后是否真的没行情;这是 M1 最容易犯错的地方。

---

## 3. 当前运行拓扑(单一事实源)

| 位置 | 状态 | 账本 |
| --- | --- | --- |
| **东京 VM**(delta-pm + console 容器) | **正式 Phase 0 账本**,2026-08-23 06:33 UTC 起跑,claude 引擎正常 | `$10,000`,0 仓(周末流薄,3 次真实分析全部规范拒单) |
| 本机笔记本 | soak 已停(claude 凭证吊销 → 只剩 rules 引擎,继续跑会灌低质信号) | 测试账本(含 SNDK 注入仓),仅作历史参考 |
| raven-labs 美西 | 未部署;定位 = 将来并发测试场(30G 内存空载) | — |
