import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import styles from "../../components/world-cup/world-cup.module.css";

// Independent metadata for the World Cup product — overrides the root layout's
// "Trading Agent" branding (compliance R1). Positioning: probability research.
export const metadata: Metadata = {
  title: "World Cup Forecast — AI 概率研究 | 公开记分",
  description:
    "An independent AI superforecaster for the 2026 World Cup: transparent probabilities, confidence intervals, and a public Brier scoreboard vs the market. Probability research, not betting advice.",
  openGraph: {
    title: "World Cup Forecast — AI superforecaster, publicly scored",
    description:
      "Transparent World Cup probabilities with confidence intervals and a public Brier scoreboard vs the market. Probability research, not betting advice.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup Forecast — AI superforecaster, publicly scored"
  }
};

export default function WorldCupLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>{children}</div>
      <LegalFooter />
    </div>
  );
}
