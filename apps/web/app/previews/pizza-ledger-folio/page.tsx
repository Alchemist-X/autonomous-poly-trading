import type { Metadata } from "next";
import { ProphetsProfitSnapshot } from "../../../components/prophets-profit-snapshot";

export const metadata: Metadata = {
  title: "Pizza snapshot preview - Folio",
  description: "Editorial-style preview for the Pizza Polymarket trading snapshot."
};

export default function PizzaLedgerFolioPreviewPage() {
  return <ProphetsProfitSnapshot as="div" variant="folio" />;
}
