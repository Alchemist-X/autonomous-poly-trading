# Uruguay vs Cabo Verde (2026 World Cup, Group H) — Market-Blind Forecast

- **Match**: 2026 FIFA World Cup group stage, Group H, Match 37
- **Kickoff**: 2026-06-21T22:00:00Z (June 21, 18:00 local, Miami)
- **Venue**: Hard Rock Stadium, Miami Gardens, USA — neutral venue, no host bonus for either side
- **Generated**: 2026-06-11 (market-blind: this forecast is fully independent of any betting/prediction-market data)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Uruguay win | **68%** | 62% – 74% | Medium |
| Draw | **20%** | 16% – 24% | Medium |
| Cabo Verde win | **12%** | 8% – 17% | Medium |

**One-line view**: Uruguay dominate on strength, experience and squad depth (~68% to win in 90 minutes), but Cabo Verde are a well-organized World Cup debutant — draw plus upset together still carry roughly a one-third probability, so this is no foregone conclusion.

## 2. Definition

Three-way result (win/draw/loss) over 90 minutes of regulation. World Cup group matches have no extra time or penalties; the score at full time settles the outcome.

## 3. Strength Profile

| Metric | Uruguay | Cabo Verde |
| --- | --- | --- |
| Elo rating | 1892 (rank 16) | 1578 (rank 68) |
| Elo gap | +314 | — |
| Pedigree | Two-time World Cup champions, regulars | First-ever World Cup appearance |
| Key players | Valverde (Real Madrid), Araujo (Barcelona), Ugarte (Man Utd) | Core drawn from second-tier European leagues |

Elo source: eloratings.net (fetched 2026-06-11, repo `elo-table.json`).

## 4. Key Factors

1. **314-point Elo gap**: the statistical model gives Uruguay a ~69% baseline win probability (eloratings.net, 2026-06-11).
2. **Uruguay near full strength**: Bielsa named a 26-man squad headlined by Valverde, Araujo and Ugarte; Suarez omitted (SI / Republic World, 2026-05-31).
3. **Bentancur fitness doubt**: the Tottenham midfielder has been out since January with a serious hamstring injury and faces a race against time (FourFourTwo / Fantasy Football Scout, 2026-06-09).
4. **Cabo Verde are debutants**: coach Bubista announced the nation's first-ever World Cup squad — no tournament experience, but high morale (FIFA.com, ~2026-06-06).
5. **Venue and climate**: Miami in June is hot and humid; the Hard Rock Stadium canopy shades the stands but leaves the pitch open. Cabo Verde's players cope well with heat, so climate gives Uruguay no extra edge (miamiandbeaches.com event page, accessed 2026-06).
6. **Schedule context**: this is matchday 2 for both — Cabo Verde open against Spain (Jun 15), Uruguay against Saudi Arabia (Jun 16); the game carries medium-to-high stakes for both sides (FOX Sports schedule page, accessed 2026-06).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Uruguay 69.1% / Draw 19.6% / Cabo Verde 11.3%
- **Adjustment delta (total ~1.1pp, well within the +/-8pp cap)**:
  - Uruguay -1.1pp: Bentancur fitness uncertainty (cited); Cabo Verde's defensive organization and nothing-to-lose debutant profile; Miami heat does not amplify the strength gap.
  - Draw +0.4pp, Cabo Verde +0.7pp.
  - Evidence is thin overall (no detailed Cabo Verde injury news), hence only a small shift.
- **p_final (renormalized)**: Uruguay 68% / Draw 20% / Cabo Verde 12%
- **Market-blind statement**: no betting or prediction-market prices or odds were used; probabilities come solely from the Elo statistical model plus a small, evidence-cited adjustment.

## 6. Method, Sources, Disclaimer

**Method**: Elo ratings from eloratings.net feed a Davidson three-way model (pA = piA/(piA + piB + 0.7*sqrt(piA*piB)), piX = 10^(R/400)); a bounded adjustment of at most +/-8pp, justified only by dated, sourced facts, is then applied and renormalized. The 80% intervals reflect drawNu sensitivity over 0.6–0.8 (win probability 67.2%–71.1%) plus evidence thinness.

**Sources**:
1. eloratings.net World.tsv (fetched 2026-06-11)
2. https://www.si.com/soccer/uruguay-2026-world-cup-roster-confirmed-full-list-players (2026-05-31)
3. https://www.republicworld.com/sports/football/fede-valverde-darwin-nunez-named-as-uruguay-announce-fifa-world-cup-2026-squad-luis-suarez-omitted-2026-05-31-126392 (2026-05-31)
4. https://www.fantasyfootballscout.co.uk/2026/06/09/fantasy-fifa-world-cup-2026-team-previews-uruguay (2026-06-09)
5. https://www.fifa.com/en/tournaments/mens/worldcup/articles/cabo-verde-squad-announcement-world-cup-bubista (~2026-06-06)
6. https://www.miamiandbeaches.com/event/fifa-world-cup-26-uruguay-vs-cabo-verde/30447 (accessed 2026-06)
7. https://www.foxsports.com/stories/soccer/cape-verde-world-cup-2026-schedule-locations-dates-times (accessed 2026-06)

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
