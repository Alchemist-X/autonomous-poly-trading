import type { Metadata } from "next";
import { MarketImpactConsole } from "../../components/market-impact/market-impact-console";

export const metadata: Metadata = {
  title: "Market Impact Engine — Predict Raven",
  description:
    "Pick a catalyst event and watch a forecasting pipeline read its impact on each stock across three horizons — today, three months, and a year — decision-first, with an open evidence pool. Illustrative, not financial advice."
};

// To-C demo surface, sibling to the Forecasting Engine (/research). The console
// owns the full localized shell + the progressive reveal; this route only
// supplies metadata.
export default function MarketImpactPage() {
  return <MarketImpactConsole />;
}
