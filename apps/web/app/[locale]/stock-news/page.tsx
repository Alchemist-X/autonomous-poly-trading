import type { Metadata } from "next";
import { StockNewsProductPage } from "../../../components/stock-news/stock-news-page";
import { localeOf } from "../../../lib/world-cup/i18n";

export const metadata: Metadata = {
  title: "News Delta — Predict Raven",
  description: "Analyze incoming market news, map impacted US stocks, and push action reports by email and WebSocket."
};

export default async function StockNewsLocalePrefixPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  return <StockNewsProductPage locale={locale} />;
}
