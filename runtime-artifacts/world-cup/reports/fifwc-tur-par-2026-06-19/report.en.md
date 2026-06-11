# World Cup Group-Stage Forecast: Türkiye vs Paraguay (Group D)

- **Match**: 2026-06-19 (local) / kickoff 2026-06-20 03:00 UTC, San Francisco Bay Area (Santa Clara)
- **Event identifier** (resolution metadata only): `fifwc-tur-par-2026-06-19`
- **Generated**: 2026-06-11T13:15:00Z　**Type**: market-blind forecast (no odds/prices consulted)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Türkiye win | **45%** | 40% – 50% | Medium |
| Draw | **26%** | 21% – 31% | Medium |
| Paraguay win | **29%** | 24% – 34% | Medium |

**One-line view**: Türkiye hold a moderate edge on Elo and attacking form, but Paraguay's seasoned defence keeps the draw and upset paths live.

## 2. Definition

Three-way result over 90 minutes plus stoppage time; no extra time or penalties in the group stage. Neutral venue (the US is a co-host, but neither side is a host nation — no host bonus applied).

## 3. Strength Profile

| Item | Türkiye | Paraguay |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1911 (#13) | 1834 (#22) |
| Coach | Vincenzo Montella | Gustavo Alfaro |
| Core players | Çalhanoğlu, Arda Güler, Kenan Yıldız | Almirón, Enciso, Gómez, Alderete |
| Context | First World Cup in 24 years | First since 2010 (16-year gap) |

Türkiye beat Venezuela 2-1 in their final warm-up (2026-06-06, Miami) — goals by Yılmaz and Akgün, assist by Güler (ESPN). Paraguay named their 26-man squad on June 1 with only three home-league players; the defence is built around Gómez (Palmeiras) and Alderete (Sunderland) (FIFA.com / beIN).

## 4. Key Factors

1. **77-point Elo gap, neutral venue**: Türkiye 1911 vs Paraguay 1834 — a moderate, not overwhelming, edge (eloratings.net, 2026-06-11).
2. **Türkiye's attacking form**: Yıldız has 14 goals for club and country this season; Güler creating well; 2-1 warm-up win over Venezuela (ESPN, 2026-06-06; Squawka/DAZN, 2026-06).
3. **Paraguay's defensive spine intact**: Alfaro's setup leans on the experienced Gómez–Alderete axis, a compact low-error style (FIFA.com, 2026-06-01).
4. **No major injury/suspension reports either side**: as of 2026-06-11, both 26-man squads are announced in full with no key absences found (Daily Sabah 2026-06-02; FIFA.com 2026-06-01).
5. **Schedule context**: this is matchday 2 for both (Paraguay open vs USA on June 12, Türkiye vs Australia on June 14); the table situation by then may shift incentives and is unknowable today (DAZN group guide).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral — no host bonus): Türkiye 45.4% / draw 25.5% / Paraguay 29.1%.
- **Adjustment delta**: roughly ±1pp total (well under the ±8pp cap). Rationale: Türkiye's attacking form and Paraguay's defensive solidity broadly offset; no injuries reported; neither team has played a competitive match yet, so evidence is thin and only a rounding-level tweak is applied.
- **p_final**: 45% / 26% / 29%.
- **Market-blind**: this forecast is fully independent of any betting odds, prediction-market prices, or implied probabilities; the numbers come solely from the Elo statistical model plus a bounded evidence-based adjustment.

## 6. Method, Sources, Disclaimer

**Method**: same-day eloratings.net Elo feeds a Davidson three-way model (pA=piA/D, pDraw=0.7*sqrt(piA*piB)/D, pi=10^(R/400)); a bounded adjustment of at most ±8pp is then applied using sourced facts only. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Türkiye win 43.8–47.1%, draw 22.7–28.1%, Paraguay win 28.1–30.2%) plus extra widening for evidence thinness.

**Sources**:
1. eloratings.net World.tsv (fetched 2026-06-11) — https://www.eloratings.net/
2. ESPN: Venezuela 1-2 Türkiye (2026-06-06) — https://www.espn.com/soccer/match/_/gameId/401871361/turkiye-venezuela
3. Daily Sabah: Türkiye 26-man squad (2026-06-02) — https://www.dailysabah.com/sports/football/turkiye-unveil-26-player-squad-for-historic-2026-world-cup-return
4. UEFA.com: Türkiye at the World Cup 2026 — https://www.uefa.com/european-qualifiers/news/02a6-20d15969649d-c1471bfa3c52-1000--turkiye-at-the-world-cup-2026-squad-fixtures-group-and-hi/
5. FIFA.com: Paraguay squad announcement (2026-06-01) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/paraguay-squad-announcement-gustavo-alfaro
6. beIN SPORTS: Paraguay 26-man squad (2026-06-01) — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/gustavo-alfaro-and-paraguay-squad-for-the-fifa-world-cup-2026-2026-06-01
7. DAZN: Group D guide (2026-06) — https://www.dazn.com/en-US/news/soccer/fifa-world-cup-26-group-d-usa-usmnt-paraguay-australia-turkey/xucnh2uim7z91nqmddlsd3eby

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
