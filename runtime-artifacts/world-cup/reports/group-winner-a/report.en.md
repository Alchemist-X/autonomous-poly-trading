# 2026 World Cup Group A Winner Forecast

- **Question**: Which team finishes first in the final Group A standings? (Mexico / South Korea / Czechia / South Africa)
- **Settlement event slug (resolution metadata only)**: `world-cup-group-a-winner`
- **Generated**: 2026-06-11T13:15:00Z (before Group A's opening match)
- **Market-blind statement**: This forecast is fully independent of any betting odds or prediction markets — no market data of any kind was fetched or consulted. Probabilities come solely from the Elo/Monte-Carlo statistical model plus a bounded, evidence-based adjustment.
- Chinese original: [`report.md`](report.md); machine-readable output: [`prediction.json`](prediction.json)

## 1. Conclusion

| Team | Statistical baseline | Bounded adjustment | **Final probability** |
| --- | --- | --- | --- |
| **Mexico** | 78.9% | −2.0pp | **76.9%** |
| **South Korea** | 11.5% | +1.0pp | **12.5%** |
| **Czechia** | 9.3% | +1.0pp | **10.3%** |
| **South Africa** | 0.3% | 0 | **0.3%** |

**One-sentence view**: With all three group games on home altitude soil and a clear lead in both Elo and current form, Mexico wins Group A about 77% of the time; the gap between South Korea (~12.5%) and Czechia (~10.3%) is smaller than one match's randomness, and South Africa retains only a mathematical chance.

Confidence tier: **Medium** — high confidence in direction (all evidence points to a large Mexico lead), medium in magnitude (first place depends on the joint outcome of three matches; one upset or a chain of draws reshapes the table).

## 2. Definition and settlement

- **What is forecast**: the team in first place of the official final FIFA Group A standings after all 3 rounds.
- **Ranking criteria** (in order): points → goal difference → goals scored → head-to-head record → fair play points → drawing of lots.
- The four outcomes are mutually exclusive and exhaustive; probabilities sum to 1. Group A concludes around 2026-06-24/25, after which the question settles.

## 3. Team notes (Elo / form / schedule)

- **Mexico** (Elo 1875, world #18): unbeaten in 8 friendlies in 2026 with only 2 goals conceded, closing with a 5-1 win over Serbia (Sports Mole, 2026-06-10); all three group games are played in Mexico (Estadio Azteca ×2, Guadalajara ×1), all at 1,500–2,240 m altitude. Caveats: a 6-match winless run to close 2025, and hosts historically start tournaments cautiously.
- **South Korea** (Elo 1758, world #33): in the 26-man squad named on May 16, Son Heung-min captains his fourth World Cup, with Kim Min-jae and Lee Kang-in both included (ESPN / FIFA, 2026-05-16); key midfielder Hwang In-beom carrying an ankle problem is the main concern. All three games are in Mexico (Guadalajara ×2, Monterrey), and the opener vs Czechia is effectively a near-neutral venue (Olympics.com, accessed 2026-06-11).
- **Czechia** (Elo 1740, world #35): qualified via the March European play-offs (UEFA.com, accessed 2026-06-11); Koubek replaced Hasek as coach in December 2025 (FourFourTwo, accessed 2026-06-11); Schick is fit to lead the line and Hlozek is back from long-term injury (FIFA, 2026-05), so squad completeness is better than the 2025 trough absorbed in the Elo. Toughest schedule of the four: the final round is away to Mexico at the Azteca (Squawka, accessed 2026-06-11).
- **South Africa** (Elo 1517, world #80): winless in 2026 (0W-3D-2L, 3 goals scored; afrik-foot, 2026-06-07), with Elo gaps of 220+ points to all three group rivals; first place would require multiple stacked upsets — the model gives 0.3%.

## 4. Method

**Step 1: Statistical baseline (Monte Carlo)**. 100,000 full-tournament pure-Elo Poisson Monte Carlo simulations (seed 20260611), ratings from the eloratings.net snapshot of 2026-06-11, with no market input of any kind. Match goals are independent Poissons: lambda = 2.6 × the Elo logistic expectancy (the 10^(Elo/400) win expectancy splits a 2.6-goal baseline); host Mexico receives +100 Elo in group matches only. Group ranking uses points → goal difference → goals scored → head-to-head mini-table among fully tied teams → random draw. Group A baseline: Mexico 78.9% / South Korea 11.5% / Czechia 9.3% / South Africa 0.3%.

**Step 2: Bounded evidence adjustment (≤ ±4pp per team, citations required)**:

| Team | Adjustment | Rationale |
| --- | --- | --- |
| Mexico | −2.0pp | Pure Elo-Poisson structurally underestimates draws: the historical host-opener draw base rate is ~26% (Sofascore, 2026-06-11) vs ~15% from this repo's Elo model for yesterday's opener (see `../fifwc-mex-rsa-2026-06-11/report.en.md`); more draws disproportionately erode the favourite's first-place probability. Compounded by the 6-match winless run that closed 2025 (Sports Mole, 2026-06-10). |
| South Korea | +1.0pp | Attacking spine intact: Son Heung-min fit and leading, Kim Min-jae / Lee Kang-in included (ESPN/FIFA, 2026-05-16); the decisive head-to-head vs Czechia is at a near-neutral venue. Hwang In-beom's ankle caps a larger upgrade. |
| Czechia | +1.0pp | Schick fit and Hlozek recovered — a full-strength squad is stronger than the 2025 trough reflected in Elo 1740 (FIFA, 2026-05); the closing away game at the Azteca caps the upgrade. |
| South Africa | 0 | Winless in 2026 with a blunt attack (afrik-foot, 2026-06-07); no positive evidence supports an upgrade; the 0.3% baseline stands. |

Adjustments net to zero, so the final probabilities renormalize naturally: **Mexico 76.9% / South Korea 12.5% / Czechia 10.3% / South Africa 0.3%**. The largest single adjustment is 2pp, well inside the ±4pp bound.

**Limitations**: Elo carries no squad or tactical detail; the host bonus is a flat +100 without venue-altitude differentiation; the random tiebreak in the simulation approximates FIFA's full criteria (including fair play points).

## Sources

1. eloratings.net World Football Elo (snapshot 2026-06-11, `../../elo-table.json`): Mexico 1875 / South Korea 1758 / Czechia 1740 / South Africa 1517
2. https://www.espn.com/soccer/story/_/id/48788433/son-heung-min-south-korea-world-cup-squad-lee-kang-kim-min-jae (2026-05-16)
3. https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/korea-republic-world-cup-squad-hong-myungbo (2026-05-16)
4. https://www.olympics.com/en/news/fifa-world-cup-2026-republic-of-korea-all-players-full-squad-list-key-stats-schedule (accessed 2026-06-11)
5. https://www.fifa.com/en/articles/czechia-world-cup-squad-announced (2026-05)
6. https://www.fourfourtwo.com/team/czech-republic-world-cup-2026-squad (accessed 2026-06-11)
7. https://www.uefa.com/european-qualifiers/news/02a6-20d15945d06d-c1587a40d2a4-1000--czechia-at-the-world-cup-2026-squad-fixtures-group-and-hi/ (accessed 2026-06-11)
8. https://www.squawka.com/en/news/world-cup/czech-republic-world-cup-2026-fixtures-squad-analysis/ (accessed 2026-06-11)
9. https://www.sportsmole.co.uk/football/mexico/world-cup-2026/preview/mexico-vs-south-africa-prediction-team-news-lineups_598869.html (2026-06-10)
10. https://www.afrik-foot.com/en-za/bafanas-winless-run-continues (2026-06-07)
11. https://www.sofascore.com/news/every-world-cup-hosts-opening-match-what-history-says (2026-06-11)

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
