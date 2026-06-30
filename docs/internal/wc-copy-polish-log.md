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
