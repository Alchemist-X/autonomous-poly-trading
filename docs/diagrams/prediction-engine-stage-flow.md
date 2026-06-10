# 预测引擎 Stage Flow 对齐说明

> 最后更新：2026-06-10  
> execution mode：inspect / demo-read-only  
> 决策来源：用户流程图 + `skills/probability-analysis` + 当前 Pulse 实现 + 分支 `pulse-stage-flow-v2` typed 管线

## 人类 review 入口

- `services/orchestrator/src/pulse/stage-flow.ts`
- `services/orchestrator/src/pulse/full-pulse.ts`
- `apps/web/app/api/prediction-engine/run/route.ts`
- `apps/web/app/prediction-engine/page.tsx`
- `apps/web/components/prediction-engine-demo.tsx`
- `apps/web/lib/prediction-engine-demo.ts`

## 现在做到了什么

Pulse research context 现在会写入 `stage_flow` 字段，显式对齐图片里的 7 步：

1. 理清定义
2. 基础推理与搜索 query
3. 证据收集与罗列
4. 证据权重更新
5. 建立结构化模型
6. 贝叶斯式更新
7. 输出结论并比较市场定价

`full-pulse` prompt 现在要求 LLM 读取 `stage_flow`，并在报告中按这些阶段组织候选或已有持仓复审。前端 demo 使用同一套阶段语言展示自然语言事件输入、概率结论、条件概率模型、证据权重和市场偏差。

## Typed 管线现状（分支 `pulse-stage-flow-v2`，2026-06-10）

7 步中的 1-6 + 第二遍 verifier 已落成 **typed、机器可校验**的独立模块（`services/orchestrator/src/pulse/`），每个模块一次结构化 LLM 调用 + 代码级 coerce + 确定性 validator。**尚未接入 live 路径**——接线（`PULSE_TYPED_MODEL` flag）和 stage-7 cutover（`pulse-entry-planner` 概率源切换）是下一步。

### 显式模型分配（stage-models.ts，单一事实源）

| 阶段 | 模块 | 模型 | 性质 |
| --- | --- | --- | --- |
| 1. 理清定义 | `resolution-definition.ts` | Sonnet | 信息 |
| 2. query plan | `query-planner.ts` | Sonnet | 信息 |
| 3. 证据收集 | `evidence-database.ts` | Sonnet | 信息 |
| 4. 证据权重 | `evidence-ledger.ts` | Opus | 判断 |
| 5. 条件概率模型 | `conditional-model.ts` | Opus | 判断 |
| 6. 贝叶斯 delta ledger | `bayes-ledger.ts` | Opus | 判断 |
| 6b. 二遍审计 | `verifier.ts` | Opus | 判断 |

### 关键机制（2026-06-10 多 agent review 加固后）

- **机器校验**（`stage-artifacts.ts`）：乘法对账、贝叶斯 posterior 链逐步对账、跨 stage 外键完整性、summary 从 records 重算、NaN 显式拒绝、方向与 delta 符号一致性、空证据 update 拒绝、stage5→6 基线衔接、marketSlug 全链一致。
- **独立预测防火墙**（`spoiler-firewall.ts`）：host 级 + 内容级（snippet 里引用的赔率）双重拦截；市场价在 stage 6 只 stamp 不进 prompt，prompt builder 签名在类型层面拿不到 marketProb；validator 拒绝含 spoiler 源的存档 artifact。
- **LLM 协议鲁棒性**：stage 3/4 的逐条响应必须带显式 `index` 键（错位/缺条不再静默错配）；不可信 web 文本进 prompt 前 sanitize（防换行注入）；解析失败重试一次；超时 kill 整个进程组。
- **可见降级**：stage 4 打分失败/覆盖不足会在 ledger 上标 `gaps`，不再静默全部回退 neutral。

## 当前仍无法完全实现的地方

| 阶段 | 当前状态 | 缺口 |
| --- | --- | --- |
| 1-6 + verifier | typed 模块已实现（见上表） | **还没接进 `full-pulse.ts`**；接线时候选必须剥掉价格字段（防火墙要求），3 候选批量入口待建。 |
| 3. 证据收集 | typed 模块依赖注入的 search runner | 还没有生产 `StageSearchRunner` 接到现有 web-search；全文抓取、Twitter/X、Reddit、Telegram、军事地图仍缺；现有搜索路径不产 `publishedAtUtc`，接线后 recency 评分会退化为常数 0.3。 |
| 7. 结论/市场比较 | 已实现于可映射市场（live 路径） | cutover 待做：`pulse-entry-planner.ts` 概率源从解析 Markdown 换成读 typed `bayes_ledger`（注意 outcomeLabel 的 Yes 朝向语义）；任意自然语言事件还缺 event-to-market matching。 |
| 跨提供商 | `stage-models.ts` 硬编码 claude-* 模型 id | codex provider 路径（`resolveStageCommandTemplate` 已支持）需要 per-provider 模型映射。 |

## 新增消耗预估

本次已经接入的 `stage_flow` 本身不新增外部请求，也不新增 LLM 调用；它会增加 Pulse report render 的上下文长度。

默认 `PULSE_REPORT_CANDIDATES=4` 时，本次改动预计新增：

| 项 | 估计 |
| --- | ---: |
| 外部请求 | 0 |
| LLM 调用 | 0 |
| 输入 token | 约 +2k 到 +4k |
| 输出 token | 约 +0.5k 到 +1.5k，取决于报告是否展开阶段说明 |
| 墙钟时间 | 通常 +10s 到 +60s，主要来自更长 prompt/report |

如果要做到和图片流程严格一致，建议新增以下能力：

| 能力 | 外部请求 | LLM 调用 | 输入 token | 输出 token | 额外耗时 |
| --- | ---: | ---: | ---: | ---: | ---: |
| LLM query plan | 0 | 可并入现有报告 | 0 | +0.8k 到 +1.5k | +15s 到 +40s |
| 全文证据抓取与交叉比对 | +20 到 +40 | 0 | +8k 到 +20k | +0.9k 到 +1.8k | +1 到 +3 分钟 |
| typed evidence ledger | 0 | 可并入现有报告 | 0 | +1.5k 到 +3k | +45s 到 +90s |
| typed conditional model | 0 | 可并入现有报告 | 0 | +1.5k 到 +3k | +45s 到 +2 分钟 |
| Bayes delta ledger + verifier | 0 | 0 到 +1 | 0 到 +15k | +1k 到 +2.5k | +30s 到 +5 分钟 |
| 任意事件市场匹配 | +2 到 +6 | 可并入现有报告 | +0.5k 到 +1.2k | +0.5k 到 +1k | +10s 到 +45s |

严格模式合计预计：外部请求 +22 到 +46；LLM 调用 +0 到 +1；输入 token +8.5k 到 +36.2k；输出 token +6.2k 到 +12.8k；额外耗时约 +4 到 +14 分钟。

## 前端 demo 状态

`/prediction-engine` 是只读 demo，不运行真实 Pulse、不联网抓证据、不下单。它展示的是生产接口形状：

- 用户自然语言输入事件。
- API 返回 `PredictionEngineRun`。
- 页面展示七阶段进度、Run Console、当前步骤成果、Yes 概率、80% 区间、市场偏差、条件模型、证据权重、缺口说明。

`PredictionEngineRun` 现在包含两块给前端可视化使用的字段：

| 字段 | 用途 |
| --- | --- |
| `service` | 告诉用户当前结果来自 demo、本地 host 服务还是 VPS 服务，并展示安全脱敏后的 endpoint label。 |
| `progress` | 按 Manus 类似的过程流展示每一步做了什么、当前成果是什么、对应 artifact 标签是什么。 |

## 本地 host 服务测试

本地开发时可以让 Next.js route 调本机 host 的预测服务：

```
Browser -> local Next /api/prediction-engine/run -> localhost prediction service -> Pulse artifacts
```

本地 `.env.local` 或启动命令建议配置：

| Env | 含义 |
| --- | --- |
| `PREDICTION_ENGINE_BACKEND_MODE=auto` | 默认模式。非 Vercel 环境会优先使用 local URL；没有 local URL 再看 VPS；都没有才用 demo。 |
| `PREDICTION_ENGINE_BACKEND_MODE=local` | 强制调本地服务；若未配置 local URL 会直接报错，避免误以为跑了真实分析。 |
| `PREDICTION_ENGINE_LOCAL_API_URL` | 完整本地 endpoint，例如 `http://127.0.0.1:8787/prediction-engine/run`。 |
| `PREDICTION_ENGINE_LOCAL_API_BASE_URL` | 本地 base URL，例如 `http://127.0.0.1:8787`；系统会自动拼 `/prediction-engine/run`。 |
| `PREDICTION_ENGINE_LOCAL_API_TOKEN` | 可选本地 bearer token；未配置时会 fallback 到 `PREDICTION_ENGINE_API_TOKEN`。 |

本地服务应该返回同一个 `PredictionEngineRun` 结构。若返回体已经包含 `conclusion` 和 `stages`，Next route 会补充 `service.source=local`、`service.endpointLabel` 和 `service.elapsedMs`，便于前端显示本地服务状态。

## 登录、邀请码和限量

当前已接入最小托管访问控制：

- Social login：Auth.js + generic OpenID Connect，入口 `/sign-in`，回调 `/api/auth/callback/oidc`。
- 用户激活：新用户登录后写入 `app_users`，默认 `pending_invite`；访问 `/invite` 输入邀请码后变成 `active`。
- 邀请码：存储在 `invite_codes`，DB 只保存 hash；创建脚本 `pnpm prediction:invite -- --label beta --max-uses 10`。
- 限量：`prediction_usage_events` 记录每次运行，`/api/prediction-engine/run` 会检查每日、每月和并发 quota。

关键配置：

| Env | 含义 |
| --- | --- |
| `AUTH_SECRET` | Auth.js session secret；生产必填。 |
| `AUTH_TRUST_HOST` | Vercel/反代部署建议 `true`。 |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | OpenID Connect provider 配置。 |
| `OIDC_SCOPE` | 默认 `openid email profile`。 |
| `PREDICTION_AUTH_REQUIRED` | `true` 时配置缺失会 fail-closed；默认 false，方便 demo 不被误锁死。 |
| `PREDICTION_INVITE_REQUIRED` | 默认 true；false 时登录用户自动激活。 |
| `PREDICTION_ADMIN_EMAILS` | 逗号分隔；匹配后 role=`admin`，默认可绕过 quota。 |
| `PREDICTION_AUTO_ACTIVATE_EMAIL_DOMAINS` | 逗号分隔；这些邮箱域登录后可自动激活。 |
| `PREDICTION_DAILY_RUN_LIMIT` | 默认 5；`0` 表示不限。 |
| `PREDICTION_MONTHLY_RUN_LIMIT` | 默认 50；`0` 表示不限。 |
| `PREDICTION_CONCURRENT_RUN_LIMIT` | 默认 1；`0` 表示不限。 |
| `PREDICTION_ADMIN_BYPASS_QUOTA` | 默认 true。 |

## 线上调用 VPS 服务

线上 Vercel 服务不应该直接在 serverless route 里跑重型 Pulse。当前设计是：

```
Browser -> Vercel /api/prediction-engine/run -> VPS-hosted prediction service -> Pulse artifacts
```

Vercel 侧需要配置：

| Env | 含义 |
| --- | --- |
| `PREDICTION_ENGINE_BACKEND_MODE=auto` 或 `vps` | 线上建议 `auto` 或显式 `vps`；Vercel 环境不会自动优先使用 local URL。 |
| `PREDICTION_ENGINE_API_URL` | 完整 VPS endpoint，例如 `https://<vps-domain>/prediction-engine/run`。优先级最高。 |
| `PREDICTION_ENGINE_API_BASE_URL` | VPS base URL，例如 `https://<vps-domain>`；系统会自动拼 `/prediction-engine/run`。 |
| `PREDICTION_ENGINE_VPS_URL` | `PREDICTION_ENGINE_API_BASE_URL` 的兼容别名。 |
| `PREDICTION_ENGINE_API_TOKEN` | 可选 bearer token；配置后 Vercel 会带 `Authorization: Bearer <token>` 调 VPS。 |
| `PREDICTION_ENGINE_API_TIMEOUT_MS` | 可选超时，默认 `120000`。 |

如果配置了 VPS backend 但请求失败，Vercel route 会返回 `502`，不会静默 fallback 到 demo；只有完全未配置 VPS URL 时才走 `buildPredictionDemoRun()`。

下一步要接真实 Pulse 时，在 VPS 服务里实现同一接口：

1. 创建 read-only Pulse run；
2. 写入 `recommendation.json` / `web_search` / `stage_flow` / future `evidence_ledger`；
3. 返回同一 `PredictionEngineRun` 结构给前端。
