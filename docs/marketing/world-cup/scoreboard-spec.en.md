# 3-Way Brier Scoreboard · Spec

> Chinese version: [scoreboard-spec.md](scoreboard-spec.md).
> Purpose: product/content spec for the public 3-way scoreboard (docs/content only, no app code; frontend implemented by others). Channels: Website + Discord.
> Source: `docs/internal/plan/2026-06-09-world-cup-special-plan.md` §6 (leaderboard flywheel), §11.3 (3-way comparison), §5 (Brier calibration), §8 (compliance framing).

---

## 1. What it is / why

The scoreboard is our only proof of credibility: put **three sets of probabilities** side by side, settle them match by match with **Brier scores** — public, auditable, and **we log losses too.** It's the most important loop in the growth flywheel (plan §6) — every forecast links back to it.

The three:
- **Us** — our independent 7-stage engine's probability.
- **Kimi** — Kimi's publicly published forecast probability (attributed, cited for comparison only).
- **Market** — Polymarket-implied probability, framed as a **"consensus-bias research variable"** (plan §11.1 — not a direct basis for prediction, and not a wagering target we facilitate).

---

## 2. What's tracked per match

| Field | Description | Source |
|---|---|---|
| `match_slug` | Unique match id = event_slug (e.g. `fifwc-mex-rsa-2026-06-11`) | `forecast_reports` (plan §4.6) |
| `market_question` | The settled question tracked (start with `match_result` 1X2; long-run props listed separately) | market list |
| `kickoff_at` / `resolved_at` | Kickoff / settlement time | fixtures |
| `p_us` | Our probability for the outcome | our report `yes_probability` |
| `p_us_ci` | Our 80% confidence interval | our report |
| `p_kimi` | Kimi's published probability for the outcome (N/A if none) | Kimi public release, cited |
| `p_market` | Market-implied probability (pre-settlement snapshot, with snapshot time) | Polymarket Gamma/CLOB snapshot |
| `resolved_outcome` | Actual result (0/1, or which 1X2 outcome hit) | result backfill |
| `brier_us` / `brier_kimi` / `brier_market` | Each side's Brier for the match | computed after settlement |
| `status` | `pending` / `resolved` | — |

> Scope (MVP): track `match_result` (1X2) single matches first — most stable, fastest to volume. Long-run props (e.g. Germany to win the title) go in a separate "long-run tracking" mini-table, updated on probability drift and settled at the corresponding stage.

---

## 3. How Brier is computed and shown

**Definition (plain):** Brier measures how accurate a probability forecast was = squared difference between the forecast probability and the actual outcome (happened = 1 / didn't = 0). **Lower = more accurate**, range 0–1 (binary).

**Formula:**
- Binary event: `Brier = (p − outcome)²`, `outcome ∈ {0,1}`.
- Multi-class (1X2: home win / draw / away win): `Brier = Σ_k (p_k − o_k)²`, where `o_k` is the one-hot of which class occurred. Multi-class Brier ranges 0–2.

**Reference lines (plan §5, to help readers judge "is this good"):**
- Pure random 3-way ≈ **0.22** (the intuitive "blind guess" baseline; show a "random baseline" reference line on the scoreboard).
- Our backtest target: single-match 1X2 Brier **< 0.20** (0.19 approaches the market).
- The one non-negotiable: **Brier is public and never faked** (plan §7).

**Display:**
- **Per-match row:** each side's Brier + highlight who was lowest (most accurate) this match; show the actual result and each side's forecast probability.
- **Cumulative section:** each side's **average Brier** to date, matches settled, last-N trend (line chart). This is the headline number.
- **Honest labeling:** matches we lose are not hidden; if our Brier is higher than the market on a match, show it as-is (plan §7: "posting our misses builds credibility").
- **Confidence tiers (plan §11.1):** the report side can label "high/medium/low" confidence to help readers gauge how sure we were; the scoreboard still settles on actual Brier.

---

## 4. Data sourcing & attribution caveats (compliance-critical)

| Column | Source | Required caveat |
|---|---|---|
| **Us** | Our `forecast_reports`, pre-generated on VPS via the real 7-stage run (plan §6) | Probability includes an 80% CI; not a certainty |
| **Kimi** | Kimi's publicly published forecast values | **Must be attributed: "Kimi published data, cited for comparison"**; N/A where no public number; do not copy its report text/tables; no affiliation claim (plan §11.3 IP red line) |
| **Market** | Polymarket-implied probability, pre-settlement snapshot | Framed as a **"consensus-bias research variable,"** not a wagering target; show snapshot time; **page carries no Polymarket deposit / wagering / affiliate link** (plan §8 R2) |
| **Outcome** | Public result | Per the official settlement ruling |

**Framing hard constraints (plan §8):**
- Throughout, say "probability / deviation / research signal," **never "betting edge / picks / tips."**
- The market column is a research reference, **not** an on-ramp to any gambling platform.
- We do not accept or facilitate any betting.

---

## 5. Rendering + auto-broadcast

**Website (`/world-cup/leaderboard`):**
- Cumulative 3-way average Brier pinned at top (the headline number) + trend line.
- Scrollable per-match table (newest `kickoff_at` first); each row links to that match's report.
- One positioning line at top; disclaimer persistent at the bottom.
- MVP data source: manual JSON or directly off `forecast_reports.resolved_outcome` (plan §10 Open Question Q6 — affects W1 on-time launch; suggest manual JSON first for speed, migrate later).

**Discord (`#leaderboard`, bot auto-broadcast — see discord-setup §5):**
- **Post-match T+1h:** single-match scoring recap (actual result + 3-way Brier + hit or miss).
- **Weekly:** cumulative 3-way average Brier recap + trend.
- The bot only reads scoreboard data to render messages; it **calls no order/funding API**.

**Flywheel (plan §6):** every pre-match forecast post and every match report links back to the scoreboard; it's the credibility hub.

---

## Disclaimer (MANDATORY — on the scoreboard footer + every Discord broadcast)

> This scoreboard provides **probability estimates and research analysis** based on public data and **does not constitute financial, investment, or betting advice**. All forecasts are **probabilities, not certainties**; past performance does not predict future results. Market probabilities are a "consensus-bias research variable" reference only, not a wagering target. Kimi data is from its public release, cited for comparison; we have no affiliation with Kimi. We do not accept or facilitate any betting, and we provide no funding channel to any gambling platform. 18+.
