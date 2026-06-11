# Norway vs Senegal (2026 World Cup Group I, Match 41) — Market-Blind Forecast

- Kickoff: 2026-06-22 20:00 EST (UTC 2026-06-23T00:00:00Z)
- Venue: MetLife Stadium (renamed New York New Jersey Stadium for the tournament), East Rutherford, NJ, USA — neutral for both teams
- Event slug (resolution metadata only): `fifwc-nor-sen-2026-06-22`
- Generated: 2026-06-11T13:15:00Z

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Norway win | **41%** | 34% – 49% | Medium |
| Draw | **26%** | 20% – 32% | Medium |
| Senegal win | **33%** | 26% – 40% | Medium |

**One-sentence view**: Norway hold a slight edge on Elo and Haaland's firepower, but reigning AFCON champions Senegal bring far more tournament experience — a close three-way race with Norway only narrowly ahead.

## 2. Outcome definition

The forecast covers the 90-minute (plus stoppage time) three-way result: Norway win / draw / Senegal win. No extra time or penalties in the group stage.

## 3. Strength profile

| | Norway | Senegal |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1914 (#11) | 1860 (#21) |
| Recent form | Dominant qualifying campaign; Haaland scored 16 qualifying goals (twice any other player in Europe); first World Cup in 28 years | Won AFCON in January 2026; Mané named player of the tournament; third consecutive World Cup |
| Key players | Haaland (Man City), Ødegaard, Sørloth, Nusa | Mané (Al-Nassr), E. Mendy, Koulibaly, Gana Gueye |

## 4. Key factors

1. **54-point Elo gap, rank 11 vs 21** — Norway are the statistical slight favourite on neutral ground (eloratings.net, 2026-06-11).
2. **Norway named their 26-man squad on 21 May with Haaland fit and included**; no significant injury absences reported (olympics.com / fifa.com, 2026-05-21).
3. **Senegal are the 2026 AFCON champions**; Mané (34, his final World Cup) was AFCON player of the tournament — a deeply tournament-tested squad (aljazeera.com, 2026-05-30).
4. **Senegal also report no major injuries**; Pape Thiaw named his preliminary squad on 21 May with Mendy, Koulibaly and Gana Gueye all included (beinsports.com / fifa.com, 2026-05-21).
5. **This is matchday 2 for both teams**: Norway face Iraq on June 16 and Senegal open against France; matchday-1 results could change qualification pressure and rotation, and are unknown at forecast time (olympics.com, 2026-05; goal.com, 2026-06).
6. **Norway's first World Cup since 1998 — almost no squad World Cup experience**; Senegal reached the knockouts in two of their last three World Cups (olympics.com, 2026-05; goal.com, 2026-06).

## 5. Model and adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7; neither team is a host, no home bonus):
  Norway 42.9% / Draw 25.7% / Senegal 31.4%
- **Adjustment (about 2pp total, well within the ±8pp cap)**: Norway −1.9pp → Senegal +1.6pp, Draw +0.3pp.
  Rationale: Senegal are reigning AFCON champions with extensive knockout pedigree, while Norway's squad has almost no World Cup experience (sources: factors 3 and 6). Haaland's qualifying output is already reflected in Elo, so it is not double-counted. With no injury evidence on either side, only a small shift is justified.
- **p_final**: Norway 41% / Draw 26% / Senegal 33%.
- **This is a market-blind forecast**: fully independent of any betting odds, market prices, or prediction-market data; none were consulted.

## 6. Method

Elo ratings from eloratings.net feed a Davidson three-way model (identical to eloToOneXTwo in this repo's `packages/sports-model/src/elo.ts`: scale=400, drawNu=0.7) to produce a statistical baseline; a bounded evidence-based adjustment of at most ±8pp is then applied and renormalized. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Norway 41.4%–44.5%, Draw 22.9%–28.3%, Senegal 30.3%–32.6%) plus evidence thinness (matchday-1 results and lineups unknown), so they are widened beyond the sensitivity band.

### Sources

1. eloratings.net World.tsv (Elo ratings, fetched 2026-06-11) — https://www.eloratings.net/World.tsv
2. olympics.com Norway World Cup preview and squad (2026-05) — https://www.olympics.com/en/news/fifa-world-cup-2026-norway-all-players-full-squad-list-key-stats-and-schedule
3. fifa.com Norway squad announcement (2026-05-21) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/norway-squad-announcement-stale-solbakken
4. aljazeera.com Senegal World Cup preview (2026-05-30) — https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list
5. beinsports.com Senegal squad (2026-05-21) — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/pape-thiaw-s-official-senegal-squad-for-the-2026-fifa-world-cup-2026-05-21
6. fifa.com Senegal squad announcement (2026-05) — https://www.fifa.com/en/articles/senegal-world-cup-squad-announcement-pape-thiaw
7. goal.com Norway vs Senegal venue and schedule info (2026-06) — https://www.goal.com/en/news/norway-vs-senegal-world-cup-tickets-how-to-buy/bltf217ffeab77fcc93

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
