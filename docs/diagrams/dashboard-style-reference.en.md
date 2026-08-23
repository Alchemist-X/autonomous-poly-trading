# Launch-page style sample: dashboard-sample

> Last updated: 2026-08-24
> Chinese original: [`dashboard-style-reference.md`](dashboard-style-reference.md)

**Sample repo: https://github.com/Alchemist-X/dashboard-sample** (MIT, our own code — copy freely)

A dark "live model-usage metrics" page design study (a layout study of poolside.ai/pulse; all content is fictional mock data). Zero dependencies, zero build: plain HTML + CSS + vanilla JS, with charts generated as hand-written SVG strings. **When this repo ships a public-facing data page for a launched service/product, consider this visual language first** — it looks professional, is light to implement, and carries no chart-library dependency.

## Where it fits

- **Public paper-fleet board**: the 5 simulated books on Huginn (fable / opus / sonnet / kimi-k3 / ds-flash) — balance curves plus a ranking; the sample's "stacked bars + leaderboard (movement arrows + own-entry highlight)" transfers almost as-is
- **/world-cup/performance visual refresh**: stat tiles for Brier / Mock PNL and event-annotated time series
- **delta / delta-pm public read-only views**: throughput/hit-rate metrics for the news→impact engine
- Any future "since launch" public metrics page (tokens, calls, downloads, accuracy tracking)

## What the style consists of (directly liftable)

| Element | Value / pattern |
| --- | --- |
| Ground / text | `#1a1a1a` background; white body text, secondary grays `#d6d5cf` → `#878580` |
| Accents | ice blue `#ace2ef` (brand/highlight) + green `#9bd85b` (links/up) + orange-red `#ff7a59` (down) |
| Chart series | ice / teal `#18a9b6` / yellow `#fed354` / purple `#bb56ff` / green `#67ae00` / orange `#ff8040` |
| Type | grotesque body (Inter); **all data labels/axes/footnote markers in JetBrains Mono** |
| Headlines | bold white lead + dimmed gray tail (`32px/500`), e.g. "**11.6 trillion** tokens … <span style="color:#878580">since our first launch.</span>" |
| Chart titles | below the chart, uppercase mono small caps + `*`, with a footnote paragraph explaining methodology (transparent data caveats are core to the style's character) |
| Stat tiles | 4-column grid, 1px top rule, big number + two-line gray label |
| Chart patterns | 100% stacked area (share), daily stacked bars (dashed launch-event markers; today's bar gets a hatched "projected tip" extrapolated from the elapsed fraction of the day), leaderboard list |
| Interaction | radio-pill model filter re-rendering all charts and numbers; hover guide line + tooltip; scroll fade-ins honoring `prefers-reduced-motion` |

## How to lift it

- Design tokens: copy the `:root` variable block at the top of `css/style.css` wholesale
- Charts: `js/charts.js` is a dependency-free SVG string generator (stacked area / stacked bars / grid / event markers / hatch pattern / tooltip); in Next.js either inject the generated markup via `dangerouslySetInnerHTML` or port its coordinate logic to JSX; for static pages copy the file as-is
- The mock data layer `js/data.js` shows the "seeded PRNG + timeline anchored to today" trick — handy for demo/placeholder pages
- ⚠️ The sample's brands (meridian / Lumen / GatewayHub) and every number are fictional; lift the styling and components only — keep the fake brand words out of product copy
- ⚠️ When wiring into predict-raven's `apps/web`, the CLAUDE.md front-end trio still applies (tri-lingual i18n / mobile fit / local build + screenshot self-review)
