# Brazil vs Haiti (2026 World Cup Group C, 2026-06-19) — Market-Blind Forecast

> Generated: 2026-06-11 | Kickoff: 2026-06-20T00:30:00Z (Lincoln Financial Field, Philadelphia, evening of June 19 local)
> This is a **market-blind** forecast: fully independent of any betting market, odds, or prediction-market prices.

## 1. Forecast

| Outcome (90 minutes) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Brazil win | **76.5%** | 70% – 83% | Medium |
| Draw | **16.9%** | 12% – 21% | Medium |
| Haiti win | **6.6%** | 4% – 10% | Medium |

**One-sentence view:** With a 443-point Elo gap over Haiti, Brazil are strong favourites at roughly 76% even with Neymar's fitness in doubt; an upset has little room.

## 2. Definition

- Target: three-way 90-minute result (including stoppage time); no extra time in the group stage.
- Resolution metadata only: event slug `fifwc-bra-hai-2026-06-19` (settlement identifier, unrelated to prices).

## 3. Strength Profile

| Team | Elo (2026-06-11) | Elo rank | Notes |
| --- | --- | --- | --- |
| Brazil | 1991 | 5 | Coached by Carlo Ancelotti; core includes Vinicius Jr, Raphinha, Matheus Cunha (source: FIFA official squad, 2026-06-02) |
| Haiti | 1548 | 73 | Coached by Sebastien Migne; captain GK Johny Placide; Duckens Nazon is all-time top scorer (source: FIFA official squad, 2026-06-02) |

Elo source: eloratings.net (fetched 2026-06-11).

## 4. Key Factors

1. **443-point Elo gap**: the statistical model alone gives Brazil a ~78.5% base win probability (eloratings.net, 2026-06-11).
2. **Neymar's grade-two calf strain** ruled him out of Brazil's final two warm-up matches; if he misses the June 13 opener vs Morocco, staff target his return for this Haiti fixture (FourFourTwo, 2026-06; fourfourtwo.com/team/brazil-world-cup-2026-squad).
3. **Brazil defender Wesley withdrew injured on June 7** with a replacement called up; overall squad depth remains world-class (FourFourTwo, 2026-06-07).
4. **Haiti's Premier League reinforcements**: Sunderland striker Wilson Isidor switched allegiance from France in March 2026 and Wolves midfielder Jean-Ricner Bellegarde made the squad; this uplift may not yet be fully reflected in Elo (FourFourTwo, 2026-06; fourfourtwo.com/team/haiti-world-cup-2026-squad).
5. **Haiti's qualification plan** is widely expected to target the Scotland and Morocco fixtures, playing a deep defensive block against Brazil to manage goal difference (FourFourTwo, 2026-06).
6. **Neutral venue**: Lincoln Financial Field, Philadelphia, evening kickoff local time on June 19, limiting heat effects; no host bonus applies to Brazil (FIFA match page / Ticketmaster, 2026-06).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Brazil 78.5% / Draw 15.4% / Haiti 6.1%.
- **Evidence-based adjustment (2pp total, cap +/-8pp):**
  - Brazil -2.0pp: Neymar doubtful, Wesley withdrawn — modest lineup uncertainty;
  - Draw +1.5pp, Haiti +0.5pp: Haiti's new Premier League-level talent (Isidor's allegiance switch only in March, so Elo may lag) and an expected low block.
- **p_final: Brazil 76.5% / Draw 16.9% / Haiti 6.6%.**
- The 80% intervals reflect drawNu sensitivity in 0.6-0.8 (Brazil win 76.8%-80.3%), thin evidence, and adjustment uncertainty.
- This forecast is **market-blind**: no betting odds, prices, or prediction-market data were consulted at any point.

## 6. Method and Sources

**Method:** eloratings.net world Elo feeds a Davidson three-way model (identical to the repo's `packages/sports-model/src/elo.ts` eloToOneXTwo, scale=400, drawNu=0.7) for base probabilities, followed by a bounded (+/-8pp max) evidence-based adjustment from publicly reported injuries, squads, and incentives, then renormalization. No market data involved.

**Sources:**
1. eloratings.net world Elo (fetched 2026-06-11) — https://www.eloratings.net/
2. FourFourTwo, Brazil World Cup squad and injuries — https://www.fourfourtwo.com/team/brazil-world-cup-2026-squad (2026-06)
3. FIFA official: Brazil squad announcement — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/brazil-squad-announcement-carlo-ancelotti (2026-06-02)
4. FourFourTwo, Haiti World Cup squad — https://www.fourfourtwo.com/team/haiti-world-cup-2026-squad (2026-06)
5. FIFA official: Haiti squad announcement — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/haiti-squad-announcement-sebastien-migne (2026-06-02)
6. FIFA match page (venue and kickoff) — https://www.fifa.com/en/match-centre/match/17/285023/289273/400021457 (2026-06)
7. Wikipedia: 2026 FIFA World Cup Group C — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_C (2026-06)

**Disclaimer:** This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
