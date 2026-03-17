# Timeout 总表
英文版见 [timeout-reference.en.md](timeout-reference.en.md)。

最后更新：2026-03-16

| 服务 | 模块/操作 | Timeout 名称 | 当前值/默认值 | 可否关闭 | 位置 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/web` | 全部 | 无 | 无 | 无 | 无 | 当前没有实际运行 timeout |
| `services/executor` | 全部 | 无 | 无 | 无 | 无 | 当前没有实际运行 timeout |
| `services/orchestrator` | Decision runtime: `codex exec` / template provider | `PROVIDER_TIMEOUT_SECONDS` | `0` | 可以，`0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/runtime/provider-runtime.ts` | AI 决策链路超时，当前默认关闭 |
| `services/orchestrator` | Full pulse render / pulse research 子命令 | `PULSE_REPORT_TIMEOUT_SECONDS` | `0` | 可以，`0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/full-pulse.ts` | 包含 full-pulse render、`npm install`、`scrape-market.ts`、`orderbook.ts` |
| `services/orchestrator` | Pulse market fetch | `PULSE_FETCH_TIMEOUT_SECONDS` | `60s` | 不支持 `0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/market-pulse.ts` | 外部抓取超时，仍保留 |
| `services/orchestrator` | Resolution: `python3 fetch_event.py` | 硬编码 | `90_000 ms` | 否 | `services/orchestrator/src/jobs/resolution.ts` | 事件数据抓取 |
| `services/orchestrator` | Resolution: `python3 scrape_source.py` | 硬编码 | `120_000 ms` | 否 | `services/orchestrator/src/jobs/resolution.ts` | 结算源快照抓取 |
| `services/rough-loop` | Task provider 执行 | `ROUGH_LOOP_TASK_TIMEOUT_MINUTES` | `45 min` | 当前不支持 `0=disabled` | `.env.example` / `services/rough-loop/src/config.ts` / `services/rough-loop/src/lib/provider.ts` | Rough Loop 调 provider 的任务执行上限 |
| `services/rough-loop` | Verification commands | `ROUGH_LOOP_TASK_TIMEOUT_MINUTES` | `45 min` | 当前不支持 `0=disabled` | `.env.example` / `services/rough-loop/src/config.ts` / `services/rough-loop/src/lib/verification.ts` | 每条 verification command 共用这个上限 |
| `services/rough-loop` | Doctor: `command -v <provider>` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/doctor.ts` | 环境检查 |
| `services/rough-loop` | Git: `git diff --name-only --relative` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | 工作树扫描 |
| `services/rough-loop` | Git: `git diff --cached --name-only --relative` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | staged 扫描 |
| `services/rough-loop` | Git: `git ls-files --others --exclude-standard` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | untracked 扫描 |
| `services/rough-loop` | Git: `git diff --relative` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | diff 导出 |
| `services/rough-loop` | Git: `git rev-parse --is-inside-work-tree` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | git 可写性检查 |
| `services/rough-loop` | Git: `git add -- ...` | 硬编码 | `15_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | 暂存文件 |
| `services/rough-loop` | Git: `git commit -m ...` | 硬编码 | `30_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | 自动提交 |
| `services/rough-loop` | Git: `git push` | 硬编码 | `60_000 ms` | 否 | `services/rough-loop/src/lib/git.ts` | 自动推送 |

| 全局约定 | 值 |
| --- | --- |
| AI 推理链路默认无限等待 | `PROVIDER_TIMEOUT_SECONDS=0` |
| Pulse render / research 默认无限等待 | `PULSE_REPORT_TIMEOUT_SECONDS=0` |
| 当前仍保留有限 timeout 的服务 | `orchestrator` 外部抓取、`orchestrator` resolution、`rough-loop` provider/verification/git/doctor |
