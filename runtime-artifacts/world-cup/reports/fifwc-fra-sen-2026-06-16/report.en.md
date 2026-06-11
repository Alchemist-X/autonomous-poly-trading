# France vs Senegal — 2026 World Cup Group I (Market-Blind Forecast)

- Kickoff: 2026-06-16 19:00 UTC (15:00 ET)
- Venue: MetLife Stadium, East Rutherford, NJ (neutral venue, no host bonus)
- Event slug (resolution metadata only): `fifwc-fra-sen-2026-06-16`
- Generated: 2026-06-11 · Confidence tier: **Medium**

## 1. Forecast

| Outcome | p_final | 80% interval |
| --- | --- | --- |
| France win | **0.57** | 0.51 – 0.63 |
| Draw | **0.24** | 0.19 – 0.28 |
| Senegal win | **0.19** | 0.15 – 0.24 |

**One-line view**: France hold a clear ~200-point Elo edge, but Senegal arrive as fresh AFCON runners-up with a settled, in-form squad — the combined chance of a draw or upset exceeds 40% and should not be dismissed.

## 2. Definition

Three-way result over 90 minutes plus stoppage time (no extra time/penalties); World Cup group matches have no extra time.

## 3. Strength Profile

| Item | France | Senegal |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 2063 (rank 3) | 1860 (rank 21) |
| Pedigree | 2018 champions, 2022 runners-up, 8th straight finals | 3rd straight finals; 2026 AFCON runners-up |
| Core | Mbappé, Dembélé (Ballon d'Or holder), Doué, Olise | Mané, Koulibaly, Nicolas Jackson (Bayern) |

## 4. Key Factors

1. **France near full strength**: Mbappé included despite recurring injury niggles through the season; Camavinga and Kolo Muani omitted — depth losses, limited impact. (ESPN, 2026-06; CBC, 2026-06)
2. **Senegal in strong form**: AFCON finalists in January 2026; Sadio Mané, 34, was named player of the tournament — leadership and form intact. (Al Jazeera, 2026-05-30)
3. **Settled, experienced Senegal squad**: 28-man provisional list named 21 May, led by Mané and Koulibaly, several players past 100 caps; Bayern striker Nicolas Jackson leads the line. (Al Jazeera, 2026-05-21; MLSSoccer Group I preview, 2026-06)
4. **Neutral venue**: MetLife Stadium is home to neither side; no host bonus applied. Both teams have sizeable diaspora support in North America — crowd effect treated as neutral. (metlifestadium.com event page, 2026-06)
5. **Historical footnote**: Senegal beat holders France 1-0 in the 2002 World Cup opener — context only, not part of the probability adjustment. (Wikipedia: 2026 FIFA World Cup Group I)

## 5. Model and Adjustment

- **Statistical baseline p_stat** (three-way Davidson model, scale=400, drawNu=0.7, no host bonus):
  France 0.588 / Draw 0.229 / Senegal 0.183
- **Evidence adjustment delta** (cap ±8pp; ±2pp applied here):
  France −2pp, Draw +1pp, Senegal +1pp. Rationale: fitness uncertainty around Mbappé's stop-start season (factor 1) combined with Senegal's AFCON-finalist form and squad completeness (factors 2-3); evidence is thin overall, so the shift is small.
- **p_final**: France 0.57 / Draw 0.24 / Senegal 0.19
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market quote. Probabilities come solely from the Elo statistical model plus the bounded, evidence-based adjustment above.

## 6. Method

World Elo ratings from eloratings.net (2026-06-11 snapshot) are converted to a 90-minute 1X2 baseline via a Davidson three-way model (drawNu=0.7), then adjusted by at most ±8pp based on dated, sourced public facts and renormalized. The 80% intervals reflect parameter sensitivity (sweeping drawNu over 0.6-0.8 moves France's baseline win probability between 0.57 and 0.61) plus extra uncertainty from thin pre-tournament evidence (lineups and late fitness unconfirmed).

### Sources

1. eloratings.net (World.tsv, fetched 2026-06-11, repo `elo-table.json`)
2. ESPN — France 2026 World Cup squad (2026-06): https://www.espn.com/soccer/story/_/id/48771039/france-2026-world-cup-squad-mbappe-camavinga-kolo-muani-dembele
3. CBC Sports — World Cup injuries (2026-06): https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
4. Al Jazeera — Senegal provisional squad (2026-05-21): https://www.aljazeera.com/sports/2026/5/21/sadio-mane-kalidou-koulibaly-star-picks-in-senegals-world-cup-squad
5. Al Jazeera — Senegal team preview (2026-05-30): https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list
6. Al Jazeera — France team preview (2026-06-02): https://www.aljazeera.com/sports/2026/6/2/france-world-cup-2026-preview-players-to-watch-group-matches-and-squad
7. MLSSoccer — Group I preview (2026-06): https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-i-preview-france-senegal-iraq-norway
8. MetLife Stadium official event page (2026-06): https://www.metlifestadium.com/events/detail/fifa-world-cup-2026-france-vs-senegal

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
