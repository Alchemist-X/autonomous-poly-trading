# 2026 World Cup Group F Winner Forecast (Market-Blind)

- **Question**: Which of Netherlands, Japan, Sweden, Tunisia finishes first in Group F?
- **Settlement event slug (resolution metadata only)**: `world-cup-group-f-winner`
- **Generated**: 2026-06-11T13:15:00Z; Chinese original: [`report.md`](report.md); machine-readable: [`prediction.json`](prediction.json)
- This forecast is fully independent of any betting or prediction market; probabilities come solely from a statistical model plus a bounded evidence-based adjustment.

## 1. Conclusion

| Team | Model baseline p_stat | Adjusted p_adj | Delta |
| --- | --- | --- | --- |
| **Netherlands** | 55.91% | **54.41%** | −1.5pp |
| **Japan** | 39.10% | **38.10%** | −1.0pp |
| **Sweden** | 3.91% | **5.91%** | +2.0pp |
| **Tunisia** | 1.08% | **1.58%** | +0.5pp |

**One-sentence view**: Netherlands' Elo-No.8 strength base and deeper rotation make them roughly 54% to top Group F; Japan (~38%) lose attacking punch with Mitoma out of the whole tournament, and the June 14 head-to-head largely decides first place, with Sweden only an outside disruptor. Confidence tier: **Medium** (the NLD–JPN Elo gap is only 42 points and both favourites carry absences).

## 2. Definition and Settlement

- Target: the team finishing **first in the final Group F standings** at the 2026 FIFA World Cup.
- FIFA group tiebreakers, in order: points → goal difference → goals scored → head-to-head among tied teams → fair-play points → drawing of lots.
- Schedule: Jun 14 Netherlands vs Japan, Sweden vs Tunisia; Jun 20 Netherlands vs Sweden; Jun 21 Tunisia vs Japan; Jun 25 Japan vs Sweden, Tunisia vs Netherlands (per the official FIFA schedule).

## 3. Team Notes (Elo / form / schedule only)

- **Netherlands** (Elo 1948, rank 8): strongest side in the group, with a ≥236-point Elo edge over everyone but Japan. The concern is breadth of absences: Xavi Simons and Jerdy Schouten (both ACL) are out, Jurrien Timber withdrew with Geertruida called up (FIFA.com), keeper Bart Verbruggen is a doubt for the opener and Memphis Depay arrives managing a hamstring issue (ESPN). Depth should absorb it, but it narrows the edge over Japan.
- **Japan** (Elo 1906, rank 14): close enough to the Dutch to be a genuine contender for first; but top winger Kaoru Mitoma misses the entire tournament with a hamstring injury (Al Jazeera; coach Moriyasu called it "a huge blow") and Takumi Minamino is out with an ACL tear, removing their two most incisive attackers.
- **Sweden** (Elo 1712, rank 43): 194+ Elo points behind both favourites; topping the group requires upsets in the direct meetings plus a goal-difference edge. The favourites' simultaneous absences nudge this tail scenario up slightly, but it remains unlikely.
- **Tunisia** (Elo 1628, rank 58): lowest Elo in the group; would need multiple upsets to finish first — close to a lottery-grade event.

## 4. Method

1. **Statistical baseline**: 100,000 full-tournament pure-Elo Poisson Monte Carlo simulations (seed 20260611). Match goals are independent Poissons with the Elo logistic expectancy splitting a 2.6-goal baseline; hosts get +100 Elo in group matches only (no host in Group F, so no effect); group ranking uses points → goal difference → goals scored → head-to-head mini-table → random draw. Ratings from the eloratings.net snapshot of 2026-06-11. **No market input of any kind.**
2. **Bounded adjustment**: at most ±4pp per team, evidence-cited only. Applied: Netherlands −1.5pp (multiple absences plus keeper doubt), Japan −1.0pp (Mitoma and Minamino out for the tournament), Sweden +2.0pp / Tunisia +0.5pp (probability leakage from both weakened favourites); renormalized to sum to 1.

## Sources

1. eloratings.net World.tsv (Elo snapshot, retrieved 2026-06-11): https://www.eloratings.net/World.tsv
2. Al Jazeera, "Mitoma fails to make Japan's 2026 World Cup squad" (2026-05-15): https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury
3. ESPN, "Kaoru Mitoma ruled out of World Cup, Tomiyasu recalled" (2026-05-15): https://www.espn.com/soccer/story/_/id/48775615/kaoru-mitoma-ruled-world-cup-injury-takehiro-tomiyasu-recalled-japan-squad
4. FIFA.com, "Netherlands call up Geertruida after Jurrien Timber withdrawal" (retrieved 2026-06-11): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber
5. ESPN, "Netherlands keeper Verbruggen a doubt for World Cup opener" (retrieved 2026-06-11): https://www.espn.com/soccer/story/_/id/49022242/netherlands-bart-verbruggen-injury-2026-world-cup-japan
6. ESPN, "2026 World Cup injuries tracker" (retrieved 2026-06-11): https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
