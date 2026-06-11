# Morocco vs Haiti (2026 World Cup Group C) — Market-Blind Forecast

- Match: 2026-06-24 22:00 UTC (Mercedes-Benz Stadium, Atlanta; Group C matchday 3)
- Event identifier (resolution metadata only): `fifwc-mar-hai-2026-06-24`
- Generated: 2026-06-11T13:15:00Z | Mode: **market-blind** (fully independent of any betting/prediction-market prices)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Morocco win | **63%** | 56% – 70% | Medium |
| Draw | **22%** | 16% – 28% | Medium |
| Haiti win | **15%** | 9% – 21% | Medium |

**One-sentence view:** Morocco dominate on strength and pedigree, but a key centre-back out, a coaching transition, possible matchday-3 rotation, and Haiti's hot form push the upset tail slightly above the pure model value.

## 2. Definition

Three-way 90-minute result (win/draw/loss). No extra time or penalties in the group stage; stoppage time counts within the 90-minute result.

## 3. Strength Profile

| Metric | Morocco | Haiti |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1827 (rank 24) | 1548 (rank 73) |
| Recent major tournament | AFCON 2025 champions (awarded by CAF ruling, 2026-03-18, Euronews) | Second-ever World Cup, topped CONCACAF group (Wikipedia) |
| Pre-tournament state | Final squad on Jun 10 with two injury withdrawals (Morocco World News) | 4-0 friendly win over New Zealand on Jun 2 (ESPN) |

Venue is the roofed, climate-controlled Mercedes-Benz Stadium in Atlanta, so weather is broadly neutral; neither side is a host nation, so no host Elo bonus applies.

## 4. Key Factors

1. **Morocco lose first-choice CB Aguerd**: withdrawn from the World Cup squad over fitness, replaced by Saadane; winger Ezzalzouli also withdrew injured the same day (Morocco World News / Wikipedia squads, 2026-06-10).
2. **Morocco in a coaching transition**: Walid Regragui departed in March 2026; U20 World Cup-winning coach Mohamed Ouahbi took over with limited senior-tournament experience (Al Jazeera, 2026-06-03).
3. **Morocco's big-tournament pedigree intact**: reached the AFCON 2025 final and were ultimately awarded the title (lost in extra time on the pitch before CAF's 3-0 ruling); squad depth far exceeds Haiti's (Euronews, 2026-03-18).
4. **Haiti in hot form**: 4-0 friendly win over New Zealand on June 2; qualified by beating Nicaragua 2-0 on the final qualifying matchday to top their group (ESPN, 2026-06-02; Wikipedia, 2025-11).
5. **Haiti's upgrades may not be fully priced into Elo**: Sunderland striker Wilson Isidor switched allegiance in March; Wolves midfielder Jean-Ricner Bellegarde is in the squad (Olympics.com, June 2026).
6. **Matchday-3 stakes unknown**: this is the final Group C round (Brazil and Scotland also in the group); qualification scenarios are unknowable now — Morocco may rotate if already through, Haiti may be highly motivated — widening the draw/upset tail.

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Morocco 66.0% / Draw 20.7% / Haiti 13.3% (Elo 1827 vs 1548).
- **Evidence adjustment delta (total -3.0pp Morocco → +1.5pp draw / +1.5pp Haiti; cap ±8pp)**:
  Rationale: Morocco's two injury withdrawals + new coach + rotation risk (factors 1/2/6); Haiti's form and reinforcements (factors 4/5). Morocco's AFCON run is largely already reflected in Elo, so no extra credit. Evidence is thin overall (final-round scenarios unknown), hence a small delta.
- **p_final: Morocco 63% / Draw 22% / Haiti 15%.**
- This is a **market-blind** forecast: no betting odds, prediction-market prices, or implied probabilities were consulted at any point; probabilities come solely from the Elo statistical model plus the bounded, sourced adjustment above.

## 6. Method and Sources

Method: eloratings.net world Elo feeds a Davidson three-way model (identical to `eloToOneXTwo` in the repo's `packages/sports-model/src/elo.ts`) for the statistical baseline; a bounded (max ±8pp) adjustment based on dated, sourced team news is then applied and renormalized. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (about ±2pp on win, ±2.3pp on draw) widened for evidence thinness (unknown final-round stakes and rotation).

Sources:
1. eloratings.net World.tsv (fetched 2026-06-11)
2. Morocco World News — Aguerd ruled out, Saadane called up (2026-06-10): https://www.moroccoworldnews.com/2026/06/317989/aguerd-ruled-out-of-moroccos-2026-world-cup-squad-marwane-saadane-called-up/
3. Wikipedia — 2026 FIFA World Cup squads (Ezzalzouli/Aguerd withdrawals, 2026-06-10): https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads
4. Al Jazeera — Morocco World Cup preview, coaching change (2026-06-03): https://www.aljazeera.com/sports/2026/6/3/morocco-world-cup-2026-preview-players-to-watch-group-and-squad-list
5. Euronews — Morocco declared AFCON 2025 winners (2026-03-18): https://www.euronews.com/2026/03/18/morocco-declared-afcon-2025-winners-after-caf-overturns-final-defeat-to-senegal
6. ESPN — Haiti 4-0 New Zealand (2026-06-02): https://www.espn.com/soccer/match/_/gameId/401871830/new-zealand-haiti
7. Olympics.com — Haiti squad and key players (June 2026): https://www.olympics.com/en/news/fifa-world-cup-2026-haiti-players-squad-list-key-stats-schedule
8. Wikipedia — Haiti national football team (qualification, 2025-11): https://en.wikipedia.org/wiki/Haiti_national_football_team

Disclaimer: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
