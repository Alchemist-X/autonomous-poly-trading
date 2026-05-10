import type { Metadata } from "next";
import { ProphetsProfitSnapshot } from "../components/prophets-profit-snapshot";

export const metadata: Metadata = {
  title: "Live Trading Snapshot",
  description: "Live Polymarket wallet ledger adapted into the Prophets Profit snapshot view.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function HomePage() {
  return <ProphetsProfitSnapshot />;
}
