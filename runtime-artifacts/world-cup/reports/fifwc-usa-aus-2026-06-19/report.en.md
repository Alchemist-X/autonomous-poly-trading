# United States vs Australia — 2026 World Cup Group D (Market-Blind Forecast)

- Match: 2026-06-19 19:00 UTC (Lumen Field, Seattle, noon local)
- Generated: 2026-06-11 | Forecast type: 90-minute three-way result (no extra time in group stage)
- **This is a market-blind forecast: fully independent of any betting lines, odds, or prediction-market data.**

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| United States win | **41%** | 34% – 48% | Medium |
| Draw | **26%** | 21% – 30% | Medium |
| Australia win | **33%** | 27% – 40% | Medium |

**One-line view:** The USA edge ahead at about 41% on true home advantage in Seattle, but Australia carry the higher Elo and the most thorough preparation — meaningful room for a draw or an away win.

## 2. Definition

Three-way result over 90 minutes (plus stoppage time): USA win / draw / Australia win. No extra time or penalties in the group stage.

## 3. Team Profiles

| Metric | United States | Australia |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1726 (No. 39) | 1777 (No. 28) |
| FIFA world ranking (NBC LA, 2026-06) | 16 | 27 |
| Head coach | Mauricio Pochettino | Tony Popovic |
| Recent prep | Lost send-off friendly 1-2 to Germany (Chicago) | Long camp in Sarasota, FL since April |

The two rating systems disagree: Elo has Australia slightly stronger, FIFA ranking has the USA clearly ahead — fundamentals are close, and home advantage is the main separator.

## 4. Key Factors (sourced)

1. **Genuine home fixture**: played at Lumen Field, Seattle, noon local kickoff; the USA are co-hosts and play all group matches on home soil ([seattle.gov](https://www.seattle.gov/fifa), 2026-06).
2. **USA injuries**: Johnny Cardoso (first-choice DM) and Patrick Agyemang miss the World Cup; starting CB Chris Richards is still working back from an ankle injury — not believed serious, but a fitness question ([Yahoo Sports live tracker](https://sports.yahoo.com/soccer/live/2026-world-cup-news-live-tracker-injuries-squads-storylines-and-updates-as-the-tournament-looms-200000653.html), 2026-06-10).
3. **Australia injuries**: Riley McGree (hamstring), Patrick Yazbek and Lewis Miller all ruled out of the final 26 ([SBS News](https://www.sbs.com.au/news/article/who-could-make-and-miss-out-on-popovics-socceroos-world-cup-squad/w12a5cv31), around 2026-06-01).
4. **USA core intact**: Pochettino named his 26-man roster in late May — Pulisic, Adams, McKennie headline; Gio Reyna returns ([U.S. Soccer](https://www.ussoccer.com/stories/2026/05/usmnt/us-mens-national-team-head-coach-mauricio-pochettino-names-26-player-roster-for-fifa-world-cup-2026), 2026-05; [ESPN](https://www.espn.com/soccer/story/_/id/48854192/usa-2026-world-cup-roster-gio-reyna-diego-luna-zendejas)).
5. **Australia best-prepared**: first of all 48 teams to begin training in the US (Sarasota camp since April); Popovic has publicly targeted the quarter-finals; fully acclimatized ([Squawka](https://www.squawka.com/en/news/world-cup/australia-world-cup-2026-fixtures-squad-analysis/), 2026-06).
6. **USA send-off loss**: closed preparation with a 1-2 loss to Germany (world top 10) — a neutral-to-soft form signal ([Yahoo Sports](https://sports.yahoo.com/soccer/live/2026-world-cup-news-live-tracker-injuries-squads-storylines-and-updates-as-the-tournament-looms-200000653.html), 2026-06).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, +100 Elo host bonus for the USA in a home group match):**
  - RaEff = 1726 + 100 = 1826; Rb = 1777
  - USA 42.3% / draw 25.7% / Australia 31.9%
- **Evidence adjustment (cap ±8pp, applied ±1pp)**: USA absences (Cardoso out, Richards doubtful) marginally heavier than Australia's (McGree et al., mostly rotation depth), plus the send-off loss → −1pp USA, +1pp Australia. Remaining evidence (FIFA ranking vs Elo pointing opposite ways; injuries on both sides) roughly cancels; evidence is thin overall, so the adjustment is deliberately conservative.
- **p_final = 41% / 26% / 33%** (rounded after renormalization).
- Sensitivity: drawNu 0.6–0.8 → USA win 40.8%–44.0%; host bonus ±35 → USA win 38.5%–46.2%. The 80% intervals widen these ranges further for evidence thinness.

## 6. Method

Probabilities come from a Davidson three-way Elo model (identical to eloToOneXTwo in the repo's `packages/sports-model/src/elo.ts`), with a +100 Elo host bonus for group matches on home soil, followed by a bounded (±8pp max) evidence-based adjustment. No betting lines, odds, or prediction-market data are used anywhere; every factual claim carries a public source and date.

**Sources:** eloratings.net (2026-06-11), U.S. Soccer (2026-05), ESPN (2026-05/06), Yahoo Sports (2026-06-10), SBS News (2026-06-01), Squawka (2026-06), seattle.gov (2026-06), NBC Los Angeles (2026-06).

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
