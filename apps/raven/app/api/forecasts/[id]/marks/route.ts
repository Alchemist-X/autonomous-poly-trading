import { NextResponse } from "next/server";
import { z } from "zod";
import { setMark } from "../../../../../lib/server/analyst";
import { isSafeEventId } from "../../../../../lib/server/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MarkSchema = z.object({
  targetId: z.string().trim().min(1).max(120),
  mark: z.enum(["keep", "doubt"]).nullable()
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSafeEventId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = MarkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid mark" }, { status: 400 });
  }
  try {
    const analyst = setMark(id, parsed.data.targetId, parsed.data.mark);
    return NextResponse.json({ analyst });
  } catch (error) {
    console.error("setting analyst mark failed:", error);
    return NextResponse.json({ error: "failed to save mark" }, { status: 500 });
  }
}
