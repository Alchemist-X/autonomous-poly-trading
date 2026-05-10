import type { Metadata } from "next";
import { ProphetsProfitSnapshot } from "../../../components/prophets-profit-snapshot";

export const metadata: Metadata = {
  title: "Pizza snapshot preview - Terminal",
  description: "Operator-terminal preview for the Pizza Polymarket trading snapshot."
};

export default function PizzaLedgerTerminalPreviewPage() {
  return <ProphetsProfitSnapshot as="div" variant="terminal" />;
}
