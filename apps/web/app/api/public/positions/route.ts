import { getPublicPositions } from "@autopoly/db";

export async function GET() {
  return Response.json(await getPublicPositions());
}

