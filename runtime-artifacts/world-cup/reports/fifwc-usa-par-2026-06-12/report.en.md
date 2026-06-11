# 2026 World Cup Group D: United States vs Paraguay (Market-Blind Forecast)

- **Match**: United States vs Paraguay, Group D opener
- **Kickoff**: 2026-06-13 01:00 UTC (evening of June 12 local, SoFi Stadium, Inglewood, CA)
- **Event slug (resolution metadata only)**: `fifwc-usa-par-2026-06-12`
- **Generated**: 2026-06-11T13:15:00Z

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| United States win | **37.7%** | 32% – 43% | Medium |
| Draw | **25.9%** | 22% – 30% | Medium |
| Paraguay win | **36.4%** | 31% – 42% | Medium |

**One-line view**: An extremely even opener — Paraguay carry the higher Elo but their creative star Enciso is an injury doubt, while the USA enjoy true host-nation home advantage; the win probabilities are near a coin flip and the draw risk is substantial.

## 2. Definition

Three-way 90-minute result (win/draw/loss). Group-stage matches have no extra time or penalties; the regulation-time score settles the outcome.

## 3. Team Strength Profile

| Metric | United States | Paraguay |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1726 (rank 39) | 1834 (rank 22) |
| Head coach | Mauricio Pochettino | Gustavo Alfaro |
| Recent state | Starting CB Richards an injury doubt; Freese established as No. 1 GK (NBC Sports, 2026-06-10) | 4-0 friendly win over Nicaragua on June 5 (ESPN, 2026-06-05) |
| Context | Co-host; plays all group matches at home | Back at a World Cup after a long absence; 26-man squad named June 1 (FIFA.com, 2026-06-01) |

Paraguay are 108 Elo points stronger on paper, but the USA receive the model's +100 host adjustment for group matches, leaving the adjusted ratings almost dead even.

## 4. Key Factors

1. **Julio Enciso doubtful**: Paraguay's primary creative outlet was stretchered off in the June 5 friendly; an MRI ruled out a structural muscle tear, but he remains highly doubtful for the opener (SI, 2026-06-10; beIN Sports, 2026-06-06).
2. **USA starting CB Chris Richards unlikely to start**: tore two ankle ligaments on May 17 and only resumed full training June 8; Robinson / McKenzie / Freeman compete to replace him (NBC Sports / Sports Mole, 2026-06-10).
3. **Host advantage**: the match is at SoFi Stadium in California, a genuine home crowd for the USA — the real-world basis for the model's +100 host bonus (ESPN, 2026-06-10).
4. **Paraguay otherwise fully fit**: aside from Enciso, Alfaro has no reported injuries (Rotowire preview, 2026-06-10).
5. **Paraguay form**: the 4-0 win over Nicaragua showed attacking sharpness, though the weak opposition discounts its value (ESPN, 2026-06-05).
6. **USA core available**: Pulisic and Adams are nailed-on starters and Tillman is in strong form (NBC Sports, 2026-06-10).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7; USA host bonus +100 for group matches → effective 1826 vs 1834):
  USA 36.2% / Draw 25.9% / Paraguay 37.9%
- **Adjustment (capped at ±8pp; net 3pp moved here)**: losing Enciso (Paraguay's single main creator) hurts slightly more than losing Richards (where the USA have several CB alternatives); the two injuries largely offset, so only +1.5pp to the USA and -1.5pp from Paraguay, draw unchanged.
- **p_final**: USA 37.7% / Draw 25.9% / Paraguay 36.4%
- **Market-blind**: this forecast is fully independent of any betting or prediction-market prices; probabilities come solely from the Elo statistical model plus the bounded, evidence-cited adjustment above.

## 6. Method

World Elo ratings from eloratings.net feed a Davidson three-way model (draw parameter ν=0.7) with a +100 host bonus for host-nation group matches, followed by a bounded (±8pp max) adjustment justified only by dated, sourced public facts. The 80% intervals reflect parameter sensitivity (ν in 0.6–0.8 and host bonus ±35 move the USA win probability roughly 32.5%–39.9%) plus evidence thinness.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11)
2. NBC Sports — USMNT lineup versus Paraguay (2026-06-10): https://www.nbcsports.com/soccer/news/usmnt-lineup-versus-paraguay-who-will-pochettino-choose-for-usa-in-world-cup-opener
3. Sports Mole — Predicted USA lineup vs Paraguay (2026-06-10): https://www.sportsmole.co.uk/football/usa/world-cup-2026/predicted-lineups/pochettinos-defensive-dilemma-for-us-opener-predicted-usa-lineup-vs-paraguay_598933.html
4. SI — USMNT's First World Cup Opponent Suffers Injury Blow (2026-06-10): https://www.si.com/soccer/usmnt-first-world-cup-opponent-injury-blow-star-player
5. beIN Sports — Paraguay's Julio Enciso injured ahead of World Cup (2026-06-06): https://www.beinsports.com/en-au/football/fifa-world-cup-2026/articles/paraguay-s-julio-enciso-injured-ahead-of-world-cup-2026-06-06
6. ESPN — Paraguay 4-0 Nicaragua (2026-06-05): https://www.espn.com/soccer/match/_/gameId/401871132/nicaragua-paraguay
7. FIFA.com — Paraguay squad announcement (2026-06-01): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/paraguay-squad-announcement-gustavo-alfaro
8. ESPN — USA at the 2026 World Cup schedule/news (2026-06-10): https://www.espn.com/soccer/story/_/id/48940468/usa-world-cup-2026-schedule-fixtures-results-scores-group-d-how-watch-news-analysis-injuries

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
