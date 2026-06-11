# Argentina vs Austria — Market-Blind Probability Forecast (2026 World Cup, Group J)

- **Match**: 2026-06-22 17:00 UTC, AT&T Stadium (Dallas-Arlington, USA; retractable roof)
- **Event identifier** (resolution metadata only): `fifwc-arg-aut-2026-06-22`
- **Generated**: 2026-06-11 (market-blind: this forecast is fully independent of any betting odds or prediction-market prices)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Argentina win | **64.5%** | 58% – 71% | Medium |
| Draw | **21.5%** | 16% – 27% | Medium |
| Austria win | **14.0%** | 9% – 19% | Medium |

**One-line view**: A near-300-point Elo gap makes the defending champions clear favourites; Messi's fitness management and Austria's stability under Rangnick justify only a small shift toward draw/Austria.

## 2. Outcome definition

Three-way result after 90 minutes plus stoppage time (no extra time in the group stage; a draw stands as the final result).

## 3. Strength profile

| Dimension | Argentina | Austria |
| --- | --- | --- |
| Elo (repo elo-table.json snapshot from eloratings.net, 2026-06-11) | 2115 | 1830 |
| Pedigree | 2022 World Cup champions; 17 of the 26-man squad were title winners | First World Cup since 1998 (8th appearance) |
| Coach/system | Scaloni, settled system for 4+ years | Rangnick, mature high-pressing system |
| Fitness flags | Messi hamstring "muscular overload" (late May), back in training; E. Martínez finger fracture but confirmed in squad | Alaba back from knee injury as captain; Arnautović (37) injury-hit season but 7 goal involvements in last 8 league games |

## 4. Key factors

1. **Messi's fitness**: left-hamstring muscular overload on May 24 vs Philadelphia; Scaloni confirmed in late May he is back training, will get friendly minutes and will captain the side (Al Jazeera, 2026-05-29; CBS Sports, late May 2026). Age 38 plus hamstring history is a genuine uncertainty.
2. **Argentina's other injuries cleared**: E. Martínez (finger fracture in the Europa League final) still selected; Cuti Romero (knee ligament) and J. Álvarez (ankle) recovered (Yahoo/NBC reports, early June 2026).
3. **Austria settled**: Rangnick named his 26-man squad on May 18; Alaba recovered for his first World Cup (FIFA.com, 2026-05-18; UEFA.com).
4. **Equal scheduling**: Argentina open June 16 vs Algeria, Austria June 17 vs Jordan; similar rest before they meet (MLSSoccer/official schedule, June 2026).
5. **Neutral venue conditions**: AT&T Stadium is climate-controlled indoors, blunting Texas June heat symmetrically for both sides (attstadium.com schedule page).
6. **Experience gap**: Austria's first World Cup finals in 28 years versus the defending champions' tournament know-how (Olympics.com, June 2026).

## 5. Model and adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Argentina 66.6% / Draw 20.5% / Austria 12.9%
- **Adjustment delta (2pp total, cap ±8pp)**: Argentina −2pp, Draw +1pp, Austria +1pp.
  Rationale: Argentina's core (Messi, E. Martínez) carries minor fitness flags and a real age risk for Messi; Austria is settled with key players fit. All Argentine injuries are cleared and squad depth is elite, so only a small shift is justified.
- **p_final**: Argentina 64.5% / Draw 21.5% / Austria 14.0%
- **Market-blind statement**: no betting odds or prediction-market prices were consulted or referenced; probabilities come solely from the Elo/Davidson statistical model plus the bounded, evidence-based adjustment above.

## 6. Method, sources, and disclaimer

**Method**: Elo snapshot (eloratings.net lineage) feeds a Davidson three-way model (drawNu=0.7) for the statistical baseline; a bounded adjustment of at most ±8pp, justified only by dated, sourced facts, is then applied and renormalized. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (win baseline ranges 64.7%–68.6%) and the thinness of evidence 11 days before kickoff.

**Sources**:
1. Repo `runtime-artifacts/world-cup/elo-table.json` (eloratings.net snapshot, 2026-06-11)
2. Al Jazeera — Messi to captain, injury fears played down (2026-05-29): https://www.aljazeera.com/sports/2026/5/29/messi-to-captain-argentina-at-world-cup-as-scaloni-plays-down-injury-fears
3. CBS Sports — Messi hamstring muscular overload (late May 2026): https://www.cbssports.com/soccer/news/lionel-messi-injury-argentina-world-cup-2026-inter-miami/
4. Yahoo Sports — Argentina injury updates and squad (early June 2026): https://sports.yahoo.com/articles/argentina-coach-shares-lionel-messi-130000668.html
5. FIFA.com — Austria squad announcement (2026-05-18): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/austria-ralf-rangnick-world-cup-squad
6. UEFA.com — Austria fixtures and Alaba's return: https://www.uefa.com/european-qualifiers/news/02a6-20d159406296-f54718194327-1000--austria-at-the-world-cup-2026-squad-fixtures-group-and-hi/
7. AT&T Stadium official schedule page: https://attstadium.com/events/fifa-world-cup-group-3/

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
