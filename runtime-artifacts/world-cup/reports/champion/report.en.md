# 2026 FIFA World Cup Champion Forecast (all 48 teams)

- **Question**: Which team wins the 2026 FIFA World Cup? (Decided by the 2026-07-19 final, including extra time and penalties)
- **Settlement event slug (resolution metadata only)**: `world-cup-winner`
- **Generated**: 2026-06-11T13:15:00Z (the day after the opener, before most teams' first matches)
- **Market-blind statement**: This forecast is fully independent of any betting odds or prediction markets — no market data of any kind was fetched or referenced; probabilities come solely from an Elo/Monte-Carlo statistical model plus a bounded, evidence-based adjustment.
- Chinese original: [`report.md`](report.md); machine-readable output: [`prediction.json`](prediction.json)

## 1. Most likely champions

**Top five: Spain 37.0%, Argentina 24.3%, France 13.7%, England 7.1%, Portugal 3.6%.**

**One-sentence view**: Spain leads at ~37% with Argentina ~24% and France ~14% — the top-four Elo tier (Spain/Argentina/France/England) combines for ~82%, while Brazil and the Netherlands take bounded downgrades for multiple key injuries.

Confidence tier: **Medium** — high directional confidence (the top-four Elo tier and the injury evidence both point to concentration at the top), with a caveat on magnitude: a pure-Elo model gives the top seed (Spain ~37%) more than the historical base rate for pre-tournament favourites (~20–25%), and a single rating system may understate injury, red-card and penalty randomness across a seven-match run.

## 2. Full 48-team probability table (descending)

| # | Team | Grp | Elo (world rank) | Statistical baseline | Adj. | **Final p** | One-line rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Spain** | H | 2157 (#1) | 37.8% | −4% | **37.0%** | Elo 2157, world No. 1 by 42 points; Group H (Uruguay/Saudi Arabia/Cape Verde) poses little exit risk; only concerns are managing Lamine Yamal's groin issue and Fermin Lopez's absence, hence a small trim. |
| 2 | **Argentina** | J | 2115 (#2) | 24.4% | −2% | **24.3%** | Defending champions, Elo 2115 world No. 2; soft Group J (Austria/Algeria/Jordan); Messi returned from his hamstring issue and scored vs Iceland, but Romero (knee) and Molina (thigh) carry knocks — tiny trim. |
| 3 | **France** | I | 2063 (#3) | 12.8% | +5% | **13.7%** | Elo 2063, world No. 3; Group I contains Norway/Senegal yet France win it 70% of the time; core squad healthy (only Ekitike missing) — small upgrade relative to injury-hit rivals. |
| 4 | **England** | L | 2024 (#4) | 6.6% | +5% | **7.1%** | Elo 2024, world No. 4; Group L has no heavyweight beyond Croatia; squad essentially intact (only Ben White out with a knee injury) — small upgrade. |
| 5 | **Portugal** | K | 1989 (#6) | 3.5% | — | **3.6%** | Elo 1989, world No. 6; the Group K top-spot duel with Colombia (50% vs 47%) decides their bracket path; no material injury news found — baseline kept. |
| 6 | **Colombia** | K | 1982 (#7) | 3.0% | +5% | **3.2%** | Elo 1982, world No. 7; full-strength core led by Luis Diaz and James Rodriguez; the Group K race with Portugal is a coin flip — small upgrade. |
| 7 | **Brazil** | C | 1991 (#5) | 3.3% | −15% | **2.9%** | Elo 1991, world No. 5, but Neymar's calf makes the opener doubtful while Rodrygo (ACL), Militao (surgery) and Estevao (hamstring) are all out — heavy attrition at both ends, downgraded 15%. |
| 8 | **Netherlands** | F | 1948 (#8) | 1.6% | −15% | **1.4%** | Elo 1948, world No. 8, but Timber (groin), Xavi Simons (knee), Schouten (knee) and De Ligt (back) are all out — the defensive and midfield spine is gutted, downgraded 15%. |
| 9 | **Ecuador** | E | 1938 (#9) | 1.1% | — | **1.2%** | Elo 1938, world No. 9 with an elite defensive record; the Group E top-spot race with Germany is nearly even (50% vs 47%); no negative news — baseline kept. |
| 10 | **Germany** | E | 1932 (#10) | 1.0% | −10% | **0.935%** | Elo 1932, world No. 10; Ter Stegen, Gnabry and Karl all out injured (Wirtz is in); no edge over Ecuador in Group E — downgraded 10%. |
| 11 | **Turkiye** | D | 1911 (#13) | 0.720% | — | **0.733%** | Elo 1911, world No. 13; favourite to win Group D (49%) with a genuine golden generation, but the rating gap shows once they meet elite sides deep in the bracket. |
| 12 | **Norway** | I | 1914 (#11) | 0.674% | — | **0.686%** | Elo 1914, world No. 11; Haaland-led attack is real, but topping Group I past France is hard (19% vs 70%), so most paths run through the tougher side as runners-up. |
| 13 | **Croatia** | L | 1912 (#12) | 0.618% | — | **0.629%** | Elo 1912, world No. 12; most likely Group L runner-up (28% to win it); deep tournament pedigree but an ageing core, and strong opponents can appear from the R32 onward. |
| 14 | **Belgium** | G | 1894 (#15) | 0.572% | — | **0.582%** | Elo 1894, world No. 15; strong favourite for Group G (68%) with a friendly early schedule, but win rates fall fast once 2000+ Elo sides appear from the QF up. |
| 15 | **Japan** | F | 1906 (#14) | 0.546% | — | **0.556%** | Elo 1906, world No. 14; chasing the Netherlands for Group F (39% vs 56%) — the Dutch injury wave indirectly improves Japan's group and bracket position. |
| 16 | **Switzerland** | B | 1891 (#17) | 0.457% | — | **0.465%** | Elo 1891, world No. 17; the Group B race with Canada is even (50% vs 48%); reliably solid, but lacks a title-level attacking ceiling. |
| 17 | **Uruguay** | H | 1892 (#16) | 0.386% | — | **0.393%** | Elo 1892, world No. 16; drawn with Spain in Group H, so the realistic route is the harder knockout path as runners-up — title probability suppressed by the draw. |
| 18 | **Mexico** | A | 1875 (#18) | 0.261% | — | **0.266%** | Host nation with all group games at home altitude venues (79% to win Group A), but at Elo 1875 (No. 18) survival probability decays quickly each knockout round. |
| 19 | **Senegal** | I | 1860 (#21) | 0.168% | — | **0.171%** | Elo 1860, world No. 21 and Africa's top-rated side; third favourite in Group I, needing to squeeze past Norway and France first. |
| 20 | **Paraguay** | D | 1834 (#22) | 0.075% | — | **0.076%** | Elo 1834, world No. 22; a decent chance to advance from Group D as a runner-up contender, but a limited ceiling once the knockouts begin. |
| 21 | **Morocco** | C | 1827 (#24) | 0.067% | — | **0.068%** | Elo 1827, world No. 24; the 2022 semi-final core remains and they are Group C runner-up favourites (17% to win it), with Brazil standing in the way of top spot. |
| 22 | **Austria** | J | 1830 (#23) | 0.052% | — | **0.053%** | Elo 1830, world No. 23; likeliest Group J runner-up with Argentina near-certain to top it — bracket position caps the upside. |
| 23 | **Canada** | B | 1788 (#25) | 0.036% | — | **0.037%** | Co-host with home group games (48% to win Group B), but Elo 1788 (No. 25) means elite opposition arrives early in the knockouts. |
| 24 | **Scotland** | C | 1782 (#26) | 0.013% | — | **0.013%** | Elo 1782, world No. 26; fighting Morocco for second in Group C — title probability is statistical tail only. |
| 25 | **Iran** | G | 1772 (#29) | 0.013% | — | **0.013%** | Elo 1772, world No. 29; a real Group G runner-up contender (22% to win it), but win rates vs top European/South American sides are low. |
| 26 | **South Korea** | A | 1758 (#33) | 0.0080% | — | **0.0081%** | Elo 1758, world No. 33; Son Heung-min leads his fourth World Cup and second place in Group A is live, but a deep run needs repeated upsets. |
| 27 | **Czechia** | A | 1740 (#35) | 0.0080% | — | **0.0081%** | Elo 1740, world No. 35; battling South Korea for second in Group A with a final-round trip to the Azteca — tail probability. |
| 28 | **Australia** | D | 1777 (#28) | 0.0080% | — | **0.0081%** | Elo 1777, world No. 28; third pick in Group D, and even if they advance the knockout ceiling is modest. |
| 29 | **Algeria** | J | 1772 (#29) | 0.0070% | — | **0.0071%** | Elo 1772, world No. 29; one of the Group J runner-up contenders, sitting on Argentina's side of the path. |
| 30 | **Panama** | L | 1730 (#38) | 0.0050% | — | **0.0051%** | Elo 1730, world No. 38; merely advancing past England/Croatia in Group L would be an upset — tail probability. |
| 31 | **USA** | D | 1726 (#39) | 0.0040% | — | **0.0041%** | Co-host with home group games, but at Elo 1726 (No. 39) they win Group D under 20% of the time and the model title probability is near zero. |
| 32 | **Sweden** | F | 1712 (#43) | 0.0010% | — | **0.0010%** | Elo 1712, world No. 43; third wheel in Group F — advancing would itself be a surprise. |
| 33 | **Egypt** | G | 1696 (#48) | 0.0010% | — | **0.0010%** | Elo 1696, world No. 48; Salah leads, but they trail Iran in the Group G runner-up race. |
| 34 | **Jordan** | J | 1680 (#52) | 0.0010% | — | **0.0010%** | Elo 1680, world No. 52; making up the numbers in Group J — mathematical tail. |
| 35 | **South Africa** | A | 1517 (#80) | ≈0% | — | **≈0%** | Elo 1517, world No. 80; weakest in Group A and winless in 2026 — never won in simulation. |
| 36 | **Bosnia-Herzegovina** | B | 1595 (#65) | ≈0% | — | **≈0%** | Elo 1595, world No. 65; about 2% to even win Group B — title probability rounds to zero. |
| 37 | **Qatar** | B | 1421 (#96) | ≈0% | — | **≈0%** | Elo 1421, among the lowest of all 48 teams; also-ran in Group B. |
| 38 | **Haiti** | C | 1548 (#73) | ≈0% | — | **≈0%** | Elo 1548, world No. 73; Group C tail. |
| 39 | **Ivory Coast** | E | 1695 (#49) | ≈0% | — | **≈0%** | Elo 1695, world No. 49; Group E third pick with upset potential, but title probability is ~0. |
| 40 | **Curaçao** | E | 1434 (#91) | ≈0% | — | **≈0%** | Elo 1434, world No. 91; one of the smallest nations ever at a World Cup — Group E tail. |
| 41 | **Tunisia** | F | 1628 (#58) | ≈0% | — | **≈0%** | Elo 1628, world No. 58; Group F tail. |
| 42 | **New Zealand** | G | 1562 (#72) | ≈0% | — | **≈0%** | Elo 1562, world No. 72; Group G tail. |
| 43 | **Saudi Arabia** | H | 1576 (#69) | ≈0% | — | **≈0%** | Elo 1576, world No. 69; sharing a group with Spain — tail. |
| 44 | **Cape Verde** | H | 1578 (#68) | ≈0% | — | **≈0%** | Elo 1578, world No. 68; historic debutants, Group H tail. |
| 45 | **Iraq** | I | 1607 (#63) | ≈0% | — | **≈0%** | Elo 1607, world No. 63; Group I tail. |
| 46 | **Uzbekistan** | K | 1714 (#42) | ≈0% | — | **≈0%** | Elo 1714, world No. 42; debutants who already face an uphill battle to escape Portugal and Colombia in Group K. |
| 47 | **Congo DR** | K | 1652 (#55) | ≈0% | — | **≈0%** | Elo 1652, world No. 55; miracle playoff qualifiers — Group K tail. |
| 48 | **Ghana** | L | 1510 (#81) | ≈0% | — | **≈0%** | Elo 1510, world No. 81, in the lowest Elo band of all 48; Group L tail. |

> "Adj." is a relative adjustment (capped at ±20%); the table is renormalized afterwards (factor ≈ +1.75%, so untouched teams end slightly above baseline). "≈0%" means zero titles in 100,000 simulations (< 0.001%).

## 3. Bracket-correlation caveat (important)

These are **marginal probabilities** — each team viewed in isolation. The 48 teams' fates are not independent: the knockout tree (official matches 73–104) makes **strong teams in the same half of the bracket heavily negatively correlated**:

- At most one of two giants in the same half can reach the final; if Spain exits early, the windfall accrues mainly to teams in Spain's half, not evenly to everyone.
- Winning a group vs finishing second routes a team to a different half (e.g. the Portugal/Colombia race in Group K, Germany/Ecuador in Group E), so group outcomes correlate strongly with downstream knockout probabilities.
- Do **not** multiply these marginals for joint events (e.g. "A and B both reach the semis"); joint probabilities must come from the match-level simulation itself.

## 4. Definition and settlement

- **What is forecast**: the team that wins the final on 2026-07-19 (US East) at MetLife Stadium, New Jersey, **including extra time and penalties** — i.e. lifts the trophy.
- The 48 outcomes are mutually exclusive and exhaustive; probabilities sum to 1.
- Settles when the final concludes (after any extra time/shootout).

## 5. Method

**Step 1 — statistical baseline (Monte Carlo)**. 100,000 full-tournament pure-Elo Poisson simulations (seed 20260611), ratings from the eloratings.net snapshot of 2026-06-11, with no market input of any kind. Match goals are independent Poissons: λ = 2.6 × the Elo logistic expectancy (the 10^(Elo/400) win expectancy splits a 2.6-goal baseline). Hosts Mexico, the United States and Canada get +100 Elo in group matches only (knockout venues vary). Group ranking: points → goal difference → goals scored → head-to-head mini-table among fully tied teams → random draw; the 8 best third-placed teams rank by points/GD/goals/random. The knockout tree is the official FIFA 2026 bracket (matches 73–104); third-place slotting approximates FIFA's combination table via deterministic bipartite matching (same-group R32 rematches impossible by construction). Drawn knockout matches after 90 Poisson minutes are resolved by a Bernoulli draw proportional to Elo expectancy (a stand-in for extra time and penalties).

**Step 2 — bounded evidence adjustment (≤ ±20% relative per team, cited, then renormalized)**:

| Team | Rel. adj. | Rationale (sources below) |
| --- | --- | --- |
| Brazil | −15% | Neymar's calf makes the opener doubtful (team doctor, May 28: up to 3 weeks out); Rodrygo (ACL), Militao (hamstring-tendon surgery) and Estevao (hamstring) all miss the tournament (ESPN/Goal/Flashscore) |
| Netherlands | −15% | Timber (groin, withdrew June 8), Xavi Simons (knee), Schouten (knee) and De Ligt (back) all out — the defensive spine is gutted (ESPN/karlobag) |
| Germany | −10% | Ter Stegen (thigh), Gnabry (thigh) and Karl (thigh) out; Wirtz is in (ESPN/karlobag) |
| Spain | −4% | Lamine Yamal's groin/hamstring still under load management (on schedule for the June 15 opener); Fermin Lopez out with a metatarsal fracture (UPI/Yahoo) |
| Argentina | −2% | Messi returned from his hamstring issue and scored vs Iceland, but Romero (knee) and Molina (thigh) carry knocks (UPI/Yahoo) |
| France | +5% | Core squad free of major injuries (only Ekitike missing) — relative gain vs injury-hit rivals (Sports Mole) |
| England | +5% | Squad essentially intact; only Ben White (knee) is out (Sports Mole/search results) |
| Colombia | +5% | Full-strength squad led by Luis Diaz and James Rodriguez per the June 2 list (FIFA) |
| Other 40 teams | 0 | No champion-probability-moving news found (only the top teams were checked — see limitations) |

The largest single adjustment is ±15%, inside the ±20% cap; the net is −1.7pp before renormalization, after which probabilities sum to 1 and per-team monotonicity p_champion ≤ p_sf ≤ p_qf holds.

**Limitations**: (i) pure Elo carries no squad-depth, tactical or managerial information — injuries are patched ex post within bounds; (ii) a single rating system may overrate the top seed (Spain's 37% exceeds historical favourite base rates); (iii) news checks covered only the top ~10 teams (4-search budget) — long-tail teams' absences were not individually verified, but their title probabilities are tail-level anyway; (iv) third-place slotting and extra-time/penalty handling are approximations.

## Sources

1. eloratings.net World Football Elo（2026-06-11 快照，本仓库 `../../elo-table.json`）— https://www.eloratings.net/
2. ESPN 2026 World Cup injuries tracker（廷贝尔/西蒙斯/德利赫特/斯豪滕、内马尔、特尔施特根/格纳布里等伤情）— https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info （2026-06-11 查阅）
3. UPI：Spain, Brazil, Argentina, U.S. injuries could factor into World Cup（亚马尔/梅西/罗梅罗/莫利纳伤情）— https://www.upi.com/Sports_News/Soccer/2026/06/10/World-Cup-injuries-Spain-Argentina-Iceland/4671780927848/ （2026-06-10）
4. Yahoo Sports：Spain, Brazil, Argentina, U.S. injuries could factor into World Cup — https://sports.yahoo.com/articles/spain-brazil-argentina-u-injuries-152522277.html （2026-06-10）
5. Sports Mole：World Cup 2026 injury list and return dates（Ekitike/Rodrygo/Xavi Simons 等）— https://www.sportsmole.co.uk/football/england/world-cup/feature/world-cup-injury-list-absent-players-and-doubts_597036.html （2026-06-11 查阅）
6. Goal.com：Cole Palmer, Rodrygo and the biggest stars who are missing from the 2026 World Cup（埃斯特旺/罗德里戈/米利唐等）— https://www.goal.com/en/lists/biggest-stars-miss-2026-world-cup-injury-suspension-selection/bltd6ff2d56ebf99a62 （2026-06-11 查阅）
7. Flashscore：Which star players are ruled out of the 2026 World Cup through injury? — https://www.flashscore.com/news/soccer-world-championship-the-major-names-who-will-miss-the-2026-world-cup-through-injury/MejPJJqJ/ （2026-06-11 查阅）
8. karlobag.eu：Injuries before the 2026 World Cup: Timber, Karl and Wesley ruled out（2026-06-08 廷贝尔退出）— https://karlobag.eu/en/sports/injuries-before-the-2026-world-cup-timber-karl-and-wesley-ruled-out-of-major-squ-cxafy/ （2026-06-11 查阅）
9. FIFA：Diaz and James headline Colombia squad（哥伦比亚满编名单）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/colombia-squad-announced （2026-06-02）
10. ESPN：2026 World Cup: Squad lists for all 48 teams（6 月 2 日 26 人名单截止）— https://www.espn.com/soccer/story/_/id/48757621/2026-world-cup-squad-lists-players-announced-all-48-teams （2026-06-11 查阅）

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
