import { getOverview } from "@autopoly/db";
import { LiveOverview } from "../components/live-overview";

export default async function HomePage() {
  const overview = await getOverview();
  return <LiveOverview initialData={overview} />;
}

