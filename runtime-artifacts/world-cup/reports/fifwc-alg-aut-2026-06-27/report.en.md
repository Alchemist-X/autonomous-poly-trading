# Algeria vs Austria — 2026 World Cup Group J (Market-Blind Forecast)

- Match: 2026-06-27 (kickoff 2026-06-28T02:00:00Z UTC), Arrowhead Stadium, Kansas City (neutral venue)
- Event slug (resolution metadata only): `fifwc-alg-aut-2026-06-27`
- Generated: 2026-06-11 · Type: **market-blind forecast** (fully independent of any betting/prediction-market data)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Algeria win | **32.5%** | 26% – 39% | Medium |
| Draw | **26.2%** | 22% – 30% | Medium |
| Austria win | **41.3%** | 34% – 48% | Medium |

**One-line view:** Austria edge it on Elo, but losing Baumgartner to injury blunts their attack while Algeria arrive fresh off an away win over the Netherlands — no outcome is anywhere near certain.

## 2. Definition

Three-way result after 90 minutes (plus stoppage time): win / draw / loss. No extra time in the group stage.

## 3. Team Profiles

| | Algeria | Austria |
| --- | --- | --- |
| Elo (local elo-table.json from eloratings.net, 2026-06-11 snapshot) | 1772 (rank 29) | 1830 (rank 23) |
| Coach / system | Petković, expected 4-3-3 (Mahrez, Gouiri, Amoura front three) | Rangnick; Alaba back from injury as captain |
| Recent results | 1-0 away win vs Netherlands on Jun 3 (Hadj Moussa) | 1-0 vs Tunisia (Jun 1); 1-0 vs South Korea; 5-1 vs Ghana (March) |

Sources: Olympics.com Algeria preview (2026-06), Squawka Austria analysis (2026-06), heavy.com (2026-06-11), ESPN (2026-06-01).

## 4. Key Factors

1. **Austria's in-form attacker Christoph Baumgartner ruled out of the World Cup by injury** (13 Bundesliga goals, career-best season); Sabitzer expected to absorb his role — ANI News, 2026-06-02; roundtable.io, 2026-06.
2. **Algeria beat the Netherlands 1-0 away on Jun 3** — a strong pre-tournament form signal — heavy.com / africasoccer.com, 2026-06-11.
3. **Algeria midfield depleted**: Boudaoui out injured, Bennacer omitted from the squad; full-back depth thinned by injuries — heavy.com (2026-06-11), Dailysports (2026-05), Olympics.com (2026-06).
4. **Austria won all three warm-ups with clean sheets** (Tunisia 1-0, South Korea 1-0, Ghana 5-1); Alaba back from his knee injury — ESPN (2026-06-01), Squawka (2026-06).
5. **Final group-stage matchday, neutral venue**: 21:00 local kickoff in Kansas City (evening, limited heat impact); with Argentina in Group J, qualification stakes on matchday 3 may shape motivation but cannot be predicted now — AXS / Wikipedia (accessed 2026-06-11).
6. Head-to-head: only one prior World Cup meeting, Austria 2-0 in 1982 (weak signal) — Wikipedia (accessed 2026-06-11).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Algeria 31.0% / Draw 25.7% / Austria 43.3% (Elo gap −58).
- **Adjustment delta (4pp total, cap ±8pp)**: Algeria +1.5pp, Draw +0.5pp, Austria −2.0pp.
  Rationale: Baumgartner's absence is the single heaviest personnel loss on either side (factor 1), reinforced by Algeria's Netherlands win (factor 2); partially offset by Algeria's own midfield/full-back losses (factor 3) and Austria's overall warm-up record (factor 4), hence only a small shift.
- **p_final**: Algeria 32.5% / Draw 26.2% / Austria 41.3%.
- This is a **market-blind** forecast: no betting odds or prediction-market prices were fetched, read, or referenced at any point; probabilities come solely from the Elo statistical model plus the bounded, evidence-cited adjustment above.

## 6. Method, Sources, Disclaimer

**Method:** eloratings.net-style Elo (local snapshot) fed into a Davidson three-way model for p_stat; then a bounded (max ±8pp) adjustment justified only by dated, sourced team news, renormalized. The 80% intervals reflect drawNu 0.6–0.8 sensitivity (draw 22.8%–28.3%), roughly ±40 Elo rating uncertainty (about ±4pp on each win probability), and the thinness of evidence two weeks out.

**Sources:**
1. Local `runtime-artifacts/world-cup/elo-table.json` (eloratings.net snapshot, 2026-06-11)
2. https://www.aninews.in/news/sports/football/austrias-christoph-baumgartner-ruled-of-fifa-world-cup-due-to-injury20260602165204/ (2026-06-02)
3. https://www.espn.com/soccer/match/_/gameId/401856597/tunisia-austria (2026-06-01)
4. https://www.squawka.com/en/news/world-cup/austria-world-cup-2026-fixtures-squad-analysis/ (accessed 2026-06)
5. https://www.olympics.com/en/news/fifa-world-cup-2026-algeria-preview-full-squad-list-key-stats-schedule (accessed 2026-06)
6. https://dailysports.net/news/algeria-announce-2026-world-cup-squad-as-riyad-mahrez-returns-and-ismael-bennacer-misses-out/ (2026-05)
7. https://heavy.com/sports/soccer/how-to-watch-algeria-vs-bolivia-live-today-world-cup-warm-up-preview-stats-team-news/ (2026-06-11)
8. https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_J (accessed 2026-06-11)

**Disclaimer:** This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
