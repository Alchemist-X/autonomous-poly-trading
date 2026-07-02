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

## Cost & security

- Subscription mode consumes your plan's usage window (no extra bill); a web-research run takes minutes. **The OAuth token acts as your account — keep it on trusted servers only.**
- The gate covers pages + API; with `RAVEN_ACCESS_TOKEN` unset the app is fully open — always set it on a public host.
- Engine artifacts live under `runtime-artifacts/forecasts/<eventId>/` (state.json / report.md / analyst.json), fully auditable.
