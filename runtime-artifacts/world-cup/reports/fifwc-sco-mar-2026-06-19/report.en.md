# Scotland vs Morocco — 2026 World Cup Group C (Market-Blind Forecast)

- **Match**: Scotland vs Morocco, Group C, matchday 2
- **Kickoff**: 2026-06-19 22:00 UTC (Foxborough, Gillette Stadium, Boston area, USA)
- **Event identifier** (resolution metadata only): `fifwc-sco-mar-2026-06-19`
- **Generated**: 2026-06-11T13:15:00Z

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Scotland win | **31%** | 26% – 36% | Medium |
| Draw | **26%** | 21% – 31% | Medium |
| Morocco win | **43%** | 37% – 49% | Medium |

**One-line view**: Morocco hold a clear but not overwhelming edge (~43%) on Elo, tournament pedigree and the form of their core, while a fully assembled Scotland are no pushovers (~31%) and the draw is live (26%) — an evenly poised match that will likely shape second place in Group C.

## 2. Definition

Three-way result over 90 minutes plus stoppage time; no extra time or penalties in the group stage — a regulation-time tie settles as "Draw".

## 3. Strength Profile

| Team | Elo (eloratings.net, fetched 2026-06-11) | Elo rank | Recent state |
| --- | --- | --- | --- |
| Scotland | 1782 | 26 | First World Cup finals in 28 years (UEFA.com); 4-1 friendly win vs Curacao on May 30 (Sky Sports) |
| Morocco | 1827 | 24 | Reached the AFCON final as hosts in Dec 2025 (Olympics.com); Hakimi is Africa's reigning best player and a 2025 Champions League winner |

## 4. Key Factors

1. **45-point Elo gap, neutral venue**: Morocco 1827 vs Scotland 1782 gives Morocco a clear but moderate statistical edge. (Source: eloratings.net, 2026-06-11)
2. **Scotland's midfield anchor Gilmour injured**: Billy Gilmour went off injured in the May 30 friendly vs Curacao; squad numbers suggest Tyler Fletcher replaces him at No 8 — a hit to midfield control. (Source: Sky Sports, June 2026)
3. **Scotland's core intact**: McTominay, Robertson and McGinn all selected and available; Hanley included despite a knock. (Source: ESPN, June 2026)
4. **Morocco missing first-choice striker + new-coach risk**: En-Nesyri left out of the 26-man squad; Mohamed Ouahbi takes charge at his first senior World Cup, adding uncertainty. (Sources: ESPN / FourFourTwo, June 2026)
5. **Schedule and stakes**: Morocco open vs Brazil on June 13, Scotland vs Haiti on June 14; this June 19 match in Foxborough likely shapes who finishes second. (Sources: MLSSoccer.com / Wikipedia, June 2026)
6. **Hakimi fit but short on rest**: the captain made the squad despite a recent injury concern, coming off a long club season including the Champions League final. (Source: Olympics.com, June 2026)

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Scotland 32.3% / Draw 25.8% / Morocco 41.9%
- **Evidence delta** (cap ±8pp, ~±1.3pp actually used):
  - Scotland −1.3pp: Gilmour's injury weakens the midfield (Factor 2);
  - Morocco +1.1pp: form and big-tournament pedigree of Hakimi/Diaz (Factors 1, 6); En-Nesyri's absence and the new-coach risk (Factor 4) capped any larger upgrade;
  - Draw +0.2pp: evenly matched sides with aligned stakes.
- **p_final**: Scotland 31% / Draw 26% / Morocco 43%.
- The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8 moves the baseline draw between 22.9% and 28.4%) plus evidence thinness (no confirmed lineups, untested coach).
- **This is a market-blind forecast**: fully independent of any odds, bookmaker or prediction-market prices; probabilities come solely from the Elo/Davidson statistical model plus a bounded evidence adjustment.

## 6. Method and Sources

**Method**: World Elo from eloratings.net feeds a Davidson three-way model (identical to `eloToOneXTwo` in the repo's `packages/sports-model/src/elo.ts`, scale=400, drawNu=0.7) for the statistical baseline; citable injury/form/schedule facts from public news justify an adjustment bounded at ±8pp, then renormalized; 80% intervals combine parameter sensitivity and evidence thinness.

**Sources** (all accessed 2026-06-11):
1. eloratings.net — World Elo table (fetched 2026-06-11, https://www.eloratings.net/World.tsv)
2. ESPN — Scotland World Cup squad announced: https://www.espn.com/soccer/story/_/id/48814281/scotland-world-cup-squad-announced-scott-mctominay-ross-stewart
3. Sky Sports — Scotland squad numbers revealed (incl. Gilmour injury): https://www.skysports.com/football/news/12017/13550179/world-cup-2026-scotland-squad-numbers-revealed-with-angus-gunn-handed-no-1-jersey-ahead-of-craig-gordon
4. ESPN — Morocco squad: Hakimi, Brahim Diaz headline; En-Nesyri out: https://www.espn.com/espn/story/_/id/48883710/achraf-hakimi-brahim-diaz-headline-morocco-squad-fifa-world-cup-youssef-en-nesyri-out
5. Olympics.com — Morocco WC 2026 preview: https://www.olympics.com/en/news/fifa-world-cup-2026-morocco-all-players-full-squad-list-key-stats-schedule
6. FourFourTwo — Morocco squad: Ouahbi's 26-man roster: https://www.fourfourtwo.com/team/morocco-world-cup-2026-squad
7. MLSSoccer.com — Group C preview: https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-c-preview-brazil-haiti-morocco-scotland ; UEFA.com — Scotland at the World Cup 2026: https://www.uefa.com/european-qualifiers/news/02a6-20d159741fe9-a2a8fac9839d-1000--scotland-at-the-world-cup-2026-squad-fixtures-group-and-hi/

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
