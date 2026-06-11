# Discord Server Setup

> Chinese version: [discord-setup.md](discord-setup.md).
> Purpose: blueprint for the World Cup community Discord (docs/content only). Channels: Website + Discord (no X/Twitter yet).
> Source: `docs/internal/plan/2026-06-09-world-cup-special-plan.md` §7 (6 channels + auto-broadcast), §8 (disclaimer + consent).

---

## 1. The 6 channels (plan §7)

| Channel | Type | Purpose | Who can post |
|---|---|---|---|
| `#announcements` | Announcement (read-only) | Launches, scoreboard milestones, beta batches, major changes | admin only |
| `#daily-forecasts` | Text | Pre-match T-8h forecast posts + links to match reports | bot + admin post; members discuss in threads |
| `#leaderboard` | Text (mostly read-only) | Auto-posted 3-way Brier scoreboard + weekly cumulative recap | bot + admin |
| `#request-a-report` | Text | Members request matches/events; we prioritize them as public reports | everyone |
| `#beta` | Text | Beta requests, invite-code instructions, quota/usage Q&A | beta + admin (instructions pinned for members) |
| `#general` | Text | Chat, intros, off-topic football | everyone |

> Keep channel names in English (universal across languages); in-channel copy is bilingual, reusing the website voice for CN.

---

## 2. `#rules` channel text (membership consent, MANDATORY)

> Use as Discord Rules Screening (members must accept before they can talk). Record consent back to `app_users.metadata` (same consent basis as the website).

```
Welcome to the "Independent AI Superforecaster" World Cup community. Please accept these rules before posting:

1. This is a probability research / education community. We publish AI probability analysis of the World Cup and verify accuracy on a public Brier scoreboard.
2. This is NOT a tips/picks community. Do not ask for or post "guaranteed/lock/picks/today's tip" content, and do not post any sportsbook deposit / wagering / affiliate links.
3. We do not accept or facilitate any betting, and we provide no funding channel to any gambling platform.
4. Forecasts are probabilities, not certainties. We log our losses too.
5. Be respectful. No spam, no scams.
6. Age & law: Prediction markets and sports betting are restricted or illegal in many jurisdictions — confirm your local laws. This community is for users aged 18 and over (18+).
7. Content you post in channels like #request-a-report may be used to generate public reports.

✅ Checking this means you are 18+ and have read and agree to the rules and disclaimer above.

Disclaimer: This community provides probability estimates and research analysis based on public data and does not constitute financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not predict future results. We do not accept or facilitate any betting, and we provide no funding channel to any gambling platform.
```

---

## 3. Welcome message (auto-DM to new members / pinned in `#general`)

```
👋 Welcome! This is the "Independent AI Superforecaster" World Cup community.

What we do: a 7-stage reasoning engine independently estimates the probability of every World Cup match, then settles it on one public scoreboard next to the market and Kimi's published probabilities.

Get started in 3 steps:
1️⃣ Check #daily-forecasts — pre-match forecast posts with full report links (free, no login).
2️⃣ Check #leaderboard — the 3-way Brier scoreboard; you can see exactly how accurate we are (we log losses too).
3️⃣ Want to run an analysis yourself? Request an invite in #beta. Want a specific match? Post in #request-a-report.

⚠️ This is a research/education community, not picks. Forecasts are probabilities, not certainties. We do not accept or facilitate any betting. 18+.
```

---

## 4. Role structure

| Role | How it's earned | Permissions |
|---|---|---|
| `admin` | Team member, assigned manually | Full: manage channels, post announcements, manage bot, kick/ban |
| `bot` | Auto-broadcast bot account | Posts in `#daily-forecasts` / `#leaderboard` / `#announcements`; not in human channels |
| `beta` | Assigned after activating an account with a valid invite code (manual, or bot-verified) | Unlocks `#beta` posting; marks "beta activated" |
| `member` | Granted on passing Rules Screening | Can post in `#request-a-report` / `#general` / forecast threads |

> For MVP, `beta` can be assigned manually (Week-1 avoids complex automation — see plan §7 "not doing" list). Auto-grant on invite activation can come later.

---

## 5. Auto-broadcast bot plan

> Goal: auto-sync "pre-match forecast → post-match scoring → weekly cumulative" to Discord so humans only need to show up once a day (plan §7 split). **Manual first where it's faster** — the bot is the target state that gradually replaces manual posting.

### Per-match auto-broadcast

| Timing | Channel | Content | Data source |
|---|---|---|---|
| **Pre-match T-8h** | `#daily-forecasts` | Forecast card: match / our P / market P / research signal (edge) / 80% CI / report link | `forecast_reports` table (match_slug) |
| **Post-match T+1h** | `#leaderboard` | Scoring recap: actual result + each side's Brier (us / Kimi / market) + hit or miss | recomputed after `resolved_outcome` backfill |
| **Weekly** | `#leaderboard` | Cumulative Brier recap: average Brier to date for all three, matches settled, trend | scoreboard aggregate |

### Forecast card template (pre-match T-8h)

```
⚽ {home} vs {away} · {kickoff local time}
📊 Our probability: {our P} (80% interval {ci_low}–{ci_high})
📈 Market (Polymarket-implied, research reference): {market P}
🔍 Research signal (model − market): {edge} pp
👉 Full 7-stage report: {report link}
— Forecasts are probabilities, not certainties. Not betting advice. 18+
```

### Scoring recap template (post-match T+1h)

```
✅ Result: {actual result}
🏅 This match's Brier (lower = better): Us {brier_us} · Kimi {brier_kimi} · Market {brier_mkt}
{one neutral line on whether we got it right — we post losses too}
👉 Full scoreboard: /world-cup/leaderboard
— Research scoring. We do not accept or facilitate any betting.
```

### Implementation notes (for whoever ships it — no code in this docs scope)

- The bot only reads `forecast_reports` (and the scoreboard aggregate) to render messages; it **calls no order/funding API**.
- The Kimi column must be labeled "Kimi published data, cited for comparison" in broadcasts; leave blank / N/A for matches with no public Kimi number.
- Any "we got it wrong" post: the publish button stays with a human (plan §7: tone sign-off is human-managed). The bot can draft it; admin confirms in one click.
- Abnormal broadcast cadence / missing data should alert admin (plan §7: quota/anomaly alerting is agent-autonomous).

---

## Disclaimer (MANDATORY — embedded in `#rules` and bot templates; the server description should also carry the short version)

> This community provides **probability estimates and research analysis** based on public data and **does not constitute financial, investment, or betting advice**. All forecasts are **probabilities, not certainties**; past performance does not predict future results. We do not accept or facilitate any betting, and we provide no funding channel to any gambling platform. 18+.
