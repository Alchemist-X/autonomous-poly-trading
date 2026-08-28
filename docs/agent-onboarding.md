# Agent Onboarding — 按需背景参考

> **这份文件不再是新会话启动必读。** 所有 agent 开始工作时只读 [`docs/agent-handoff.md`](agent-handoff.md) 获取当前状态；仅在缺少环境或历史背景时按需查阅本文件。
>
> 你是 Claude Code / Codex / OpenClaw 在这个仓库**新启动**的 agent。这份文档让你 **5 分钟**进入工作状态，不踩坑。
>
> 英文版：[`docs/en/agent-onboarding.md`](en/agent-onboarding.md)
>
> 最后更新：2026-04-26

---

## ⚠️ 0. 这是一个真钱实盘项目

每次 `pnpm daily:forecast` / `pnpm forecast:live` 都会在 Polymarket 下**真实订单，不可逆**。

**用户没明确说"实盘"或"recommend-only"时，先问、再动。** 不要默认理解为"试试看"。

## 1. 看一眼当前环境

跑这两条（只读，不动钱）：

```bash
ls .env.* 2>/dev/null | grep -v example      # 有几个真凭据文件
grep -c '^[A-Z_]\+=' .env.example             # 模板字段数
```

根目录有 `.env.pizza` / `.env.no1` 等是用户的钱包配置文件。**默认主钱包是 `.env.pizza`**（per `skills/daily-pulse/agents/openai.yaml` 的 `default_prompt`）。

> ⚠️ `.env.pizza` 只是**默认**，不是写死。如果你被部署到新机器、对接到不同的主钱包，应该改默认到你自己的 env 文件并改 yaml 那行。

## 2. 必读项目核心规则（按顺序）

| 顺序 | 文档 | 干啥用 |
| --- | --- | --- |
| 1 | [`/CLAUDE.md`](../CLAUDE.md) | 协作约定 + 项目执行要点（Claude Code 已自动加载，扫一遍） |
| 2 | [`docs/risk-controls.md`](risk-controls.md) | 风控完整规则（执行级 / 仓位级 / 系统级硬上限） |
| 3 | [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](internal/plan/2026-04-28-v2-cutover-runbook.md) | V2 切换日 runbook（如果今天已经过 4/28，这个不再紧急） |
| 4 | [`docs/diagrams/dev-reference.md`](diagrams/dev-reference.md) | 命令速查 / 部署形态 / 依赖矩阵 |

## 3. 验证你能跑起来（不动钱）

```bash
pnpm install
pnpm build
pnpm test    # 应该 317/317 全过
```

挂了先查原因。**不要在 build 没过的情况下跑 forecast:live。**

## 4. 用户让你「跑 pulse」该怎么解读

| 用户说 | 你做 |
| --- | --- |
| "跑 pulse 看看推荐" / "不要下单" / "recommend only" | `ENV_FILE=.env.pizza pnpm forecast:live -- --recommend-only` |
| "跑 pulse" / "实盘" / "正式下单" / "live" | `ENV_FILE=.env.pizza pnpm daily:forecast` |
| "用 no1 钱包" | 把 `.env.pizza` 替换成 `.env.no1` |
| "看一下当前持仓 / 净值" | 读 `runtime-artifacts/pulse-live/` 下最近一次 run 的 `execution-summary.json`，或访问 spectator 网页 |

## 5. 跑完之后必须报告

不管成功还是失败：

- 打印 run 目录路径：`runtime-artifacts/pulse-live/<ts>-<runId>/`
- 报告 `run-summary.md` 的关键数据：成交数 / 拒单数 / 净值变化
- 失败时：检查 `run-error/<ts>-<reason>/error.json` 里的 `failure stage` + `next command`

## 6. 容易踩的坑

| 坑 | 怎么避免 |
| --- | --- |
| 直接 `forecast:live` 不加 `--recommend-only` 想"看一下" | 这会**真扣钱**。除非用户明说要 live 才省略 `--recommend-only` |
| `claude --print` 子进程 0 字节挂 5 分钟 | **不是失败**，等它，Pulse 渲染内部 timeout 是 30 分钟 |
| 看到 `[WARN] Fee mismatch ...` | 不是错误，是本地静态 fee 表跟链上不一致的告警，不阻断下单 |
| 一上来就改架构、瘦身根目录 | 先问用户。这种改动有 cascade 风险（vitest config 路径、Vercel 自动部署等） |
| 看见 `claude.md` 小写觉得要改大写 | macOS 大小写不敏感视为同一文件，git 里是小写。改名要走 `git mv -f` 二步法 |

## 7. 接手老仓库的目录速记

主代码（你大部分时间都在这）：

```
apps/web/        ← Next.js 前端（公开 spectator 页 + admin）
services/
  ├── orchestrator/   ← Pulse 抓取 + 决策运行时 + 风控裁剪 + 报告
  ├── executor/       ← Polymarket CLOB 下单 + 同步 + 止损
packages/        ← 共享 contracts/db/terminal-ui
scripts/         ← CLI 入口（daily-pulse、pulse-live 等）
```

历史 / 内部文档（按需读）：

```
docs/
  ├── archive/             ← 旧 handoff / 探索稿（legacy）
  ├── internal/
  │   ├── plan/            ← 阶段性规划
  │   └── review/          ← 历史 review/decision 笔记
  ├── diagrams/            ← 架构图 + 操作手册
  ├── en/                  ← 英文镜像
  └── *.md                 ← progress / risk-controls / ...
```

## 8. 当前阶段的关键信息（可能很快过期）

> 看到这一节请先核对日期：今天 vs 文档"最后更新"。如果差距大，去看 `progress.md` 拿最新状态。

- **V2 cutover：2026-04-28 11:00 UTC**——切换前后参考 runbook
- **当前实盘**：pizza 钱包 (`0x6664...614e`)，~$314 collateral，6+ 仓位
- **最近一次 pulse-live 跑**：3 单全成（参考 `runtime-artifacts/pulse-live/` 下最新目录）

## 9. 实在不确定就问

- 钱包对不对？→ 问
- 是 recommend-only 还是 live？→ 问
- 这个改动会动到生产 cron / Vercel / 用户钱包？→ 问
- "顺手优化"涉及多个模块 cascade？→ 问

CLAUDE.md §4 的话："只有在涉及外部权限、不可逆风险、成本/安全/生产影响，或产品目标本身不明确时，才停下来请求用户拍板。" —— 真钱交易项目里，这条 trigger 比一般项目频繁得多。
