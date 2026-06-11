# Switzerland vs Canada — 2026 World Cup Group B (Market-Blind Forecast)

- Match: 2026-06-24 19:00 UTC, BC Place, Vancouver (Canada at home)
- Event slug (resolution metadata only): `fifwc-che-can-2026-06-24`
- Generated: 2026-06-11 · Scope: 90-minute three-way result (no extra time in group stage)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Switzerland win | **40.4%** | 34% – 47% | Medium |
| Draw | **26.4%** | 21% – 31% | Medium |
| Canada win | **33.2%** | 26% – 40% | Medium |

**One-line view:** Switzerland edge it on squad health and steady form, but Canada have home advantage in Vancouver — a near coin-flip battle for top spot in Group B.

## 2. Definition

Three-way result over 90 minutes plus stoppage time; no extra time or penalties in the group stage.

## 3. Strength Profile

| Item | Switzerland | Canada |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1891 (rank 17) | 1788 (rank 25), +100 host bonus for group matches → effective 1888 |
| Core | Xhaka (145 caps, 4th World Cup), Embolo (team-leading 4 goals in qualifying) | Jonathan David (8 goals, 5 assists at Juventus), Davies (fitness doubt) |
| Recent | 4-1 friendly win vs Jordan, May 31 (St. Gallen) | Pre-tournament injury wave (below) |

Sources: eloratings.net (2026-06-11); FIFA squad announcement (2026-05-20); olympics.com Switzerland squad list; FOX Sports Canada squad analysis (2026-06).

## 4. Key Factors

1. **Canada's injury wave (favors Switzerland):** starting CB Bombito (broken leg, Oct 2025) reportedly removed from the roster; Flores withdrew injured May 31, replaced by Nelson June 9; midfielder Koné left training with a fever. Sources: SI (2026-06), Daily Hive (2026-06-10).
2. **Davies doubtful but trending up (neutral, slight Swiss lean):** ACL tear in March 2025 followed by two hamstring setbacks; unlikely for the opener, but returned to group training June 10 with a ~2-week window before this matchday-3 fixture. Sources: ESPN, Daily Hive (2026-06).
3. **Switzerland near full strength (favors Switzerland):** 26-man squad named May 20 with no major fitness disputes; Yakin backs the experienced Xhaka/Akanji/Embolo spine; 4-1 friendly win over Jordan May 31. Sources: FIFA (2026-05-20), UEFA.com.
4. **Canada's home stage and historic stakes (favors Canada):** played at BC Place, Vancouver, on Group B's final matchday — likely deciding the group winner; Canada chasing their first-ever World Cup knockout berth. Sources: Wikipedia Group B, FIFA Match Centre, Destination Vancouver.
5. **Jonathan David fully fit (favors Canada):** recovered from hip injury, completed his debut Juventus season (8 goals, 5 assists), no new injury reports. Source: FOX Sports (2026-06).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, +100 host bonus for Canada's group match):** Switzerland 37.4% / Draw 25.9% / Canada 36.7%.
- **Evidence adjustment (7pp total, bound ±8pp):** Switzerland +3.0pp, Draw +0.5pp, Canada −3.5pp. Rationale: Canada's multiple injuries/doubts (factors 1-2) vs a healthy Swiss squad (factor 3); not maxed out because Davies has a recovery window, David is fit, and home advantage is already in the model.
- **p_final (renormalized):** Switzerland 40.4% / Draw 26.4% / Canada 33.2%.
- **Market-blind:** this forecast is fully independent of any betting market, odds, or prediction-market price; it relies solely on the Elo statistical model and cited public news.

## 6. Method

Elo from eloratings.net (archived 2026-06-11 in `elo-table.json`); three-way probabilities via the Davidson model (piA=10^(R/400), draw parameter ν=0.7); +100 Elo host bonus for host nations (Mexico/USA/Canada) in group matches. The 80% intervals reflect parameter sensitivity (ν 0.6-0.8 moves Switzerland's win probability 36.0%-38.8%; host bonus ±35 moves it 33.7%-41.1%) plus lineup uncertainty 13 days out. Evidence adjustment capped at ±8pp; thin evidence means small or zero delta.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11)
2. ESPN — Davies named to squad amid injury concerns (2026-06): espn.com/soccer/story/_/id/48914937
3. SI — Canada loses star player to injury on eve of World Cup (Bombito) (2026-06): si.com/soccer/canada-loses-star-player-injury-eve-2026-world-cup
4. SI — Canada names injury replacement (Flores out, Nelson in) (2026-06-09): si.com/soccer/canada-names-injury-replacement-before-world-cup-opener
5. Daily Hive — Canada injury updates: Davies back in training, Koné fever (2026-06-10): dailyhive.com/vancouver/canada-injury-updates-fifa-world-cup-opener
6. FOX Sports — Winners/losers from Canada's squad, David's recovery (2026-06): foxsports.com/stories/soccer/winners-and-losers-from-canadas-world-cup-squad
7. FIFA — Switzerland squad announcement (2026-05-20): fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/switzerland-squad-announcement-murat-yakin
8. olympics.com — Switzerland full squad list and key stats (2026-05/06): olympics.com/en/news/fifa-world-cup-2026-switzerland-players-squad-list-key-stats-schedule
9. Wikipedia — 2026 FIFA World Cup Group B (schedule/venue): en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_B

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
