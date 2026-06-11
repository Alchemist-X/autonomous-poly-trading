# Prediction Engine Stage Flow Alignment

> Last updated: 2026-06-07  
> execution mode: inspect / demo-read-only  
> Decision source: user's flow diagram + `skills/probability-analysis` + current Pulse implementation

## Human Review Entry Points

- `services/orchestrator/src/pulse/stage-flow.ts`
- `services/orchestrator/src/pulse/full-pulse.ts`
- `apps/web/app/api/prediction-engine/run/route.ts`
- `apps/web/app/prediction-engine/page.tsx`
- `apps/web/components/prediction-engine-demo.tsx`
- `apps/web/lib/prediction-engine-demo.ts`

## What Is Implemented Now

Pulse research context now writes a `stage_flow` field that explicitly aligns with the seven steps from the screenshots:

1. Clarify resolution definition
2. Base reasoning and search-query design
3. Collect and list evidence
4. Update evidence weights
5. Build a structured model
6. Bayesian-style update
7. Output conclusion and compare market pricing

The `full-pulse` prompt now requires the LLM to read `stage_flow` and organize market candidates or existing-position reviews around those stages. The frontend demo uses the same stage language to show natural-language event input, probability output, conditional model, evidence weights, and market mispricing.

## Remaining Gaps

| Stage | Current status | Gap |
| --- | --- | --- |
| 1. Clarify definition | Partial | Polymarket rules and question text are fetched, but Yes/No boundaries, representative authority, timezone, and edge cases are still mainly written by the LLM in Markdown rather than validated as JSON. |
| 2. Base reasoning/query | Partial | Queries are template-built from question/category/tags; there is no LLM-generated node-specific query plan yet. |
| 3. Evidence collection | Partial | Pulse has Polymarket page/comment/orderbook collection plus DuckDuckGo snippets; it does not reliably fetch full page bodies, Twitter/X, Reddit, Telegram, military maps, or some local/party media. |
| 4. Evidence weighting | Partial | Reports contain evidence chains and confidence language, but each evidence item's direction, strength, recency, primary-source status, and corroboration are not yet stored in a typed evidence ledger. |
| 5. Structured model | Partial | The LLM can write `P(A) x P(B|A) x P(C|A,B)`, but model nodes and arithmetic checks are not forced into typed artifacts. |
| 6. Bayesian update | Partial | The LLM can explain updates, but baseline, deltas, final probability, and credible interval are not independently audited; there is no second-pass verifier. |
| 7. Conclusion/market comparison | Implemented for mapped markets | For mapped Polymarket markets, Pulse parses AI probability, market probability, and edge before risk controls. Arbitrary natural-language events still need event-to-market matching. |

## Incremental Cost Estimate

The `stage_flow` block added in this iteration does not add external requests or LLM calls. It does increase the report-render context length.

With the default `PULSE_REPORT_CANDIDATES=4`, this change is expected to add:

| Item | Estimate |
| --- | ---: |
| External calls | 0 |
| LLM calls | 0 |
| Input tokens | about +2k to +4k |
| Output tokens | about +0.5k to +1.5k, depending on how much the report expands the stages |
| Wall-clock time | usually +10s to +60s, mostly from the longer prompt/report |

For strict parity with the screenshots, the likely additions are:

| Capability | External calls | LLM calls | Input tokens | Output tokens | Extra time |
| --- | ---: | ---: | ---: | ---: | ---: |
| LLM query plan | 0 | Can fold into current report | 0 | +0.8k to +1.5k | +15s to +40s |
| Full-page evidence fetch and cross-check | +20 to +40 | 0 | +8k to +20k | +0.9k to +1.8k | +1 to +3 min |
| Typed evidence ledger | 0 | Can fold into current report | 0 | +1.5k to +3k | +45s to +90s |
| Typed conditional model | 0 | Can fold into current report | 0 | +1.5k to +3k | +45s to +2 min |
| Bayes delta ledger + verifier | 0 | 0 to +1 | 0 to +15k | +1k to +2.5k | +30s to +5 min |
| Arbitrary-event market matching | +2 to +6 | Can fold into current report | +0.5k to +1.2k | +0.5k to +1k | +10s to +45s |

Strict mode total estimate: +22 to +46 external calls; +0 to +1 LLM calls; +8.5k to +36.2k input tokens; +6.2k to +12.8k output tokens; about +4 to +14 minutes.

## Frontend Demo Status

`/prediction-engine` is a read-only demo. It does not run real Pulse, fetch live evidence, or place orders. It demonstrates the production interface shape:

- User enters an event in natural language.
- API returns a `PredictionEngineRun`.
- Page displays seven-stage progress, Run Console, current step output, Yes probability, 80% interval, market edge, conditional model, evidence weights, and known gaps.

`PredictionEngineRun` now includes two fields for frontend visualization:

| Field | Purpose |
| --- | --- |
| `service` | Shows whether the result came from the demo, a local-hosted service, or the VPS service, plus a safely redacted endpoint label. |
| `progress` | Powers a Manus-style process stream showing what each step did, the current output, and the related artifact label. |

## Local-Hosted Service Testing

During local development, the Next.js route can call a locally hosted prediction service:

```
Browser -> local Next /api/prediction-engine/run -> localhost prediction service -> Pulse artifacts
```

Recommended local `.env.local` or startup env:

| Env | Meaning |
| --- | --- |
| `PREDICTION_ENGINE_BACKEND_MODE=auto` | Default mode. On non-Vercel hosts it prefers the local URL, then the VPS URL, then demo fallback. |
| `PREDICTION_ENGINE_BACKEND_MODE=local` | Force the local service. If no local URL is configured, the route errors instead of pretending a real analysis ran. |
| `PREDICTION_ENGINE_LOCAL_API_URL` | Full local endpoint, for example `http://127.0.0.1:8787/prediction-engine/run`. |
| `PREDICTION_ENGINE_LOCAL_API_BASE_URL` | Local base URL, for example `http://127.0.0.1:8787`; the route appends `/prediction-engine/run`. |
| `PREDICTION_ENGINE_LOCAL_API_TOKEN` | Optional local bearer token. If omitted, the route falls back to `PREDICTION_ENGINE_API_TOKEN`. |

The local service should return the same `PredictionEngineRun` shape. If the response already includes `conclusion` and `stages`, the Next route adds `service.source=local`, `service.endpointLabel`, and `service.elapsedMs` so the frontend can display local service status.

## Login, Invites, and Quotas

The minimum hosted access-control layer is now wired:

- Social login: Auth.js + generic OpenID Connect, with `/sign-in` as the entry point and `/api/auth/callback/oidc` as the callback.
- User activation: first login writes an `app_users` row. New users default to `pending_invite`; entering an invite at `/invite` activates them.
- Invites: stored in `invite_codes`; the database stores only hashes. Create one with `pnpm prediction:invite -- --label beta --max-uses 10`.
- Quotas: `prediction_usage_events` records each run, and `/api/prediction-engine/run` checks daily, monthly, and concurrent limits.

Key configuration:

| Env | Meaning |
| --- | --- |
| `AUTH_SECRET` | Auth.js session secret; required in production. |
| `AUTH_TRUST_HOST` | Use `true` for Vercel / reverse-proxy deployments. |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | OpenID Connect provider settings. |
| `OIDC_SCOPE` | Defaults to `openid email profile`. |
| `PREDICTION_AUTH_REQUIRED` | When true, missing config fails closed. Default false so demos are not accidentally locked. |
| `PREDICTION_INVITE_REQUIRED` | Default true. When false, signed-in users auto-activate. |
| `PREDICTION_ADMIN_EMAILS` | Comma-separated emails. Matching users get role=`admin` and bypass quota by default. |
| `PREDICTION_AUTO_ACTIVATE_EMAIL_DOMAINS` | Comma-separated email domains that auto-activate on login. |
| `PREDICTION_DAILY_RUN_LIMIT` | Default 5. Use `0` for unlimited. |
| `PREDICTION_MONTHLY_RUN_LIMIT` | Default 50. Use `0` for unlimited. |
| `PREDICTION_CONCURRENT_RUN_LIMIT` | Default 1. Use `0` for unlimited. |
| `PREDICTION_ADMIN_BYPASS_QUOTA` | Default true. |

## Calling the VPS Service in Production

The Vercel service should not run heavy Pulse work inside a serverless route. The intended production path is:

```
Browser -> Vercel /api/prediction-engine/run -> VPS-hosted prediction service -> Pulse artifacts
```

Configure these Vercel env vars:

| Env | Meaning |
| --- | --- |
| `PREDICTION_ENGINE_BACKEND_MODE=auto` or `vps` | Use `auto` or explicit `vps` in production. Vercel does not automatically prefer local URLs. |
| `PREDICTION_ENGINE_API_URL` | Full VPS endpoint, for example `https://<vps-domain>/prediction-engine/run`. Highest priority. |
| `PREDICTION_ENGINE_API_BASE_URL` | VPS base URL, for example `https://<vps-domain>`; the route appends `/prediction-engine/run`. |
| `PREDICTION_ENGINE_VPS_URL` | Compatibility alias for `PREDICTION_ENGINE_API_BASE_URL`. |
| `PREDICTION_ENGINE_API_TOKEN` | Optional bearer token. When set, Vercel sends `Authorization: Bearer <token>` to the VPS. |
| `PREDICTION_ENGINE_API_TIMEOUT_MS` | Optional timeout. Default: `120000`. |

If a VPS backend is configured but unavailable, the Vercel route returns `502` and does not silently fall back to the demo. It only uses `buildPredictionDemoRun()` when no VPS URL is configured.

To connect real Pulse later, implement the same interface in the VPS service:

1. create a read-only Pulse run;
2. write `recommendation.json` / `web_search` / `stage_flow` / future `evidence_ledger`;
3. return the same `PredictionEngineRun` shape to the frontend.
