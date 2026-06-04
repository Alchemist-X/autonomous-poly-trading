import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

type JsonObject = Record<string, unknown>;

interface PulseDecisionReportInput {
  archiveDir: string;
  stage?: string | null;
  renderPdf?: boolean;
}

export interface PulseDecisionReportResult {
  markdownPath: string;
  englishMarkdownPath: string;
  htmlPath: string;
  pdfPath: string | null;
  errorPath: string | null;
}

interface NormalizedSource {
  title: string;
  url: string;
  retrievedAtUtc: string | null;
  note: string | null;
}

interface NormalizedDecision {
  action: string;
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  outcomeLabel: string | null;
  side: string;
  notionalUsd: number;
  aiProb: number;
  marketProb: number;
  edge: number;
  confidence: string;
  thesisMd: string;
  sources: NormalizedSource[];
}

interface ReportMarketContext {
  decision: NormalizedDecision;
  candidate: JsonObject | null;
  research: JsonObject | null;
  executedOrder: JsonObject | null;
  pulseSection: string | null;
  sourceNeeds: string[];
  sourceCoverage: Array<[string, string, string]>;
  sourceQualityScore: number;
  sourceQualityLabel: string;
  eventProbability: {
    eventLabel: string;
    marketEventProb: number | null;
    ravenEventProb: number | null;
    tradedOutcomeProb: number;
    tradedMarketProb: number;
    edge: number;
  };
}

function isRecord(value: unknown): value is JsonObject {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readOptionalText(filePath: string | null | undefined): Promise<string | null> {
  if (!filePath) return null;
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readOptionalJson(filePath: string): Promise<JsonObject | null> {
  const text = await readOptionalText(filePath);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripMarkdown(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string | null | undefined, maxLength: number): string {
  const normalized = stripMarkdown(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

function shortId(value: unknown): string {
  const text = stringValue(value);
  if (!text) return "-";
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function normalizeSource(value: unknown): NormalizedSource | null {
  if (!isRecord(value)) return null;
  const title = stringValue(value.title) ?? "Source";
  const url = stringValue(value.url);
  if (!url) return null;
  return {
    title,
    url,
    retrievedAtUtc: stringValue(value.retrieved_at_utc),
    note: stringValue(value.note)
  };
}

function normalizeDecision(value: unknown): NormalizedDecision | null {
  if (!isRecord(value)) return null;
  const action = stringValue(value.action);
  const eventSlug = stringValue(value.event_slug);
  const marketSlug = stringValue(value.market_slug);
  const tokenId = stringValue(value.token_id);
  const side = stringValue(value.side);
  const notionalUsd = numberValue(value.notional_usd);
  const aiProb = numberValue(value.ai_prob);
  const marketProb = numberValue(value.market_prob);
  const edge = numberValue(value.edge);
  const thesisMd = stringValue(value.thesis_md);
  if (!action || !eventSlug || !marketSlug || !tokenId || !side || notionalUsd == null || aiProb == null || marketProb == null || edge == null || !thesisMd) {
    return null;
  }
  return {
    action,
    eventSlug,
    marketSlug,
    tokenId,
    outcomeLabel: stringValue(value.outcome_label),
    side,
    notionalUsd,
    aiProb,
    marketProb,
    edge,
    confidence: stringValue(value.confidence) ?? "unknown",
    thesisMd,
    sources: arrayValue(value.sources).map(normalizeSource).filter((source): source is NormalizedSource => Boolean(source))
  };
}

function getMarketSlug(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return stringValue(value.marketSlug) ?? stringValue(value.market_slug) ?? stringValue(value.slug);
}

function getCandidateQuestion(candidate: JsonObject | null, fallbackSlug: string): string {
  return stringValue(candidate?.question) ?? fallbackSlug;
}

function getCandidateUrl(candidate: JsonObject | null): string | null {
  return stringValue(candidate?.url);
}

function getCandidateTags(candidate: JsonObject | null): string[] {
  return arrayValue(candidate?.tags)
    .map((tag) => isRecord(tag) ? stringValue(tag.label) ?? stringValue(tag.slug) : stringValue(tag))
    .filter((tag): tag is string => Boolean(tag));
}

function findCandidate(pulseJson: JsonObject | null, marketSlug: string): JsonObject | null {
  for (const candidate of arrayValue(pulseJson?.candidates)) {
    if (isRecord(candidate) && getMarketSlug(candidate) === marketSlug) {
      return candidate;
    }
  }
  return null;
}

function findResearch(pulseJson: JsonObject | null, marketSlug: string): JsonObject | null {
  for (const research of arrayValue(pulseJson?.research_candidates)) {
    if (!isRecord(research)) continue;
    const market = isRecord(research.market) ? research.market : null;
    if (market && getMarketSlug(market) === marketSlug) {
      return research;
    }
  }
  return null;
}

function findExecutedOrder(executionSummary: JsonObject | null, marketSlug: string): JsonObject | null {
  for (const order of arrayValue(executionSummary?.executed)) {
    if (isRecord(order) && stringValue(order.marketSlug) === marketSlug) {
      return order;
    }
  }
  return null;
}

function markdownHeadingPattern(title: string): RegExp {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`^##\\s+\\d+\\.\\s+${escaped}\\s*$`, "im");
}

function extractPulseSection(markdown: string | null, candidate: JsonObject | null, decision: NormalizedDecision): string | null {
  if (!markdown) return null;
  const titles = [
    stringValue(candidate?.question),
    decision.marketSlug
  ].filter((title): title is string => Boolean(title));
  for (const title of titles) {
    const match = markdown.match(markdownHeadingPattern(title));
    if (!match || match.index == null) continue;
    const start = match.index;
    const next = markdown.slice(start + match[0].length).search(/^##\s+\d+\.\s+/m);
    const end = next >= 0 ? start + match[0].length + next : markdown.length;
    return markdown.slice(start, end).trim();
  }
  return null;
}

function extractSubsection(section: string | null, heading: string): string | null {
  if (!section) return null;
  const match = section.match(new RegExp(`^###\\s+${heading}\\s*$`, "im"));
  if (!match || match.index == null) return null;
  const start = match.index + match[0].length;
  const rest = section.slice(start);
  const next = rest.search(/^###\s+/m);
  return rest.slice(0, next >= 0 ? next : undefined).trim();
}

function inferSourceNeeds(candidate: JsonObject | null): string[] {
  const question = stringValue(candidate?.question) ?? "market";
  const category = stringValue(candidate?.categoryLabel) ?? stringValue(candidate?.categorySlug) ?? "unknown category";
  const tags = getCandidateTags(candidate).join(", ") || "no tags";
  return [
    `Resolution authority: the source that can actually settle "${question}", including explicit rule text and any named oracle/provider.`,
    `Market microstructure: current CLOB bid/ask, depth, liquidity, fees, and whether the executable token/outcome matches the probability estimate.`,
    `Event-state evidence: fresh primary or near-primary data relevant to category "${category}" and tags "${tags}". This is deliberately event-specific, not a fixed source list.`,
    "Base-rate or calibration evidence: historical frequency, comparable events, or quantitative distribution appropriate to this exact question.",
    "Counter-evidence: credible opposing cases, stale-data warnings, and the most likely reason the Raven probability could be wrong."
  ];
}

function sourceCoverage(input: {
  decision: NormalizedDecision;
  candidate: JsonObject | null;
  research: JsonObject | null;
}): Array<[string, string, string]> {
  const scrape = isRecord(input.research?.scrapeResult) ? input.research?.scrapeResult as JsonObject : null;
  const rules = isRecord(scrape?.rules) ? scrape?.rules as JsonObject : null;
  const context = isRecord(scrape?.market_context) ? scrape?.market_context as JsonObject : null;
  const comments = isRecord(scrape?.comments) ? scrape?.comments as JsonObject : null;
  const orderbooks = arrayValue(input.research?.orderbooks);
  const rows: Array<[string, string, string]> = [];
  rows.push(["Market source", input.decision.sources.length > 0 || getCandidateUrl(input.candidate) ? "present" : "missing", "Decision sources and candidate URL."]);
  rows.push(["Resolution rule/source", stringValue(rules?.description) || stringValue(rules?.resolution_source) ? "present" : "missing", stringValue(rules?.description) ?? "No explicit rule text in artifact."]);
  rows.push(["Orderbook/depth", orderbooks.length > 0 ? "present" : "missing", orderbooks.length > 0 ? `${orderbooks.length} orderbook snapshot(s).` : "No research orderbook snapshot found."]);
  rows.push(["Event context", numberValue(context?.annotations_count) && Number(context?.annotations_count) > 0 ? "present" : "thin", `${numberValue(context?.annotations_count) ?? 0} annotation(s).`]);
  rows.push(["Comments/counter-evidence", numberValue(comments?.sampled_count) && Number(comments?.sampled_count) > 0 ? "present" : "missing", `${numberValue(comments?.sampled_count) ?? 0} sampled comment(s).`]);
  return rows;
}

function scoreSourceQuality(rows: Array<[string, string, string]>, decision: NormalizedDecision): number {
  let score = 40;
  for (const [, status] of rows) {
    if (status === "present") score += 10;
    if (status === "thin") score += 4;
  }
  if (decision.sources.length >= 2) score += 5;
  if (decision.confidence === "high") score += 5;
  if (decision.confidence === "low") score -= 8;
  return Math.max(0, Math.min(100, score));
}

function sourceQualityLabel(score: number): string {
  if (score >= 85) return "strong";
  if (score >= 70) return "usable";
  if (score >= 55) return "thin";
  return "needs review";
}

function computeEventProbability(decision: NormalizedDecision) {
  const outcome = decision.outcomeLabel?.toLowerCase();
  const isNo = outcome === "no";
  const isYes = outcome === "yes";
  const ravenEventProb = isNo ? 1 - decision.aiProb : isYes ? decision.aiProb : null;
  const marketEventProb = isNo ? 1 - decision.marketProb : isYes ? decision.marketProb : null;
  return {
    eventLabel: isNo ? "Yes / event happens" : isYes ? "Yes / traded event happens" : "Traded outcome event",
    marketEventProb,
    ravenEventProb,
    tradedOutcomeProb: decision.aiProb,
    tradedMarketProb: decision.marketProb,
    edge: decision.edge
  };
}

function buildContext(input: {
  recommendation: JsonObject | null;
  executionSummary: JsonObject | null;
  pulseJson: JsonObject | null;
  pulseMarkdown: string | null;
}): ReportMarketContext[] {
  const openLike = arrayValue(input.recommendation?.decisions)
    .map(normalizeDecision)
    .filter((decision): decision is NormalizedDecision => Boolean(decision))
    .filter((decision) => ["open", "close", "reduce"].includes(decision.action));
  return openLike.map((decision) => {
    const candidate = findCandidate(input.pulseJson, decision.marketSlug);
    const research = findResearch(input.pulseJson, decision.marketSlug);
    const executedOrder = findExecutedOrder(input.executionSummary, decision.marketSlug);
    const pulseSection = extractPulseSection(input.pulseMarkdown, candidate, decision);
    const coverage = sourceCoverage({ decision, candidate, research });
    const score = scoreSourceQuality(coverage, decision);
    return {
      decision,
      candidate,
      research,
      executedOrder,
      pulseSection,
      sourceNeeds: inferSourceNeeds(candidate),
      sourceCoverage: coverage,
      sourceQualityScore: score,
      sourceQualityLabel: sourceQualityLabel(score),
      eventProbability: computeEventProbability(decision)
    };
  });
}

function renderTable(headers: string[], rows: string[][]): string {
  const th = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tr = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  const clean = (value: string) => value.replace(/<[^>]*>/g, "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  return [
    `| ${headers.map(clean).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(clean).join(" | ")} |`)
  ].join("\n");
}

function getOrderValue(order: JsonObject | null, key: string): unknown {
  return isRecord(order) ? order[key] : null;
}

function renderMarketHtml(context: ReportMarketContext): string {
  const decision = context.decision;
  const candidate = context.candidate;
  const order = context.executedOrder;
  const probability = context.eventProbability;
  const sourceRows = decision.sources.length > 0
    ? decision.sources.map((source) => [
        escapeHtml(source.title),
        `<a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a>`,
        escapeHtml(source.retrievedAtUtc ?? "-"),
        escapeHtml(source.note ?? "-")
      ])
    : [[escapeHtml(getCandidateQuestion(candidate, decision.marketSlug)), escapeHtml(getCandidateUrl(candidate) ?? "-"), "-", "Candidate URL fallback"]];
  const coverageRows = context.sourceCoverage.map(([need, status, detail]) => [
    escapeHtml(need),
    `<span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span>`,
    escapeHtml(detail)
  ]);
  const pulseProbability = extractSubsection(context.pulseSection, "概率评估");
  const pulseEvidence = extractSubsection(context.pulseSection, "证据链");
  const pulseReasoning = extractSubsection(context.pulseSection, "推理逻辑");
  const pulseInfoSources = extractSubsection(context.pulseSection, "信息源");
  const dataGaps = context.pulseSection?.match(/\*\*数据缺口：\*\*\s*([^\n]+)/)?.[1] ?? null;
  return `
    <section class="market">
      <div class="market-head">
        <div>
          <p class="kicker">${escapeHtml(decision.action.toUpperCase())} ${escapeHtml(decision.side)} ${escapeHtml(decision.outcomeLabel ?? "")}</p>
          <h2>${escapeHtml(getCandidateQuestion(candidate, decision.marketSlug))}</h2>
          <p class="muted">${escapeHtml(decision.marketSlug)}</p>
        </div>
        <div class="score">${context.sourceQualityScore}/100<br><span>${escapeHtml(context.sourceQualityLabel)}</span></div>
      </div>
      <div class="metrics">
        <div><span>Market event probability</span><strong>${formatPct(probability.marketEventProb)}</strong></div>
        <div><span>Raven event probability</span><strong>${formatPct(probability.ravenEventProb)}</strong></div>
        <div><span>Traded outcome fair probability</span><strong>${formatPct(probability.tradedOutcomeProb)}</strong></div>
        <div><span>Edge</span><strong>${formatPct(probability.edge)}</strong></div>
      </div>
      <p class="lead"><strong>推理结果：</strong>${escapeHtml(stripMarkdown(decision.thesisMd))}</p>
      ${renderTable(["字段", "值"], [
        ["成交/计划金额", escapeHtml(formatUsd(numberValue(getOrderValue(order, "filledNotionalUsd")) ?? decision.notionalUsd))],
        ["成交均价", escapeHtml(numberValue(getOrderValue(order, "avgPrice"))?.toFixed(4) ?? "-")],
        ["Order ID", escapeHtml(shortId(getOrderValue(order, "orderId")))],
        ["Tx", escapeHtml(shortId(arrayValue(isRecord(order?.rawResponse) ? order?.rawResponse.transactionsHashes : null)[0]))],
        ["Confidence", escapeHtml(decision.confidence)],
        ["Category / tags", escapeHtml([stringValue(candidate?.categoryLabel), ...getCandidateTags(candidate)].filter(Boolean).join(" / ") || "-")]
      ])}
      <h3>事件发生概率判断</h3>
      ${renderTable(["概率口径", "市场", "Raven", "说明"], [
        ["事件发生", escapeHtml(formatPct(probability.marketEventProb)), escapeHtml(formatPct(probability.ravenEventProb)), escapeHtml(probability.eventLabel)],
        ["交易 outcome", escapeHtml(formatPct(probability.tradedMarketProb)), escapeHtml(formatPct(probability.tradedOutcomeProb)), escapeHtml(`${decision.side} ${decision.outcomeLabel ?? "outcome"}`)],
        ["Edge", "-", escapeHtml(formatPct(probability.edge)), "Raven traded-outcome probability minus market traded-outcome probability"]
      ])}
      <h3>动态信息源需求</h3>
      <p class="muted">这些需求由市场问题、category、tags 和结算规则动态生成；不是固定的“高质量来源”白名单。</p>
      <ol>${context.sourceNeeds.map((need) => `<li>${escapeHtml(need)}</li>`).join("")}</ol>
      <h3>本轮实际信息源</h3>
      ${renderTable(["来源", "URL", "获取时间", "备注"], sourceRows)}
      <h3>来源覆盖质量</h3>
      ${renderTable(["维度", "状态", "细节"], coverageRows)}
      ${pulseProbability ? `<h3>Pulse 概率评估摘录</h3><pre>${escapeHtml(truncate(pulseProbability, 1600))}</pre>` : ""}
      ${pulseEvidence ? `<h3>Pulse 证据链摘录</h3><pre>${escapeHtml(truncate(pulseEvidence, 2200))}</pre>` : ""}
      ${pulseReasoning ? `<h3>Pulse 推理逻辑摘录</h3><pre>${escapeHtml(truncate(pulseReasoning, 1200))}</pre>` : ""}
      ${pulseInfoSources ? `<h3>Pulse 信息源摘录</h3><pre>${escapeHtml(truncate(pulseInfoSources, 1200))}</pre>` : ""}
      ${dataGaps ? `<h3>数据缺口</h3><p class="warning">${escapeHtml(stripMarkdown(dataGaps))}</p>` : ""}
    </section>
  `;
}

function renderHtml(input: {
  archiveDir: string;
  stage?: string | null;
  preflight: JsonObject | null;
  recommendation: JsonObject | null;
  executionSummary: JsonObject | null;
  contexts: ReportMarketContext[];
  fees: JsonObject[];
}) {
  const runId = stringValue(input.recommendation?.runId) ?? stringValue(input.executionSummary?.runId) ?? "-";
  const execution = isRecord(input.preflight?.execution) ? input.preflight?.execution as JsonObject : null;
  const primaryConclusion = stringValue(input.preflight?.primaryConclusion) ?? "-";
  const feeRows = input.fees.map((fee) => [
    escapeHtml(stringValue(fee.marketSlug) ?? "-"),
    escapeHtml(String(numberValue(fee.estimatedFeeRate) ?? "-")),
    escapeHtml(String(numberValue(fee.actualBaseFee) ?? "-")),
    escapeHtml(stringValue(fee.timestamp) ?? "-")
  ]);
  const overviewRows = input.contexts.map((context) => [
    escapeHtml(getCandidateQuestion(context.candidate, context.decision.marketSlug)),
    escapeHtml(`${context.decision.side} ${context.decision.outcomeLabel ?? ""}`.trim()),
    escapeHtml(formatPct(context.eventProbability.marketEventProb)),
    escapeHtml(formatPct(context.eventProbability.ravenEventProb)),
    escapeHtml(formatPct(context.eventProbability.edge)),
    escapeHtml(`${context.sourceQualityScore}/100 ${context.sourceQualityLabel}`)
  ]);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Pulse 分析与决策报告</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif; color: #152033; line-height: 1.5; font-size: 12px; margin: 0; }
    h1 { font-size: 27px; line-height: 1.15; margin: 0 0 12px; }
    h2 { font-size: 18px; margin: 0; }
    h3 { font-size: 13.5px; margin: 17px 0 7px; color: #172554; page-break-after: avoid; }
    a { color: #155e75; text-decoration: none; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 7px 0 13px; font-size: 10px; }
    th, td { border: 1px solid #d7dde8; padding: 5px 6px; vertical-align: top; word-break: break-word; }
    th { background: #eef2ff; color: #1e293b; font-weight: 800; }
    pre { white-space: pre-wrap; word-break: break-word; border: 1px solid #e2e8f0; background: #f8fafc; padding: 8px; border-radius: 6px; font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 9px; }
    ol { margin: 6px 0 12px 18px; padding: 0; }
    li { margin: 3px 0; }
    .cover { min-height: 250mm; padding: 16mm 7mm 0; page-break-after: always; background: linear-gradient(180deg, #f8fafc 0, #fff 44%); }
    .eyebrow { letter-spacing: .08em; text-transform: uppercase; color: #0f766e; font-weight: 800; }
    .subtitle { color: #475569; font-size: 14px; max-width: 680px; }
    .review { border: 1px solid #a5f3fc; background: #ecfeff; border-radius: 8px; padding: 12px 14px; margin: 18px 0; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 11px 0; }
    .metrics > div { border: 1px solid #dbeafe; background: #f8fbff; border-radius: 8px; padding: 8px; min-height: 62px; }
    .metrics span { display: block; color: #64748b; font-size: 10px; }
    .metrics strong { display: block; color: #0f172a; font-size: 16px; margin-top: 3px; }
    .market { page-break-before: always; }
    .market-head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; }
    .kicker, .muted { color: #64748b; }
    .kicker { margin: 0 0 4px; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
    .lead { background: #f8fafc; border-left: 4px solid #0f766e; padding: 9px 11px; }
    .score { min-width: 72px; text-align: center; background: #0f766e; color: #fff; border-radius: 10px; padding: 8px; font-weight: 900; }
    .score span { font-size: 10px; font-weight: 700; }
    .status.present { color: #047857; font-weight: 800; }
    .status.thin { color: #b45309; font-weight: 800; }
    .status.missing { color: #b91c1c; font-weight: 800; }
    .warning { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 10px; }
  </style>
</head>
<body>
  <section class="cover">
    <p class="eyebrow">Predict Raven / Pulse Decision Report</p>
    <h1>分析与决策报告<br>概率判断、信息源需求与推理结果</h1>
    <p class="subtitle">本报告由每轮 Pulse archive 自动生成。它不预设固定“高质量信息源”名单，而是按具体问题、category、tags、结算规则和已有 artifact 动态列出应获取的信息类型、实际覆盖情况和缺口。</p>
    <div class="review">
      <strong>人工 Review 入口</strong>
      <ol>
        <li>先看每个市场的“事件发生概率判断”：市场概率、Raven 概率、交易方向 edge 是否一致。</li>
        <li>再看“动态信息源需求”和“来源覆盖质量”：这决定本次概率是否值得信任。</li>
        <li>如果来源覆盖缺失，不要机械扩大仓位；先补对应事件需要的官方/一级/实时数据。</li>
      </ol>
    </div>
    ${renderTable(["字段", "值"], [
      ["Run ID", escapeHtml(runId)],
      ["Stage", escapeHtml(input.stage ?? "-")],
      ["Execution", escapeHtml(`${stringValue(execution?.executionMode) ?? "-"} / ${stringValue(execution?.decisionStrategy) ?? "-"}`)],
      ["Env", escapeHtml(stringValue(execution?.envFilePath) ?? "-")],
      ["Preflight", escapeHtml(primaryConclusion)],
      ["Archive", escapeHtml(input.archiveDir)]
    ])}
  </section>
  <section>
    <h2>1. 总览</h2>
    ${renderTable(["事件", "交易", "市场事件概率", "Raven 事件概率", "交易 Edge", "来源质量"], overviewRows)}
    <h3>来源质量原则</h3>
    <p>高质量来源不是固定列表。对体育、加密、选举、奖项、公司市值、天气、法律监管等问题，真正重要的来源不同。本报告只固定评估维度：结算权威、市场微结构、事件当前状态、历史/统计基准、反证与不确定性；具体来源由市场问题动态决定。</p>
    ${input.fees.length > 0 ? `<h3>Fee discrepancy</h3>${renderTable(["市场", "estimated feeRate", "CLOB base_fee", "时间"], feeRows)}` : ""}
  </section>
  ${input.contexts.map(renderMarketHtml).join("\n")}
</body>
</html>`;
}

function renderMarkdown(input: {
  archiveDir: string;
  stage?: string | null;
  preflight: JsonObject | null;
  recommendation: JsonObject | null;
  executionSummary: JsonObject | null;
  contexts: ReportMarketContext[];
}) {
  const runId = stringValue(input.recommendation?.runId) ?? stringValue(input.executionSummary?.runId) ?? "-";
  const overviewRows = input.contexts.map((context) => [
    getCandidateQuestion(context.candidate, context.decision.marketSlug),
    `${context.decision.side} ${context.decision.outcomeLabel ?? ""}`.trim(),
    formatPct(context.eventProbability.marketEventProb),
    formatPct(context.eventProbability.ravenEventProb),
    formatPct(context.eventProbability.edge),
    `${context.sourceQualityScore}/100 ${context.sourceQualityLabel}`
  ]);
  const marketSections = input.contexts.map((context) => {
    const decision = context.decision;
    const pulseReasoning = extractSubsection(context.pulseSection, "推理逻辑");
    const pulseEvidence = extractSubsection(context.pulseSection, "证据链");
    return [
      `## ${getCandidateQuestion(context.candidate, decision.marketSlug)}`,
      "",
      `- 事件发生概率判断：市场 ${formatPct(context.eventProbability.marketEventProb)}；Raven ${formatPct(context.eventProbability.ravenEventProb)}；交易方向 ${decision.side} ${decision.outcomeLabel ?? "outcome"}；edge ${formatPct(context.eventProbability.edge)}。`,
      `- 来源质量：${context.sourceQualityScore}/100 ${context.sourceQualityLabel}。`,
      `- 推理结果：${stripMarkdown(decision.thesisMd)}`,
      "",
      "### 动态信息源需求",
      "",
      context.sourceNeeds.map((need) => `- ${need}`).join("\n"),
      "",
      "### 本轮实际信息源",
      "",
      decision.sources.length > 0
        ? decision.sources.map((source) => `- ${source.title}: ${source.url}${source.note ? ` — ${source.note}` : ""}`).join("\n")
        : `- ${getCandidateUrl(context.candidate) ?? "No candidate URL"}`,
      "",
      "### 来源覆盖质量",
      "",
      renderMarkdownTable(["维度", "状态", "细节"], context.sourceCoverage),
      "",
      pulseEvidence ? `### Pulse 证据链摘录\n\n${truncate(pulseEvidence, 1800)}\n` : "",
      pulseReasoning ? `### Pulse 推理逻辑摘录\n\n${truncate(pulseReasoning, 1000)}\n` : ""
    ].join("\n");
  }).join("\n");
  return [
    "# Pulse 分析与决策报告",
    "",
    `生成时间：${new Date().toISOString()}`,
    `Run ID：${runId}`,
    `归档目录：${input.archiveDir}`,
    "",
    "## 总览",
    "",
    renderMarkdownTable(["事件", "交易", "市场事件概率", "Raven 事件概率", "交易 Edge", "来源质量"], overviewRows),
    "",
    "## 来源质量原则",
    "",
    "高质量来源不是固定列表。对不同问题，真正重要的来源不同。本报告只固定评估维度：结算权威、市场微结构、事件当前状态、历史/统计基准、反证与不确定性；具体来源由市场问题动态决定。",
    "",
    marketSections
  ].join("\n").trimEnd() + "\n";
}

async function writePdf(htmlPath: string, pdfPath: string) {
  const playwright = await import("playwright");
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>>;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("playwright install") && !message.includes("Executable doesn't exist")) {
      throw error;
    }
    await installPlaywrightChromium();
    browser = await playwright.chromium.launch({ headless: true });
  }
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
}

async function installPlaywrightChromium() {
  const require = createRequire(import.meta.url);
  const playwrightEntry = require.resolve("playwright");
  const cliPath = path.join(path.dirname(playwrightEntry), "cli.js");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "install", "chromium"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`playwright install chromium failed with code ${code ?? "-"}\n${output.trim()}`));
      }
    });
  });
}

export async function writePulseDecisionReportArtifacts(input: PulseDecisionReportInput): Promise<PulseDecisionReportResult> {
  await mkdir(input.archiveDir, { recursive: true });
  const preflight = await readOptionalJson(path.join(input.archiveDir, "preflight.json"));
  const recommendation = await readOptionalJson(path.join(input.archiveDir, "recommendation.json"));
  const executionSummary = await readOptionalJson(path.join(input.archiveDir, "execution-summary.json"));
  const feeText = await readOptionalText(path.join(input.archiveDir, "fee-discrepancies.jsonl"));
  const fees = (feeText ?? "")
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        return isRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })
    .filter((item): item is JsonObject => Boolean(item));
  const pulseJsonPath = stringValue(recommendation?.pulseJsonPath);
  const pulseMarkdownPath = stringValue(recommendation?.pulseMarkdownPath);
  const pulseJson = pulseJsonPath ? await readOptionalJson(pulseJsonPath) : null;
  const pulseMarkdown = pulseMarkdownPath ? await readOptionalText(pulseMarkdownPath) : null;
  const contexts = buildContext({
    recommendation,
    executionSummary,
    pulseJson,
    pulseMarkdown
  });
  const html = renderHtml({
    archiveDir: input.archiveDir,
    stage: input.stage,
    preflight,
    recommendation,
    executionSummary,
    contexts,
    fees
  });
  const markdown = renderMarkdown({
    archiveDir: input.archiveDir,
    stage: input.stage,
    preflight,
    recommendation,
    executionSummary,
    contexts
  });
  const englishMarkdown = markdown.replace(
    "高质量来源不是固定列表。对不同问题，真正重要的来源不同。本报告只固定评估维度：结算权威、市场微结构、事件当前状态、历史/统计基准、反证与不确定性；具体来源由市场问题动态决定。",
    "High-quality sources are not a fixed list. Different questions require different evidence. This report fixes only the evaluation dimensions: resolution authority, market microstructure, current event state, historical/statistical calibration, and counter-evidence; the specific sources are derived from the market."
  );
  const markdownPath = path.join(input.archiveDir, "decision-report.md");
  const englishMarkdownPath = path.join(input.archiveDir, "decision-report.en.md");
  const htmlPath = path.join(input.archiveDir, "decision-report.html");
  const pdfPath = path.join(input.archiveDir, "decision-report.pdf");
  const errorPath = path.join(input.archiveDir, "decision-report-error.json");
  await Promise.all([
    writeFile(markdownPath, markdown, "utf8"),
    writeFile(englishMarkdownPath, englishMarkdown, "utf8"),
    writeFile(htmlPath, html, "utf8")
  ]);
  let renderedPdfPath: string | null = null;
  let renderedErrorPath: string | null = null;
  if (input.renderPdf !== false) {
    try {
      await writePdf(htmlPath, pdfPath);
      const pdfStat = await stat(pdfPath);
      if (pdfStat.size <= 0) {
        throw new Error("Generated PDF is empty.");
      }
      renderedPdfPath = pdfPath;
    } catch (error) {
      renderedErrorPath = errorPath;
      await writeFile(
        errorPath,
        JSON.stringify({
          ok: false,
          stage: input.stage ?? null,
          message: error instanceof Error ? error.message : String(error),
          markdownPath,
          htmlPath,
          pdfPath
        }, null, 2),
        "utf8"
      );
    }
  }
  return {
    markdownPath,
    englishMarkdownPath,
    htmlPath,
    pdfPath: renderedPdfPath,
    errorPath: renderedErrorPath
  };
}

export const testables = {
  computeEventProbability,
  inferSourceNeeds,
  sourceCoverage,
  sourceQualityLabel,
  normalizeDecision
};
