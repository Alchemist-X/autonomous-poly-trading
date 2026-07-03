# 仓库复杂度三阶段重构计划

> 状态：**Stage 1 执行中**（2026-07-03 用户批准）。英文版待同步翻译。
>
> 依据：2026-07-03 十路并行诊断（全仓 ~84k 行 TS/Python，443 次工具调用，每个死代码判定均做过全仓引用搜索）。诊断原始发现归档于当次会话 workflow `wf_ae1b75f2-3a5`。

## 0. 诊断结论（为什么要重构）

复杂度不是"代码写得烂"，而是三个结构性问题叠加：

1. **质量门禁缺失**：CI 只有世界杯站部署（`wc-results.yml`），884 个测试从不在 CI 跑，主干已有 3 个稳定失败无人发现（provider-runtime.test.ts 依赖 gitignored 的 `vendor/repos`）；`scripts/` 1.26 万行（含实盘下单入口）不在任何 tsconfig 里，类型错误只能在真钱运行时暴露。
2. **同一逻辑多份拷贝**：preflight 检查 3 份、Polymarket Gamma 客户端 6 份、CLOB 下单路径 4+ 份、`recommendation.json`（下单依据）8 个读写方无共享 schema、归档写盘 5 份、markdown 渲染 ~6 份。历史上 neg-risk 费率语义 3 处联动漏改已真实修过 3 次。
3. **死代码占比高**：apps/web 约 45% 服务于已删除的功能入口；多处 1000+ 行零引用模块因"没人敢删"长期滞留。

**最危险的一条**：下单保护逻辑分叉——GTC 限价单轮询、SELL 前链上余额校验、费率核验只存在于 `scripts/pulse-live.ts` 的 `executePlans` 里；同一笔决策走 executor 队列路径（`live:test` / `agent:persistent`）拿到的是无余额预检的纯 FOK。执行引擎应当只有一份，住在 executor 里（Stage 3 处理）。

## 1. 用户已拍板决策（2026-07-03）

| 决策项 | 结论 |
| --- | --- |
| raven-managed + services/managed-trading 产品线 | **保留**，等待未来开发（只清理零引用的废弃依赖） |
| `/api/prediction-engine/run` + demo + auth/邀请码链（~2100 行） | **保留** |
| raven-agent-loop（orchestrator 内 1000+ 行零引用） | **删除** |
| position-monitor（休眠止损守护脚本） | **删除** |
| e2e 套件（workspace 路径失效、事实断连） | **删除** |
| `/market-impact` 孤儿页（1333 行） | **删除** |
| `scripts/forecast/viewer` 原型（~1600 行，功能已被 apps/raven 覆盖） | **删除** |
| generate-wallet-envs 多钱包三件套 | **删除** |

## 2. Stage 1 — 安全网 + 纯减法（零行为变化）

**目标**：让仓库先"可以被安全重构"。门禁先行 + 有证据的死代码清理（预计净减 1.2 万行以上）。

### 2.1 门禁

- [x] ~~修红：provider-runtime.test.ts 摆脱 vendor 依赖~~ → **已有 [PR #61](https://github.com/Alchemist-X/predict-raven/pull/61)（并行会话）在做同一件事，不重复；#61 应先于/随本计划合并，否则 CI 首日即红**
- [x] 新增 `.github/workflows/ci.yml`：PR + push main 触发 `install --frozen-lockfile → pnpm -r build → pnpm -r typecheck → pnpm test`
- [x] 新增 `scripts/tsconfig.json` + 根命令 `typecheck:scripts`——scripts/ 1.26 万行首次有 tsc 门禁。**存量基线：14 个真类型错**（pulse-live×4 / agent-persistent-runner×5 / live-test×3 / managed-pulse×2；其中 `live-test.ts:125` 的 `Cannot find name 'db'` 疑似真 bug——该错误路径运行时会直接抛 ReferenceError）。CI 中该步 `continue-on-error`，Stage 2 清零后转阻塞。严格度对齐 tsx 运行时（`allowImportingTsExtensions`；`noUncheckedIndexedAccess` 暂关，workspace 包不受影响）
- [x] 三语 i18n key 一致性 vitest（en / zh-CN / zh-TW 键集合相等；历史上"漏翻上线再 fix"发生过 4 次）

### 2.2 删除（每项均已全仓引用搜索验证）

| 目标 | 规模 | 证据摘要 |
| --- | --- | --- |
| apps/web `lib/research/` 除 locale.ts 外全部 | ~1650 行 + 76KB 快照 | /research 控制台 038299b 已删；仅 route.ts 与 prediction-engine-demo import locale.ts |
| apps/web `public-run-pulse` 三件套 | 757 行 | 交易观赛页时代数据层，页面早删，仅自身测试互引 |
| apps/web `app+lib/market-impact/` | 1333 行 | 零入链孤儿路由（用户拍板删除） |
| apps/web `globals.css` 裁剪 | 1759 → ~150 行 | 132 个 class 仅 8 个（auth-\*、shell/panel）被引用，其余为已删交易 dashboard 样式 |
| apps/web `generated/locales+translations.generated.json` | 1.2MB | 零读者零写者，生成脚本已不存在 |
| apps/web 依赖瘦身 | prebuild 3 包 → 1 包 | contracts 仅被 public-run-pulse 引用、norns 仅被 lib/research 引用，删后即可摘除 |
| packages/sports-model 7 个零引用模块 | ~1900 行 | zigp / bivariate-poisson / spi / monte-carlo / bayesian / market / decision；唯一消费方 fifa-models 不用它们 |
| orchestrator `raven-agent-loop.ts` + 测试 | ~1000 行 | 零引用（用户拍板删除） |
| orchestrator `resolution.ts` 死导出 | ~10 行 | previewResolutionTrackingSnapshot 全仓零调用 |
| executor `okx-agentic-wallet.js` shim（仅 .js，.ts 本体保留） | 3 行 | Turbopack shim，已无 Next app 引用 executor；删后跑 executor build 验证 |
| managed-trading 废弃依赖 `@polymarket/clob-client` v1 | 1 dep | 源码零 import（v2 在用；产品线本身保留） |
| `scripts/position-monitor.{ts,test.ts}` + docs | ~470 行 | 无 script/cron/import（用户拍板删除；orchestrator 里的 `poly-position-monitor` 是 vendor skill 名，无关） |
| `scripts/forecast/viewer/` 整目录 + `forecast:viewer` 命令 | ~1600 行 | 功能已被 apps/raven 全覆盖（用户拍板删除） |
| `scripts/generate-wallet-envs.{ts,test.ts}` + example.json | ~400 行 | 多钱包注册流程弃用（用户拍板删除） |
| `scripts/v2-smoke-balance.ts` | ~100 行 | 文件头自注 "Delete after smoke is done" |
| `e2e/` 整目录 + 3 个根命令 + workspace 失效条目 | ~1700 行 | pnpm-workspace.yaml 指向已改名目录，e2e:\* 静默失效（用户拍板删除而非救活） |
| `deploy/hostinger/` | 4 文件 | 已放弃的部署目标，零引用 |
| apps/raven `DossierMeta.ci` 字段 | 3 处 | 2026-07-02 决定不对外展示置信区间后，该字段只生产从未渲染 |

### 2.3 归档与对齐

- [x] `scripts/world-cup/archive/`：mc-sim.py、build-bracket-prediction.py、build-event-list.ts、ws-listen.ts 移入（一次性产物已固化，保留方法论留档），README 标注冻结日期
- [x] AGENTS.md 以 CLAUDE.md 为准重写（原有 3 处实质漂移：盲测政策旧版、构建命令恰是会失败那条、缺 PR 车道；现为逐字节同步副本）
- [x] `.claude/settings.local.json` 移出 git 追踪并 gitignore（含免确认 git push 权限，不应入库）
- [x] （顺手）`docs/diagrams/dev-reference.md` 仓库树重写——原树还是 `autonomous-poly-trading` 时代，含 4 个幽灵目录

### 2.5 Stage 1 执行记录（2026-07-03 完成）

- **2.2 删除项全部落地**，实际删除量高于预估：lib/research 簇 2446 行（含 snapshots）、sports-model 2103 行（eval runner 依赖已删模块，按规则一并删除、RESULTS.md 留档）、globals.css 1759→240 行。全部删除均留有 grep 验证证据（见各删除 commit / 会话报告）。
- **验证**：`pnpm -r build` 全绿（含 web 331 静态页）、`pnpm -r typecheck` 全绿、`pnpm test` 759/762（3 个失败 = PR #61 在修的既有 vendor 问题，与本次改动无关已甄别）、`typecheck:scripts` 基线 14 错、4 页 × 桌面/移动 8 张截图 0 pageerror。
- **Stage 2 移交项**：14 个 scripts 类型错清零后把 CI 该步转阻塞（`live-test.ts:125` 的 `Cannot find name 'db'` 优先，疑似真 bug）；`prediction-engine-demo.ts` L803/875 文案仍提及已删 snapshot 路径（纯字符串，顺手改）；`.shell`/`.panel` 两个 class 当前零引用，下次动 auth 页时确认后可删。

### 2.4 验收标准

全量 `pnpm -r build` + `pnpm -r typecheck` + `pnpm test` 绿（provider-runtime 3 个失败若 PR #61 未合则为已知项）；apps/web 桌面+移动截图自评（sign-in / invite / world-cup 首页，globals.css 裁剪不许崩样式）；`forecast:*` 实盘命令零改动。

## 3. Stage 2 — 消灭"改一处漏两处"（立契约、收重复）

- `recommendation.json` 共享 zod schema 进 contracts（8 个读写方）；执行计划 schema 同理（orchestrator→executor 字段透传全 parse）
- preflight 三份 → 单一 check-builder；`calculatePositionPnlPct` 双实现统一为 executor 未取整版（止损阈值敏感）
- Polymarket 客户端收敛：Gamma 6 份 → sports-data 规范版（非实盘世界杯脚本先切）；executor/managed-trading 重复的 making/taking 成交换算抽 contracts 纯函数
- 包边界正名：orchestrator/executor 增加正式子路径导出，scripts 层 10+ 处 `../services/*/src/` 深路径 import 改包名导入；sports-data 补 workspace 依赖
- env 加载统一 `@autopoly/contracts/env` loadEnvFile（managed-trading 对齐 ENV_FILE 优先级）
- 工具收敛：formatUsd / logger / cli-args / 归档写盘 → terminal-ui 与共享小模块
- pulse/forecast 双命名冻结策略：env、DB kind、归档路径标 frozen legacy；5 个 `pulse:*` 别名走弃用周期；文件名层 ~30 个可安全改；新代码一律 forecast
- 前端热文件拆分：`world-cup.module.css`（2918 行、全仓最热 25 次提交）按组件就近拆；raven 两个 500+ 行页面组件拆块
- 根 package.json 8 处重复预构建链收敛为 predeps；vendor 双份 polymarket-market-pulse 合一
- world-cup settlement 两份实现合一（locator 策略注入）；`stripPrices` 盲测执法点收敛单点

**验收**：CI 绿 + `forecast:recommend` 干跑归档 diff 对比 + 世界杯站/raven 截图自评。

## 4. Stage 3 — 结构重组（触实盘核心，最后动）

- **执行引擎归一（最重要）**：pulse-live 的 executePlans（GTC 轮询/SELL 余额校验/费率核验）下沉 executor，队列 worker 复用同一执行语义；pulse-live.ts 拆 preflight/执行/渲染/归档 4 块，主函数 <300 行
- orchestrator 拆大文件：full-pulse.ts（1531）按 研究收集/prompt/渲染/兜底报告 拆 5 块（**输出字符串逐字节不变**——下游正则解析下单）；pulse-entry-planner 按"报告解析 vs 仓位计算"切开；portfolio-report-artifacts（1282）拆 report/ 目录
- polymarket-sdk.ts 拆 5 块 + 原文件 re-export 壳；修单例缓存不区分 config 的隐患
- forecast-engine 抽包（= issue #56）：types+store+engine 入 `packages/forecast-engine`，raven 删"逐字节一致"复制体，env 直读改显式 config 注入（不在实盘链路，可独立提前）
- legacy 清退：provider-runtime（983 行）先冻结后删（需用户拍板时点）；live-test 并入 pulse-live --recommend-only；daily-pulse spawn 改直接 import

**验收**：常规门禁 + 实盘链路每拆一块跑 `forecast:recommend` 干跑归档逐字段 diff；执行引擎下沉需一次用户监督下的小额 live 验证。

## 5. 风险控制原则（全阶段通用）

1. 触及 `pulse-live` / orchestrator pulse / executor 下单路径的改动：逐段等价搬运，禁止顺手改逻辑，独立 PR。
2. 任何"删除"必须先全仓 grep（含 package.json scripts、CI workflow、docs 命令引用）留证。
3. 每个 stage 独立可交付、独立可回滚。
4. 涉及交易 / 风控参数 / 密钥 / 不可逆操作：一律停下等用户确认（CLAUDE.md PR 车道）。
