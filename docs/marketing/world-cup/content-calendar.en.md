# 40-Day Content Calendar · Website + Discord only

> Chinese version: [content-calendar.md](content-calendar.md).
> Purpose: blueprint for the 40-day launch content cadence (docs/content only). **Adapted to Website + Discord, all X/Twitter items removed** (user decision: no X yet).
> Source: `docs/internal/plan/2026-06-09-world-cup-special-plan.md` §7 (40-day calendar, Week-1 checklist), §6 (funnel), §9 (roadmap).
> Time anchors: today 2026-06-09, opener 6/11, final 7/19.

---

## 0. Channel note (important change)

The original plan was a one-way funnel "EN/CN X → Website → Discord." **This run is Website + Discord only:**
- **Website** = the catch + credibility hub (match reports + 3-way scoreboard).
- **Discord** = community/retention + the only active distribution channel (daily forecasts, scoring broadcasts, beta).
- With no X reach loop, cold start leans harder on **Discord invite spread + the SEO/shareability of match reports + report requests (#request-a-report)**. The plan's "OG card reshared to X" becomes "OG card for match-report-page sharing + image attached to Discord posts."

---

## 1. Per-match cadence

| Timing | Action | Where | Auto/manual |
|---|---|---|---|
| **Pre-match T-8h** | Forecast post: match / our P / market P / research signal / 80% interval / report link | Discord `#daily-forecasts` (+ website match report ready to click) | bot drafts, admin posts (tone sign-off human, plan §7) |
| **Post-match T+1h** | Scoring recap: actual result + 3-way Brier + hit or miss (**we post losses too**) | Discord `#leaderboard` (+ website scoreboard updated) | bot drafts, admin posts |
| **Weekly** | Cumulative Brier recap: 3-way average + matches settled + trend | Discord `#leaderboard` + website scoreboard headline | bot + admin |
| **Long-run (ongoing)** | Title 48-leg / top scorer probability drift updates (e.g. Germany to win) | website long-run table + occasional Discord | agent maintains JSON |

> Templates in [discord-setup.en.md](discord-setup.en.md) §5 (forecast card / scoring recap / weekly recap). The full 7-stage match report is always the catch destination.

---

## 2. Week-1 launch checklist (6/9–6/15, opener week)

> North star (plan §7 KPI): **close the loop**. Don't chase volume — first wire up "report → scoring → community." Manual first where it's faster (plan §7 "not doing" list).

- **D0 (6/9, today)**
  - [ ] Website landing copy live (use [landing-copy.en.md](landing-copy.en.md)), disclaimer in the footer.
  - [ ] Create the Discord 6 channels + Rules Screening (use the `#rules` / welcome / roles from [discord-setup.en.md](discord-setup.en.md)).
  - [ ] Confirm the Discord invite link works, put it in the website CTAs.
- **D1 (6/10)**
  - [ ] Pre-generate reports + PDFs for 2–3 opener-week matches (real 7-stage on VPS, plan §9 Phase 0).
  - [ ] Scoreboard base live (even manual JSON, even 3 rows is fine, plan §7 D3–D7).
  - [ ] Confirm login works in prod + issue the first beta codes (`--max-uses 50 --label wc-week1`, plan §7 D1).
- **D2 (6/11, opener day)**
  - [ ] **Publish the flagship piece:** the Germany +3.6pp response (use [germany-response.en.md](germany-response.en.md); fill placeholders fillable before kickoff, leave the rest as TODO).
  - [ ] Opener forecast card: `fifwc-mex-rsa-2026-06-11` (Mexico vs South Africa) → `#daily-forecasts`.
  - [ ] Pin "who we are / how we score" in Discord `#announcements`.
- **D3–D7 (6/12–6/15)**
  - [ ] Run ≥3 matches end-to-end (pre-match card → post-match recap → into the scoreboard). Opener week anchors `fifwc-mex-rsa-2026-06-11` + `fifwc-kr-cze` (South Korea vs Czechia) for the baseline (plan §7 W1).
  - [ ] Validate one full funnel: a request in `#request-a-report` → send report link → user logs in → issue code → activate → one successful custom run.
  - [ ] Ship `/world-cup/leaderboard` (even with 3 settled rows).
  - [ ] Build up the **first ~20 group-stage cached reports** (plan §9 Phase 0: "run ~20 popular group-stage matches first").
- **Not doing (Week-1):** OG auto-render polish, paid tiers, complex bots, paid acquisition (plan §7). No X, so no X account/pinning either.

---

## 3. Weekly rhythm (W1–W6, tied to real fixtures)

| Week | Dates | Phase | Featured matches (named in plan §7) | Content focus |
|---|---|---|---|---|
| **W1** | 6/9–6/15 | Opener week | `fifwc-mex-rsa-2026-06-11`, `fifwc-kr-cze` | Build scoreboard base, close the loop, ship Germany flagship, build ~20 cached reports |
| **W2** | 6/16–6/22 | Group-stage volume | `fifwc-bra-mar` (Brazil vs Morocco), `fifwc-arg-alg` (Argentina vs Algeria) | Traffic peak, hunt anti-consensus upsets; on-time forecast card + recap every match |
| **W3** | 6/23–6/27 | Group-stage close | `fifwc-fra-sen` (France vs Senegal), `fifwc-esp-ksa` (Spain vs Saudi Arabia) | Scoreboard slope (plan §7 target Brier<0.25); cumulative Brier recap every 3 days |
| **W4** | 6/28–7/4 | Knockouts R32/R16 | High-production deep report per match | One "full 7-stage breakdown" deep post per match (Discord long-form + website report) |
| **W5** | 7/5–7/11 | QF/SF approach | Quarters / semis | Retention + depth; positive edge vs market (plan §7 target) |
| **W6** | 7/12–7/19 | SF → Final | Final `<<TODO: final slug>>` | Full-final deep report + **Brier summary as an external citation asset** (plan §9 Phase 3) |

> Long-run calls update throughout: title 48-leg (incl. Germany) / top-scorer probability drift, recomputed as the draw and knockouts progress.

---

## 4. Fixed weekly actions (throughout)

- **Every match:** pre-match T-8h forecast card (`#daily-forecasts`) + post-match T+1h scoring recap (`#leaderboard`).
- **Every 3 days:** cumulative Brier recap post (the flywheel, rain or shine, plan §7).
- **Weekly:** one "full 7-stage breakdown" deep post (CN/EN, website long-form + Discord).
- **Human shows up once a day:** admin appears in Discord, answers `#request-a-report` / `#beta` (plan §7).
- **The one non-negotiable:** Brier is public and never faked; we post losses (plan §7).

---

## 5. Split (human vs agent, plan §7)

- **Agent-autonomous:** pre/post-match post drafts (CN+EN), OG card generation, scheduled Discord broadcasts, scoreboard JSON maintenance + Brier recompute, FAQ auto-answers, quota-anomaly alerts.
- **Human-managed:** the publish button / tone sign-off (especially "we got it wrong" recaps), invite-code issuance strategy, any real-money action, Discord account ownership (plan §10 Open Question Q5: who holds the accounts must be confirmed first).

---

## Disclaimer (MANDATORY — every public post and all content tied to this calendar carries the short version)

> This content provides **probability estimates and research analysis** based on public data and **does not constitute financial, investment, or betting advice**. All forecasts are **probabilities, not certainties**; past performance does not predict future results. We do not accept or facilitate any betting, and we provide no funding channel to any gambling platform. 18+.
