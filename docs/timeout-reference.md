# Timeout 总表
英文版见 [timeout-reference.en.md](timeout-reference.en.md)。

最后更新：2026-06-05

| 服务 | 模块/操作 | Timeout 名称 | 当前值/默认值 | 可否关闭 | 位置 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/web` | 全部 | 无 | 无 | 无 | 无 | 当前没有实际运行 timeout |
| `services/executor` | 全部 | 无 | 无 | 无 | 无 | 当前没有实际运行 timeout |
| `services/orchestrator` | Decision runtime: `codex exec` / template provider | `PROVIDER_TIMEOUT_SECONDS` | `0` | 可以，`0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/runtime/provider-runtime.ts` | AI 决策链路超时，当前默认关闭 |
| `services/orchestrator` | Full pulse render / pulse research 子命令 | `PULSE_REPORT_TIMEOUT_SECONDS` | `0` | 可以，`0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/full-pulse.ts` | 包含 full-pulse render、`npm install`、`scrape-market.ts`、`orderbook.ts` |
| `services/orchestrator` | Pulse external web-search | `PULSE_WEB_SEARCH_TIMEOUT_SECONDS` | `120s` | 不建议关闭；可用 `PULSE_WEB_SEARCH_ENABLED=false` 关闭搜索 | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/web-search.ts` / `services/orchestrator/src/pulse/full-pulse.ts` | 搜索失败或 120 秒超时会写入 `web_search.status` 并继续 Pulse 渲染 |
| `services/orchestrator` | Pulse market fetch | `PULSE_FETCH_TIMEOUT_SECONDS` | `60s` | 不支持 `0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/market-pulse.ts` | 外部抓取超时，仍保留 |
| `services/orchestrator` | Resolution: `python3 fetch_event.py` | 硬编码 | `90_000 ms` | 否 | `services/orchestrator/src/jobs/resolution.ts` | 事件数据抓取 |
| `services/orchestrator` | Resolution: `python3 scrape_source.py` | 硬编码 | `120_000 ms` | 否 | `services/orchestrator/src/jobs/resolution.ts` | 结算源快照抓取 |

| 全局约定 | 值 |
| --- | --- |
| AI 推理链路默认无限等待 | `PROVIDER_TIMEOUT_SECONDS=0` |
| Pulse render / research 默认无限等待 | `PULSE_REPORT_TIMEOUT_SECONDS=0` |
| 当前仍保留有限 timeout 的服务 | `orchestrator` Pulse web-search / 外部抓取、`orchestrator` resolution |
