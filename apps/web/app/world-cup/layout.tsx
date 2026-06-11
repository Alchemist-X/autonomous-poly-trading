import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import styles from "../../components/world-cup/world-cup.module.css";

// Independent metadata for the World Cup product — overrides the root layout's
// "Trading Agent" branding (compliance R1). Positioning: probability research.
export const metadata: Metadata = {
  title: "Predict Raven 世界杯版 — 盲测 AI 概率研究",
  icons: {
    icon: "/favicon-raven.png",
    shortcut: "/favicon-raven.png",
    apple: "/brand/raven-icon.png"
  },
  description:
    "An independent, market-blind AI superforecaster for the 2026 World Cup: transparent probabilities built without looking at any betting or prediction-market prices, scored publicly with Brier. Probability research, not betting advice.",
  openGraph: {
    title: "Predict Raven World Cup — market-blind AI forecasts, publicly scored",
    description:
      "Transparent World Cup probabilities, produced without reading any market prices, with a public Brier scoreboard. Probability research, not betting advice.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Predict Raven World Cup — market-blind AI forecasts"
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
