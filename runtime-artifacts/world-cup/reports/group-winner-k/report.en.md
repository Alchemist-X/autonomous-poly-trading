# 2026 World Cup Group K Winner Forecast

> Generated: 2026-06-11 | Market-blind: this report uses no betting or prediction-market data
> 中文版：[report.md](report.md)

## 1. Conclusion

| Team | Probability | Elo (2026-06-11) | World rank |
| --- | --- | --- | --- |
| Portugal | **50.2%** | 1989 | #6 |
| Colombia | 47.1% | 1982 | #7 |
| Uzbekistan | 2.0% | 1714 | #42 |
| Congo DR | 0.7% | 1652 | #55 |

**One-sentence view:** Portugal and Colombia are separated by just 7 Elo points (1989 vs 1982), making the group-winner race a near coin-flip with both squads at full strength — Ronaldo is fit and in the squad, and Colombia's James-and-Diaz-led roster is intact — so first place will most likely come down to their head-to-head meeting in Miami; Uzbekistan and DR Congo are long shots for top spot.

## 2. Definition

"Group K winner" means first place in the final FIFA group-stage standings, ranked by: points → goal difference → goals scored → head-to-head record → fair-play points → drawing of lots. This forecast corresponds to event `world-cup-group-k-winner` (referenced as resolution metadata only).

## 3. Team notes (Elo / form / schedule only)

- **Portugal**: Elo 1989 (world #6), the group's nominal top side but by the thinnest of margins. Ronaldo (41) has fully recovered from his March muscle injury, was named in Roberto Martinez's World Cup squad on 19 May, and started the 10 June friendly against Nigeria ahead of his sixth World Cup; the supporting cast (Bruno Fernandes, Leao, etc.) plays at a higher club level overall. Friendly schedule: they open against DR Congo in Houston on 17 June, banking points before the big clash.
- **Colombia**: Elo 1982 (world #7), effectively level with Portugal. Nestor Lorenzo's 26-man squad is headlined by James Rodriguez and Luis Diaz (Bayern, the team's top scorer); James had only a minor knock in camp and is fully recovered — no material absences. They face Uzbekistan in Mexico City and DR Congo in Guadalajara — high-altitude venues familiar to a side used to Bogota — with the decisive meeting against Portugal staged in Miami.
- **Uzbekistan**: Elo 1714 (#42), a World Cup debutant after a solid Asian qualifying campaign; but the gap to both group heavyweights exceeds 260 Elo points, and a path to first place requires upsetting at least one of them — just 2.0% of simulations. Fighting for a third-place berth is the more realistic target.
- **Congo DR**: Elo 1652 (#55), qualified via the play-offs and carries the group's lowest rating; opening against Portugal compounds an already difficult draw — under 1% to top the group.

## 4. Method

1. **Statistical baseline**: pure-Elo Poisson Monte Carlo, 100,000 full-tournament simulations (seed 20260611), Elo from the eloratings.net snapshot of 2026-06-11; goals are independent Poissons (the Elo expectancy splits a 2.6-goal baseline), group ranking by points → goal difference → goals scored → head-to-head mini-table → drawing of lots, with no market input of any kind. Baseline: Portugal 50.2% / Colombia 47.1% / Uzbekistan 2.0% / Congo DR 0.7%.
2. **Bounded evidence adjustment (cap ±4pp per team)**: **0pp this run** — two targeted searches (Portugal and Colombia availability) found no material pre-tournament absences: Ronaldo is fit and started the final friendly, James's minor knock has cleared and Colombia's squad is intact, so no evidence justifies tilting either way. Final probabilities = baseline.
3. **Confidence: low** — the top two are a near coin-flip, so the point call on "who wins the group" is highly uncertain; the structure "Portugal and Colombia far above the other two" is, however, very robust.

## Sources

1. eloratings.net World.tsv snapshot (2026-06-11) — Elo ratings and ranks (https://www.eloratings.net/World.tsv)
2. FIFA.com: Ronaldo set for sixth World Cup as Portugal squad named (2026-05-19): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cristiano-ronaldo-roberto-martinez-portugal-squad-announcement
3. World Soccer Talk: Confirmed lineups for Portugal vs Nigeria pre-World Cup friendly, Ronaldo starts (2026-06-10): https://worldsoccertalk.com/news/is-cristiano-ronaldo-playing-today-predicted-lineups-for-portugal-vs-nigeria-in-pre-world-cup-2026-international-friendly/
4. FIFA.com: Diaz and James headline Colombia squad (2026-06): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/colombia-squad-announced
5. ESPN: James Rodriguez, Luis Diaz lead Colombia World Cup squad; James's minor knock cleared (2026-06): https://www.espn.com/soccer/story/_/id/48873914/james-rodriguez-luis-diaz-colombia-world-cup-squad

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
