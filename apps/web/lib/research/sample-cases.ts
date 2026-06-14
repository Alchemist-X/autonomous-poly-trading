// Pre-saved demo cases for the public Forecasting Engine console.
//
// Clicking a case streams a full run — layered evidence, a conditional model,
// Bayesian updates, and a calibrated probability + CI — with zero input.
//
// • iran-nuclear is a REAL research snapshot (2026-06-13): its data comes from a
//   multi-agent deep-research run (web search + adversarial verification), runs
//   at the flagship Skuld tier, and carries live source URLs. See
//   `resolveCuratedCase` in prediction-engine-demo.ts.
// • fed-rate-cut is a curated mock demo.
//
// Every human-readable field is locale-keyed; the event text is localized too so
// an English run shows an English question (event detection matches both
// languages, so the curated case resolves either way).

import type { NornTier } from "@autopoly/norns";
import type { ConsoleLocale } from "./locale";

export interface SampleCase {
  id: string;
  label: Record<ConsoleLocale, string>;
  blurb: Record<ConsoleLocale, string>;
  eventText: Record<ConsoleLocale, string>;
  marketPrice: number;
  // Optional tier to dispatch this case at (the flagship real-research case runs
  // at Skuld). When omitted, the console uses the user's selected tier.
  tier?: NornTier;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "iran-nuclear",
    label: { en: "US-Iran nuclear deal", zh: "美伊核协议" },
    blurb: {
      en: "Skuld live run · Real research snapshot 2026-06-13",
      zh: "Skuld 实跑 · 真实研究快照 2026-06-13"
    },
    eventText: {
      en: "Can the US and Iran reach a nuclear deal before 2026-06-30?",
      zh: "美国和伊朗能在 2026-06-30 前达成核协议吗？"
    },
    marketPrice: 0.67,
    tier: "skuld"
  },
  {
    id: "fed-rate-cut",
    label: { en: "Fed rate cut", zh: "美联储降息" },
    blurb: {
      en: "Demo · Fed cuts ≥50bp before Sept 2026",
      zh: "演示 · Fed cuts ≥50bp before Sept 2026"
    },
    eventText: {
      en: "Will the Fed cut rates by at least 50bp before September 2026?",
      zh: "美联储会在 2026 年 9 月前降息至少 50 个基点吗？"
    },
    marketPrice: 0.52
  }
];
