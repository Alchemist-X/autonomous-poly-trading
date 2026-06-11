# Tunisia vs Netherlands (2026 World Cup Group F) — Market-Blind Forecast

- Match: kickoff 2026-06-25 23:00 UTC (18:00 CDT, June 25), Group F matchday 3
- Event identifier (resolution metadata only): `fifwc-tun-nld-2026-06-25`
- Generated: 2026-06-11 (14 days before kickoff)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Tunisia win | **9.0%** | 6% – 13% | Medium |
| Draw | **18.4%** | 14% – 24% | Medium |
| Netherlands win | **72.6%** | 66% – 78% | Medium |

**One-sentence view:** The Netherlands hold a 320-point Elo edge and Tunisia collapsed in their warm-ups (0-5 vs Belgium); Timber's absence matters only marginally, so the Dutch win probability sits just above 70%, with matchday-3 stakes and possible rotation the main uncertainty.

## 2. Definition

Three-way 90-minute result (win/draw/loss). Group-stage matches have no extra time or penalties; a draw stands as the final result.

## 3. Strength Profile

| Metric | Tunisia | Netherlands |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1628 | 1948 |
| Elo world rank | 58 | 8 |
| Recent state | Warm-up losses 0-1 Austria, 0-5 Belgium; new coach since early 2026 | Timber out injured; otherwise near full strength, opener vs Japan June 13 |

- Tunisia changed coach after an AFCON round-of-16 exit to Mali in early 2026; Sabri Lamouchi took over with limited preparation time (Squawka, retrieved 2026-06-11).
- Ronald Koeman's Netherlands squad is essentially intact apart from Timber, with Frenkie de Jong among the core (FIFA.com / ESPN, June 2026).

## 4. Key Factors

1. **320-point Elo gap**: Netherlands 1948 (8th) vs Tunisia 1628 (58th) — a clearly lopsided pairing (eloratings.net, 2026-06-11).
2. **Tunisia's warm-up collapse**: a 0-5 defeat to Belgium in the final friendly on June 6, after which coach Lamouchi apologised to fans and said he felt "ashamed"; they also lost 0-1 to Austria (GHANAsoccernet / Football365, 2026-06-07).
3. **Timber ruled out for the Netherlands**: groin injury; KNVB confirmed on June 8 that he misses the World Cup, with Sunderland's Geertruida called up; Koeman noted that without him there are "only seven defenders" (ESPN / FIFA.com, 2026-06-08) — a modest hit to Dutch defensive depth, with a ready replacement.
4. **Tunisia coaching transition**: Lamouchi only took charge in early 2026 and made sweeping squad changes for the May 15 list (FIFA.com, 2026-05-15).
5. **Matchday-3 stakes unknown (uncertainty driver)**: if the Netherlands qualify early after Japan (June 13) and Sweden, they may rotate; Tunisia could be eliminated or fighting for survival. Direction unknowable today — it widens intervals only.
6. **Venue**: Arrowhead Stadium, Kansas City — neutral ground, no host bonus for either side (Squawka, retrieved 2026-06-11).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, no host bonus — neither side is a host nation):
  Tunisia 11.0% / Draw 19.4% / Netherlands 69.6%
- **Evidence-based delta** (cap ±8pp total; 6pp used):
  - Tunisia −2.0pp, Draw −1.0pp, Netherlands +3.0pp
  - Rationale: Tunisia's two warm-up defeats (incl. 0-5) plus a coaching transition are a strong negative signal; Timber's absence is a small offsetting factor for the Dutch.
- **p_final**: Tunisia 9.0% / Draw 18.4% / Netherlands 72.6%
- Intervals reflect drawNu 0.6–0.8 sensitivity (Dutch win ~67.7%–71.6% on the stat leg), thin evidence, and unknown matchday-3 rotation/stakes.
- **This is a market-blind forecast**: fully independent of any odds, bookmaker, or prediction-market price; probabilities come solely from the Elo statistical model plus a bounded, sourced adjustment.

## 6. Method and Sources

Method: same-day Elo ratings from eloratings.net feed a Davidson three-way model for baseline probabilities; a bounded adjustment of at most ±8pp, justified only by dated, sourced public facts, is applied and renormalised; 80% intervals combine parameter sensitivity and evidence thinness.

Sources:
1. eloratings.net World.tsv (fetched 2026-06-11) — https://www.eloratings.net/World.tsv
2. ESPN: Timber to miss the World Cup (2026-06-08) — https://www.espn.com/soccer/story/_/id/49001511/netherlands-arsenal-defender-jurrien-timber-miss-world-cup-injury
3. FIFA.com: Netherlands call up Geertruida (2026-06-08) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber
4. GHANAsoccernet: Lamouchi "ashamed" after 0-5 Belgium defeat (2026-06-07) — https://ghanasoccernet.com/tunisia-coach-lamouchi-ashamed-after-heavy-pre-world-cup-friendly-defeat-to-belgium
5. Football365: World Cup warm-up fixtures and results (June 2026) — https://www.football365.com/news/world-cup-2026-warm-up-friendly-fixtures-results-kick-off-times-what-tv-channel
6. Squawka: Tunisia World Cup 2026 analysis (retrieved 2026-06-11) — https://www.squawka.com/en/news/world-cup/tunisia-world-cup-2026-fixtures-squad-analysis/
7. FIFA.com: Lamouchi names Tunisia squad (2026-05-15) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/tunisia-squad-named-sabri-lamouchi
8. ESPN: 2026 World Cup injuries tracker (retrieved 2026-06-11) — https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
