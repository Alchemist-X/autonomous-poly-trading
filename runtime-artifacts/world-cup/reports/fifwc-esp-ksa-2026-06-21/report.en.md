# Spain vs Saudi Arabia — 2026 World Cup Group H (Market-Blind Forecast)

- Match: 2026-06-21 16:00 UTC, Mercedes-Benz Stadium, Atlanta, USA (Group H, matchday 2)
- Event slug (resolution metadata only): `fifwc-esp-ksa-2026-06-21`
- Generated: 2026-06-11T13:15:00Z | Nature: **market-blind** — fully independent of any odds or prices

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Spain win | **84.0%** | 79% – 88% | Medium |
| Draw | **12.6%** | 9% – 16% | Medium |
| Saudi Arabia win | **3.4%** | 2% – 6% | Medium |

**One-line view:** The 581-point Elo gulf between No. 1 Spain (2157) and No. 69 Saudi Arabia (1576) makes a Spain win the overwhelming baseline; Saudi Arabia's late coaching change but resilient defending, plus mild uncertainty over Spain's returning key players, justify only a ~2pp moderate trim.

## 2. Definition

Three-way result over 90 minutes plus stoppage time (no extra time/penalties); group-stage matches can end in a draw.

## 3. Strength Profile

- Spain: Elo 2157, world No. 1 (eloratings.net, fetched 2026-06-11). Reigning European champions under De la Fuente; 26-man squad confirmed (no Real Madrid players; Yamal headlines). Source: ESPN, early June 2026.
- Saudi Arabia: Elo 1576, world No. 69 (same source). Third successive World Cup, qualified via a fourth-round playoff; seven previous appearances without a deep knockout breakthrough. Source: FIFA / Goal.com, June 2026.

## 4. Key Factors

1. **Spain's injuries are manageable but carry tail risk**: Fermín López out (metatarsal fracture, surgery); Yamal (groin/hamstring) has not played since April 22, medically cleared for the June 15 opener with possible minute limits; Merino returning from a stress fracture. De la Fuente: "almost everyone available from the first game, and if not, ready for the second" — this match is matchday 2, so availability should be higher. Source: ESPN injuries tracker / ESPN squad article, early June 2026.
2. **Saudi Arabia's late coaching change**: Hervé Renard sacked April 17; Greek coach Georgios Donis took over weeks before the finals with only 3 matches in charge (1W 1D 1L) — very little integration time. Source: Goal.com / FourFourTwo, May–June 2026.
3. **Mixed Saudi warm-ups**: 1-2 loss to Ecuador (May 30), 3-0 win over Puerto Rico (June 5), 0-0 draw with Senegal (June 9; opponent had a red card) — defensive organization against stronger sides looks serviceable. Source: Outlook India / FourFourTwo, 2026-06-09.
4. **Neutral, climate-controlled venue**: Mercedes-Benz Stadium has a fixed roof and air conditioning, largely neutralizing the midday-heat narrative that could otherwise weaken the favourite. Source: FOX Sports, June 2026.
5. **Schedule context**: Spain open against Cape Verde on June 15 while Saudi Arabia face Uruguay; on matchday 2 Spain will likely still be chasing goal difference to secure top spot, so motivation to win outright is strong. Source: Wikipedia Group H page, June 2026.

## 5. Model and Adjustment

- p_stat (Davidson three-way, scale=400, drawNu=0.7, neutral venue, no host bonus): **Spain 85.7% / Draw 11.3% / KSA 3.0%**
- Adjustment (total ~2.1pp, well within the ±8pp cap):
  - Spain −1.7pp: Yamal without match rhythm since late April + Fermín out + Merino just back (Factor 1)
  - Draw +1.3pp, KSA +0.4pp: Saudi clean sheet vs Senegal suggests a packable low block (Factor 3); coaching turbulence (Factor 2) caps any larger upgrade
- p_final: **Spain 84.0% / Draw 12.6% / KSA 3.4%**
- This forecast is **market-blind**: no betting odds, prediction-market prices, or implied probabilities were consulted or referenced.

## 6. Method

The baseline maps same-day eloratings.net Elo through a Davidson three-way model (identical to eloToOneXTwo in the repo's `packages/sports-model/src/elo.ts`; drawNu=0.7) into win/draw/loss probabilities, then applies a bounded (max ±8pp) evidence-based adjustment with renormalization. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Spain 84.4–87.1%) plus extra uncertainty from thin pre-tournament evidence.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11, model input)
2. ESPN — Spain World Cup 2026 squad confirmed (early June 2026): https://www.espn.com/soccer/story/_/id/48870392/spain-world-cup-2026-squad-confirmed-lamine-yamal-stars-no-real-madrid-players
3. ESPN — 2026 World Cup injuries tracker (June 2026): https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
4. FOX Sports — Saudi Arabia WC2026 schedule/venue (June 2026): https://www.foxsports.com/stories/soccer/saudi-arabia-world-cup-2026-schedule-locations-dates-times
5. Goal.com — World Cup 2026 Ultimate Guide: Saudi Arabia (June 2026): https://www.goal.com/en-sa/world-cup-teams/group-h/world-cup-2026-guide-saudi-arabia/O~blta4d1aa8150596e24
6. FourFourTwo — Saudi Arabia WC2026 squad / Donis record (June 2026): https://www.fourfourtwo.com/team/saudi-arabia-world-cup-2026-squad
7. Outlook India — Saudi Arabia 0-0 Senegal (2026-06-09): https://www.outlookindia.com/sports/football/saudi-arabia-vs-senegal-live-score-international-friendly-2026-updates-highlights-texas

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
