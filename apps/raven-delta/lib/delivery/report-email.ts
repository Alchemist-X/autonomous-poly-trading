// Email report renderer — decision-first, forecasting-agent style.
// Required contents (product spec): ① the original news link, ② how much
// time has passed between the news' first appearance and this email being
// sent, ③ the concrete action(s) to take. Verdict and actions lead; method
// and caveats trail. Inline styles only (email clients strip stylesheets).

import type { DeltaRun } from "../analyzer/schema";
import { formatElapsed, freshnessRead } from "../analyzer/timing";
import { pick, type DeliveryLocale } from "./shared";

const ACTION_TEXT: Record<string, [string, string]> = {
  buy: ["BUY", "买入"],
  add: ["ADD", "加仓"],
  watch: ["WATCH", "观察"],
  trim: ["TRIM", "减仓"],
  sell: ["SELL", "卖出"],
  hedge: ["HEDGE", "对冲"],
  avoid: ["AVOID CHASING", "避免追价"]
};

const DIRECTION_TEXT: Record<string, [string, string]> = {
  bullish: ["Bullish", "利多"],
  bearish: ["Bearish", "利空"],
  mixed: ["Mixed", "混合"]
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function actionText(action: string, locale: DeliveryLocale): string {
  const entry = ACTION_TEXT[action];
  return entry ? pick(locale, entry[0], entry[1]) : action;
}

function directionText(direction: string, locale: DeliveryLocale): string {
  const entry = DIRECTION_TEXT[direction];
  return entry ? pick(locale, entry[0], entry[1]) : direction;
}

function moveRange(range: { min: number; max: number }): string {
  const sign = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
  return `${sign(range.min)} … ${sign(range.max)}`;
}

// "2026-07-05T15:05:20.148Z" reads poorly in an alert; minute precision is
// what a trader needs.
function humanUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

// ② Freshness line: first-seen -> email send time.
export function elapsedLine(run: DeltaRun, sentAtIso: string, locale: DeliveryLocale): string {
  const firstSeen = run.analysis.timing.firstSeenUtc;
  if (!firstSeen) {
    return pick(
      locale,
      `First public appearance could not be verified (${run.analysis.timing.basis})`,
      `全网最早出现时间无法核实（${run.analysis.timing.basis}）`
    );
  }
  const elapsed = formatElapsed(firstSeen, sentAtIso, locale);
  return pick(
    locale,
    `First seen ${humanUtc(firstSeen)} — ${elapsed} had passed when this email was sent`,
    `全网最早出现于 ${humanUtc(firstSeen)} —— 本邮件发出时已过去 ${elapsed}`
  );
}

export function renderPlainText(run: DeltaRun, locale: DeliveryLocale, sentAtIso: string): string {
  const a = run.analysis;
  const attention = a.attention.worthAttention
    ? `${pick(locale, "WORTH ATTENTION", "值得关注")} ${a.attention.score}/100`
    : `${pick(locale, "NOT ACTIONABLE", "无需行动")} ${a.attention.score}/100`;
  const lines = [
    `Raven Delta · ${run.id} · ${run.engine}`,
    "",
    run.news.headline,
    pick(locale, "Original link", "原文链接") + `: ${run.news.url ?? pick(locale, "(not provided)", "（未提供）")}`,
    `⏱ ${elapsedLine(run, sentAtIso, locale)}`,
    "",
    `${attention} — ${a.attention.verdict}`,
    "",
    pick(locale, "WHAT TO DO:", "要做的操作："),
    ...(a.impactedStocks.length === 0
      ? [pick(locale, "- Nothing. This news does not clear the action bar.", "- 不操作。这条新闻没有达到行动门槛。")]
      : a.impactedStocks.map(
          (stock) =>
            `- ${actionText(stock.action, locale)} ${stock.ticker} (${directionText(stock.direction, locale)}, ${moveRange(stock.expectedMovePct)}, ${stock.horizon}) — ${stock.actionRationale}`
        )),
    "",
    `${pick(locale, "Market mechanism", "市场传导机制")}: ${a.marketReadout}`,
    "",
    `${pick(locale, "Trading plan", "操作计划")}: ${a.tradingPlan}`,
    "",
    pick(locale, "Limitations:", "局限性："),
    ...a.limitations.map((item) => `- ${item}`)
  ];
  return lines.join("\n");
}

const S = {
  page: "margin:0;padding:28px 16px;background:#f4efe4;",
  card: "max-width:640px;margin:0 auto;background:#fbf7ee;border:1px solid #e6ddcc;border-radius:14px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:#211c13;line-height:1.55;",
  brandBar: "padding:14px 26px;border-bottom:1px solid #e6ddcc;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.12em;color:#6e6452;",
  brandAccent: "color:#bc4a0e;font-weight:bold;",
  section: "padding:20px 26px;",
  fresh: "padding:12px 26px;background:#211c13;color:#f4efe4;font-size:13.5px;",
  freshStale: "padding:12px 26px;background:#7a2f1a;color:#f4efe4;font-size:13.5px;",
  h1: "margin:0 0 6px;font-size:21px;line-height:1.3;font-weight:600;",
  link: "color:#bc4a0e;",
  pill: "display:inline-block;padding:3px 10px;border-radius:999px;font-family:Menlo,Consolas,monospace;font-size:11px;font-weight:bold;",
  pillYes: "background:#f5e3d4;color:#98380a;border:1px solid #d9b394;",
  pillNo: "background:#efe8da;color:#6e6452;border:1px solid #d6cbb4;",
  muted: "color:#6e6452;font-size:13.5px;",
  microHead: "margin:0 0 10px;font-family:Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.1em;color:#9a907c;text-transform:uppercase;",
  actionRow: "padding:12px 14px;border:1px solid #e6ddcc;border-radius:10px;background:#ffffff;margin:0 0 8px;",
  actionTag: "display:inline-block;padding:2px 9px;border-radius:6px;background:#bc4a0e;color:#fff6ec;font-family:Menlo,Consolas,monospace;font-size:11.5px;font-weight:bold;margin-right:8px;",
  mono: "font-family:Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;",
  footer: "padding:16px 26px 22px;border-top:1px solid #e6ddcc;color:#9a907c;font-size:11.5px;"
};

function renderActionRows(run: DeltaRun, locale: DeliveryLocale): string {
  const a = run.analysis;
  if (a.impactedStocks.length === 0) {
    return `<p style="${S.muted}">${escapeHtml(
      pick(locale, "Nothing. This news does not clear the action bar — that is the call.", "不操作。这条新闻没有达到行动门槛——这就是结论。")
    )}</p>`;
  }
  return a.impactedStocks
    .map(
      (stock) => `
      <div style="${S.actionRow}">
        <div>
          <span style="${S.actionTag}">${escapeHtml(actionText(stock.action, locale))}</span>
          <strong style="${S.mono}font-size:15px;">${escapeHtml(stock.ticker)}</strong>
          <span style="${S.muted}"> ${escapeHtml(stock.company)} · ${escapeHtml(directionText(stock.direction, locale))} · <span style="${S.mono}">${escapeHtml(moveRange(stock.expectedMovePct))}</span> · ${escapeHtml(stock.horizon)}</span>
        </div>
        <p style="margin:7px 0 0;font-size:13.5px;">${escapeHtml(stock.reasoning)} <em>${escapeHtml(stock.actionRationale)}</em></p>
        ${
          stock.evidence.length > 0
            ? `<p style="margin:6px 0 0;${S.muted}">${escapeHtml(pick(locale, "Evidence", "证据"))}: ${stock.evidence
                .map((item) => escapeHtml(item.point))
                .join(" · ")}</p>`
            : ""
        }
      </div>`
    )
    .join("");
}

export function renderHtml(run: DeltaRun, locale: DeliveryLocale, sentAtIso: string): string {
  const a = run.analysis;
  const fresh = freshnessRead(a.timing.firstSeenUtc, sentAtIso, locale);
  const headlineHtml = run.news.url
    ? `<a href="${escapeHtml(run.news.url)}" style="${S.link}">${escapeHtml(run.news.headline)}</a>`
    : escapeHtml(run.news.headline);
  const attentionPill = a.attention.worthAttention
    ? `<span style="${S.pill}${S.pillYes}">${escapeHtml(pick(locale, "WORTH ATTENTION", "值得关注"))} ${a.attention.score}/100</span>`
    : `<span style="${S.pill}${S.pillNo}">${escapeHtml(pick(locale, "NOT ACTIONABLE", "无需行动"))} ${a.attention.score}/100</span>`;

  return `
  <div style="${S.page}">
    <div style="${S.card}">
      <div style="${S.brandBar}"><span style="${S.brandAccent}">RAVEN DELTA</span> · RAVEN LABS · ${escapeHtml(
        pick(locale, "NEWS IMPACT ALERT", "新闻冲击警报")
      )}</div>

      <div style="${fresh.staleWarning ? S.freshStale : S.fresh}">
        ⏱ ${escapeHtml(elapsedLine(run, sentAtIso, locale))}${
          fresh.staleWarning ? ` — ${escapeHtml(pick(locale, "over 24h old: likely priced in", "已超过 24 小时：大概率已被定价"))}` : ""
        }
      </div>

      <div style="${S.section}">
        ${attentionPill}
        <h1 style="${S.h1}margin-top:10px;">${headlineHtml}</h1>
        <p style="margin:6px 0 0;font-size:14.5px;">${escapeHtml(a.attention.verdict)}</p>
        <p style="margin:6px 0 0;${S.muted}">${escapeHtml(a.attention.credibilityNote)}</p>
      </div>

      <div style="${S.section}border-top:1px solid #e6ddcc;">
        <p style="${S.microHead}">${escapeHtml(pick(locale, "What to do", "要做的操作"))}</p>
        ${renderActionRows(run, locale)}
      </div>

      <div style="${S.section}border-top:1px solid #e6ddcc;">
        <p style="${S.microHead}">${escapeHtml(pick(locale, "Market mechanism", "市场传导机制"))}</p>
        <p style="margin:0;font-size:13.5px;">${escapeHtml(a.marketReadout)}</p>
        <p style="margin:10px 0 0;font-size:13.5px;">${escapeHtml(a.tradingPlan)}</p>
      </div>

      <div style="${S.section}border-top:1px solid #e6ddcc;">
        <p style="${S.microHead}">${escapeHtml(pick(locale, "Original link", "原文链接"))}</p>
        <p style="margin:0;font-size:13.5px;">${
          run.news.url
            ? `<a href="${escapeHtml(run.news.url)}" style="${S.link}">${escapeHtml(run.news.url)}</a>`
            : escapeHtml(pick(locale, "No URL was provided with this news item.", "这条新闻未附带 URL。"))
        }</p>
      </div>

      <div style="${S.footer}">
        ${escapeHtml(`run ${run.id} · engine ${run.engine} · ${run.generatedAtUtc}`)}<br/>
        ${escapeHtml(a.limitations.join(" · "))}<br/>
        ${escapeHtml(pick(locale, "Demo mode: no live prices, no orders, not investment advice.", "演示模式：无实时价格、不下单、不构成投资建议。"))}
      </div>
    </div>
  </div>`;
}
