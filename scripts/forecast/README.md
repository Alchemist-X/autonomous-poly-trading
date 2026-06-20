# Iterative Binary Forecaster (`scripts/forecast/`)

> 中文在下。An iterative, fully-traceable probability engine for binary (yes/no)
> events, driven by a user prompt. Built for predict-raven on the
> `feat/iterative-forecaster` branch.

## What it does

Give it a binary question. It runs **multiple rounds**; each round an AI agent
(Claude Code, via its own WebSearch) gathers **new** evidence from the live web
and updates a **running probability**. Every probability move is attributed to a
**cited source** via a Bayesian log-odds update, so the whole decision process is
auditable: you can see exactly which source moved P(YES) by how many percentage
points, round by round.

This is **not** the trading pipeline and has **no market dependency**: events come
from a prompt, not Polymarket; there is no price, edge, sizing, or order. It does
search the open web (market-blindness is intentionally not enforced here).

## Usage

```bash
# Endpoint is configured purely by env (no secret is committed).
ANTHROPIC_BASE_URL=<endpoint> ANTHROPIC_API_KEY=<key> \
pnpm forecast:event -- "Will Apple announce and ship a foldable iPhone in 2026?" \
  --resolution "Resolves YES if Apple officially announces AND ships ... in 2026" \
  --deadline 2026-12-31 \
  --max-rounds 3
```

Re-running the **same question** resumes the existing forecast and adds rounds
(prior sources are passed back to the agent as "do not re-count"). Pass `--fresh`
to start over.

Flags: `--resolution`, `--deadline`, `--max-rounds N`, `--model <id>`, `--fresh`.

Env: `ANTHROPIC_API_KEY` (required), `ANTHROPIC_BASE_URL`, `FORECAST_MAX_ROUNDS`,
`FORECAST_MODEL`, `FORECAST_ALLOWED_TOOLS` (default `"WebSearch WebFetch"`),
`FORECAST_AGENT_TIMEOUT_MS`.

## Output

Per forecast, under `runtime-artifacts/forecasts/<eventId>/`:

- `report.md` — human-readable audit: probability trajectory table, per-round
  reasoning + searches, a per-source table (`source | moved ±Npp | from→to |
  verified`), and a cumulative evidence ledger.
- `state.json` — machine state (resumable; persisted after every round).

## Architecture

```
cli.ts        parse args -> load/create state -> runForecast -> print summary
engine.ts     the round loop: prior-aware prompt -> agent -> validate ->
              dedupe by canonical URL -> Bayesian update -> persist -> stop check
claude-agent.ts  spawn `claude --print --output-format stream-json --verbose
                 --allowedTools WebSearch`; parse JSONL to capture the agent's
                 actual search queries + result URLs and extract the final JSON
bayes.ts      logit / invLogit / applyLlrs (per-source pp attribution) / clamps
store.ts      per-event state.json + report.md; eventId; canonical paths
url.ts        canonicalizeUrl — the cross-round dedupe key
types.ts      shared types + the agent round-output contract
forecast.test.ts  unit tests for the deterministic core (run with `pnpm test`)
```

The agent emits **structured JSON** per round (validated fail-closed — a malformed
round throws and retries once, never silently degrades to a guessed number). The
engine, not the agent, sets the probability: the agent proposes a signed
log-likelihood-ratio per source, the engine threads those through log-odds space.

## P0 risk mitigations (why it behaves)

- **No double-counting across rounds** — every source is keyed by canonical URL;
  already-counted URLs are stripped before the update and listed back to the agent
  as "do not re-count".
- **No oscillation from re-picking** — continuity invariant: round *n* prior ==
  round *n-1* posterior; the agent moves *from* the supplied prior. Per-source LLR
  magnitude is clamped (≤2 nats); probability clamped to [1%, 99%].
- **No fabricated citations** — every cited URL is reconciled against the agent's
  actual WebSearch result trace (from stream-json); unmatched URLs are flagged
  `⚠ not in trace` in the report.
- **Bounded cost/rounds** — hard `--max-rounds` cap; stops early on no-new-info or
  convergence (move < 1pp).

## Known limitations / next steps

- **No automatic scoring (Brier/calibration)** — by design (per project decision);
  arbitrary prompt events have no settlement oracle. The state schema records
  enough (deadline, per-round history) to add resolution tracking later.
- **Binary only** — v1 scope. Multi-outcome / continuous would need a per-outcome
  probability vector and a different update.
- **Crude credible interval** — a heuristic band, not a calibrated interval.
- **Web visualization** — out of scope here (the user is designing the web UI
  separately); `report.md` + `state.json` are the integration surface for now.

---

## 中文说明

输入一个**二元(是/否)问题**,引擎跑**多轮**:每轮由 AI agent(Claude Code,用它自己的
WebSearch)联网找**新**证据,更新一个**持续维护的概率**。每一次概率移动都通过贝叶斯
log-odds 更新**挂在一个被引用的信源上**——可以看到哪个信源把 P(是) 移动了多少个百分点,
逐轮可追溯。

**与交易线无关、不依赖市场**:事件来自 prompt 而非 Polymarket,没有价格/edge/下单。会联网
搜索(此处不强制市场盲测)。

运行见上面 Usage。产物在 `runtime-artifacts/forecasts/<eventId>/`:`report.md`(人类可读
追溯)+ `state.json`(可恢复的机器状态)。重复同一问题会**续跑加轮**,旧信源作为"不要重复
计数"传回 agent。

关键防护:跨轮按 canonical URL **去重**、连续性不变量**防震荡**、用真实搜索轨迹**核对信源
防编造**、`--max-rounds` + 收敛/无新信息**封顶成本**。

局限:暂不自动打分(无结算源,符合既定决策)、仅二元、置信区间是启发式、Web 可视化另做。
