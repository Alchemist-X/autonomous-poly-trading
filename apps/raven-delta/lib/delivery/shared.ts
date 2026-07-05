// Shared delivery plumbing: receipts, the timeout-guarded JSON POST used by
// every channel, and localization helpers for the rendered artifacts.

import type { DeliveryReceipt } from "../analyzer/schema";

export type DeliveryLocale = "en" | "zh";

export function pick(locale: DeliveryLocale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}

export function receipt(input: Omit<DeliveryReceipt, "timestampUtc">): DeliveryReceipt {
  return { ...input, timestampUtc: new Date().toISOString() };
}

export function deliveryTimeoutMs(): number {
  const parsed = Number(process.env.DELTA_DELIVERY_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8_000;
}

export interface PostJsonResult {
  ok: boolean;
  status: number | null;
  body: string;
  timedOut: boolean;
  errorMessage: string | null;
}

// One fetch shape for every outbound channel: JSON POST, hard timeout that
// covers the body read, no thrown errors — callers translate into receipts.
export async function postJson(url: string, payload: unknown, headers: Record<string, string> = {}): Promise<PostJsonResult> {
  const timeoutMs = deliveryTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 2000), timedOut: false, errorMessage: null };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: "",
      timedOut: controller.signal.aborted,
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timer);
  }
}

// Receipts travel to unauthenticated callers: keep failure details generic and
// log the specifics server-side only.
export function failureDetail(locale: DeliveryLocale, channel: string, result: PostJsonResult): string {
  console.error(`raven-delta delivery ${channel} failed:`, result.status, result.errorMessage ?? result.body.slice(0, 200));
  if (result.timedOut) {
    return pick(locale, `Delivery timed out after ${deliveryTimeoutMs()}ms.`, `推送在 ${deliveryTimeoutMs()}ms 后超时。`);
  }
  if (result.status !== null) {
    return pick(locale, `Delivery endpoint returned ${result.status}.`, `推送端点返回 ${result.status}。`);
  }
  return pick(locale, "Delivery failed (see server logs).", "推送失败（详见服务端日志）。");
}
