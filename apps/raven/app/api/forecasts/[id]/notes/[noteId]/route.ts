import { NextResponse } from "next/server";
import { removeNote } from "../../../../../../lib/server/analyst";
import { isSafeEventId } from "../../../../../../lib/server/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await ctx.params;
  if (!isSafeEventId(id) || !/^[a-z0-9-]{1,64}$/.test(noteId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const removed = removeNote(id, noteId);
    if (!removed) return NextResponse.json({ error: "note not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("removing analyst note failed:", error);
    return NextResponse.json({ error: "failed to remove note" }, { status: 500 });
  }
}
