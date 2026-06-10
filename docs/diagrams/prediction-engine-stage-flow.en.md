# Prediction Engine Stage Flow Alignment

> Last updated: 2026-06-10  
> execution mode: inspect / demo-read-only  
> Decision source: user's flow diagram + `skills/probability-analysis` + current Pulse implementation + the `pulse-stage-flow-v2` typed pipeline branch

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

## Typed Pipeline Status (branch `pulse-stage-flow-v2`, 2026-06-10)

Stages 1-6 plus the second-pass verifier now exist as **typed, machine-validated** standalone modules (`services/orchestrator/src/pulse/`): one structured LLM call per module, code-level coercion, and deterministic validators. **Not yet wired into the live path** — the wiring (`PULSE_TYPED_MODEL` flag) and the stage-7 cutover (switching `pulse-entry-planner`'s probability source) are the next steps.

### Explicit model assignment (stage-models.ts, single source of truth)

| Stage | Module | Model | Nature |
| --- | --- | --- | --- |
| 1. Clarify definition | `resolution-definition.ts` | Sonnet | information |
| 2. Query plan | `query-planner.ts` | Sonnet | information |
| 3. Evidence collection | `evidence-database.ts` | Sonnet | information |
| 4. Evidence weighting | `evidence-ledger.ts` | Opus | judgment |
| 5. Conditional model | `conditional-model.ts` | Opus | judgment |
| 6. Bayes delta ledger | `bayes-ledger.ts` | Opus | judgment |
| 6b. Second-pass audit | `verifier.ts` | Opus | judgment |

### Key mechanisms (after the 2026-06-10 multi-agent review hardening)

- **Machine validation** (`stage-artifacts.ts`): multiplication reconciliation, per-step Bayes posterior-chain reconciliation, cross-stage foreign-key integrity, summaries recomputed from records, explicit NaN rejection, direction-vs-delta sign consistency, zero-evidence updates rejected, stage-5->6 base linkage, marketSlug uniformity across the chain.
- **Independent-forecasting firewall** (`spoiler-firewall.ts`): host-level plus content-level (odds quoted inside snippets) blocking; the market price is stamped onto stage 6 output but never enters a prompt — the prompt builders' signatures cannot even see marketProb at the type level; validators reject stored artifacts containing spoiler sources.
- **LLM protocol robustness**: stage 3/4 per-item responses must carry an explicit `index` key (shuffled/partial responses can no longer silently misalign); untrusted web text is sanitized before prompt interpolation (newline-injection defense); one retry on unparseable output; timeouts kill the whole process group.
- **Visible degradation**: a failed or under-covered stage-4 scoring call marks `gaps` on the ledger instead of silently defaulting every record to neutral.

## Remaining Gaps

| Stage | Current status | Gap |
| --- | --- | --- |
| 1-6 + verifier | Typed modules implemented (table above) | **Not yet wired into `full-pulse.ts`**; wiring must strip price fields from candidates (firewall requirement); a 3-candidate batch entry point is still needed. |
| 3. Evidence collection | Typed module takes an injected search runner | No production `StageSearchRunner` bridges the existing web-search yet; full-text fetch, Twitter/X, Reddit, Telegram, military maps still missing; the current search path does not produce `publishedAtUtc`, so recency scoring will degenerate to a constant 0.3 at wiring time. |
| 7. Conclusion/market comparison | Implemented for mapped markets (live path) | Cutover pending: switch `pulse-entry-planner.ts`'s probability source from Markdown parsing to the typed `bayes_ledger` (mind the Yes-orientation semantics of outcomeLabel); arbitrary natural-language events still need event-to-market matching. |
| Cross-provider | `stage-models.ts` hardcodes claude-* model ids | The codex provider path (already supported by `resolveStageCommandTemplate`) needs a per-provider model mapping. |

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
