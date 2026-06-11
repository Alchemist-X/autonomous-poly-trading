# 2026 World Cup Group G: New Zealand vs Belgium (Market-Blind Forecast)

- Generated: 2026-06-11T13:15:00Z
- Match: 2026-06-26 (20:00 PT Vancouver; UTC 2026-06-27T03:00:00Z)
- Venue: BC Place, Vancouver, Canada (neutral venue, no host bonus)
- Event identifier (resolution metadata only): `fifwc-nzl-bel-2026-06-26`

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| New Zealand win | **11.5%** | 8% – 16% | Medium |
| Draw | **20.5%** | 15% – 26% | Medium |
| Belgium win | **68.0%** | 61% – 75% | Medium |

**One-line view:** Belgium are clearly stronger and win roughly 68% of the time, but as a final group-stage match Belgium may rotate if already qualified, and with Lukaku and other key men carrying injuries, New Zealand's chance of taking points is not negligible.

## 2. Outcome definition

Three-way result over 90 minutes plus stoppage time: A = New Zealand win / Draw / B = Belgium win. No extra time or penalties in the group stage.

## 3. Strength profile

| Team | Elo (eloratings.net snapshot 2026-06-11) | Elo rank | FIFA rank |
| --- | --- | --- | --- |
| New Zealand | 1562 | 72 | 85 (ESPN, June 2026) |
| Belgium | 1894 | 15 | 9 (ESPN, June 2026) |

- Belgium key players: De Bruyne (34, surgery last October, returned in March), Doku (21 goal contributions in 50 games this season), Lukaku (selected despite injury). (FourFourTwo / beIN, 2026-05-15)
- New Zealand key player: captain Chris Wood (Nottingham Forest), back from December knee surgery and self-reporting full fitness. (Flashscore, June 2026)

## 4. Key factors

1. **332-point Elo gap**: 1894 vs 1562, one of the most lopsided group-stage pairings. Source: eloratings.net snapshot, 2026-06-11.
2. **Belgium's injured forwards**: at the 15 May squad announcement De Bruyne (eye) and Lukaku (hip) were both sidelined yet selected; Lukaku has played barely an hour of competitive football this season due to recurring muscle injuries. Sources: beIN Sports, 2026-05-15; FourFourTwo.
3. **Matchday-3 rotation risk**: this is Group G's final round; Belgium face Egypt (June 15) and Iran first and may rotate if already qualified. Sources: Wikipedia "2026 FIFA World Cup Group G" schedule; FOX Sports schedule page.
4. **Wood fully fit**: New Zealand's only Premier League-calibre striker is confirmed fully recovered and has been playing for over a month and a half. Source: Flashscore, June 2026.
5. **Neutral venue**: BC Place (Vancouver, covered roof) is neutral for both sides; no host Elo bonus applies. Source: Destination Vancouver event page.

## 5. Model and adjustment

- **Statistical baseline p_stat** (Davidson three-way model, scale=400, drawNu=0.7, no host bonus for either side):
  - New Zealand 10.4% / Draw 19.0% / Belgium 70.6%
- **Evidence-based delta** (total ~2.6pp, cap +/-8pp):
  - Belgium -2.6pp: Lukaku has barely played all season, De Bruyne only recently back (factor 2); possible matchday-3 rotation (factor 3).
  - Draw +1.5pp, New Zealand +1.1pp: redistribution of the above; Wood's fitness preserves New Zealand's counter-attacking ceiling (factor 4).
- **p_final**: New Zealand 11.5% / Draw 20.5% / Belgium 68.0%.
- The 80% intervals reflect parameter sensitivity (drawNu 0.6-0.8 moves Draw 16.7%-21.1% and Belgium 68.7%-72.5%) plus matchday-3 motivation uncertainty and thin evidence.
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price. Probabilities come only from the Elo statistical model plus the bounded, sourced adjustment above.

## 6. Method and sources

Method: take the eloratings.net 2026-06-11 Elo snapshot as input, derive a statistical baseline via the Davidson three-way model (scale=400, drawNu=0.7), then apply a bounded (max +/-8pp) adjustment justified only by dated, sourced team news, and renormalize. No betting or prediction-market data is used anywhere.

Sources:
1. eloratings.net World.tsv snapshot (2026-06-11), repo file `runtime-artifacts/world-cup/elo-table.json`
2. beIN Sports (2026-05-15): https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/de-bruyne-and-lukaku-named-in-belgium-world-cup-squad-despite-injuries-2026-05-15
3. FourFourTwo Belgium squad page: https://www.fourfourtwo.com/team/belgium-world-cup-2026-squad
4. Flashscore (June 2026), Wood fully fit: https://www.flashscore.com/news/soccer-world-cup-new-zealand-captain-chris-wood-fully-fit-for-2026-world-cup-after-injury-battles/xj5tDLMN/
5. ESPN (June 2026), New Zealand squad and rankings: https://www.espn.com/soccer/story/_/id/48764554/chris-wood-headlines-new-zealand-2026-world-cup-squad
6. FIFA.com, New Zealand squad named: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/new-zealand-squad-named
7. Wikipedia "2026 FIFA World Cup Group G": https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_G

Disclaimer: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
