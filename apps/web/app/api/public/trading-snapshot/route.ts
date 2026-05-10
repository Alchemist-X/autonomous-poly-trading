import { getTradingSnapshotData } from "../../../../lib/trading-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return Response.json(await getTradingSnapshotData());
}
