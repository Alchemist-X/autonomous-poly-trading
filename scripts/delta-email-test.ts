// Raven Delta — email subscription test module.
//
// Exercises the exact pipeline a Twitter/X poller will drive: news item ->
// quality gate -> full delta analysis -> email + WebSocket push. Defaults the
// recipient to the operator's test inbox and ALWAYS writes the rendered email
// to runtime-artifacts/raven-delta/email-preview/ so the report format can be
// reviewed even before a real email provider (RESEND_API_KEY) is configured.
//
// Usage:
//   pnpm delta:test-email                                  # built-in sample news
//   pnpm delta:test-email -- --text "..." --url "https://…" --locale zh
//   pnpm delta:test-email -- --email someone@example.com   # override recipient
//   DELTA_GATE_MIN_SCORE=0 pnpm delta:test-email           # force the gate open

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { newsInputSchema } from "../apps/raven-delta/lib/analyzer/schema";
import { runDeltaAnalysis } from "../apps/raven-delta/lib/analyzer/analyze";
import { runQualityGate } from "../apps/raven-delta/lib/analyzer/quality-gate";
import { resolveEngine } from "../apps/raven-delta/lib/analyzer/provider";
import { sendEmail } from "../apps/raven-delta/lib/delivery/email";
import { broadcastRun } from "../apps/raven-delta/lib/delivery/websocket";
import { renderHtml, renderPlainText, elapsedLine } from "../apps/raven-delta/lib/delivery/report-email";

const DEFAULT_TEST_EMAIL = "issue.00.gui@gmail.com";

const SAMPLE_TEXT = [
  "OpenAI announces a $40B multi-year cloud and GPU capacity agreement with Microsoft, Nvidia, and Oracle.",
  "The agreement expands AI data-center capacity through 2028. Management says demand for Blackwell-class",
  "GPUs remains above prior internal forecasts, while power availability is the main constraint."
].join("\n");

const C = {
  info: (message: string) => console.log(`\x1b[36mINFO\x1b[0m  ${message}`),
  ok: (message: string) => console.log(`\x1b[32mOK\x1b[0m    ${message}`),
  warn: (message: string) => console.warn(`\x1b[33mWARN\x1b[0m  ${message}`),
  err: (message: string) => console.error(`\x1b[31mERR\x1b[0m   ${message}`)
};

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const resolution = resolveEngine();
  C.info(`execution mode: inspect/email-test | engine: ${resolution.engine} (${resolution.reason}) | decision source: script defaults + CLI args`);

  const locale = readArg("locale") === "zh" ? ("zh" as const) : ("en" as const);
  const news = newsInputSchema.parse({
    text: readArg("text") ?? SAMPLE_TEXT,
    url: readArg("url") ?? "https://www.reuters.com/technology/openai-40b-capacity-agreement-sample",
    publishedAtUtc: readArg("published") ?? new Date(Date.now() - 23 * 60_000).toISOString(),
    locale
  });
  const recipient = readArg("email") ?? process.env.DELTA_TEST_EMAIL?.trim() ?? DEFAULT_TEST_EMAIL;

  // Stage 1 — quality gate (same gate /api/ingest runs).
  const gate = await runQualityGate(news);
  C.info(`quality gate [${gate.gateEngine}]: score ${gate.score}/100 vs threshold ${gate.threshold} -> ${gate.pass ? "PASS" : "REJECT"} — ${gate.reason}`);
  if (!gate.pass) {
    C.warn("Item did not clear the gate; no analysis, no email (this is the designed behavior).");
    C.warn("To force it through for a template test: DELTA_GATE_MIN_SCORE=0 pnpm delta:test-email");
    process.exit(2);
  }

  // Stage 2 — full analysis.
  const { run, archiveFile } = await runDeltaAnalysis(news);
  C.ok(`analysis done: engine=${run.engine} attention=${run.analysis.attention.score}/100 impacted=${run.analysis.impactedStocks.length}`);
  if (run.engineFallbackReason) C.warn(`engine degraded: ${run.engineFallbackReason}`);
  C.info(elapsedLine(run, new Date().toISOString(), locale));

  // Stage 3 — render + always archive an email preview.
  const sentAtIso = new Date().toISOString();
  const previewDir = path.join(process.cwd(), "runtime-artifacts", "raven-delta", "email-preview");
  mkdirSync(previewDir, { recursive: true });
  const stamp = sentAtIso.replace(/[:.]/g, "-");
  const htmlPath = path.join(previewDir, `${stamp}-${run.id}.html`);
  const textPath = path.join(previewDir, `${stamp}-${run.id}.txt`);
  writeFileSync(htmlPath, renderHtml(run, locale, sentAtIso));
  writeFileSync(textPath, renderPlainText(run, locale, sentAtIso));

  // Stage 4 — real push attempt (email + WS), honest receipts either way.
  const [emailReceipt, wsReceipt] = await Promise.all([
    sendEmail(run, [recipient], { trust: "full" }, locale),
    broadcastRun(run, process.env.DELTA_INGEST_WS_TOPIC?.trim() || "delta", locale)
  ]);

  C.info(`email -> ${recipient}: ${emailReceipt.status} [${emailReceipt.provider}] — ${emailReceipt.detail}`);
  C.info(`websocket -> ${wsReceipt.target}: ${wsReceipt.status} [${wsReceipt.provider}] — ${wsReceipt.detail}`);
  if (emailReceipt.status === "simulated") {
    C.warn("Email was SIMULATED. To send for real: set RESEND_API_KEY + DELTA_EMAIL_FROM (or DELTA_EMAIL_WEBHOOK_URL) in the env.");
  }

  C.ok("Artifacts:");
  console.log(`  email HTML preview : ${htmlPath}`);
  console.log(`  email plain text   : ${textPath}`);
  if (archiveFile) console.log(`  run archive        : ${archiveFile}`);
  process.exit(emailReceipt.status === "failed" ? 1 : 0);
}

main().catch((error) => {
  C.err(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
