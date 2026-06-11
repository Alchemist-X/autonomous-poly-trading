# World Cup Group-Stage Forecast: Portugal vs Uzbekistan (Group K, 2026-06-23)

> Market-blind report: this forecast is fully independent of any betting market, odds, or prediction-market data. It is based solely on a statistical model plus publicly sourced news evidence.
> Generated: 2026-06-11 (12 days before kickoff; neither team has played its opening group match yet)

## 1. Forecast Summary

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Portugal win | **68.0%** | 60% – 74% | Medium |
| Draw | **19.5%** | 15% – 25% | Medium |
| Uzbekistan win | **12.5%** | 8% – 18% | Medium |

**One-sentence view:** Portugal hold a clear edge in strength, form, and tournament experience — the model gives roughly a 68% win probability; World Cup debutants Uzbekistan are more likely to grind out a draw defensively than to win outright.

## 2. Definition

- Subject: Group K Match 47, Portugal vs Uzbekistan, 2026-06-23 17:00 UTC (local noon, Houston).
- Three-way result settled on **90 minutes of regulation** (plus stoppage time); no extra time or penalties in the group stage.
- Resolution metadata: event slug `fifwc-prt-uzb-2026-06-23` (identifier only; no prices referenced).

## 3. Strength Profile

| Metric | Portugal | Uzbekistan |
| --- | --- | --- |
| Elo (repo elo-table.json snapshot, source eloratings.net) | 1989 (rank 6) | 1714 (rank 42) |
| Pedigree | Reigning UEFA Nations League champions (June 2025: beat Spain on penalties in the final, Germany 2-1 in the semi) | **First-ever World Cup** (one of four debutants this edition) |
| Recent form | 3 wins in last 5, 13 goals scored, 4 conceded; 2-1 friendly win over Nigeria in June | Cannavaro named his 26-man squad on June 2; 15 of 26 play in the domestic league |
| Key players | Cristiano Ronaldo (named May 19, record 6th World Cup, captain), Bruno Fernandes, Rafael Leao | Eldor Shomurodov (captain, 44 international goals), Abdukodir Khusanov (Man City CB), Abbosbek Fayzullaev |

Sources: FIFA (2026-05-19), Al Jazeera (2026-06-08), beIN Sports (2026-06-02), Olympics.com (2026-06).

## 4. Key Factors

1. **275-point Elo gap**: 1989 vs 1714; the neutral-venue Davidson model alone yields about a 65.7% baseline win probability for Portugal (elo-table.json snapshot, source eloratings.net, 2026-06).
2. **Ronaldo fit and named**: he missed March friendlies with a hamstring strain (Plataforma Media, 2026-03-25), but was named captain in the May 19 squad and is expected to start in Houston (FIFA, 2026-05-19).
3. **Portugal in strong form**: reigning Nations League champions; 3 wins in last 5 with 13 goals; 2-1 over Nigeria in their June send-off friendly (Al Jazeera 2026-06-08; Outlook India 2026-06).
4. **Uzbekistan defensive concern**: their standout player, Man City centre-back Khusanov, has had injury-curtailed minutes this season, raising match-sharpness doubts (beIN Sports, 2026-06-02).
5. **Debutant inexperience**: Uzbekistan are at their first World Cup, with 15 of 26 squad members playing domestically — limited top-level tournament exposure (FIFA team profile 2026; beIN Sports 2026-06-02).
6. **Venue factor neutralized**: NRG Stadium has a retractable roof and full air conditioning; June noon kickoffs are expected to be played roof-closed in controlled conditions, so Houston heat is not an adjustment factor (Football Ground Guide, 2026-06).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus — neither team is a host nation):
  Portugal 65.7% / Draw 20.8% / Uzbekistan 13.5%.
- **Evidence-based delta (total +2.3pp, well under the +/-8pp cap)**: Portugal +2.3pp, Draw -1.3pp, Uzbekistan -1.0pp.
  Rationale: Portugal at full strength and in form (factors 2, 3) combined with Uzbekistan's key-defender sharpness doubts and debutant inexperience (factors 4, 5); however, the Elo gap already captures most of the strength difference and Uzbekistan's opener (June 18 vs Colombia) has not been played, so evidence is thin and the shift is kept small.
- **p_final (renormalized)**: Portugal **68.0%** / Draw **19.5%** / Uzbekistan **12.5%**.
- **Interval basis**: sweeping drawNu over 0.6-0.8 moves each leg 2-4pp; +/-50 Elo on Portugal moves the win leg between 61% and 70%; adding 12-days-out lineup/opening-result uncertainty yields the 80% intervals above. No host-bonus parameter applies to this fixture, so no +/-35 bonus sensitivity term.
- **Market-blind**: no betting odds or prediction-market prices were read or referenced at any point; p_final is the published number.

## 6. Method and Sources

Method: take the eloratings.net Elo snapshot as input; derive baseline probabilities with the Davidson three-way model (identical to eloToOneXTwo in the repo's `packages/sports-model/src/elo.ts`); apply a bounded (max +/-8pp) adjustment from sourced news evidence as of 2026-06-11 and renormalize; 80% intervals reflect parameter sensitivity and evidence thinness.

Sources:
1. FIFA — Portugal squad announcement (2026-05-19): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cristiano-ronaldo-roberto-martinez-portugal-squad-announcement
2. beIN Sports — Uzbekistan World Cup guide (2026-06-02): https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/uzbekistan-at-the-2026-fifa-world-cup-squad-schedule-and-everything-you-need-to-know-2026-06-02
3. Al Jazeera — Portugal World Cup preview (2026-06-08): https://www.aljazeera.com/sports/2026/6/8/portugal-world-cup-2026-preview-players-to-watch-group-matches-and-squad
4. Plataforma Media — Ronaldo muscle injury (2026-03-25): https://www.plataformamedia.com/en/2026/03/25/ronaldo-portugal-muscle-injury-world-cup-2026/
5. FIFA — Uzbekistan team profile and history (2026): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/uzbekistan-team-profile-history
6. Football Ground Guide — air-conditioned 2026 World Cup stadiums (2026-06): https://footballgroundguide.com/news/which-2026-world-cup-stadiums-have-air-conditioning.html
7. Outlook India — Portugal 2-1 Nigeria friendly (2026-06): https://www.outlookindia.com/sports/football/portugal-vs-nigeria-live-score-international-friendly-2026-updates-highlights-leiria
8. eloratings.net Elo snapshot (via repo runtime-artifacts/world-cup/elo-table.json, 2026-06)

Disclaimer: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
