# Tunisia vs Japan — 2026 World Cup Group Stage, Group F (Market-Blind Forecast)

- **Match**: Tunisia vs Japan, Group F matchday 2, Estadio BBVA, Monterrey (Mexico)
- **Kickoff**: 2026-06-21 04:00 UTC (22:00 June 20 local time)
- **Generated**: 2026-06-11 | **Nature**: market-blind forecast, fully independent of any betting/prediction-market prices

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Tunisia win | **12%** | 9% – 16% | Medium |
| Draw | **21%** | 17% – 26% | Medium |
| Japan win | **67%** | 60% – 73% | Medium |

**One-line view**: Japan's 278-point Elo edge is decisive; the Mitoma/Minamino injury losses are roughly offset by Tunisia's coaching upheaval and a 0-5 warm-up collapse against Belgium — Japan wins about 2 times in 3.

## 2. Definition

Three-way result over 90 minutes (plus stoppage time); no extra time or penalties in the group stage. A draw settles as a draw.

## 3. Strength Profile

| Team | Elo (eloratings.net, 2026-06-11 snapshot) | Elo world rank |
| --- | --- | --- |
| Japan | 1906 | 14 |
| Tunisia | 1628 | 58 |

- Japan: 26-man squad led by Takefusa Kubo, with Wataru Endo and Daichi Kamada included; Takehiro Tomiyasu recalled after nearly two years out (FIFA/World Soccer Talk, 2026-05). Japan opens vs Netherlands before moving to Monterrey to face Tunisia (ESPN, 2026-05-15).
- Tunisia: head coach Sabri Lamouchi only took over in January 2026 and has managed just 2 matches; veterans Sassi, Meriah, Maaloul and Sliti were all left out (FIFA, 2026-05; Squawka).

## 4. Key Factors

1. **Japan missing both star wingers**: Kaoru Mitoma (hamstring) is out of the World Cup; Takumi Minamino is also out injured — reduced width and 1-v-1 threat (Al Jazeera, 2026-05-15; ESPN, 2026-05-15).
2. **Tunisia coaching upheaval**: Lamouchi appointed in January with only 2 matches in charge, and a heavily changed squad dropping long-serving veterans — cohesion is uncertain (FIFA, 2026-05).
3. **Tunisia's warm-up collapse**: June friendlies brought a 1-0 loss to Austria and a 5-0 thrashing by Belgium, raising defensive concerns against stronger sides (FIFA warm-up roundup, 2026-06).
4. **Venue and adaptation**: both of Tunisia's first two group games are at Estadio BBVA, Monterrey (June 15 vs Sweden, June 21 vs Japan) — a small familiarity edge; the 22:00 local night kickoff limits heat impact (Wikipedia Group F, accessed 2026-06-11).
5. **Japan's squad depth**: even without Mitoma/Minamino, the attacking pool (Kubo, Kamada, Doan and others) remains Asia's deepest, partially absorbing the injury hit (World Soccer Talk, 2026-05).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Tunisia 13.3% / Draw 20.7% / Japan 66.0%
- **Adjustment (total |delta| ~2.6pp, cap +/-8pp)**:
  - Japan missing Mitoma + Minamino: -2pp direction against Japan;
  - Tunisia's new-coach churn + 0-5 loss + veteran clear-out: -2.5pp direction against Tunisia;
  - Tunisia's Monterrey venue familiarity: +0.5pp direction for Tunisia;
  - Net: Tunisia -1.3pp, Draw +0.3pp, Japan +1.0pp.
- **p_final**: Tunisia 12% / Draw 21% / Japan 67%.
- This is a **market-blind** forecast: no betting or prediction-market prices or odds were fetched or referenced at any point; probabilities come solely from the Elo statistical model plus a bounded evidence-based adjustment.

## 6. Method, Sources and Disclaimer

**Method**: the eloratings.net 2026-06-11 Elo snapshot feeds a Davidson three-way model (pi_A = 10^(Ra/400), draw parameter nu = 0.7) to produce p_stat; a bounded adjustment of at most +/-8pp based on dated, sourced public facts is then applied and renormalized. The 80% intervals reflect parameter sensitivity (nu in [0.6, 0.8]) plus evidence thinness (10 days before kickoff; lineups and form can still change).

**Sources**:
1. eloratings.net World.tsv (2026-06-11 snapshot, repo elo-table.json)
2. Al Jazeera — Mitoma fails to make Japan's 2026 World Cup squad (2026-05-15): https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury
3. ESPN — Mitoma ruled out, Tomiyasu recalled (2026-05-15): https://www.espn.com/soccer/story/_/id/48775615/kaoru-mitoma-ruled-world-cup-injury-takehiro-tomiyasu-recalled-japan-squad
4. FIFA — Lamouchi names much-changed Tunisia squad (2026-05): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/tunisia-squad-named-sabri-lamouchi
5. FIFA — Pre-tournament warm-up results roundup (2026-06): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/pre-tournament-warm-up-results-fixtures-scorers
6. Squawka — Tunisia World Cup 2026 squad & tactical analysis (2026-06): https://www.squawka.com/en/news/world-cup/tunisia-world-cup-2026-fixtures-squad-analysis/
7. Wikipedia — 2026 FIFA World Cup Group F (accessed 2026-06-11): https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_F

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
