import { NextResponse } from "next/server";
import { z } from "zod";
import { addNote } from "../../../../../lib/server/analyst";
import { isSafeEventId } from "../../../../../lib/server/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NoteSchema = z.object({
  text: z.string().trim().min(1).max(600),
  stance: z.enum(["yes", "no", "question"]),
  targetId: z.string().trim().max(120).nullable().optional()
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSafeEventId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid note" }, { status: 400 });
  }
  try {
    const note = addNote(id, {
      text: parsed.data.text,
      stance: parsed.data.stance,
      targetId: parsed.data.targetId ?? null
    });
    return NextResponse.json({ note });
  } catch (error) {
    console.error("adding analyst note failed:", error);
    return NextResponse.json({ error: "failed to save note" }, { status: 500 });
  }
}
