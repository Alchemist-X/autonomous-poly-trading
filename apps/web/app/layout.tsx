import type { Metadata } from "next";
import "./globals.css";

// Site-wide branding: market-blind World Cup probability research.
// The legacy AutoPoly trading-dashboard shell and metadata were removed
// (compliance R1) — this app now serves the forecasting product only.
export const metadata: Metadata = {
  title: "Predict Raven 世界杯版 — 盲测 AI 概率研究",
  description:
    "An independent, market-blind AI superforecaster for the 2026 World Cup. Transparent probabilities, sourced reasoning, public Brier scoring. Probability research, not betting advice.",
  metadataBase: new URL("https://web-one-sand-83.vercel.app"),
  icons: {
    icon: "/favicon-raven.png"
  },
  openGraph: {
    title: "Predict Raven 世界杯版 — market-blind AI probability research",
    description:
      "Transparent World Cup probabilities produced without reading any market prices. Probability research, not betting advice.",
    siteName: "Predict Raven",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Predict Raven 世界杯版 — market-blind AI probability research"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
