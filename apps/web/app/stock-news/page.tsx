import type { Metadata } from "next";
import { StockNewsProductPage } from "../../components/stock-news/stock-news-page";

export const metadata: Metadata = {
  title: "News Delta — Predict Raven",
  description: "Analyze incoming market news, map impacted US stocks, and push action reports by email and WebSocket."
};

export default function StockNewsPage() {
  return <StockNewsProductPage locale="en" />;
}
