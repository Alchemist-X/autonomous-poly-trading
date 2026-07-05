// Email channel: Resend when configured, generic webhook as second choice,
// honest `simulated` receipt otherwise. Recipients are gated by an operator
// allowlist so the public endpoint can never be turned into an email relay.

import type { DeltaRun, DeliveryReceipt } from "../analyzer/schema";
import { failureDetail, pick, postJson, receipt, type DeliveryLocale } from "./shared";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPlainText(run: DeltaRun, locale: DeliveryLocale): string {
  const a = run.analysis;
  const attention = a.attention.worthAttention
    ? pick(locale, "WORTH ATTENTION", "值得关注")
    : pick(locale, "not actionable", "无需行动");
  const lines = [
    `Raven Delta · ${run.id} · ${run.engine}`,
    "",
    run.news.headline,
    "",
    `${pick(locale, "Attention", "关注度")}: ${attention} (${a.attention.score}/100) — ${a.attention.verdict}`,
    a.marketReadout,
    "",
    pick(locale, "Impacted stocks:", "受影响股票："),
    ...(a.impactedStocks.length === 0
      ? [pick(locale, "- none — no trade suggested from this headline", "- 无——本条新闻不建议交易")]
      : a.impactedStocks.map(
          (stock) =>
            `- ${stock.ticker} ${stock.direction} ${stock.magnitude} | ${stock.action} | ${stock.expectedMovePct.min}%..${stock.expectedMovePct.max}% | ${stock.reasoning}`
        )),
    "",
    `${pick(locale, "Trading plan", "操作计划")}: ${a.tradingPlan}`,
    "",
    pick(locale, "Limitations:", "局限性："),
    ...a.limitations.map((item) => `- ${item}`)
  ];
  return lines.join("\n");
}

export function renderHtml(run: DeltaRun, locale: DeliveryLocale): string {
  const a = run.analysis;
  const rows = a.impactedStocks
    .map(
      (stock) => `
      <tr>
        <td><strong>${escapeHtml(stock.ticker)}</strong><br/>${escapeHtml(stock.company)}</td>
        <td>${escapeHtml(stock.direction)} · ${escapeHtml(stock.magnitude)}</td>
        <td>${escapeHtml(stock.action)}</td>
        <td>${stock.expectedMovePct.min}%..${stock.expectedMovePct.max}%</td>
        <td>${escapeHtml(stock.reasoning)}</td>
      </tr>`
    )
    .join("");
  const headers = [
    pick(locale, "Ticker", "股票"),
    pick(locale, "Direction", "方向"),
    pick(locale, "Action", "操作"),
    pick(locale, "Expected move", "预期波动"),
    pick(locale, "Reasoning", "推理")
  ];
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #211c13; line-height: 1.5;">
      <p style="font-size: 12px; color: #6e6452; text-transform: uppercase; letter-spacing: 0.08em;">Raven Delta · Raven Labs</p>
      <h1 style="font-size: 22px; margin: 0 0 10px;">${escapeHtml(run.news.headline)}</h1>
      <p><strong>${escapeHtml(a.attention.verdict)}</strong></p>
      <p>${escapeHtml(a.marketReadout)}</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <thead>
          <tr style="text-align: left; background: #f4efe4;">${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>${escapeHtml(a.tradingPlan)}</p>
      <p style="font-size: 12px; color: #6e6452;">${escapeHtml(
        pick(locale, "Demo mode: no live prices, no orders, not investment advice.", "演示模式：无实时价格、不下单、不构成投资建议。")
      )}</p>
    </div>`;
}

export async function sendEmail(run: DeltaRun, requested: readonly string[], gate: EmailGate, locale: DeliveryLocale): Promise<DeliveryReceipt> {
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
      { from, to: allowed, subject: subjectFor(run), text: renderPlainText(run, locale), html: renderHtml(run, locale) },
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
      text: renderPlainText(run, locale),
      html: renderHtml(run, locale),
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
