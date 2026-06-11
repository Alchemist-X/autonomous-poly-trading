# Mexico vs Korea Republic — 2026 World Cup Group A (Market-Blind Forecast)

- **Match**: 2026-06-18 (kickoff 2026-06-19 01:00 UTC), Estadio Akron, Guadalajara
- **Generated**: 2026-06-11T13:15Z | **Nature**: market-blind (no odds/market prices consulted)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Mexico win | **62.0%** | 55% – 69% | Medium |
| Draw | **22.5%** | 18% – 27% | Medium |
| Korea Republic win | **15.5%** | 11% – 21% | Medium |

**One-line view**: Playing at home with a 117-point Elo edge and an in-form attack, Mexico are favored at roughly 62%; Korea carry injury and form doubts and lean heavily on Son Heung-min.

## 2. Definition

Three-way 90-minute result (win/draw/loss); no extra time in the group stage; official result governs.

## 3. Strength Profile

| Team | Elo (2026-06-11) | Elo rank | Notes |
| --- | --- | --- | --- |
| Mexico | 1875 (+100 host bonus, group stage) | 18 | Coach Javier Aguirre; playing at home in Guadalajara |
| Korea Republic | 1758 | 33 | Coach Hong Myung-bo; Son Heung-min's 4th World Cup |

Source: eloratings.net (repo snapshot `elo-table.json`, fetched 2026-06-11).

## 4. Key Factors

1. **Host-nation home advantage**: the match is at Estadio Akron, Guadalajara (~48,000 capacity); Mexico play all group matches on home soil (Goal.com venue guide, 2026-06; FIFA match centre).
2. **Mexico's attack is in form**: Raul Jimenez, 35, scored 9 league goals for Fulham in 2025-26 and has 44 international goals, second all-time for Mexico; he is the tactical focal point (World Soccer Talk preview, 2026-06).
3. **Korea injury and form concerns**: media note injuries, tactical concerns and lack of form among Korea's core; midfielder Hwang In-beom (Feyenoord) was called up while carrying an ankle injury (ESPN squad report, 2026-05-16; Daily Cal Group A preview, 2026-06).
4. **Korea still have elite players**: Son Heung-min (33, LAFC) is in sparkling form and Kim Min-jae (Bayern) is a top centre-back, giving Korea genuine upset potential (Olympics.com / Goal.com squad reports, 2026-05/06).
5. **Matchday 1 results unknown**: at generation time (June 11) neither side had completed their opener, so first-round form could not be incorporated — a main source of uncertainty.

## 5. Model and Adjustment

- **p_stat** (three-way Davidson model, scale=400, drawNu=0.7; +100 host bonus for Mexico in group play):
  Mexico 60.2% / Draw 22.6% / Korea 17.3%
- **Evidence adjustment** (capped at ±8pp; 4pp used): Mexico +2pp, Korea −2pp. Rationale: multi-source reports of Korean injury/form concerns versus a clean, in-form Mexican squad; all pre-tournament qualitative evidence with no matchday data, hence a small shift only.
- **p_final**: Mexico **62.0%** / Draw **22.5%** / Korea **15.5%**
- **This forecast is market-blind**: fully independent of any betting odds, lines, or prediction-market prices; it is built solely from the statistical model plus public news evidence.

## 6. Method

Elo from an eloratings.net snapshot; three-way probabilities via the Davidson model (pA=piA/D, pDraw=0.7*sqrt(piA*piB)/D, piX=10^(R/400)); +100 host bonus in group play. The 80% intervals reflect parameter sensitivity (with drawNu 0.6–0.8 and host bonus ±35, Mexico's win probability spans 54.8%–65.6%) plus evidence thinness. Evidence adjustment is capped at ±8pp with renormalization.

**Sources**:
1. eloratings.net (World.tsv snapshot, 2026-06-11)
2. FIFA match centre: fifa.com/en/match-centre/match/17/285023/289273/400021442
3. ESPN Korea squad (incl. Hwang In-beom injury): espn.com/soccer/story/_/id/48788433 (2026-05-16)
4. Daily Cal Group A preview: dailycal.org/sports/world-cup/south-korea-mexico-highlight-2026-world-cup-group-a (2026-06)
5. World Soccer Talk Mexico preview: worldsoccertalk.com/world-cup/mexico-2026-world-cup-preview (2026-06)
6. Goal.com venue/ticket guide: goal.com/en/news/mexico-vs-south-korea-world-cup-tickets (2026-06)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
