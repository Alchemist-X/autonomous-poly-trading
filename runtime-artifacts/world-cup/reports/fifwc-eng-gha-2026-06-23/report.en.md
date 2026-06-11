# 2026 World Cup Group L: England vs Ghana (Market-Blind Forecast)

- Kickoff: 2026-06-23 20:00 UTC (Boston, 16:00 EDT)
- Generated: 2026-06-11 | Event slug (resolution metadata only): `fifwc-eng-gha-2026-06-23`

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| England win | **85.0%** | 79% – 89% | High |
| Draw | **11.5%** | 8% – 16% | High |
| Ghana win | **3.5%** | 2% – 6% | High |

**One-line view:** England are overwhelmingly stronger with a full-strength squad, while Ghana are missing Kudus and in poor form — England's win probability is about 85%.

## 2. Definition

Three-way 90-minute result (including stoppage time): England win / draw / Ghana win. No extra time or penalties in the group stage.

## 3. Strength Profile

| Team | Elo | Elo world rank | Recent form |
| --- | --- | --- | --- |
| England | 2024 | 4th | Won all 8 qualifiers, 22 scored, 0 conceded; beat New Zealand 1-0 in a June 6 friendly |
| Ghana | 1510 | 81st | Lost to Austria and Germany in March; lost to Mexico in late May; drew Wales on June 2 |

Elo source: eloratings.net (2026-06-11 snapshot, `elo-table.json`). The 514-point Elo gap is among the largest of any group-stage pairing.

## 4. Key Factors

1. **Ghana's star Mohammed Kudus is ruled out of the entire tournament**, and first-choice centre-back Alexander Djiku is also absent — a double blow to creativity and defensive core (olympics.com, 2026-06).
2. **Ghana's preparation form is poor**: losses to Austria and Germany in March, a loss to Mexico in late May, and only a draw with Wales on June 2 — 1 draw, 3 losses in warm-ups (ghanafa.org / olympics.com, 2026-06-02).
3. **England won all 8 qualifiers with 22 goals scored and none conceded** under Thomas Tuchel (footballgroundguide.com, 2026-06).
4. **England's squad depth is exceptional**: the 26-man list announced June 1 omits Palmer, Foden and Maguire yet loses little strength; Toney and Watkins included (Sky Sports / FIFA.com, 2026-06-01).
5. **England's only minor concern is at full-back**: Livramento, Reece James and Spence are just back from injury, and Stones lacks club minutes (ESPN, 2026-06) — limited impact given depth.
6. **Neutral venue** (Boston); neither side gets a host bonus. Late-June afternoon heat on the US East Coast affects both teams equally.

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, no host bonus — neither team is a co-host):
  England 82.55% / Draw 13.16% / Ghana 4.28%.
- **Evidence adjustment (England +2.45pp, Draw -1.66pp, Ghana -0.78pp, well inside the ±8pp cap)**:
  Elo already absorbs Ghana's recent defeats, but the Kudus + Djiku absences are forward-looking deductions Elo has not priced in; England have no major absences, a perfect qualifying record and a clean warm-up. Small shift toward England.
- **p_final: England 85.0% / Draw 11.5% / Ghana 3.5%.**
- Intervals reflect drawNu 0.6–0.8 parameter sensitivity (England statistical band 81.0%–84.1%) plus evidence thinness.
- **This is a market-blind forecast: fully independent of any betting line, odds, or prediction-market price. Probabilities come solely from the Elo/Davidson statistical model plus a bounded evidence-based adjustment.**

## 6. Method and Sources

Method: eloratings.net Elo ratings as baseline; Davidson three-way model (drawNu=0.7) produces statistical probabilities; a bounded adjustment of at most ±8pp, justified only by dated, sourced public facts, is then applied and renormalized. No betting or prediction-market data is used.

Sources:
1. eloratings.net World.tsv (snapshot 2026-06-11) — https://www.eloratings.net/World.tsv
2. Sky Sports — England World Cup squad announcement (2026-06-01) — https://www.skysports.com/football/news/12016/13543455/england-world-cup-squad-announcement-ruthless-thomas-tuchel-leaves-big-names-out-of-26-man-squad
3. ESPN — England at the 2026 World Cup (injury news, 2026-06) — https://www.espn.com/soccer/story/_/id/48701061/england-world-cup-2026-schedule-fixtures-results-scores-group-l-how-watch-uk-news-analysis-injuries
4. olympics.com — Ghana at FIFA World Cup 2026 (Kudus/Djiku absences, 2026-06) — https://www.olympics.com/en/news/fifa-world-cup-2026-ghana-all-players-full-squad-list-key-stats-schedule
5. ghanafa.org — Black Stars squad numbers confirmed (2026-06) — https://www.ghanafa.org/black-stars-squad-numbers-confirmed-for-2026-fifa-world-cup
6. ghanafa.org — Queiroz names 2026 FIFA World Cup squad (2026-06) — https://www.ghanafa.org/carlos-queiroz-names-2026-fifa-world-cup-squad
7. englandfootball.com — fixtures & results (1-0 vs New Zealand, 2026-06-06) — https://www.englandfootball.com/england/mens-senior-team/fixtures-results
8. footballgroundguide.com — England's perfect qualifying record (2026-06) — https://footballgroundguide.com/news/when-are-england-playing-at-the-2026-world-cup-full-match-schedule-and-uk-kick-off-times-confirmed.html

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
