import { NextResponse } from "next/server";
import { listRuns } from "../../../lib/analyzer/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const runs = listRuns(Number.isFinite(limit) && limit > 0 ? limit : 20).map(({ file: _file, ...entry }) => entry);
  return NextResponse.json({ runs });
}
