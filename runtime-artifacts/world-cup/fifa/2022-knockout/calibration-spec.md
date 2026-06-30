# FIFA8 90-minute DRAW recalibration — derived from 2022 Qatar knockout data

**Date:** 2026-06-30  **Author:** analysis agent  **Status:** spec only (no engine code changed)  **Market-blind:** yes — only on-pitch FIFA stats + Elo priors read, no prices.

## Human review entry points (check these first)

1. **The recommended number:** `k = 0.283`, evenness weights `0.50 / 0.30 / 0.20` (closeness / low-scoring / defensive). Section 3.
2. **The 15-fixture before/after table** (eyeball the spotlight ties): Section 4.
3. **The honest caveat that changes the whole story:** all 5 of the 2022 draws went to extra time, which poisons `xgApprox` as a *level* signal — Section 1.3. This is why the calibration is a base-rate lift with a *mild* evenness tilt, not a strong conditional model.
4. **Exact field mapping** to `fifa8-store` / `TeamProfile` so this can be implemented without guessing names: Section 2.2.
5. **Source data:** `runtime-artifacts/world-cup/fifa/2022-knockout/team-match-stats.json` (32 rows = 16 ties × 2 perspectives).

---

## What problem this solves

The live FIFA8 R32 forecasts (headline = `multicalibrated` model) average a **90-minute draw probability of 22.7%**, and **no tie has a draw as its most-likely outcome** (verified across all 15 fixtures). Real WC knockouts sit at **~31% draws at 90'** (5/16 in 2022) with **~3.0 goals/match**, and the distribution is bimodal: lopsided ties become blowouts with many goals; even/defensive ties become low-scoring draws. The engine systematically under-weights the draw, most badly on the close ties. This spec recalibrates the 1X2 directly (the Elo/Davidson models have no goal matrix to touch), conditioned on how *even* each tie looks on-pitch.

---

## 1. 2022 knockout empirical findings (n = 16 ties, 90-minute basis)

Source: `team-match-stats.json`. Scores are end-of-90 (the extractor wrote post-ET page-1 scores; per the extraction report, two ties differ at 90' and are corrected here: **Croatia–Brazil 0-0** (written 1-1) and **Argentina–France 2-2** (written 3-3)). Both manifest corrections are draws either way, so the draw count is unaffected.

### 1.1 Headline base rates (reproduced exactly from the manifest)

| Metric | Value |
| --- | --- |
| 90-minute draw rate | **5 / 16 = 31.25%** |
| Goals per match (90') | **48 / 16 = 3.000** |
| Mean total goals, drawn ties | 2.00 |
| Mean total goals, decisive ties | 3.45 |

The 3.45-vs-2.00 split is the bimodality the brief describes: decisive ties carry the goals, drawn ties are low-scoring.

### 1.2 The five 90-minute draws

Morocco–Spain (0-0), Japan–Croatia (1-1), Netherlands–Argentina (2-2), Argentina–France (2-2), Croatia–Brazil (0-0). **All five went to extra time / penalties.** That is not a coincidence — a 90' draw *is* the definition of a tie that proceeds to ET. This fact drives the central caveat below.

### 1.3 CRITICAL caveat — the `xgApprox` "evenness" signal is an extra-time artifact

`xgApprox` here is **not real xG**. The 2022 FIFA template has no xG row, so the extractor used the documented Model-2 fallback `0.10·onTarget + 0.03·offTarget + 0.05·lineBreaks` (`xgReal` is null in all 16). More importantly, **the on-pitch stats for the 5 ET ties are full-match-including-extra-time** (total distance 142–148 km vs 106–118 km for the 90' ties — a clean tell). So a drawn tie accumulated ~33% more shots/line-breaks simply by playing 120 minutes.

Consequence: any **cumulative-level** stat is mechanically inflated for exactly the drawn ties. Concretely:

| Signal | Pearson corr with draw (n=16) | Why |
| --- | --- | --- |
| combined `xgApprox` (level) | **+0.624** | **Artifact** — drawn ties played 120', so they amassed more shots. Unusable for *predicting* a draw. |
| ET-membership indicator | **+1.000** | Tautology: all 5 draws are the 5 ET ties. |

Reading the +0.62 as "draws cluster in high-xG ties" would be exactly backwards. The real-world relationship ("draws are low-scoring") is the opposite; the data shows the reverse only because of the length confound. **We therefore do not fit weights on 2022 `xgApprox` levels.**

### 1.4 Length-robust signals (ratios / shares — unaffected by match length)

These are the only 2022 signals we can trust for conditioning, because a percentage doesn't grow just because the match is longer. They point in the theory-correct direction, but weakly at n=16 — report effect sizes, not p-values:

| Signal (combined or gap) | corr w/ draw | drawn mean | decisive mean | direction |
| --- | --- | --- | --- | --- |
| combined low-block % | **+0.378** | 44.6 | 38.0 | draws are more defensive ✓ |
| combined high-press % | −0.280 | 9.4 | 11.5 | draws press less ✓ |
| possession gap | −0.065 | 13.9 | 15.8 | draws marginally more balanced (essentially flat) |
| xG gap (within-match, less length-sensitive) | +0.199 | 1.68 | 1.27 | noisy / wrong-ish; do not use |

**Honest bottom line from 2022:** the robust, transferable fact is the **base rate (31% @90', 3.0 g/match)**. The *conditional* "which ties draw" is only weakly identifiable here, and only the **defensive posture (low-block, +0.38)** survives as a clean, theory-consistent on-pitch tilt. We therefore build the recalibration as a **base-rate draw lift with a mild evenness tilt**, with weights fixed from first principles + the robust signal signs — *not* an aggressively fit conditional model. n=16 plus the ET confound forbids more.

---

## 2. Recommended recalibration

### 2.1 Functional form (operates on the 1X2 directly)

For each knockout fixture with model output `(a, draw, b)` and an evenness score `e ∈ [0,1]`:

```
draw' = draw + k · e · (1 − draw)          # headroom-scaled lift (keeps draw' < 1)
draw' = min(0.90, draw')                    # hard cap
scale = (1 − draw') / (1 − draw)
a'    = a · scale
b'    = b · scale                           # a,b shrink proportionally; favourite tilt preserved
```

- The `(1 − draw)` factor scales the lift by available headroom, so the same `k` cannot push any tie past certainty and naturally tapers as `draw` grows.
- Re-normalisation moves probability mass **out of {a, b} into draw only**, preserving the win/loss *ratio* `a:b` — the model's read on *who* is favoured is untouched; only *how often it ends level* changes.
- This layer is model-agnostic and 1X2-only — apply it identically to every forecaster (Dixon-Coles, the four Elo/Davidson models, the two ML models, and both ensembles). No goal matrix required.

### 2.2 Evenness index `e` — exact field references

`e` is a weighted blend of three sub-terms, each clamped to `[0,1]`. Field names below are the live 2026 R32 stats (`fifa8-r32.generated.json` → `statsA` / `statsB`) with the corresponding `TeamProfile` field (`packages/fifa-models/src/types.ts`) in parentheses. The store layer is `apps/web/lib/world-cup/fifa8-store.ts`.

```
clamp01(x) = max(0, min(1, x))

# (1) strength closeness — even teams draw more (strongest first-principles driver)
eloGap   = |statsA.elo − statsB.elo|                 # TeamProfile.prior.elo
close    = 1 − clamp01(eloGap / 200)                 # 200-Elo gap ⇒ "lopsided"

# (2) low-scoring tendency — low combined attack ⇒ low-scoring ⇒ draw-prone
combXg   = statsA.xgFor + statsB.xgFor               # TeamProfile.attackRate (both teams)
low      = 1 − clamp01(combXg / 4.0)                 # 4.0 goals combined ⇒ "high-scoring"

# (3) defensive posture — the only robust 2022 on-pitch tilt (+0.38)
combLB   = statsA.lowBlockPct + statsB.lowBlockPct   # TeamProfile.lowBlockPct (both teams)
defensive= clamp01(combLB / 55)                      # 55 combined ⇒ "both sit deep"

e = clamp01(0.50·close + 0.30·low + 0.20·defensive)
```

Weights rationale: **closeness 0.50** (even-teams-draw is the strongest theoretical driver and the cleanest signal the 2026 data supplies); **low-scoring 0.30** (drawn ties averaged 2.0 goals vs 3.45 — strong directional support); **defensive 0.20** (only the robust 2022 ratio signal survived, +0.38, but it is weak and near-constant across this field, so it earns the smallest weight). Scales (200 Elo / 4.0 xG / 55 LB) are round, defensible thresholds, not over-fit; they were not tuned to the 15 fixtures.

> Note: `xgFor` and `lowBlockPct` in the **2026** stats are clean per-90 group-stage averages (no ET contamination — the ET problem is specific to the 2022 source PDFs), so using them here is sound even though we could not trust the 2022 `xgApprox` *levels* for fitting.

### 2.3 The parameter `k`

```
k = 0.283
```

Solved by bisection so that, applied to the headline (`multicalibrated`) forecast across all 15 live R32 fixtures, the **aggregate mean 90-minute draw probability = 31.25%** (the 2022 figure), up from the current 22.7%.

---

## 3. Tuning result

- **Before:** mean headline draw = **22.69%**, draw-modal ties = **0/15**.
- **After (`k = 0.283`):** mean headline draw = **31.25%** (= 2022 target by construction), draw-modal ties = **1/15** (Australia–Egypt, a genuine near-coin-flip: pre a=0.31 / b=0.44).
- The boost concentrates on even ties and barely touches lopsided ones — see Section 4.

### Sensitivity (robustness of the design, not a re-fit)

Re-solving `k` under alternative weightings, the spotlight behaviour is stable:

| weights (close/low/def) | k | NLD–MAR | USA–BIH | POR–CRO | ESP–AUT | ARG–CPV | draw-modal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **0.50/0.30/0.20 (chosen)** | **0.283** | 32.2% | 32.8% | 38.3% | 20.1% | 25.7% | 1 |
| 0.60/0.40/0.00 (no defensive) | 0.382 | 32.9% | 34.0% | 40.7% | 17.0% | 22.3% | 2 |
| 0.40/0.30/0.30 | 0.253 | 31.9% | 32.6% | 37.4% | 21.2% | 27.1% | 1 |
| 0.70/0.30/0.00 (closeness-heavy) | 0.371 | 33.1% | 33.4% | 41.2% | 16.7% | 21.6% | 3 |

Dropping the (near-constant) defensive term sharpens the contrast — lopsided ties stay flatter but more even ties flip draw-modal. The chosen blend is the middle ground: even ties reach 30%+, lopsided ties stay clearly favourite-modal, only the true coin-flip flips.

---

## 4. 15-fixture before / after (headline `multicalibrated`, `k = 0.283`)

`even` = evenness index `e`. `modal` = most-likely outcome after recalibration; `*` = newly became draw-modal.

| # | Fixture | Elo A/B | combXg | combLB | even | draw before | draw after | modal after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Brazil v Japan | 1991/1906 | 3.33 | 51.1 | 0.52 | 21.4% | **33.0%** | A |
| 2 | Germany v Paraguay | 1932/1834 | 3.07 | 48.5 | 0.50 | 25.4% | **36.0%** | A |
| 3 | Netherlands v Morocco | 1948/1827 | 3.13 | 39.1 | 0.40 | 23.4% | **32.2%** | A |
| 4 | Côte d'Ivoire v Norway | 1695/1914 | 2.97 | 45.8 | 0.24 | 24.6% | 29.8% | B |
| 5 | France v Sweden | 2063/1712 | 3.19 | 41.3 | 0.21 | 15.8% | 20.8% | A |
| 6 | Mexico v Ecuador | 1875/1938 | 3.27 | 39.6 | 0.54 | 22.3% | **34.2%** | A |
| 7 | Belgium v Senegal | 1894/1860 | 3.43 | 34.0 | 0.58 | 24.1% | **36.6%** | A |
| 8 | England v DR Congo | 2024/1652 | 3.16 | 42.0 | 0.22 | 24.9% | 29.5% | A |
| 9 | United States v Bosnia-Herzegovina | 1726/1595 | 2.32 | 42.6 | 0.45 | 22.9% | **32.8%** | A |
| 10 | Switzerland v Algeria | 1891/1772 | 3.18 | 34.3 | 0.39 | 24.4% | **32.7%** | A |
| 11 | Spain v Austria | 2157/1830 | 3.68 | 40.6 | 0.17 | 16.0% | 20.1% | A |
| 12 | Portugal v Croatia | 1989/1912 | 2.91 | 39.5 | 0.53 | 27.4% | **38.3%** | A |
| 13 | Argentina v Cabo Verde | 2115/1578 | 3.11 | 57.3 | 0.27 | 19.6% | 25.7% | A |
| 14 | Australia v Egypt | 1777/1696 | 2.32 | 52.4 | 0.61 | 25.2% | **38.2%** | **draw \*** |
| 15 | Colombia v Ghana | 1982/1510 | 2.55 | 44.8 | 0.27 | 22.9% | 28.8% | A |

**Mean draw after = 31.25%.**

### Reading of the spotlight ties (matches the brief's intent)

- **Even ties rise toward 30%+ as requested:** Netherlands–Morocco 23.4 → 32.2%, United States–Bosnia 22.9 → 32.8%, Portugal–Croatia 27.4 → 38.3%.
- **Lopsided ties barely move:** Spain–Austria 16.0 → 20.1% (+4.1pp, Elo gap 327), France–Sweden 15.8 → 20.8% (Elo gap 351), Argentina–Cabo Verde 19.6 → 25.7% (Elo gap 537). All stay clearly favourite-modal — the favourite's win prob only shrinks a few points.
- **One tie becomes draw-modal:** Australia–Egypt — and it should. It is the most even on the board (Elo gap 81, lowest combined xG 2.32 alongside USA–Bosnia), and the model already had it near a coin-flip (a=0.31 / b=0.44) before any adjustment. Promoting the draw to most-likely on the single tie that is genuinely even and low-scoring is the correct behaviour, not an artifact.

---

## 5. Implementation notes & limitations (for whoever wires this in)

- **Where it lives:** a pure post-processing function on each `ModelPrediction.probs` (`OneXTwo {home, draw, away}`) for knockout fixtures only. Apply per-forecaster so every model's published 1X2 reflects it; the headline/ensemble then inherits it. Group-stage forecasts must be left untouched (this is a knockout-base-rate calibration).
- **Immutability:** return a new `{home: a', draw: draw', away: b'}` triple; do not mutate the model output.
- **Validate inputs:** guard against `draw ≥ 1`, missing `elo`/`xgFor`/`lowBlockPct` (fall back to `e = 0`, i.e. no adjustment, if a field is absent — never crash a forecast over a missing stat).
- **n = 16 honesty:** this is a one-tournament calibration with a known ET confound on the conditional signal. Treat `k = 0.283` and the weights as a *reasonable prior*, not a precise estimate. The strong claim is the **aggregate base rate (~31%)**; the per-tie evenness ordering is a soft, theory-led tilt. Re-fit when 2026 knockout 90' results land, and ideally pool with 2018/2014 knockouts to escape n=16.
- **Does not model goals.** This only re-points the 1X2. If a goals/total-goals output is later needed, that requires a separate (e.g. bivariate-Poisson) layer; this spec deliberately stays on the 1X2 because the Elo/Davidson models expose nothing else.
- **Market-blind throughout:** evenness uses only Elo priors + on-pitch FIFA stats. No prices read at any step.
