# WC Knockout copy / layout polish log

Running log of the continuous copy + layout polish loop on the live FIFA8 knockout
pages (forecasting-agent.com /world-cup/knockout + /knockout/[id]). One small,
high-confidence improvement per iteration; screenshot-verified; auto PR/merge/deploy.
Goal: maximum information density + zero confusion for a first-time visitor.

## 2026-06-30 ~11:15 HKT — iteration 1
- **Shipped:** restored the forecast timestamp to **2026-06-29** on the knockout hero + detail method note. The draw-calibration re-run had bumped it to 2026-06-30, which mislabeled when the blind forecast was locked AND made the already-played 06-28/06-29 ties look predicted after kickoff. The calibration adds no new match data, so the forecast time is unchanged. Verified live; matches the committed Polymarket baseline snapshot. (Same session also shipped the 2022-grounded 90-min draw calibration: draws lifted to ~31%, Australia–Egypt draw-modal.)
- **Next direction (iteration 2):** screenshot the list + a detail page fresh (desktop + mobile, zh-CN + en) and assess these candidates, pick the single highest-value clarity win:
  1. Is "多校准融合 / Multi-calibrated 8-in-1" legible to a newcomer? Consider a one-line plain gloss near the model-comparison header or the guide.
  2. The 9-model comparison table on mobile — model names wrap to 2 lines and may feel cramped; check density vs readability.
  3. The detail page evidence-card read sentences — are any wordy? Tighten to the densest phrasing.
  4. The intro paragraph is fairly long — can it be tightened without losing the 90-min / ET / market-blind points?

## 2026-06-30 ~12:45 HKT — iteration 2
- **Shipped (PR #51):** the dedicated **methodology page** `/world-cup/knockout/how-it-works` the user asked for — a diagram-led walkthrough (FIFA PDF → 9 data fields with meanings+examples → 3-game Bayesian profile → 8 models in depth → blend + draw calibration → published 90' win/draw/loss), linked from the model-guide ⓘ ("完整方法说明：从数据到预测 →"). Agent-built; I did desktop+mobile+EN visual QA and verified live in all 3 locales + the guide-link suffix URL resolves in prod (HTTP 200).
- **Polish made during QA:** on mobile the numbered stage-caption list duplicated the stacked-diagram captions (two back-to-back 8-item lists) → hid `.stageCaptions` ≤720px since the stacked boxes already carry each caption inline. Verified ≤390px.
- **Earlier this session (PR #50):** restored the forecast timestamp to 2026-06-29 (calibration re-run had bumped it to 06-30).
- **Next direction (iteration 3):**
  1. The methodology page is only reachable via the ⓘ tooltip (which a visitor may never open). Consider a subtle always-visible "怎么预测的? →" link from the knockout-list intro straight to `/how-it-works`.
  2. The 9-model comparison table on mobile — density vs readability (still pending from iter 1).
  3. Detail-page evidence-card sentences — tighten any wordy ones.

## 2026-06-30 ~13:25 HKT — iteration 3
- **Shipped (PR #52):** de-leaked the knockout **detail page** for zh. The per-model rationale prose (headline + method note) is generated English-only, and 7 of the 8 displayed top-driver labels were unmapped — so a zh visitor saw "United States are a slight favourite…" and "Attack vs defence". Fix: render the English rationale prose only on `en` (zh already has the localized group header + driver line carrying the verdict + reason), and map every displayed top-driver label to an i18n key (攻防对比 / 机会创造状态 / 体能负荷 / 整体质量 / 突破防线 / 传球结构 / 模型一致度). Verified live: zh fully localized, en unchanged.
- **Next direction (iteration 4):**
  1. **Bilingual per-model rationale (bigger, engine-level):** the rich per-model reasoning sentence is hidden on zh (only the driver line remains). To give zh the same density as en, the engine would need to emit Chinese headline/methodNote and the archive be regenerated — flag for the user (touches the forecasting pipeline, market-blind regen).
  2. Still pending: an always-visible "怎么预测的? →" link from the knockout-list intro to /how-it-works (currently only via the ⓘ tooltip).
  3. The 9-model comparison table on the LIST card — mobile density (still unexamined).

## 2026-06-30 ~14:10 HKT — iteration 4
- **Shipped (PR #53):** surfaced the methodology deep link as an always-visible sibling of the ⓘ guide toggle on the knockout list (was buried 2 clicks deep inside the tooltip). The cryptic per-model names on every card now have a one-click path to the page that explains them. Removed the in-tooltip duplicate; new `.kgBar` flex row; reused `kgFullMethod` (no new i18n). Verified live: SSR-visible on zh + en.
- **Next direction (iteration 5):**
  1. The list-card 9-model rows have mini-bars on **desktop** but they look absent/hidden on **mobile** (≤390px) — verify, and if so add a compact bar so model lean is scannable on phones too.
  2. Bilingual per-model rationale (engine-level; still flagged for the user — gives zh the per-model reasoning prose currently hidden).
  3. Intro paragraph tightening (pending from iter 1) — 4 sentences, could be denser.
