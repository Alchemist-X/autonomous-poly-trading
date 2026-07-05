// Delivery fan-out: email + WebSocket in parallel, receipts attached to the run.

import type { DeltaRun, DeliveryReceipt } from "../analyzer/schema";
import { sendEmail, type EmailGate } from "./email";
import { broadcastRun } from "./websocket";
import type { DeliveryLocale } from "./shared";

export interface DeliveryRequest {
  run: DeltaRun;
  emailRecipients: readonly string[];
  wsTopic: string | null;
  gate: EmailGate;
  locale: DeliveryLocale;
}

export async function deliverRun(input: DeliveryRequest): Promise<DeliveryReceipt[]> {
  const [email, websocket] = await Promise.all([
    sendEmail(input.run, input.emailRecipients, input.gate, input.locale),
    broadcastRun(input.run, input.wsTopic, input.locale)
  ]);
  return [email, websocket];
}
