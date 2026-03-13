import { getPublicTrades } from "@autopoly/db";
import { LiveTrades } from "../../components/live-trades";

export default async function TradesPage() {
  const trades = await getPublicTrades();
  return <LiveTrades initialData={trades} />;
}

