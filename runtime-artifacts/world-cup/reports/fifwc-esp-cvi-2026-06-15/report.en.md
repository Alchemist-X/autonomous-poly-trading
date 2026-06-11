# Spain vs Cabo Verde — 2026 World Cup Group H (Market-Blind Forecast)

- **Match**: 2026-06-15 16:00 UTC (Mercedes-Benz Stadium, Atlanta; 12:00 local)
- **Event identifier** (resolution metadata only): `fifwc-esp-cvi-2026-06-15`
- **Generated**: 2026-06-11T13:15:00Z

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Spain win | **82.5%** | 78% – 87% | High |
| Draw | **14.0%** | 10% – 18% | High |
| Cabo Verde win | **3.5%** | 2% – 6% | High |

**One-line view**: World-Elo-No.1 Spain face a Cabo Verde side at their first-ever World Cup with almost no top-five-league players — the gap is enormous; winger fitness doubts and two recent warm-up draws nudge the draw probability slightly above the pure model value, but a Spain win remains the overwhelmingly dominant scenario.

## 2. Definition

Forecast target is the 90-minute three-way result (win/draw/loss). Group-stage matches have no extra time or penalties; the regulation-time score settles the outcome.

## 3. Strength profile

| Metric | Spain | Cabo Verde |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 2157 (No. 1) | 1578 (No. 68) |
| World Cup pedigree | 2010 champions, Euro 2024-winning core | First-ever appearance |
| Squad base | Regulars across Europe's elite clubs (no Real Madrid players this cycle) | Only 1 top-five-league player (Logan Costa, Villarreal) |
| Recent warm-ups | Draws vs Egypt and Iraq, then 3-1 win over Peru on June 8 | Preparing after a historic African qualifying campaign |

## 4. Key factors

1. **579-point Elo gap**: 2157 vs 1578; the Davidson three-way model yields roughly an 86% statistical win probability for Spain (source: eloratings.net World.tsv, fetched 2026-06-11).
2. **Spain winger fitness**: Lamine Yamal and Nico Williams skipped the June 8 Peru friendly to recover at base camp; coach De la Fuente said the three injured players (incl. Merino) should be available on June 15 but may be on minute restrictions (source: ESPN, 2026-06-09/10).
3. **Fermín López out of the World Cup**: fractured metatarsal in his right foot requiring surgery (source: ESPN/UPI injury roundup, 2026-06-10).
4. **Spain's warm-up trajectory**: goalless-style draws against Egypt (Elo 1696) and Iraq (Elo 1607) — opponents in Cabo Verde's strength band (1578) — suggest breaking down a deep block is not automatic; Spain then beat Peru 3-1 (source: Al Jazeera, 2026-06-09).
5. **Cabo Verde's limited depth**: the 26-man squad announced on May 19 is built around 36-year-old Ryan Mendes and Casa Pia striker Dailon Livramento, with just one player in Europe's top five leagues (sources: beIN Sports, 2026-05-19; FourFourTwo).
6. **Venue and weather**: Mercedes-Benz Stadium has a retractable roof, so climate effects are negligible; neutral venue, no host bonus applies (source: olympics.com schedule page, 2026-05).

## 5. Model and adjustment

- **p_stat** (Davidson three-way, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Spain **85.6%** / Draw **11.3%** / Cabo Verde **3.1%**
- **Adjustment (total 3.1pp, cap ±8pp)**:
  - Spain −3.1pp: possible minute restrictions on Yamal/Williams + Fermín's absence + the "blunt vs deep blocks" signal from two draws against similarly rated opponents;
  - Draw +2.7pp, Cabo Verde +0.4pp: Cabo Verde will very likely sit deep, raising stalemate risk slightly above the model baseline; but their squad depth is too thin to justify more than a marginal upset bump.
- **p_final**: Spain **82.5%** / Draw **14.0%** / Cabo Verde **3.5%** (normalized).
- **80% intervals**: drawNu sensitivity over 0.6–0.8 (Spain win 84.3%–87.0%, draw 9.9%–12.7%) plus uncertainty over injury outcomes and evidence thinness.
- **Market-blind**: this forecast is fully independent of any betting or prediction-market prices; probabilities come only from the Elo/statistical model plus a bounded, evidence-based adjustment.

## 6. Method

Daily Elo from eloratings.net feeds a Davidson three-way extension (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts: piA=10^(Ra/400), pDraw=0.7*sqrt(piA*piB)/denom) to produce the statistical baseline; recent public news (official/major outlets, never odds pages) drives a bounded adjustment of at most ±8pp, then probabilities are renormalized. Intervals reflect parameter sensitivity and evidence thinness.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11) — Elo ratings and ranks
2. ESPN: Yamal/Nico Williams left out of final warm-up to recover (2026-06-09) — https://www.espn.com/soccer/story/_/id/48993924/lamine-yamal-nico-williams-left-spain-last-world-cup-warmup
3. ESPN: Spain 26-man squad confirmed, no Real Madrid players (2026-06) — https://www.espn.com/soccer/story/_/id/48870392/spain-world-cup-2026-squad-confirmed-lamine-yamal-stars-no-real-madrid-players
4. ESPN/UPI: World Cup injury roundup, Fermín López out with metatarsal fracture (2026-06-10) — https://www.upi.com/Sports_News/Soccer/2026/06/10/World-Cup-injuries-Spain-Argentina-Iceland/4671780927848/
5. Al Jazeera: Spain 3-1 Peru, after draws vs Egypt and Iraq (2026-06-09) — https://www.aljazeera.com/sports/2026/6/9/spain-cruise-past-peru-in-final-world-cup-2026-warm-up-match
6. beIN Sports: Bubista names Cabo Verde's 26-man squad (2026-05-19) — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/bubista-s-official-cabo-verde-squad-for-the-2026-fifa-world-cup-2026-05-19
7. olympics.com / FourFourTwo: Cabo Verde's first appearance, squad makeup, schedule and venue (2026-05) — https://www.olympics.com/en/news/fifa-world-cup-2026-cabo-verde-all-players-full-squad-list-key-stats-schedule

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
