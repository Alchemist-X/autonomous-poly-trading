# Belgium vs IR Iran (2026 World Cup, Group G) — Market-Blind Forecast

- Match: 2026 FIFA World Cup group stage, Group G, Match 39
- Kickoff: 2026-06-21T19:00:00Z (SoFi Stadium, Inglewood, Los Angeles)
- Event slug (resolution metadata only): `fifwc-bel-irn-2026-06-21`
- Generated: 2026-06-11T13:15:00Z | Type: **market-blind** (fully independent of any betting/prediction-market prices)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Belgium win | **51.8%** | 45% – 58% | Medium |
| Draw | **24.3%** | 20% – 29% | Medium |
| IR Iran win | **23.9%** | 19% – 30% | Medium |

**One-line view**: Belgium hold a 122-point Elo edge and clear on-paper superiority, but De Bruyne/Lukaku fitness doubts and Iran's collective resilience make this closer to a "60-40 type" game than a blowout.

## 2. Definition

Three-way 90-minute result (incl. stoppage time, no extra time/penalties); group-stage matches have no extra time. Official settlement governs.

## 3. Strength Profile

| Item | Belgium | IR Iran |
| --- | --- | --- |
| Elo (2026-06-11, eloratings.net) | 1894 (15th) | 1772 (29th) |
| Manager | Rudi Garcia | Amir Ghalenoei |
| Core | De Bruyne (6 goals in qualifying), Courtois, Doku | Taremi (10 goals in 15 for Olympiacos) |
| Key gap | KDB/Lukaku named while injured, fitness in doubt | Azmoun omitted entirely (57 goals in 91 caps void) |

Sources: eloratings.net (via local `elo-table.json`, fetched 2026-06-11); beIN Sports 2026-05-15; Flashscore 2026-06-01.

## 4. Key Factors

1. **122-point Elo gap**: Belgium 1894 vs Iran 1772; the neutral-venue statistical model gives Belgium ~50% (eloratings.net, 2026-06-11).
2. **Belgium's two stars carrying injuries**: De Bruyne (eye injury at Napoli) and Lukaku (hip; only 7 club matches all season) were both named in the 26-man squad announced 15 May despite injuries (beIN Sports, 2026-05-15).
3. **Iran without Azmoun**: omitted from the squad entirely, leaving a 57-goals-in-91-caps void up front — a material attacking downgrade (Flashscore / allfootball, 2026-06-01).
4. **Taremi in form**: 10 goals in 15 games for Olympiacos, heading to his third World Cup; Iran's attack still has teeth (Flashscore, 2026-06-01; SI preview).
5. **No ticket allocation for Iranian fans**: the US revoked Iran's supporter ticket allocation (Al Jazeera, 2026-06-09), so no atmosphere boost for Iran in Los Angeles.
6. **Second group-stage round**: Group G opens 15 June; this is each side's second match, so first-round results will shape stakes (Wikipedia Group G; ESPN fixture page).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Belgium 50.3% / Draw 24.8% / Iran 24.9%
- **Adjustment delta (cap ±8pp, actual ±1.5pp)**:
  - Iran -1.0pp: Azmoun's omission is the single most concrete loss;
  - Belgium +1.5pp, Draw -0.5pp: KDB/Lukaku are injured but both named with a month to recover, and qualifying form (KDB 6 goals) supports the on-paper edge; Taremi's form partly offsets Iran's loss, so the net shift is small.
- **p_final**: Belgium 51.8% / Draw 24.3% / Iran 23.9%.
- This is a **market-blind** forecast: no betting or prediction-market prices were fetched, read, or referenced at any point. Numbers come solely from the Elo statistical model plus a bounded, evidence-cited adjustment.

## 6. Method and Sources

Method: same-day Elo from eloratings.net feeds a Davidson three-way model (identical to `eloToOneXTwo` in repo `packages/sports-model/src/elo.ts`) for the statistical baseline; then a bounded (≤±8pp) adjustment justified only by dated, sourced team news, renormalized. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity plus evidence thinness.

Sources:
1. eloratings.net World.tsv (fetched 2026-06-11, local `elo-table.json`)
2. beIN Sports, Belgium 26-man squad and KDB/Lukaku injuries, 2026-05-15 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/de-bruyne-and-lukaku-named-in-belgium-world-cup-squad-despite-injuries-2026-05-15
3. Flashscore, Iran squad: Taremi headlines, Azmoun overlooked, 2026-06-01 — https://www.flashscore.com/news/soccer-world-championship-taremi-and-jahanbakhsh-lead-iran-s-world-cup-squad-with-azmoun-overlooked/pGYQ1OUq/
4. Sports Illustrated, Iran 2026 World Cup preview — https://www.si.com/soccer/iran-2026-world-cup-preview
5. Al Jazeera, US revokes Iranian fans' ticket allocation, 2026-06-09 — https://www.aljazeera.com/sports/2026/6/9/iran-says-us-have-revoked-world-cup-ticket-allocation-for-their-supporters
6. ESPN, fixture page (2026-06-21, Belgium vs Iran) — https://www.espn.com/soccer/match/_/gameId/760451/iran-belgium

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
