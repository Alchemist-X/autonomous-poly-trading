# Cote d'Ivoire vs Ecuador — 2026 World Cup Group E (Market-Blind Forecast)

- **Match**: 2026 FIFA World Cup, Group E, Matchday 1
- **Kickoff**: 2026-06-14 23:00 UTC (Lincoln Financial Field, Philadelphia; 19:00 ET)
- **Generated**: 2026-06-11T13:15:00Z | resolution slug (metadata only): `fifwc-civ-ecu-2026-06-14`

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Cote d'Ivoire win | **16.5%** | 12% – 21% | Medium |
| Draw | **24.5%** | 19% – 30% | Medium |
| Ecuador win | **59.0%** | 52% – 66% | Medium |

**One-line view**: A 243-point Elo gap makes Ecuador the clear favourite on merit, but Cote d'Ivoire arrive in hot form (2-1 over France on June 4) and an opener between two defence-first sides skews tighter than the pure model suggests, lifting the draw.

## 2. Definition

Three-way result over 90 minutes (plus stoppage time); no extra time or penalties in the group stage. Neutral venue (Philadelphia, USA); no host bonus for either side.

## 3. Team Profiles

| Dimension | Cote d'Ivoire | Ecuador |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1695 (rank 49) | 1938 (rank 9) |
| Qualifying | Qualified from CAF | 2nd in CONMEBOL behind only Argentina; 5 goals conceded in 18 games (fewest) |
| Recent friendlies | 2-1 vs France (Jun 4), 1-0 vs Scotland, 4-0 vs South Korea | 3-0 vs Guatemala (Jun 7), 2-1 vs Saudi Arabia (May) |
| Key players | Amad Diallo, Kessie, Haller (fitness to monitor) | Moises Caicedo, Enner Valencia |

Sources: eloratings.net (2026-06-11); Opta Analyst (2026-06); Goal.com match preview (2026-06).

## 4. Key Factors

1. **Ecuador's elite defence**: only 5 goals conceded across 18 CONMEBOL qualifiers, the fewest in the confederation; Opta flags them as a potential surprise package. Compresses goal-margin variance and lifts the draw. ([Opta Analyst](https://theanalyst.com/articles/ecuador-defensive-steel-world-cup-2026-surprise-package), 2026-06)
2. **Cote d'Ivoire in hot form**: 2-1 friendly win over France on June 4, after 4-0 vs South Korea and 1-0 vs Scotland; mostly already reflected in the 2026-06-11 Elo snapshot, so only a small uplift is applied. ([Goal.com preview](https://www.goal.com/en-us/news/ivory-coast-ecuador-world-cup-preview/bltb6fef7b1a695267a), 2026-06)
3. **No major Ecuador absences**: Beccacece named the 26-man squad on June 1; only backup striker Leonardo Campana missed out injured. Caicedo's rest in the June 7 friendly was precautionary. ([fifaworldcupnews.com](https://www.fifaworldcupnews.com/ecuador-world-cup-2026-squad-official/), 2026-06-01; [Bolavip](https://bolavip.com/en/soccer/why-is-moises-caicedo-not-starting-today-for-ecuador-vs-guatemala-in-international-friendly-before-2026-world-cup), 2026-06-07)
4. **Cote d'Ivoire squad largely intact**: squad named May 15; only Clement Akpa withdrew injured (replaced by Operi on May 29); Haller made the squad after an injury-hit season. ([FIFA.com](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cote-divoire-squad-announcement-emerse-fae), 2026-05-15)
5. **Opener profile**: both teams are defensively disciplined and neither can afford an early defeat; mainstream previews expect a tight, low-scoring game. ([Goal.com preview](https://www.goal.com/en-us/news/ivory-coast-ecuador-world-cup-preview/bltb6fef7b1a695267a), 2026-06)

## 5. Model and Adjustment

- **p_stat (three-way Davidson, scale=400, drawNu=0.7, neutral venue, no host bonus)**: Cote d'Ivoire 15.5% / Draw 21.8% / Ecuador 62.7%.
- **Evidence-based adjustment (total |delta| ~7.4pp, within the 8pp cap)**:
  - Draw +2.7pp: low-scoring opener expectation between two defence-first sides (factors 1, 5);
  - Cote d'Ivoire +1.0pp: momentum slightly above what Elo rank 49 implies (factor 2; kept small as Elo already includes the friendlies);
  - Ecuador -3.7pp: the offset of the above; their clean injury sheet (factor 3) prevents a larger cut.
- **p_final**: 16.5% / 24.5% / 59.0%.
- This is a **market-blind** forecast: fully independent of any betting or prediction-market information; derived solely from the statistical model plus cited-evidence adjustment.

## 6. Method and Sources

Method: eloratings.net snapshot (2026-06-11) fed into the Davidson three-way model (identical to repo `packages/sports-model/src/elo.ts`, scale=400, drawNu=0.7) to obtain p_stat; then a bounded (<= +/-8pp) adjustment justified by cited facts, renormalized. The 80% intervals reflect drawNu 0.6-0.8 sensitivity (A 15.0-16.0%, Draw 19.3-24.2%, B 60.8-64.7%), +/-25 Elo-point sensitivity, and the thinness of pre-tournament evidence.

Sources:

1. eloratings.net World.tsv snapshot (2026-06-11)
2. [FIFA.com Cote d'Ivoire squad announcement](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cote-divoire-squad-announcement-emerse-fae) (2026-05-15)
3. [Goal.com match preview](https://www.goal.com/en-us/news/ivory-coast-ecuador-world-cup-preview/bltb6fef7b1a695267a) (2026-06)
4. [Opta Analyst: Ecuador's defensive steel](https://theanalyst.com/articles/ecuador-defensive-steel-world-cup-2026-surprise-package) (2026-06)
5. [fifaworldcupnews.com Ecuador squad](https://www.fifaworldcupnews.com/ecuador-world-cup-2026-squad-official/) (2026-06-01)
6. [Bolavip: Caicedo rested explanation](https://bolavip.com/en/soccer/why-is-moises-caicedo-not-starting-today-for-ecuador-vs-guatemala-in-international-friendly-before-2026-world-cup) (2026-06-07)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
