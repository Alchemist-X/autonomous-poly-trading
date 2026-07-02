import { NextResponse } from "next/server";
import { loadAnalyst } from "../../../../lib/server/analyst";
import { getDossier } from "../../../../lib/server/dossier";
import { isSafeEventId } from "../../../../lib/server/ids";
import { getJob } from "../../../../lib/server/run-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSafeEventId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const job = getJob(id);
    const dossier = getDossier(id, job);
    if (!dossier && !job) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      dossier,
      job: job
        ? {
            status: job.status,
            question: job.question,
            log: job.log.slice(-20),
            startedAtUtc: job.startedAtUtc,
            maxRounds: job.maxRounds,
            provider: job.provider
          }
        : null,
      analyst: loadAnalyst(id)
    });
  } catch (error) {
    console.error("loading forecast failed:", error);
    return NextResponse.json({ error: "failed to load forecast" }, { status: 500 });
  }
}
