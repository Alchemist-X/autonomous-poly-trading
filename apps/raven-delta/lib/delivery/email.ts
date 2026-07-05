// Email channel: Resend when configured, generic webhook as second choice,
// honest `simulated` receipt otherwise. Recipients are gated by an operator
// allowlist so the public endpoint can never be turned into an email relay.

import type { DeltaRun, DeliveryReceipt } from "../analyzer/schema";
import { failureDetail, pick, postJson, receipt, type DeliveryLocale } from "./shared";
import { renderHtml, renderPlainText } from "./report-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailGate {
  // "full" = authenticated caller (access token) — any recipient allowed.
  // "public" = anonymous caller — only allowlisted recipients pass.
  trust: "full" | "public";
}

function allowlist(): string[] {
  return (process.env.DELTA_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function filterRecipients(requested: readonly string[], gate: EmailGate): { allowed: string[]; rejected: string[] } {
  const clean = [...new Set(requested.map((item) => item.trim().toLowerCase()).filter((item) => EMAIL_RE.test(item)))].slice(0, 20);
  if (gate.trust === "full") return { allowed: clean, rejected: [] };
  const permitted = new Set(allowlist());
  return {
    allowed: clean.filter((item) => permitted.has(item)),
    rejected: clean.filter((item) => !permitted.has(item))
  };
}

function subjectFor(run: DeltaRun): string {
  // Strip CR/LF so a pasted multi-line headline can never smuggle headers.
  const flat = run.news.headline.replace(/[\r\n]+/g, " ").trim();
  return `[Raven Delta] ${flat.slice(0, 120)}`;
}

export async function sendEmail(run: DeltaRun, requested: readonly string[], gate: EmailGate, locale: DeliveryLocale): Promise<DeliveryReceipt> {
  const sentAtIso = new Date().toISOString();
  const { allowed, rejected } = filterRecipients(requested, gate);
  const rejectedNote =
    rejected.length > 0
      ? pick(locale, ` ${rejected.length} recipient(s) rejected by allowlist.`, ` ${rejected.length} 个收件人未通过白名单。`)
      : "";

  if (allowed.length === 0) {
    return receipt({
      channel: "email",
      status: "skipped",
      provider: "none",
      target: "none",
      detail:
        requested.length === 0
          ? pick(locale, "No email recipients supplied.", "未提供邮件收件人。")
          : pick(locale, "No recipient passed validation/allowlist.", "没有收件人通过校验/白名单。") + rejectedNote
    });
  }

  const target = allowed.join(", ");
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.DELTA_EMAIL_FROM?.trim();
  if (resendKey && from) {
    const result = await postJson(
      "https://api.resend.com/emails",
      { from, to: allowed, subject: subjectFor(run), text: renderPlainText(run, locale, sentAtIso), html: renderHtml(run, locale, sentAtIso) },
      { authorization: `Bearer ${resendKey}` }
    );
    if (!result.ok) {
      return receipt({ channel: "email", status: "failed", provider: "resend", target, detail: failureDetail(locale, "resend", result) });
    }
    return receipt({
      channel: "email",
      status: "sent",
      provider: "resend",
      target,
      detail: pick(locale, "Email accepted by Resend.", "邮件已被 Resend 接收。") + rejectedNote
    });
  }

  const webhookUrl = process.env.DELTA_EMAIL_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const result = await postJson(webhookUrl, {
      channel: "email",
      recipients: allowed,
      subject: subjectFor(run),
      text: renderPlainText(run, locale, sentAtIso),
      html: renderHtml(run, locale, sentAtIso),
      runId: run.id
    });
    if (!result.ok) {
      return receipt({ channel: "email", status: "failed", provider: "webhook", target, detail: failureDetail(locale, "email-webhook", result) });
    }
    return receipt({
      channel: "email",
      status: "sent",
      provider: "webhook",
      target,
      detail: pick(locale, "Email payload accepted by webhook.", "邮件负载已被 webhook 接收。") + rejectedNote
    });
  }

  return receipt({
    channel: "email",
    status: "simulated",
    provider: "simulated",
    target,
    detail: pick(
      locale,
      "Set RESEND_API_KEY + DELTA_EMAIL_FROM (or DELTA_EMAIL_WEBHOOK_URL) to send real email.",
      "配置 RESEND_API_KEY + DELTA_EMAIL_FROM（或 DELTA_EMAIL_WEBHOOK_URL）后才会真实发信。"
    )
  });
}
