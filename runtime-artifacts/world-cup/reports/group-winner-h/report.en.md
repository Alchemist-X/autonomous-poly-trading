# 2026 World Cup Group H Winner Forecast

Generated: 2026-06-11T13:15:00Z | Model: pure-Elo Monte Carlo + bounded evidence adjustment | Chinese original: `report.md`

## 1. Conclusion

| Team | Model baseline (MC) | Adjusted probability | Adjustment |
| --- | --- | --- | --- |
| Spain | 86.2% | **84.2%** | -2.0pp |
| Uruguay | 13.4% | **15.1%** | +1.8pp |
| Cape Verde | 0.2% | **0.3%** | +0.1pp |
| Saudi Arabia | 0.2% | **0.3%** | +0.1pp |

(Adjusted probabilities sum to 1.)

**One-sentence view:** Spain, the world's No. 1 Elo side, is the overwhelming favorite of the model to top Group H (~84%); Uruguay is the only realistic challenger, while Saudi Arabia and Cape Verde winning the group is little more than a mathematical possibility.

## 2. Definition

"Group H winner" = first place in the official FIFA final group-stage standings. Tiebreakers in order: points -> goal difference -> goals scored -> head-to-head record among tied teams (mini-table) -> fair-play points -> drawing of lots.

Group H schedule: Spain vs Cape Verde (Jun 15, Atlanta); Uruguay vs Saudi Arabia (Jun 16); Uruguay vs Cape Verde (Jun 22); Spain vs Uruguay (Jun 27, the likely first-place decider).

## 3. Team notes (Elo / form / schedule only)

- **Spain** (Elo 2157, world No. 1): Reigning European champions and Elo leaders, with an overwhelming single-match expectancy against every group opponent. Caveats: Lamine Yamal's hamstring may affect the first one or two group games and Fermin Lopez (metatarsal fracture) misses the tournament; coach Luis de la Fuente says virtually the full squad should be available from game one. The only real variance for first place is the Jun 27 match against Uruguay.
- **Uruguay** (Elo 1892, No. 16): Clearly the second-strongest team. Bielsa named his squad on May 31 (no Luis Suarez). Winless in their last four friendlies (3 draws, 1 loss, including a 1-5 defeat to the USA in November), so form is a concern; winning the group almost certainly requires beating Spain on Jun 27.
- **Cape Verde** (Elo 1578, No. 68): First-ever World Cup appearance. Elo roughly level with Saudi Arabia, but topping the group requires finishing above both Spain and Uruguay; the model gives under 0.5%.
- **Saudi Arabia** (Elo 1576, No. 69): Third consecutive World Cup, slightly more tournament experience, but Elo far below the top two; the Jun 16 match against Uruguay essentially sets their ceiling.

## 4. Method

1. **Statistical baseline**: 100,000 full-tournament Monte Carlo simulations (seed 20260611), purely Elo-driven with no market input of any kind. Goals are independent Poissons (a 2.6-goal baseline split by the Elo logistic expectancy); group ranking uses points -> goal difference -> goals scored -> head-to-head among tied teams -> random draw; hosts get +100 Elo in group matches only (not relevant to Group H). Elo from the eloratings.net snapshot of 2026-06-11.
2. **Bounded adjustment** (max +/-4pp absolute per team, evidence required): Spain -2.0pp (Yamal hamstring may cost early group minutes, Fermin Lopez out — directly affects group-stage points); Uruguay +1.8pp (the only realistic beneficiary, capped by their own four-match winless run); Saudi Arabia / Cape Verde +0.1pp each (variance spillover in scenarios where Spain drops early points). Renormalized to sum 1.
3. This forecast is 100% independent of any betting or prediction-market data.

## Sources

1. eloratings.net Elo snapshot (2026-06-11): https://www.eloratings.net/
2. ESPN: Spain 26-man squad confirmed, Yamal injury status (2026-05-25): https://www.espn.com/soccer/story/_/id/48870392/spain-world-cup-2026-squad-confirmed-lamine-yamal-stars-no-real-madrid-players
3. ESPN: 2026 World Cup injuries tracker (continuously updated, accessed 2026-06-11): https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
4. FIFA: Bielsa names Uruguay squad (2026-05-31): https://www.fifa.com/en/articles/uruguay-world-cup-squad-2026-marcelo-bielsa
5. FIFA: Spain squad announcement (2026-05-25): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/spain-squad-announcement-luis-de-la-fuente
6. Sports Mole: Group H preview (schedule and recent form, accessed 2026-06-11): https://www.sportsmole.co.uk/football/spain/world-cup-2026/feature/world-cup-group-h-preview-predictions-key-fixture-star-players_598732.html

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
