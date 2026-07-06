import { NextResponse } from "next/server";
import { getRun } from "../../../../lib/analyzer/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json(run);
}
