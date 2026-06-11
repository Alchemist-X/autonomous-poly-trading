# Austria vs Jordan — 2026 World Cup Group Stage, Group J (Market-Blind Forecast)

- Kickoff: 2026-06-17 04:00 UTC (Levi's Stadium, Santa Clara, California; evening of June 16 local time)
- Event slug (resolution metadata only): `fifwc-aut-jor-2026-06-17`
- Generated: 2026-06-11T13:15:00Z | Type: **market-blind** (fully independent of any odds/market prices)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Austria win | **0.55** | 0.48 – 0.62 | Medium |
| Draw | **0.24** | 0.19 – 0.29 | Medium |
| Jordan win | **0.21** | 0.15 – 0.27 | Medium |

**One-line view**: A 150-point Elo gap plus Jordan's winless, leaky five-match run gives Austria a clear ~55% edge, but Baumgartner's tournament-ending injury dents Austria's creativity and keeps Jordan's upset window ajar.

## 2. Definition

Three-way result after 90 minutes plus stoppage time (win / draw / loss). No extra time or penalties in the group stage; a draw stands as the final result.

## 3. Strength Profile

| | Austria | Jordan |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1830 (rank 23) | 1680 (rank 52) |
| Coach | Ralf Rangnick | Jamal Sellami (Morocco) |
| World Cup pedigree | First finals since 1998 | Tournament debut |
| Form | 26-man squad named May 18; captain Alaba back from injury (UEFA.com) | 0 wins in last 5 (2D 3L), 11 goals conceded (Goal.com preview) |

## 4. Key Factors

1. **Austria's key midfielder Christoph Baumgartner is out of the entire World Cup** with a proximal rectus femoris tendon injury in the hip; Rangnick has not yet named a replacement (roundtable.io, June 2026).
2. **Jordan are winless in five**: 0-2 vs Colombia on June 7, 1-4 vs Switzerland in late May, with 11 goals conceded across the run (Goal.com preview, June 2026). Note: these results are already partly baked into the latest Elo.
3. **Jordan striker Yazan Al-Naimat is out** (ACL, December 2025 Arab Cup); Ali Olwan, third-top scorer of AFC qualifying with 9 goals, returns from injury (Al Jazeera, 2026-06-06).
4. **Jordan's talisman Musa Al-Taamari (Rennes) is in strong form**: 7 goals and 11 assists in 36 Ligue 1 appearances, the main transition threat (Al Jazeera, 2026-06-06).
5. **Neutral venue**: Levi's Stadium (Santa Clara) — no host bonus for either side; Austria's Wöber and Lawal missed the squad through fitness (UEFA.com, May 2026).
6. **Stakes**: With Argentina and Algeria also in Group J, points in the opener matter for both sides' paths in the 48-team format (MLSSoccer.com Group J preview).

## 5. Model and Adjustment

- **p_stat** (three-way Davidson model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Austria 0.533 / draw 0.242 / Jordan 0.225 (Elo 1830 vs 1680).
- **Evidence-based adjustment (cap ±8pp; actual net move ~±2pp)**:
  - Jordan's defensive evidence is negative (11 conceded in 5, first-choice striker out) → Jordan −1.5pp;
  - Baumgartner's tournament-long absence partly offsets Austria's edge → Austria only +2pp (not larger);
  - Draw −0.5pp. The evidence cuts both ways, so the adjustment stays restrained.
- **p_final (renormalized)**: Austria 0.553 / draw 0.237 / Jordan 0.210 → published 0.55 / 0.24 / 0.21.
- **Market-blind**: no betting or prediction-market prices/odds were fetched, read, or referenced at any point; probabilities come solely from the Elo statistical model plus the bounded, sourced adjustment above.

## 6. Method

Starting from the eloratings.net snapshot of 2026-06-11, the Davidson three-way model (drawNu=0.7) maps the Elo gap to win/draw/loss probabilities; a bounded adjustment of at most ±8pp is then applied based on dated, sourced team news, followed by renormalization. The 80% intervals reflect drawNu parameter sensitivity (0.6–0.8), unconfirmed lineups, and the sample uncertainty of a tournament debutant.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11, elo-table.json)
2. Goal.com — Austria vs Jordan World Cup Preview (June 2026): https://www.goal.com/en/news/austria-jordan-world-cup-preview/blt7c1bb3d0f0243ac5
3. UEFA.com — Austria at the World Cup 2026 (May/June 2026): https://www.uefa.com/european-qualifiers/news/02a6-20d159406296-f54718194327-1000--austria-at-the-world-cup-2026-squad-fixtures-group-and-hi/
4. roundtable.io — Austria Faces World Cup Realigned by Baumgartner Injury (June 2026): https://roundtable.io/sports/soccer/bundesliga/rb-leipzig/austria-faces-world-cup-realigned-by-baumgartner-injury
5. Al Jazeera — Jordan World Cup 2026 preview (2026-06-06): https://www.aljazeera.com/sports/2026/6/6/jordan-world-cup-2026-preview-players-to-watch-group-matches-and-squad
6. Elbotola — Sellami names Jordan final squad (2026-06-02): https://m.elbotola.com/en/article/2026-06-02-09-43-150.html
7. FIFA Match Centre — Austria vs Jordan (venue/kickoff): https://www.fifa.com/en/match-centre/match/17/285023/289273/400021498

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
