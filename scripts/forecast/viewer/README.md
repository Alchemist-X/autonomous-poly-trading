# Forecast Viewer (`scripts/forecast/viewer/`)

> 中文在下。A web visualization of the iterative forecaster — the implementation of
> the **Predict Raven** Claude Design (`Predict Raven.dc.html`). Runs in two modes:
> **live** (a local server that actually runs the engine on the question you type)
> and **static** (a self-contained file replaying one saved `state.json`).

## Live mode — the page actually runs the engine

```bash
# from repo root; the engine spawns `claude` so it needs the same env as forecast:event
ANTHROPIC_BASE_URL=... ANTHROPIC_API_KEY=... pnpm forecast:viewer
# -> open http://127.0.0.1:8123
```

`server.ts` (node:http) serves the page in live mode and exposes:
- `POST /api/forecast {question,maxRounds,fresh}` → spawns the real
  `scripts/forecast/cli.ts` as a child process, returns the `eventId`.
- `GET /api/runs/:eventId` → `{ state, job }` — the engine persists `state.json`
  after every round, so the page **polls** it and shows real progress (framing →
  iteration N → result) as it lands.
- `GET /api/runs` → recent runs (the input page lists them; click to reopen).

Type a question → Consult → watch P(YES) move as the agent gathers evidence →
final report. It's the same engine as `pnpm forecast:event`, just driven from the
web. (Rich evidence needs the endpoint's WebSearch to be up; a 0-source run is
usually a transient endpoint rate-limit, not a wiring problem.)

## Static mode — a self-contained snapshot

A single static page that renders one forecast run in three phases:

1. **Input** — ask a yes/no question (hero landing).
2. **Reasoning** — playback of the agent iterating: a live P(YES) belief readout +
   an evidence stream where each source nudges the probability.
3. **Result** — the report: hero estimate, a **belief-trajectory chart** across
   iterations, Raven's summary, collapsible resolution/framing, and an expandable
   **iteration timeline** (each iteration → its reasoning + per-source attribution).

It is a faithful port of the Claude Design, reimplemented as dependency-free
vanilla JS so it binds to the **current** pipeline schema (`../types.ts`) and ports
cleanly later (no chart libraries). Color, type, and layout match the design.

### Design fixes applied (vs the original `.dc.html`)
- Evidence stream's **3rd card fades out** via a bottom gradient mask (not flat opacity).
- "round" → **"iteration"** in all user-facing labels.
- **Source titles are colored by direction** — green when the source raised P(YES),
  red when it lowered it.
- Removed the `PRIOR → R1 … → RESULT` progress stepper from the reasoning phase.

### New-schema features surfaced
- `summary` object → verdict + **key factors (YES / NO)** + open uncertainties.
  Older runs without `summary` fall back to the final iteration's reasoning (labeled).
- `kind:"reflection"` sources → **↻ REVISION** tag + "revises a prior source" badge.
- `whyChanged` → a per-iteration `net / ▲up / ▼down / led by` decomposition line.
- `credibleInterval` → an 80% CI readout next to the estimate.

## Build & view

```bash
# from scripts/forecast/viewer/
node build.mjs                                   # default: 6-iteration foldable-iPhone run
node build.mjs ../../../runtime-artifacts/forecasts/<eventId>/state.json   # any run
```

`index.html` is self-contained (data inlined) — **open it directly in a browser**
(file://) or serve the folder: `python3 -m http.server 8123`.

### URL params (handy for review / screenshots)
- `?phase=input|reasoning|result` — jump to a phase (default `input`).
- `?theme=dark|light` — the design ships both palettes.
- `?step=N` — freeze the reasoning playback at step N.
- `?open=3,5` — open specific iterations in the result timeline.
- `?expand=all` — open every iteration + source.

## Visual QA
`clip.mjs` takes crisp 2× screenshots: `node clip.mjs <outDir> <path>...`.
The repo's `scripts/visual-qa.mjs` also works (`--base http://localhost:8123`).
Screenshots are written under `runtime-artifacts/` (gitignored).

## Not yet
- Production home: this is a local prototype. Porting into `apps/web` (a real
  Next.js route + en/zh-CN/zh-TW i18n) is a separate step.
- Live progress is **polled** (round-level) from the `state.json` the engine
  writes after each round — not a per-token stream. Fine-grained "searching now…"
  comes from the engine's stdout log tail.

---

## 中文说明

两种模式。**Live(连引擎)**:`ANTHROPIC_BASE_URL=... ANTHROPIC_API_KEY=... pnpm forecast:viewer`
→ 打开 `http://127.0.0.1:8123`,网页上输入 yes/no 问题点 Consult,`server.ts` 会真的
spawn `scripts/forecast/cli.ts` 跑引擎;引擎每轮写 `state.json`,网页**轮询**它,实时显示
框定 → 第 N 轮 → 结果。输入页还会列出近期 run,点开即看。和 `pnpm forecast:event` 是同一个
引擎,只是从网页驱动(证据多少取决于 endpoint 的 WebSearch 是否在线;偶发 0 信源通常是共享
endpoint 被限流,不是接线问题)。

**Static(快照)**:`node build.mjs [state.json 路径]` 把某次 run 烤进自包含的 `index.html`,
直接浏览器打开即可(无需服务器)。

这是 Claude Design 里 `Predict Raven.dc.html` 的**落地实现**。三个阶段:输入提问 → 推理
(逐条证据推动 P(是))→ 结果报告(信念轨迹图 + 摘要 + 结算口径 + 可展开的**迭代时间线**)。

**已按你的要求改的 4 处**:第 3 条信源底部渐变淡出;`round` 全改成 `iteration`;信源
标题按涨/跌着色(涨绿跌红);去掉推理阶段顶部的 `PRIOR→R1→…→RESULT` 进度条。
**适配新管线**:`summary`(含 YES/NO 关键因子)、`reflection` 反思信源(↻ REVISION)、
每轮 `whyChanged` 分解、`credibleInterval` 置信区间。

URL 参数见上(`?phase= / ?theme= / ?open= / ?expand=all`)。接入 `apps/web`(真正的
Next.js 路由 + 三语 i18n)是后续单独一步。
