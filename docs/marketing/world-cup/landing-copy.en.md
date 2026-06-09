# World Cup Forecasting · Landing Page Copy

> Chinese version: [landing-copy.md](landing-copy.md).
> Purpose: blueprint copy for the website landing page (docs/content only, no app code changes). Channels: Website + Discord (no X/Twitter yet).
> Source: `docs/internal/plan/2026-06-09-world-cup-special-plan.md` §6/§7/§8/§11. All numbers come from real Phase 1 model output; placeholders marked `<<TODO>>`.

---

## 0. One-liner positioning (Hero)

> **An independent AI superforecaster, scored in public.**
> Stepping up to Kimi's open invitation — head to head against the market and against Kimi, scored match by match with Brier.

- Short version (page header / title): **Independent AI superforecaster · Public scoring**
- Subhead: We turn every World Cup match into a probability, show all of our reasoning, and log every win and loss on a public scoreboard.

---

## 1. Hero section

**Headline:** An independent AI superforecaster, scored in public.

**Subhead:** A 7-stage reasoning engine independently estimates the **probability** of each result / group finish / title for every World Cup match, then puts it on one scoreboard next to the market and Kimi's published probabilities — settled match by match. Not picks. The research process, made public.

**Primary CTA:** Join Discord for daily forecasts and the scoreboard → (Discord invite link)
**Secondary CTA:** Browse published match reports (free, no login) → `/world-cup`

**Trust line (under hero):** Forecasts are probabilities, not certainties. · Public Brier scoring · We log losses too · 18+

---

## 2. "How it works" — the 7 stages in plain language

> No jargon. For every match the engine runs these 7 steps. Each one is logged in the report and you can expand it.

1. **Pin down what's actually being asked.** Is it who wins, who advances, or who lifts the trophy? What counts as a "win," and whose ruling settles it? Keeps news buzz from being mistaken for a result.
2. **Break it into a few must-be-true conditions.** "Can Germany win?" splits into 2–5 smaller questions that all have to hold, plus what to research for each.
3. **Gather evidence.** Pull public data and reporting: team strength (Elo / FIFA ranking), recent form, injuries, fixtures, weather, market prices — sorted by source type.
4. **Weight the evidence.** Not all news is equal. First-party, fresh, cross-confirmed sources get more weight; rumors and stale info get less.
5. **Run the math model.** A statistical engine (Elo match odds + Monte Carlo tournament simulation) sets a baseline probability. The AI only nudges it — within hard limits, and only with evidence — where the stats can't see (injuries, confirmed lineups, altitude/heat, rotation).
6. **Update the probability step by step.** Starting from the baseline, we show exactly how each key piece of evidence pushes the number up or down, ending with a main probability plus an **80% confidence interval**.
7. **Compare to the market, flag the gap.** We line our probability up against the market and flag the difference — we call it a **research signal**, not betting advice.

> Want the real thing? Open any match report: steps 1–7 are expandable stage cards with the evidence ledger, model breakdown, and the probability-update trail.

---

## 3. The 3-way scoreboard pitch

**Headline:** Who's more accurate? See it in public.

We do something nobody else does: put **three sets of probabilities** in one table and settle them match by match.

- **Us** (the independent AI superforecaster's probability)
- **Kimi** (its publicly published forecast probability, with attribution)
- **The market** (Polymarket-implied probability, used as a "consensus-bias research variable")

After each match, all three get a **Brier score** (lower = more accurate). We don't cherry-pick wins — **we log losses too.** This scoreboard is our only proof of credibility.

**CTA:** See the live scoreboard → `/world-cup/leaderboard`

> Note: Kimi figures are cited for public comparison only. We are not affiliated with Kimi, do not republish its report, and do not speak for it. Market probabilities are a research reference only. We do not accept or facilitate any betting.

---

## 4. Free vs Beta

| | Anyone (free, no login) | Beta (invite code) |
|---|---|---|
| Browse published match reports (probability / CI / model breakdown / research signal) | ✅ Unlimited | ✅ |
| 3-way scoreboard | ✅ | ✅ |
| **Run a full 7-stage analysis yourself on any event** | — | ✅ 5/day · 50/month |
| Download report PDF | ✅ (published matches) | ✅ |

- **Free tier (cached reports):** Pre-run reports for popular matches — public, shareable, downloadable, no account needed.
- **Beta tier (custom run):** Want the engine to run live on a match or question you care about? Activate with an invite code (fair-use quota: 5/day, 50/month, 1 concurrent).

**How to get an invite:** Follow the steps in the Discord `#beta` channel, or drop the match you want to see in `#request-a-report` — we prioritize popular requests as public reports.

---

## 5. What we are / are not

**We are:** a probability research and education tool. We make the AI's reasoning public and auditable, and verify accuracy on a public scoreboard.

**We are not:** picks, tipping, a sportsbook, or a money rail. We don't tell you "what to buy," we **do not accept or facilitate any betting**, and the site carries no sportsbook deposit / wagering / affiliate links.

---

## 6. Bottom CTA

**Headline:** Watch an AI turn the World Cup into probabilities

- **Join Discord** → (invite link): daily forecasts, auto-posted scoreboard, beta access, report requests.
- **Browse reports** → `/world-cup`: public match reports starting from the opener.

---

## Disclaimer (MANDATORY — must appear in the landing page footer)

> This tool provides **probability estimates and research analysis** based on public data and **does not constitute financial, investment, or betting advice**. All forecasts are **probabilities, not certainties**; past performance does not predict future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions — confirm your local laws; some regions require you to be **18+**. We do not accept or facilitate any betting, and we provide no funding channel to any gambling platform.
