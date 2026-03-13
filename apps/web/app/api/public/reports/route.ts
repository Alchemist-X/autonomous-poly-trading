import { getReports } from "@autopoly/db";

export async function GET() {
  const reports = await getReports();
  return Response.json(reports);
}

