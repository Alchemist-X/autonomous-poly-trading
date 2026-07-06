import { NextResponse } from "next/server";
import { resolveEngine } from "../../../lib/analyzer/provider";
import { getUniverse } from "../../../lib/analyzer/universe";

export const runtime = "nodejs";

export async function GET() {
  const resolution = resolveEngine();
  return NextResponse.json({
    ok: true,
    engine: resolution.engine,
    engineReason: resolution.reason,
    universeVersion: getUniverse().version,
    universeSize: getUniverse().stocks.length,
    accessTokenConfigured: Boolean(process.env.DELTA_ACCESS_TOKEN?.trim())
  });
}
