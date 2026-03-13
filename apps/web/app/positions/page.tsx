import { getPublicPositions } from "@autopoly/db";
import { LivePositions } from "../../components/live-positions";

export default async function PositionsPage() {
  const positions = await getPublicPositions();
  return <LivePositions initialData={positions} />;
}

