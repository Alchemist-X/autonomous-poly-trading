// Pre-saved demo cases for the public Deep Research console.
//
// Clicking a case streams a full run — layered evidence, a conditional model,
// Bayesian updates, and a calibrated probability + CI — with zero input.
//
// • iran-nuclear is a REAL research snapshot (2026-06-13): its data comes from a
//   multi-agent deep-research run (web search + adversarial verification), runs
//   at the flagship Skuld tier, and carries live source URLs. See
//   `resolveCuratedCase` in prediction-engine-demo.ts.
// • fed-rate-cut is a curated mock demo.

import type { NornTier } from "@autopoly/norns";

export interface SampleCase {
  id: string;
  label: string;
  blurb: string;
  eventText: string;
  marketPrice: number;
  // Optional tier to dispatch this case at (the flagship real-research case runs
  // at Skuld). When omitted, the console uses the user's selected tier.
  tier?: NornTier;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "iran-nuclear",
    label: "美伊核协议",
    blurb: "Skuld 实跑 · 真实研究快照 2026-06-13",
    eventText: "美国和伊朗能在 2026-06-30 前达成核协议吗？",
    marketPrice: 0.67,
    tier: "skuld"
  },
  {
    id: "fed-rate-cut",
    label: "美联储降息",
    blurb: "演示 · Fed cuts ≥50bp before Sept 2026",
    eventText: "美联储会在 2026 年 9 月前降息至少 50 个基点吗？",
    marketPrice: 0.52
  }
];
