import { NextResponse } from "next/server";
import { z } from "zod";
import { listRuns } from "../../../lib/server/dossier";
import { pickProvider, providerKeyAvailable, startForecast } from "../../../lib/server/run-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ runs: listRuns() });
  } catch (error) {
    console.error("listing forecast runs failed:", error);
    return NextResponse.json({ error: "failed to list runs" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  question: z.string().trim().min(8, "question too short").max(400, "question too long"),
  maxRounds: z.number().int().min(1).max(6).optional(),
  fresh: z.boolean().optional(),
  provider: z.enum(["claude", "deepseek"]).optional()
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const provider = pickProvider(parsed.data.provider);
  if (!providerKeyAvailable(provider)) {
    const missing = provider === "deepseek" ? "DEEPSEEK_API_KEY" : "ANTHROPIC_API_KEY";
    return NextResponse.json({ error: `server is missing ${missing} for provider "${provider}"` }, { status: 500 });
  }
  try {
    const job = startForecast(parsed.data.question, {
      maxRounds: parsed.data.maxRounds,
      fresh: parsed.data.fresh,
      provider
    });
    return NextResponse.json({ eventId: job.eventId, status: job.status, provider: job.provider });
  } catch (error) {
    console.error("starting forecast failed:", error);
    return NextResponse.json({ error: "failed to start forecast" }, { status: 500 });
  }
}
