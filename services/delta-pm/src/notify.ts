// Push notifications — Feishu custom-bot webhook (the operator's fastest
// mobile channel today; an app/web-push client can subscribe to the same
// events later). Env-gated: empty DELTAPM_FEISHU_WEBHOOK = disabled. Push
// failures are logged to the ledger and NEVER fail the pipeline.
//
// What pushes (signal, not noise):
//   - a tradeable signal passed both checks and entered deep analysis
//   - a decision (open OR reasoned rejection) with its headline numbers
//   - stop-loss / hard-floor / halt book events
// Every message links to the audit page so the operator lands on the full
// IC-memo chain.

import { config } from "./config.js";
import { appendLedger } from "./store.js";

export type PushKind = "signal" | "decision" | "book_event";

export async function push(kind: PushKind, title: string, lines: string[]): Promise<void> {
  if (!config.feishuWebhook) return;
  const text = [`【Delta PM · 影子】${title}`, ...lines, `审计页: ${config.auditPageUrl}`].join("\n");
  try {
    const res = await fetch(config.feishuWebhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ msg_type: "text", content: { text } }),
      signal: AbortSignal.timeout(10_000)
    });
    const body = (await res.json().catch(() => ({}))) as { code?: number; msg?: string };
    if (!res.ok || (typeof body.code === "number" && body.code !== 0)) {
      throw new Error(`feishu → http ${res.status} code ${body.code ?? "?"} ${body.msg ?? ""}`);
    }
    appendLedger({ type: "push_sent", kind, title });
  } catch (error) {
    appendLedger({ type: "error", where: "push", kind, message: error instanceof Error ? error.message : String(error) });
  }
}
