# Iraq vs Norway — 2026 FIFA World Cup Group I (Market-Blind Forecast)

- Match: 2026-06-16 22:00 UTC, Gillette Stadium, Foxborough (neutral venue)
- Event identifier (resolution metadata only): `fifwc-irq-nor-2026-06-16`
- Generated: 2026-06-11T13:15:00Z

## 1. Forecast Summary

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Iraq win | **13%** | 8% – 18% | Medium |
| Draw | **21%** | 15% – 27% | Medium |
| Norway win | **66%** | 57% – 74% | Medium |

**One-line view:** Norway are clear favourites (~two-thirds win probability) on the back of Haaland's firepower and a 307-point Elo gap, but Iraq just held Spain to a draw — their low block gives the draw real upside.

## 2. Definition

Three-way 90-minute result (including stoppage time, excluding extra time/penalties); World Cup group matches have no extra time, so a draw stands as final.

## 3. Strength Profile

| Item | Iraq | Norway |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1607 (rank 63) | 1914 (rank 11) |
| Head coach | Graham Arnold (FIFA) | Ståle Solbakken (FIFA) |
| Recent friendlies | 1-1 Spain (Jun 4), 0-2 Venezuela (Jun 10) | 3-1 Sweden (Jun 1), 1-1 Morocco (Jun 7) |
| Background | Qualified via play-off tournament | First World Cup since 1998; Haaland scored 16 in qualifying |

## 4. Key Factors

1. **307-point Elo gap**: Norway 1914 vs Iraq 1607 — the statistical baseline already gives Norway ~68.5% (eloratings.net, 2026-06-11).
2. **Haaland in extraordinary form**: 16 goals in European qualifying (double any other player), fastest ever to 50 international goals in 46 caps (Al Jazeera, 2026-05-26).
3. **Iraq held Spain 1-1**: on Jun 4 in La Coruña against the Elo #1 side, evidence that Arnold's low-block system works (ESPN, 2026-06-04).
4. **Iraq lost final warm-up but injury-free**: 0-2 vs Venezuela on Jun 10, with zero injuries and no suspensions reported (Iraqi News, 2026-06-10).
5. **Odegaard's injury-plagued season**: at least five separate injuries, missed the March friendlies, but featured against Morocco on Jun 7 (Olympics.com; ESPN, 2026-06-07).
6. **Neutral venue**: Foxborough — no host bonus for either side (FIFA schedule).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):**
  Iraq 11.7% / Draw 19.8% / Norway 68.5%
- **Adjustment (2.5pp total, cap ±8pp):** Iraq +1.3pp, Draw +1.2pp, Norway −2.5pp.
  Rationale: Iraq's draw with Spain demonstrates a credible low block (factor 3); Norway were held by Morocco and Odegaard's season-long fitness issues add mild doubt (factor 5). Norway's qualifying dominance is already priced into Elo, and Iraq lost their final warm-up, so the shift stays small.
- **p_final:** Iraq 13% / Draw 21% / Norway 66%.
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price. Probabilities come solely from the Elo statistical model plus a bounded, evidence-based adjustment.

## 6. Method

Elo ratings from eloratings.net feed a Davidson three-way model (identical to the repo's `packages/sports-model/src/elo.ts` eloToOneXTwo: scale=400, drawNu=0.7) to produce the statistical baseline; a bounded adjustment of at most ±8pp, justified only by dated, sourced facts, is then applied and renormalized. The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8 spans Norway 66.6%–70.5%, draw 17.5%–22.0%) plus evidence thinness (both sides are long absent from World Cups; opening-match uncertainty), so the bands are widened beyond the parameter range.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11, local `elo-table.json`)
2. ESPN: Spain 1-1 Iraq (2026-06-04) — https://www.espn.com/soccer/match/_/gameId/401871471/iraq-spain
3. Iraqi News: Iraq 0-2 Venezuela, no injuries (2026-06-10) — https://www.iraqinews.com/sports/iraq-venezuela-friendly-result-graham-arnold-world-cup-2026/
4. Al Jazeera: Norway World Cup preview (2026-05-26) — https://www.aljazeera.com/sports/2026/5/26/norway-world-cup-2026-preview-players-to-watch-group-matches-squad-list
5. ESPN: Norway 3-1 Sweden (2026-06-01) — https://www.espn.com/soccer/match/_/gameId/401864055/sweden-norway
6. ESPN: Morocco 1-1 Norway (2026-06-07) — https://www.espn.com/soccer/match/_/gameId/401866598/norway-morocco
7. Olympics.com: Norway full squad and Odegaard fitness context — https://www.olympics.com/en/news/fifa-world-cup-2026-norway-all-players-full-squad-list-key-stats-and-schedule
8. FIFA: Iraq preliminary squad announcement (Graham Arnold) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
