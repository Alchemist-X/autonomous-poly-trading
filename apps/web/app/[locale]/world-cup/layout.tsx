import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorldCupHeader } from "../../../components/world-cup/wc-header";
import { LegalFooter } from "../../../components/world-cup/legal-footer";
import styles from "../../../components/world-cup/world-cup.module.css";

// Independent metadata for the World Cup product — overrides the root layout's
// "Trading Agent" branding (compliance R1). Positioning: probability research.
const OG_DESCRIPTION =
  "A market-blind forecasting agent's probabilities for all 48 teams — champion, group and knockout odds from an Elo prior, 100k Monte-Carlo simulations and Bayesian updates on key evidence. Publicly Brier-scored. Probability research, not betting advice.";

export const metadata: Metadata = {
  title: "Predict Raven — 2026 World Cup forecasts",
  icons: {
    icon: "/favicon-raven.png",
    shortcut: "/favicon-raven.png",
    apple: "/brand/raven-icon.png"
  },
  description: OG_DESCRIPTION,
  openGraph: {
    title: "Predict Raven — 2026 World Cup forecasts",
    description: OG_DESCRIPTION,
    siteName: "Predict Raven",
    url: "https://forecasting-agent.com/world-cup",
    type: "website",
    images: [{ url: "/brand/raven-icon.png", width: 256, height: 256, alt: "Predict Raven" }]
  },
  twitter: {
    card: "summary",
    title: "Predict Raven — 2026 World Cup forecasts",
    description: OG_DESCRIPTION,
    images: ["/brand/raven-icon.png"]
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
