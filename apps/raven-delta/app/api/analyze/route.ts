import { NextResponse } from "next/server";
import { z } from "zod";
import { newsInputSchema } from "../../../lib/analyzer/schema";
import { runDeltaAnalysis } from "../../../lib/analyzer/analyze";
import { deliverRun } from "../../../lib/delivery";
import { callerTrust } from "../../../lib/auth";

export const runtime = "nodejs";

const emailListSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(",")))
  .transform((items) => items.map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, 20));

const analyzeRequestSchema = newsInputSchema.extend({
  push: z
    .object({
      emails: emailListSchema.optional(),
      wsTopic: z.string().trim().max(120).optional()
    })
    .optional()
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return NextResponse.json({ error: "Invalid request.", detail }, { status: 400 });
  }

  const { push, ...news } = parsed.data;
  const { run } = await runDeltaAnalysis(news);
  const delivery = await deliverRun({
    run,
    emailRecipients: push?.emails ?? [],
    wsTopic: push?.wsTopic ?? null,
    gate: { trust: callerTrust(request) },
    locale: news.locale
  });

  return NextResponse.json({ ...run, delivery });
}
