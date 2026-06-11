# 2026 World Cup Group D Winner Forecast (USA · Türkiye · Paraguay · Australia)

Generated: 2026-06-11T13:15:00Z | Prediction ID: `group-winner:d` | This report is 100% independent of any betting/prediction-market data

## 1. Conclusion

| Team | Model baseline | Adjusted probability |
|---|---|---|
| Türkiye | 49.2% | **50.4%** |
| Paraguay | 21.4% | **21.9%** |
| USA | 19.5% | **17.5%** |
| Australia | 9.9% | **10.2%** |

**One-sentence view:** Türkiye, holding the group's highest Elo, has roughly a 50% chance of topping Group D; hosts USA enjoy home advantage but the injury absences of Cardoso and Agyemang tighten their race with Paraguay for second.

## 2. Definition

"Group D winner" = 1st place in the final FIFA group-stage standings. Official ranking criteria in order: points → goal difference → goals scored → head-to-head record among tied teams → fair-play points (cards) → drawing of lots.

## 3. Team Notes (Elo, form and schedule only — no market information)

- **Türkiye (Elo 1911, world #13)**: Highest Elo in the group, 77 points above second-ranked Paraguay; the 26-man squad led by Güler and Yıldız was announced on June 2 with no major injury news. The final matchday away game vs USA at SoFi on June 25 is the biggest variable in the race for first.
- **Paraguay (Elo 1834, world #22)**: Second strongest on paper, a defensively solid side; a result in the June 12 opener vs USA (SoFi) would materially lift their group-winner probability.
- **USA (Elo 1726, world #39)**: All three group games on home soil (Los Angeles x2, Seattle x1); the model already applies a +100 Elo host bonus in group play (effective 1826). However, starting midfielder Johnny Cardoso and forward Patrick Agyemang miss the World Cup through injury, and Richards carries a foot concern, so we shade the baseline down by 2pp.
- **Australia (Elo 1777, world #28)**: Raw Elo actually above the USA's; a physical side with limited attacking ceiling. Winning the group would require at least 4 points from the direct meetings with Türkiye and the USA — lowest probability, but not negligible.

## 4. Method

1. **Statistical baseline**: Pure-Elo Poisson Monte Carlo, 100,000 full-tournament simulations (seed 20260611), Elo from the eloratings.net snapshot of 2026-06-11, no market input of any kind. Goals are independent Poissons with lambdas splitting a 2.6-goal baseline by the Elo win expectancy; hosts Mexico, USA and Canada receive +100 Elo in group matches only. Group ranking follows points → goal difference → goals scored → head-to-head among tied teams → random draw (fair play approximated by randomness).
2. **Bounded adjustment**: At most ±4pp per team, only with cited evidence. A single adjustment here: USA −2pp for the confirmed injury absences of Cardoso and Agyemang (source 2); the other three teams are renormalized in proportion to their baselines so the total sums to 1. No injury evidence rose to the adjustment threshold for Türkiye, Paraguay or Australia, so they stay at baseline.
3. **Confidence tier**: Medium. The group winner hinges on three matchdays and goal-difference details; the model is sensitive to single-match variance.

## Sources

1. eloratings.net World Football Elo Ratings (snapshot 2026-06-11) — https://www.eloratings.net/
2. ESPN: USMNT names 2026 World Cup roster; Cardoso and Agyemang out injured; Group D schedule (6/12 vs Paraguay at SoFi, 6/19 vs Australia in Seattle, 6/25 vs Türkiye at SoFi) (2026-06-09) — https://www.espn.com/soccer/story/_/id/48882389/usa-2026-world-cup-roster-christian-pulisic-squad-mckennie-adams
3. CBS Sports: Pochettino announces roster, Reyna in, Luna out (2026-06-09) — https://www.cbssports.com/soccer/news/usmnt-world-cup-roster-2026-live-updates-squad-announcement/live/
4. FIFA.com: Güler and Yıldız take centre stage in Türkiye squad (2026-05-18) — https://www.fifa.com/en/articles/turkiye-preliminary-world-cup-squad-announced
5. Daily Sabah: Türkiye unveil final 26-player squad (2026-06-02) — https://www.dailysabah.com/sports/football/turkiye-unveil-26-player-squad-for-historic-2026-world-cup-return

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
