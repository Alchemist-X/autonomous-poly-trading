# 2026 FIFA World Cup — Group C Winner Forecast (Brazil / Morocco / Scotland / Haiti)

- Prediction ID: `group-winner:c` | Generated: 2026-06-11T13:15:00Z
- Scope: **fully independent of any betting/prediction market (market-blind)**. Probabilities come solely from an Elo Monte Carlo statistical model plus a bounded, evidence-cited adjustment.

## 1. Conclusion

| Team | Model baseline | Adjusted probability |
| --- | --- | --- |
| Brazil | 72.8% | **70.8%** |
| Morocco | 16.9% | **16.9%** |
| Scotland | 10.1% | **12.1%** |
| Haiti | 0.3% | **0.3%** |

**One-sentence view:** Brazil's commanding Elo lead (1991 vs Morocco's 1827) gives them roughly a 70% chance of topping Group C, but with Rodrygo, Estevao and Wesley out and Neymar doubtful for the opener, Morocco and a fully fit Scotland together retain about a 30% chance of an upset.

## 2. Question definition

"Group C winner" = the team finishing **1st in the final Group C standings** after the 2026 FIFA World Cup group stage. Ranking criteria in order: points → goal difference → goals scored → head-to-head record → fair play points → drawing of lots.

Group fixtures (UTC): 06-13 Brazil vs Morocco, Haiti vs Scotland; 06-19 Scotland vs Morocco, Brazil vs Haiti; 06-24 Morocco vs Haiti, Scotland vs Brazil (final round played simultaneously).

## 3. Team notes (Elo / form / schedule only)

- **Brazil** (Elo 1991, world #5): a 164-point Elo lead over the second-ranked side in the group, with all three opponents clearly weaker; the 06-13 opener against Morocco effectively decides the race if Brazil win it. The concern is squad disruption: Rodrygo (ACL) out long-term, Estevao injured, right-back Wesley withdrawn pre-tournament and replaced, and 34-year-old Neymar's mid-May calf injury leaves his opener in doubt.
- **Morocco** (Elo 1827, #24): led by Achraf Hakimi and Brahim Diaz, the most credible challenger to Brazil; but centre-back Nayef Aguerd and winger Abde Ezzalzouli withdrew injured days before the opener and first-choice striker Youssef En-Nesyri was left out, so Morocco's own losses roughly cancel the relative gain from Brazil's injuries. Their group-winner chance hinges heavily on the opening match.
- **Scotland** (Elo 1782, #26): only 45 Elo points behind Morocco and, as of writing, with no major reported absences — a fully fit squad. Beating Morocco on 06-19 and taking points off Brazil in the final round would make first place realistic. The +2pp upgrade reflects the relative shift of "both rivals depleted, Scotland intact".
- **Haiti** (Elo 1548, #73): far adrift on Elo; the pure model gives just a 0.3% group-winner probability, requiring an extreme chain of upsets. Kept at baseline.

## 4. Method

1. **Statistical baseline**: 100,000 full-tournament pure-Elo Poisson Monte Carlo simulations (seed 20260611, eloratings.net snapshot of 2026-06-11). Match goals are independent Poissons with lambda = 2.6 x the Elo logistic expectancy; group ranking uses points → goal difference → goals scored → head-to-head mini-table among tied teams → random draw; the host Elo bonus applies only to host-nation group matches and is irrelevant to Group C; **no market input of any kind**. Baseline: Brazil 72.75% / Morocco 16.89% / Scotland 10.07% / Haiti 0.30%.
2. **Bounded evidence adjustment** (max ±4pp absolute per team, renormalized to 1): Brazil −2pp (multiple squad absences plus Neymar doubt — pure Elo cannot see player availability); Morocco 0 (its own three losses roughly offset the gain from Brazil's weakening); Scotland +2pp (the only contender with no reported absences); Haiti unchanged. The adjustment is a zero-sum transfer, so the four probabilities still sum to 1.

## Sources

1. eloratings.net World Football Elo Ratings snapshot (Elo ratings and ranks) — https://www.eloratings.net/World.tsv (2026-06-11)
2. FIFA.com: Brazil 26-man squad announcement — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/brazil-squad-announcement-carlo-ancelotti (accessed 2026-06-11)
3. beIN SPORTS: Wesley injured, Atalanta midfielder Ederson called up as replacement — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/wesley-suffers-injury-as-brazil-names-replacement-for-fifa-world-cup-squad-2026-06-07 (2026-06-07)
4. ESPN 2026 World Cup injuries tracker (Rodrygo ACL out; Neymar calf, up to three weeks from May 28; Estevao out) — https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info (accessed 2026-06-11)
5. ESPN: Hakimi and Brahim Diaz headline Morocco squad; En-Nesyri out — https://www.espn.com/espn/story/_/id/48883710/achraf-hakimi-brahim-diaz-headline-morocco-squad-fifa-world-cup-youssef-en-nesyri-out (accessed 2026-06-11)
6. GHANAsoccernet: Aguerd and Ezzalzouli withdraw from Morocco squad shortly before the tournament — https://ghanasoccernet.com/2026-world-cup-morocco-suffer-double-injury-blow-as-nayef-aguerd-and-abde-ezzalzouli-withdraw-from-squad (accessed 2026-06-11)
7. Goal.com: 2026 World Cup Group C Morocco guide (fixtures and group) — https://www.goal.com/en/world-cup-teams/group-c/world-cup-2026-guide-morocco/O~blt4970f3f09e30e066 (accessed 2026-06-11)

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
