# Raven Forecasting Engine — server deployment

> 中文主文档：[`README.md`](README.md)

One long-lived server + Docker runs the whole service: the Next.js three-screen app plus the forecasting engine (engine runs as child processes inside the container; dossiers persist on a volume). **Do not deploy to serverless** — runs take minutes and write to local disk.

## Prerequisites

- Docker on the server (`curl -fsSL https://get.docker.com | sh`)
- A domain pointing at the server (optional but recommended, for HTTPS)

## Steps

1. **Generate a subscription token on your own machine** (reuses a Claude Pro/Max subscription instead of API billing): `claude setup-token`, complete the one-time browser authorization, copy the long-lived token. Alternatively use an `ANTHROPIC_API_KEY` (pay-as-you-go).
2. **Clone + configure on the server:**
   ```bash
   git clone -b feat/iterative-forecaster https://github.com/Alchemist-X/predict-raven.git
   cd predict-raven/deploy/raven
   cp .env.example .env   # set RAVEN_ACCESS_TOKEN + CLAUDE_CODE_OAUTH_TOKEN
   ```
3. **Build + start:** `docker compose up -d --build`, then `docker compose logs -f raven` until "Ready" (serves on 127.0.0.1:3200).
4. **HTTPS reverse proxy:** install caddy, use `Caddyfile.example` with your domain, `systemctl reload caddy`.
5. **First visit:** `https://your.domain/?token=<RAVEN_ACCESS_TOKEN>` — sets a 90-day cookie; APIs accept an `x-raven-token` header.

## Operations

Update: `git pull && docker compose up -d --build` · Logs: `docker compose logs -f raven` · Dossier backup: volume `raven-artifacts` · Rotate access token: edit `.env`, `docker compose up -d`.

## Forecast API + MCP (second service, port 8787)

The `forecast-api` compose service abstracts the same forecasting engine into a public API: **POST a question → get the event's probability + the analysis behind it + the cited evidence**, in three forms: JSON, plain text, and a PDF dossier. It shares the artifacts volume with the raven app, so API-created forecasts also appear in the web UI (and vice versa).

Auth: `Authorization: Bearer <FORECAST_API_TOKEN>` (or `x-api-key` / `?token=`; falls back to `RAVEN_ACCESS_TOKEN` when unset).

```bash
BASE=http://<server-ip>:8787; TOKEN=<FORECAST_API_TOKEN>

# Start a forecast (takes minutes; add "wait":true to block until done)
curl -X POST $BASE/v1/forecasts -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"question":"Will the Fed cut rates before September 2026?"}'
# → {"forecast":{"id":"<id>","status":"running",...}}

curl -H "Authorization: Bearer $TOKEN" $BASE/v1/forecasts/<id>        # JSON answer
curl -H "Authorization: Bearer $TOKEN" $BASE/v1/forecasts/<id>/text   # plain-text answer
curl -OJ -H "Authorization: Bearer $TOKEN" $BASE/v1/forecasts/<id>/pdf # PDF dossier
```

**MCP** (same port, `/mcp`, streamable HTTP; tools: `forecast_start` / `forecast_status` / `forecast_result`):

```bash
claude mcp add --transport http raven-forecast http://<server-ip>:8787/mcp \
  --header "Authorization: Bearer <FORECAST_API_TOKEN>"
```

Rate limiting: `FORECAST_API_MAX_CONCURRENT` parallel runs (default 2), 429 beyond that. PDFs are rendered by headless Chromium inside the container and cached in the event dir (`answer.pdf`).

**Daily quota + invite codes:** the web app and the API **each** get at most `FORECAST_DAILY_QUOTA` (default 20) engine runs per UTC day — only actual run starts count; polling and result reads are free. Beyond that a request must carry a **valid invite code**: web — an input appears under the ask bar (remembered in localStorage after an accepted unlock); API — `x-invite-code: <code>` header or an `"invite"` body field; MCP — the `invite_code` argument of `forecast_start`. Counters live in `runtime-artifacts/quota/` and survive restarts.

**Invite-code management (file event store, zero deps):** codes live in `runtime-artifacts/invites/events.jsonl` on the artifacts volume (append-only event log shared by both containers, atomic appends) with per-code label / max-uses / expiry / revocation / usage metering; **a use is charged only when the code unlocks an over-quota run** — never while free quota remains. `FORECAST_INVITE_CODE` (default `raven-labs`) is only the **first-boot seed** (an unlimited code); afterwards the store is the source of truth:

```bash
docker exec raven-forecast-api-1 pnpm --filter @autopoly/forecast-api invite list
docker exec raven-forecast-api-1 pnpm --filter @autopoly/forecast-api invite create -- --label "for-alice" --max-uses 10 --expires 2026-08-01
docker exec raven-forecast-api-1 pnpm --filter @autopoly/forecast-api invite revoke -- <code>
```

**Public exposure:** the repo compose binds `127.0.0.1:8787` only. To serve externally, add a server-side `docker-compose.override.yml` re-binding the port publicly (`ports: !override ["8787:8787"]`) plus a cloud firewall rule for 8787; once you have a domain, prefer a Caddy reverse proxy (see the `Caddyfile.example` pattern). ⚠️ Until TLS is set up the token travels over plaintext HTTP — share it only with callers you trust, rotate on leak.

## Paper Trading Agent (third service, simulation only)

The `paper-agent` service is a fully autonomous, **simulation-only** Polymarket agent: no keys, no signer, no order endpoint exists in its code — it only reads public market data (Gamma / CLOB books) and simulates fills against the live book with fee accounting (the repo's calibrated category fee model).

**Logic (phase 1):**
1. Three times a day (`PAPER_EVAL_TIMES_UTC`, default UTC 00:10/08:10/16:10) every position is re-assessed by an **isolated process** running the DeepSeek (or Kimi) iterative forecast engine — the prompt carries only the market question and resolution criteria, **never our position, entry price, or the market price** — producing an independent probability;
2. The harness compares belief vs executable price: **net edge of holding (exit fees in) < threshold → close**; the stop-loss (default −35%) outranks the model view;
3. Exits use the **hybrid strategy**: 50% market (taker fee) + 50% resting limit (maker-free, TTL falls back to market); stop-loss is the exception — 100% market;
4. After the last daily cycle a **reflection report** is written (`runtime-artifacts/paper-agent/reports/`): per-exit sell-vs-hold counterfactual, Brier calibration, fee drag, and limit-vs-market execution quality.

Commands (prefix with `sudo docker exec raven-paper-agent-1` on the VM):

```bash
pnpm --filter @autopoly/paper-agent paper status
pnpm --filter @autopoly/paper-agent paper buy -- <slug> YES 50
pnpm --filter @autopoly/paper-agent paper cycle
pnpm --filter @autopoly/paper-agent paper reflect
```

Optional auto-entries: list market slugs (one per line) in the file `PAPER_WATCHLIST` points at; fee-adjusted edge ≥ `PAPER_ENTRY_EDGE_PP` (default 8pp) triggers a simulated market entry. The book lives in `runtime-artifacts/paper-agent/` (portfolio.json + ledger.jsonl); evaluation dossiers are shared with the raven web app.

## Cost & security

- Subscription mode consumes your plan's usage window (no extra bill); a web-research run takes minutes. **The OAuth token acts as your account — keep it on trusted servers only.**
- The gate covers pages + API; with `RAVEN_ACCESS_TOKEN` unset the app is fully open — always set it on a public host.
- Engine artifacts live under `runtime-artifacts/forecasts/<eventId>/` (state.json / report.md / analyst.json), fully auditable.
