// Machine-facing news feed seam. A Twitter/X poller (or any future source
// adapter — see lib/news-sources/types.ts) POSTs raw news items here; the
// pipeline analyzes and pushes without a human in the loop. Requires the
// access token whenever one is configured.

import { NextResponse } from "next/server";
import { newsInputSchema } from "../../../lib/analyzer/schema";
import { runDeltaAnalysis } from "../../../lib/analyzer/analyze";
import { runQualityGate } from "../../../lib/analyzer/quality-gate";
import { deliverRun } from "../../../lib/delivery";
import { ingestAllowed } from "../../../lib/auth";
import { DEFAULT_WS_TOPIC } from "../../../lib/delivery/websocket";

export const runtime = "nodejs";

function defaultIngestEmails(): string[] {
  return (process.env.DELTA_INGEST_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  if (!ingestAllowed(request)) {
    return NextResponse.json({ error: "Access token required." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = newsInputSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return NextResponse.json({ error: "Invalid news item.", detail }, { status: 400 });
  }

  // Stage 1 — quality gate: a cheap judgment on whether the item is big
  // enough to justify a full analysis + push. Sub-threshold items stop here.
  const gate = await runQualityGate(parsed.data);
  if (!gate.pass) {
    return NextResponse.json(
      { status: "gated", gate, runId: null, delivery: [] },
      { status: 202 }
    );
  }

  // Stage 2 — full delta analysis, then push email + WS immediately.
  const { run } = await runDeltaAnalysis(parsed.data);
  const delivery = await deliverRun({
    run,
    emailRecipients: defaultIngestEmails(),
    wsTopic: process.env.DELTA_INGEST_WS_TOPIC?.trim() || DEFAULT_WS_TOPIC,
    gate: { trust: "full" },
    locale: parsed.data.locale
  });

  return NextResponse.json(
    {
      status: "analyzed",
      gate,
      runId: run.id,
      engine: run.engine,
      worthAttention: run.analysis.attention.worthAttention,
      attentionScore: run.analysis.attention.score,
      firstSeenUtc: run.analysis.timing.firstSeenUtc,
      impactedCount: run.analysis.impactedStocks.length,
      delivery
    },
    { status: 202 }
  );
}
