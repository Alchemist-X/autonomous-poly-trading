import type { Metadata } from "next";
import { ProphetsProfitSnapshot } from "../../../components/prophets-profit-snapshot";

export const metadata: Metadata = {
  title: "Pizza snapshot preview - Exchange",
  description: "Brokerage-board preview for the Pizza Polymarket trading snapshot."
};

export default function PizzaLedgerExchangePreviewPage() {
  return <ProphetsProfitSnapshot as="div" variant="exchange" />;
}
