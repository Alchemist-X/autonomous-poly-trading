# Timeout Reference Table
Chinese version: [timeout-reference.md](timeout-reference.md).

Last updated: 2026-06-05

| Service | Module / Operation | Timeout Name | Current / Default Value | Can Be Disabled | Location | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/web` | Entire service | None | None | N/A | N/A | No runtime timeout is currently defined |
| `services/executor` | Entire service | None | None | N/A | N/A | No runtime timeout is currently defined |
| `services/orchestrator` | Decision runtime: `codex exec` / template provider | `PROVIDER_TIMEOUT_SECONDS` | `0` | Yes, `0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/runtime/provider-runtime.ts` | AI decision path timeout, disabled by default |
| `services/orchestrator` | Full pulse render / pulse research subcommands | `PULSE_REPORT_TIMEOUT_SECONDS` | `0` | Yes, `0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/full-pulse.ts` | Covers full-pulse render, `npm install`, `scrape-market.ts`, and `orderbook.ts` |
| `services/orchestrator` | Pulse external web-search | `PULSE_WEB_SEARCH_TIMEOUT_SECONDS` | `120s` | Not recommended; use `PULSE_WEB_SEARCH_ENABLED=false` to disable search | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/web-search.ts` / `services/orchestrator/src/pulse/full-pulse.ts` | Search failures or 120s timeout are recorded in `web_search.status`; Pulse rendering continues |
| `services/orchestrator` | Pulse market fetch | `PULSE_FETCH_TIMEOUT_SECONDS` | `60s` | `0=disabled` not supported | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/market-pulse.ts` | External fetch timeout, still finite |
| `services/orchestrator` | Resolution: `python3 fetch_event.py` | Hardcoded | `90_000 ms` | No | `services/orchestrator/src/jobs/resolution.ts` | Event-data fetch |
| `services/orchestrator` | Resolution: `python3 scrape_source.py` | Hardcoded | `120_000 ms` | No | `services/orchestrator/src/jobs/resolution.ts` | Resolution-source snapshot |

| Global Convention | Value |
| --- | --- |
| AI reasoning path waits indefinitely by default | `PROVIDER_TIMEOUT_SECONDS=0` |
| Pulse render / research waits indefinitely by default | `PULSE_REPORT_TIMEOUT_SECONDS=0` |
| Services that still keep finite timeouts | `orchestrator` Pulse web-search / external fetches, `orchestrator` resolution jobs |
