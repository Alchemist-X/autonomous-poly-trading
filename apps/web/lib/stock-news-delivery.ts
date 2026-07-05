import type { StockNewsDeliveryReceipt, StockNewsImpactRun } from "./stock-news-impact";

interface DeliveryInput {
  run: StockNewsImpactRun;
  emailRecipients: readonly string[];
  websocketTopic: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function receipt(input: Omit<StockNewsDeliveryReceipt, "timestampUtc">): StockNewsDeliveryReceipt {
  return {
    ...input,
    timestampUtc: nowIso()
  };
}

function renderPlainText(run: StockNewsImpactRun): string {
  const lines = [
    run.summary.title,
    "",
    run.news.headline,
    "",
    run.summary.verdict,
    run.summary.marketMechanism,
    "",
    "Affected stocks:",
    ...run.affectedStocks.map((stock) =>
      `- ${stock.ticker} ${stock.directionLabel} | ${stock.actionLabel} | expected move ${stock.expectedMovePct}% | ${stock.thesis}`
    ),
    "",
    "Limitations:",
    ...run.limitations.map((item) => `- ${item}`)
  ];
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtml(run: StockNewsImpactRun): string {
  const rows = run.affectedStocks
    .map((stock) => `
      <tr>
        <td><strong>${escapeHtml(stock.ticker)}</strong><br/>${escapeHtml(stock.company)}</td>
        <td>${escapeHtml(stock.directionLabel)}</td>
        <td>${escapeHtml(stock.actionLabel)}</td>
        <td>${stock.expectedMovePct}%</td>
        <td>${escapeHtml(stock.thesis)}</td>
      </tr>`)
    .join("");
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Predict Raven · News Delta</p>
      <h1 style="font-size: 22px; margin: 0 0 10px;">${escapeHtml(run.summary.title)}</h1>
      <p><strong>${escapeHtml(run.news.headline)}</strong></p>
      <p>${escapeHtml(run.summary.verdict)}</p>
      <p>${escapeHtml(run.summary.marketMechanism)}</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <thead>
          <tr style="text-align: left; background: #f3f4f6;">
            <th>Ticker</th>
            <th>Direction</th>
            <th>Action</th>
            <th>Move</th>
            <th>Thesis</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size: 12px; color: #6b7280;">Demo mode: no live prices, no orders, no investment advice.</p>
    </div>`;
}

function readEmailWebhookUrl(): string | null {
  return process.env.STOCK_NEWS_EMAIL_WEBHOOK_URL?.trim() || null;
}

function readWsBroadcastUrl(): string | null {
  const explicit = process.env.STOCK_NEWS_WS_BROADCAST_URL?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL || process.env.STOCK_NEWS_WS_DEFAULT_LOCAL === "off") return null;
  const port = process.env.STOCK_NEWS_WS_PORT?.trim() || "8791";
  return `http://127.0.0.1:${port}/broadcast`;
}

async function sendEmail(run: StockNewsImpactRun, recipients: readonly string[]): Promise<StockNewsDeliveryReceipt> {
  const cleanRecipients = recipients.map((item) => item.trim()).filter(Boolean);
  if (cleanRecipients.length === 0) {
    return receipt({
      channel: "email",
      status: "skipped",
      provider: "none",
      target: "none",
      detail: "No email recipients supplied."
    });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.STOCK_NEWS_EMAIL_FROM?.trim();
  if (resendKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: cleanRecipients,
          subject: `[Predict Raven] ${run.news.headline.slice(0, 120)}`,
          text: renderPlainText(run),
          html: renderHtml(run)
        })
      });
      const text = await response.text();
      if (!response.ok) {
        return receipt({
          channel: "email",
          status: "failed",
          provider: "resend",
          target: cleanRecipients.join(", "),
          detail: `Resend returned ${response.status}: ${text.slice(0, 240)}`
        });
      }
      return receipt({
        channel: "email",
        status: "sent",
        provider: "resend",
        target: cleanRecipients.join(", "),
        detail: "Email accepted by Resend."
      });
    } catch (error) {
      return receipt({
        channel: "email",
        status: "failed",
        provider: "resend",
        target: cleanRecipients.join(", "),
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const webhookUrl = readEmailWebhookUrl();
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          recipients: cleanRecipients,
          subject: `[Predict Raven] ${run.news.headline}`,
          text: renderPlainText(run),
          html: renderHtml(run),
          run
        })
      });
      if (!response.ok) {
        return receipt({
          channel: "email",
          status: "failed",
          provider: "webhook",
          target: cleanRecipients.join(", "),
          detail: `Email webhook returned ${response.status}.`
        });
      }
      return receipt({
        channel: "email",
        status: "sent",
        provider: "webhook",
        target: cleanRecipients.join(", "),
        detail: "Email payload accepted by webhook."
      });
    } catch (error) {
      return receipt({
        channel: "email",
        status: "failed",
        provider: "webhook",
        target: cleanRecipients.join(", "),
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return receipt({
    channel: "email",
    status: "simulated",
    provider: "simulated",
    target: cleanRecipients.join(", "),
    detail: "Set RESEND_API_KEY + STOCK_NEWS_EMAIL_FROM or STOCK_NEWS_EMAIL_WEBHOOK_URL to send real email."
  });
}

async function broadcastWebSocket(run: StockNewsImpactRun, topic: string | null): Promise<StockNewsDeliveryReceipt> {
  const targetTopic = topic?.trim() || "stock-news-impact";
  const broadcastUrl = readWsBroadcastUrl();
  if (!broadcastUrl) {
    return receipt({
      channel: "websocket",
      status: "simulated",
      provider: "simulated",
      target: targetTopic,
      detail: "Set STOCK_NEWS_WS_BROADCAST_URL or run the local WebSocket hub to push real events."
    });
  }

  try {
    const response = await fetch(broadcastUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: targetTopic,
        type: "stock-news-impact",
        runId: run.id,
        generatedAtUtc: run.generatedAtUtc,
        headline: run.news.headline,
        topTickers: run.summary.topTickers,
        affectedStocks: run.affectedStocks.slice(0, 5),
        summary: run.summary
      })
    });
    if (!response.ok) {
      return receipt({
        channel: "websocket",
        status: "failed",
        provider: "broadcast-http",
        target: targetTopic,
        detail: `Broadcast endpoint returned ${response.status}.`
      });
    }
    return receipt({
      channel: "websocket",
      status: "sent",
      provider: "broadcast-http",
      target: targetTopic,
      detail: `Broadcast accepted by ${broadcastUrl}.`
    });
  } catch (error) {
    return receipt({
      channel: "websocket",
      status: "failed",
      provider: "broadcast-http",
      target: targetTopic,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function deliverStockNewsImpactRun(input: DeliveryInput): Promise<StockNewsDeliveryReceipt[]> {
  const [email, websocket] = await Promise.all([
    sendEmail(input.run, input.emailRecipients),
    broadcastWebSocket(input.run, input.websocketTopic)
  ]);
  return [email, websocket];
}
