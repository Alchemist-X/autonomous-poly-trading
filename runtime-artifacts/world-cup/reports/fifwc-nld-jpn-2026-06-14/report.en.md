# Netherlands vs Japan — 2026 World Cup Group Stage, Group F (Market-Blind Forecast)

- Match: 2026-06-14 20:00 UTC (15:00 local), AT&T Stadium, Arlington, Texas, USA (neutral venue, closed roof + A/C)
- Event identifier (resolution metadata only): `fifwc-nld-jpn-2026-06-14`
- Generated: 2026-06-11T13:15:00Z · Forecast type: 90-minute three-way result (no extra time in group stage)

## 1. Forecast Summary

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Netherlands win | **38.6%** | 32% – 45% | Medium |
| Draw | **26.8%** | 22% – 31% | Medium |
| Japan win | **34.6%** | 29% – 41% | Medium |

**One-sentence view:** The Netherlands hold a slight edge on paper, but with defensive and goalkeeping injuries piling up, an in-form Japan with an intact midfield spine can drag this opener close to a coin flip.

## 2. Definition

90-minute regulation three-way result (win/draw/loss); no extra time or penalties in the group stage. This is a **market-blind** forecast: fully independent of any betting line, odds, or prediction-market price — built only from the statistical model plus cited public news evidence.

## 3. Strength Profile

| Team | Elo (2026-06-11) | Elo rank | Notes |
| --- | --- | --- | --- |
| Netherlands | 1948 | 8 | Top-tier European side, but recent injuries cluster in defense and goal |
| Japan | 1906 | 14 | Asia's leading side, in excellent recent form (1-0 away win over England at Wembley, March 2026); Elo already reflects recent results |

Source: eloratings.net (repo snapshot `elo-table.json`, fetched 2026-06-11); England result per Al Jazeera, 2026-05-15.

## 4. Key Factors

1. **Netherlands defender Jurriën Timber ruled out of the World Cup** with a groin injury; Lutsharel Geertruida called up as replacement — FIFA.com / ESPN, June 2026 (week before the match). <https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber>
2. **Netherlands first-choice goalkeeper Bart Verbruggen is a doubt**: held out of training Wednesday (June 10); Koeman says day-by-day, hopeful for June 14 — ESPN, 2026-06-10. <https://www.espn.com/soccer/story/_/id/49022242/netherlands-bart-verbruggen-injury-2026-world-cup-japan>
3. **Japan winger Kaoru Mitoma missed the final 26-man squad** with a hamstring injury; coach Moriyasu confirmed he could not regain fitness during the tournament — Al Jazeera, 2026-05-15. <https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury>
4. **Japan captain Wataru Endo recovered from his ankle injury**, made the final squad and was named captain — midfield spine intact — Nippon.com (June 2026 squad data page). <https://www.nippon.com/en/japan-data/h02782/>
5. **Venue conditions neutralized**: AT&T Stadium has a retractable roof and air conditioning; the roof is expected to be closed for summer World Cup fixtures, largely removing the Texas June heat (avg ~33°C) as a factor for either side — AT&T Stadium / Wikipedia. <https://attstadium.com/events/fifa-world-cup-group-1/> <https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_F>
6. ESPN's World Cup injury tracker lists further Dutch players carrying knocks (e.g. Depay's hamstring), so overall availability is below paper strength — ESPN injuries tracker, June 2026. <https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info>

## 5. Model and Adjustment

**Statistical baseline p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus for either side):

- piA=10^(1948/400), piB=10^(1906/400), sq=sqrt(piA*piB), denom=piA+piB+0.7*sq
- p_stat = Netherlands 41.6% / Draw 25.8% / Japan 32.6%

**Bounded adjustment (cap ±8pp, 3pp used):**

| Direction | Size | Rationale |
| --- | --- | --- |
| Netherlands | −3.0pp | Timber out + first-choice keeper Verbruggen doubtful + multiple knocks (factors 1/2/6): clear hit to defensive integrity |
| Draw | +1.0pp | Both sides missing key players; cautious opener between near-peers |
| Japan | +2.0pp | Relatively better squad availability (Endo back, factor 4); Mitoma's absence (factor 3) partly offsets, hence only a small uplift |

Note: Japan's recent highlights (incl. the March win over England) are already in the 2026-06-11 Elo snapshot and are not double-counted in the adjustment.

**p_final = Netherlands 38.6% / Draw 26.8% / Japan 34.6%**

This is a **market-blind** forecast: no betting odds or prediction-market prices were fetched or referenced at any point; p_final is the published number with no market leg.

## 6. Method, Sources, Disclaimer

**Method:** Elo ratings from eloratings.net feed a Davidson three-way model (identical to the repo's `packages/sports-model/src/elo.ts` eloToOneXTwo, scale=400, drawNu=0.7) to produce the statistical baseline; a bounded adjustment of at most ±8pp, justified only by dated, sourced facts, is then applied and renormalized. The 80% intervals reflect drawNu sensitivity over 0.6–0.8 (baseline NED 40.1%–43.2%, draw 23.0%–28.4%, JPN 31.5%–33.9%) plus extra uncertainty from thin evidence (keeper status unresolved).

**Sources:**

1. eloratings.net World.tsv (snapshot 2026-06-11)
2. FIFA.com — Geertruida call-up / Timber withdrawal (June 2026)
3. ESPN — Verbruggen injury status (2026-06-10)
4. ESPN — World Cup injuries tracker (June 2026, rolling)
5. Al Jazeera — Mitoma misses squad (2026-05-15)
6. Nippon.com — Japan final squad and captain (June 2026)
7. Wikipedia / AT&T Stadium — schedule and venue details (June 2026)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
