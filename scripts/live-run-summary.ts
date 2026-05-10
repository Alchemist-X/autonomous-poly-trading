import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { OverviewResponse, TradeDecision } from "@autopoly/contracts";
import type { PositionMarkAttribution } from "./pulse-evaluation-ledger.ts";

type SummaryLocale = "zh" | "en";

type DecisionAction = TradeDecision["action"];
type DecisionSide = TradeDecision["side"];

export interface SummaryDecision {
  action: DecisionAction;
  marketSlug: string;
  eventSlug: string;
  tokenId: string;
  side: DecisionSide;
  notionalUsd: number;
  thesisMd?: string | null;
}

export interface SummaryPlan {
  action: DecisionAction;
  marketSlug: string;
  eventSlug?: string;
  tokenId?: string;
  side?: DecisionSide;
  notionalUsd: number;
  bankrollRatio?: number | null;
  thesisMd?: string | null;
}

export interface SummaryOrder {
  action?: DecisionAction | null;
  marketSlug: string;
  tokenId?: string | null;
  side?: DecisionSide | null;
  requestedNotionalUsd?: number | null;
  filledNotionalUsd?: number | null;
  executionAmount?: number | null;
  executionUnit?: "usd" | "shares" | null;
  orderId?: string | null;
  avgPrice?: number | null;
  status?: string | null;
  ok?: boolean | null;
  reason?: string | null;
}

export interface SummaryBlockedItem {
  action?: DecisionAction | null;
  marketSlug: string;
  tokenId?: string | null;
  reason: string;
}

export interface SummaryPortfolioSnapshot {
  cashUsd: number;
  equityUsd: number;
  openPositions: number;
  drawdownPct: number;
}

export interface SummaryFailure {
  stage: string;
  message: string;
  rawSummary?: string | null;
  nextSteps?: string[];
}

export interface SummaryArtifacts {
  preflightPath?: string | null;
  recommendationPath?: string | null;
  executionSummaryPath?: string | null;
  errorPath?: string | null;
  pulseMarkdownPath?: string | null;
  pulseJsonPath?: string | null;
  runtimeLogPath?: string | null;
  additionalPaths?: string[];
}

export interface LiveRunSummaryInput {
  mode: "live:test" | "pulse:live";
  executionMode: string;
  strategy?: string | null;
  envFilePath?: string | null;
  archiveDir: string;
  runId?: string | null;
  status: "success" | "failed";
  stage?: string | null;
  generatedAtUtc?: string | null;
  promptSummary?: string | null;
  reasoningMd?: string | null;
  decisions?: SummaryDecision[];
  executablePlans?: SummaryPlan[];
  executedOrders?: SummaryOrder[];
  blockedItems?: SummaryBlockedItem[];
  portfolioBefore?: SummaryPortfolioSnapshot | null;
  portfolioAfter?: SummaryPortfolioSnapshot | null;
  positionMarkAttribution?: PositionMarkAttribution | null;
  artifacts?: SummaryArtifacts;
  failure?: SummaryFailure;
}

interface RenderOptions {
  locale: SummaryLocale;
  input: LiveRunSummaryInput;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return `$${value.toFixed(2)}`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatDelta(value: number | null | undefined, formatter: (x: number) => string): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatter(value)}`;
}

function toSingleLine(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string | null | undefined, maxLength: number): string {
  if (!value) {
    return "-";
  }
  const compact = value.trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

function relativeArtifactPath(archiveDir: string, artifactPath: string | null | undefined): string {
  if (!artifactPath) {
    return "-";
  }
  if (!path.isAbsolute(artifactPath)) {
    return artifactPath;
  }
  const relative = path.relative(archiveDir, artifactPath);
  if (!relative || relative === ".") {
    return `./${path.basename(artifactPath)}`;
  }
  return relative.startsWith("..") ? artifactPath : `./${relative}`;
}

function buildActionCounts(input: LiveRunSummaryInput): Record<DecisionAction, number> {
  const counts: Record<DecisionAction, number> = {
    open: 0,
    close: 0,
    reduce: 0,
    hold: 0,
    skip: 0
  };
  const actionItems = input.decisions && input.decisions.length > 0
    ? input.decisions
    : input.executablePlans ?? [];
  for (const item of actionItems) {
    counts[item.action] += 1;
  }
  return counts;
}

function deriveNoTradeReason(input: LiveRunSummaryInput, locale: SummaryLocale): string | null {
  const executed = input.executedOrders ?? [];
  if (executed.some((order) => order.ok ?? (order.status === "filled"))) {
    return null;
  }
  const blocked = input.blockedItems ?? [];
  if (blocked.length > 0) {
    const reasonList = blocked.slice(0, 3).map((item) => `${item.marketSlug}: ${item.reason}`).join(" | ");
    return locale === "zh"
      ? `本轮未下单，主要拦截原因：${reasonList}`
      : `No orders were placed. Primary blockers: ${reasonList}`;
  }
  const decisions = input.decisions ?? [];
  if (decisions.length > 0 && decisions.every((decision) => decision.action === "hold" || decision.action === "skip")) {
    return locale === "zh"
      ? "本轮决策均为 hold/skip，没有可执行买卖单。"
      : "All decisions were hold/skip, so there were no executable orders.";
  }
  if ((input.executablePlans ?? []).length === 0) {
    return locale === "zh"
      ? "本轮没有可执行计划，可能被风控、仓位限制或执行阈值过滤。"
      : "No executable plans remained after risk checks, exposure caps, or execution thresholds.";
  }
  return locale === "zh"
    ? "本轮执行阶段未产生有效成交。"
    : "Execution finished without valid fills.";
}

function renderOverviewSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const generatedAt = input.generatedAtUtc ?? new Date().toISOString();
  const lines = [
    locale === "zh" ? "## 1. 运行概览" : "## 1. Run Overview",
    "",
    `| ${locale === "zh" ? "字段" : "Field"} | ${locale === "zh" ? "值" : "Value"} |`,
    "| --- | --- |",
    `| ${locale === "zh" ? "运行 ID" : "Run ID"} | ${input.runId ?? "-"} |`,
    `| ${locale === "zh" ? "模式" : "Mode"} | ${input.mode} |`,
    `| ${locale === "zh" ? "执行模式" : "Execution Mode"} | ${input.executionMode} |`,
    `| ${locale === "zh" ? "策略" : "Strategy"} | ${input.strategy ?? "-"} |`,
    `| ${locale === "zh" ? "状态" : "Status"} | ${input.status}${input.stage ? ` (${input.stage})` : ""} |`,
    `| ${locale === "zh" ? "时间" : "Time"} | ${generatedAt} |`,
    `| ${locale === "zh" ? "环境文件" : "Env File"} | ${input.envFilePath ?? "-"} |`,
    `| ${locale === "zh" ? "归档目录" : "Archive Dir"} | ${input.archiveDir} |`,
    ""
  ];
  return lines;
}

function renderActionSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const counts = buildActionCounts(input);
  const lines = [
    locale === "zh" ? "## 2. 本轮执行动作" : "## 2. Action Breakdown",
    "",
    `| ${locale === "zh" ? "动作" : "Action"} | ${locale === "zh" ? "数量" : "Count"} |`,
    "| --- | --- |",
    `| open | ${counts.open} |`,
    `| close | ${counts.close} |`,
    `| reduce | ${counts.reduce} |`,
    `| hold | ${counts.hold} |`,
    `| skip | ${counts.skip} |`,
    ""
  ];
  return lines;
}

function renderExecutionSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const executablePlans = input.executablePlans ?? [];
  const executedOrders = input.executedOrders ?? [];
  const lines = [locale === "zh" ? "## 3. 新开仓与已执行订单" : "## 3. New Positions & Executed Orders", ""];

  if (executablePlans.length === 0) {
    lines.push(locale === "zh" ? "- 本轮没有可执行计划。" : "- No executable plans in this run.");
  } else {
    lines.push(locale === "zh" ? "### 可执行计划" : "### Executable Plans");
    lines.push("");
    lines.push(`| ${locale === "zh" ? "动作" : "Action"} | ${locale === "zh" ? "市场" : "Market"} | ${locale === "zh" ? "方向" : "Side"} | ${locale === "zh" ? "金额" : "Notional"} | ${locale === "zh" ? "仓位占比" : "Bankroll Ratio"} |`);
    lines.push("| --- | --- | --- | --- | --- |");
    for (const plan of executablePlans) {
      lines.push(`| ${plan.action} | ${plan.marketSlug} | ${plan.side ?? "-"} | ${formatUsd(plan.notionalUsd)} | ${formatPct(plan.bankrollRatio ?? null)} |`);
    }
  }

  lines.push("");
  if (executedOrders.length === 0) {
    lines.push(locale === "zh" ? "- 本轮没有实际下单成交。" : "- No executed orders in this run.");
  } else {
    lines.push(locale === "zh" ? "### 已执行订单" : "### Executed Orders");
    lines.push("");
    lines.push(`| ${locale === "zh" ? "市场" : "Market"} | ${locale === "zh" ? "方向" : "Side"} | ${locale === "zh" ? "请求金额" : "Requested"} | ${locale === "zh" ? "成交金额" : "Filled"} | ${locale === "zh" ? "订单 ID" : "Order ID"} | ${locale === "zh" ? "结果" : "Result"} |`);
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const order of executedOrders) {
      const requested = order.requestedNotionalUsd ?? order.executionAmount ?? null;
      const result = order.ok == null
        ? (order.status ?? "-")
        : (order.ok ? "ok" : "failed");
      lines.push(`| ${order.marketSlug} | ${order.side ?? "-"} | ${formatUsd(requested)} | ${formatUsd(order.filledNotionalUsd ?? null)} | ${order.orderId ?? "-"} | ${result} |`);
    }
  }
  lines.push("");
  return lines;
}

function renderBlockedSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const blocked = input.blockedItems ?? [];
  const lines = [locale === "zh" ? "## 4. 未执行/被拦截项与原因" : "## 4. Skipped/Blocked Items & Reasons", ""];
  if (blocked.length === 0) {
    const noTradeReason = deriveNoTradeReason(input, locale);
    if (noTradeReason) {
      lines.push(`- ${noTradeReason}`);
    } else {
      lines.push(locale === "zh" ? "- 没有被拦截项。" : "- No blocked items.");
    }
    lines.push("");
    return lines;
  }

  lines.push(`| ${locale === "zh" ? "动作" : "Action"} | ${locale === "zh" ? "市场" : "Market"} | ${locale === "zh" ? "Token" : "Token"} | ${locale === "zh" ? "原因" : "Reason"} |`);
  lines.push("| --- | --- | --- | --- |");
  for (const item of blocked) {
    lines.push(`| ${item.action ?? "-"} | ${item.marketSlug} | ${item.tokenId ?? "-"} | ${item.reason} |`);
  }
  lines.push("");
  return lines;
}

function renderPortfolioSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const before = input.portfolioBefore;
  const after = input.portfolioAfter;
  const lines = [locale === "zh" ? "## 5. 组合变化" : "## 5. Portfolio Changes", ""];

  lines.push(`| ${locale === "zh" ? "指标" : "Metric"} | ${locale === "zh" ? "运行前" : "Before"} | ${locale === "zh" ? "运行后" : "After"} | ${locale === "zh" ? "变化" : "Delta"} |`);
  lines.push("| --- | --- | --- | --- |");

  const addRow = (label: string, beforeValue: number | null | undefined, afterValue: number | null | undefined, formatter: (x: number | null | undefined) => string, deltaFormatter: (x: number) => string) => {
    const delta = beforeValue != null && afterValue != null ? afterValue - beforeValue : null;
    lines.push(`| ${label} | ${formatter(beforeValue)} | ${formatter(afterValue)} | ${delta == null ? "-" : formatDelta(delta, deltaFormatter)} |`);
  };

  addRow(locale === "zh" ? "现金" : "Cash", before?.cashUsd, after?.cashUsd, formatUsd, (value) => formatUsd(value));
  addRow(locale === "zh" ? "净值" : "Equity", before?.equityUsd, after?.equityUsd, formatUsd, (value) => formatUsd(value));
  addRow(locale === "zh" ? "持仓数" : "Open Positions", before?.openPositions, after?.openPositions, (value) => value == null ? "-" : String(value), (value) => value.toFixed(0));
  addRow(locale === "zh" ? "回撤" : "Drawdown", before?.drawdownPct, after?.drawdownPct, formatPct, (value) => formatPct(value));

  lines.push("");
  return lines;
}

function sumFilledCashFlow(orders: SummaryOrder[]) {
  return orders.reduce((sum, order) => {
    const filled = order.filledNotionalUsd ?? 0;
    if (!(order.ok ?? false) || !(filled > 0)) {
      return sum;
    }
    if (order.side === "BUY") {
      return sum - filled;
    }
    if (order.side === "SELL") {
      return sum + filled;
    }
    return sum;
  }, 0);
}

function countExpectedPositionDelta(orders: SummaryOrder[]) {
  return orders.reduce((sum, order) => {
    if (!(order.ok ?? false)) {
      return sum;
    }
    if (order.action === "open") {
      return sum + 1;
    }
    if (order.action === "close") {
      return sum - 1;
    }
    return sum;
  }, 0);
}

function renderPnlAttributionSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const before = input.portfolioBefore;
  const after = input.portfolioAfter;
  if (!before || !after) {
    return [];
  }

  const orders = input.executedOrders ?? [];
  const expectedCashFlow = sumFilledCashFlow(orders);
  const cashDelta = after.cashUsd - before.cashUsd;
  const equityDelta = after.equityUsd - before.equityUsd;
  const expectedPositionDelta = countExpectedPositionDelta(orders);
  const actualPositionDelta = after.openPositions - before.openPositions;
  const cashResidual = cashDelta - expectedCashFlow;
  const hasPositionDeltaMismatch = expectedPositionDelta !== actualPositionDelta;
  const markAttribution = input.positionMarkAttribution ?? null;

  const lines = [locale === "zh" ? "## 6. PnL 归因与成交后核对" : "## 6. PnL Attribution & Post-Fill Audit", ""];
  if (!markAttribution) {
    lines.push(locale === "zh"
      ? "> 这是账户级初步归因。更精确的逐仓 PnL 需要保存成交前后每个 token 的 mark 快照。"
      : "> This is account-level first-pass attribution. Precise per-position PnL requires token-level mark snapshots before and after execution.");
    lines.push("");
  }
  lines.push(`| ${locale === "zh" ? "项目" : "Item"} | ${locale === "zh" ? "数值" : "Value"} | ${locale === "zh" ? "说明" : "Note"} |`);
  lines.push("| --- | --- | --- |");
  lines.push(`| ${locale === "zh" ? "成交现金流估算" : "Estimated fill cash flow"} | ${formatDelta(expectedCashFlow, formatUsd)} | ${locale === "zh" ? "BUY 为现金流出，SELL 为现金流入" : "BUY is cash outflow; SELL is cash inflow"} |`);
  lines.push(`| ${locale === "zh" ? "实际现金变化" : "Actual cash delta"} | ${formatDelta(cashDelta, formatUsd)} | ${locale === "zh" ? "运行后现金 - 运行前现金" : "post-run cash minus pre-run cash"} |`);
  lines.push(`| ${locale === "zh" ? "现金残差" : "Cash residual"} | ${formatDelta(cashResidual, formatUsd)} | ${locale === "zh" ? "实际现金变化 - 成交现金流；可能来自费用、四舍五入、未刷新余额" : "actual cash delta minus fill cash flow; may be fees, rounding, or stale balance"} |`);
  lines.push(`| ${locale === "zh" ? "净值变化" : "Equity delta"} | ${formatDelta(equityDelta, formatUsd)} | ${locale === "zh" ? "包含已有仓位 mark-to-market、新仓即时价差、费用或估值口径变化" : "includes existing-position mark-to-market, new-fill spread, fees, or valuation differences"} |`);
  lines.push(`| ${locale === "zh" ? "预期持仓数变化" : "Expected position-count delta"} | ${formatDelta(expectedPositionDelta, (value) => value.toFixed(0))} | ${locale === "zh" ? "按 open/close 成交估算；reduce 不改变持仓数" : "estimated from open/close fills; reduce does not change position count"} |`);
  lines.push(`| ${locale === "zh" ? "实际持仓数变化" : "Actual position-count delta"} | ${formatDelta(actualPositionDelta, (value) => value.toFixed(0))} | ${hasPositionDeltaMismatch ? (locale === "zh" ? "需要核对 execution-summary positions 与远端仓位刷新" : "requires checking execution-summary positions and remote position refresh") : (locale === "zh" ? "与成交动作一致" : "consistent with fills")} |`);
  lines.push("");

  if (!markAttribution) {
    return lines;
  }

  const totals = markAttribution.totals;
  const unexplainedEquityDelta = equityDelta - expectedCashFlow - totals.markedValueDeltaUsd;
  lines.push(locale === "zh" ? "### 逐仓 mark 快照归因" : "### Per-Position Mark Snapshot Attribution");
  lines.push("");
  lines.push(`| ${locale === "zh" ? "项目" : "Item"} | ${locale === "zh" ? "数值" : "Value"} |`);
  lines.push("| --- | --- |");
  lines.push(`| ${locale === "zh" ? "运行前持仓 mark 总值" : "Pre-run marked position value"} | ${formatUsd(totals.beforeMarkedValueUsd)} |`);
  lines.push(`| ${locale === "zh" ? "运行后持仓 mark 总值" : "Post-run marked position value"} | ${formatUsd(totals.afterMarkedValueUsd)} |`);
  lines.push(`| ${locale === "zh" ? "持仓 mark 总变化" : "Total marked value delta"} | ${formatDelta(totals.markedValueDeltaUsd, formatUsd)} |`);
  lines.push(`| ${locale === "zh" ? "未成交已有仓位 mark 变化" : "Untraded existing-position mark delta"} | ${formatDelta(totals.untradedExistingMarkDeltaUsd, formatUsd)} |`);
  lines.push(`| ${locale === "zh" ? "成交相关已有仓位 mark 变化" : "Traded existing-position mark delta"} | ${formatDelta(totals.tradedExistingMarkDeltaUsd, formatUsd)} |`);
  lines.push(`| ${locale === "zh" ? "新仓成交后 mark-vs-fill 差额" : "New-position mark-vs-fill delta"} | ${formatDelta(totals.newPositionMarkVsFillDeltaUsd, formatUsd)} |`);
  lines.push(`| ${locale === "zh" ? "净值未解释残差" : "Unexplained equity residual"} | ${formatDelta(unexplainedEquityDelta, formatUsd)} |`);
  lines.push("");

  const rows = markAttribution.changes.slice(0, 12);
  if (rows.length === 0) {
    lines.push(locale === "zh" ? "- 没有逐仓 mark 变化记录。" : "- No per-position mark changes were recorded.");
    lines.push("");
    return lines;
  }
  lines.push(`| ${locale === "zh" ? "市场" : "Market"} | ${locale === "zh" ? "状态" : "Status"} | ${locale === "zh" ? "运行前价/值" : "Before price/value"} | ${locale === "zh" ? "运行后价/值" : "After price/value"} | ${locale === "zh" ? "价值变化" : "Value delta"} | ${locale === "zh" ? "mark-vs-fill" : "mark-vs-fill"} |`);
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const change of rows) {
    const beforeCell = `${formatPct(change.beforeMarkPrice)} / ${formatUsd(change.beforeValueUsd)}`;
    const afterCell = `${formatPct(change.afterMarkPrice)} / ${formatUsd(change.afterValueUsd)}`;
    lines.push(`| ${change.marketSlug} | ${change.status} | ${beforeCell} | ${afterCell} | ${formatDelta(change.valueDeltaUsd, formatUsd)} | ${formatDelta(change.markVsFillDeltaUsd, formatUsd)} |`);
  }
  lines.push("");
  return lines;
}

function renderReasoningSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const lines = [locale === "zh" ? "## 7. 决策原因摘要" : "## 7. Decision Reasoning Summary", ""];

  lines.push(`- ${locale === "zh" ? "Prompt 摘要" : "Prompt Summary"}: ${toSingleLine(input.promptSummary)}`);
  lines.push(`- ${locale === "zh" ? "推理摘要" : "Reasoning Summary"}: ${truncate(input.reasoningMd, 500)}`);

  const thesisCandidates = (input.decisions ?? [])
    .filter((decision) => decision.thesisMd && decision.thesisMd.trim().length > 0)
    .slice(0, 5);
  if (thesisCandidates.length > 0) {
    lines.push(locale === "zh" ? "- 重点归因：" : "- Key Thesis Attribution:");
    for (const item of thesisCandidates) {
      lines.push(`  - ${item.action} ${item.marketSlug}: ${truncate(item.thesisMd, 180)}`);
    }
  } else {
    const noTradeReason = deriveNoTradeReason(input, locale);
    if (noTradeReason) {
      lines.push(`- ${locale === "zh" ? "未下单原因" : "No-Trade Reason"}: ${noTradeReason}`);
    }
  }
  lines.push("");
  return lines;
}

function renderFailureSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const failure = input.failure;
  if (input.status !== "failed" || !failure) {
    return [];
  }
  const lines = [
    locale === "zh" ? "## 8. 失败说明与下一步" : "## 8. Failure Context & Next Steps",
    "",
    `- ${locale === "zh" ? "失败阶段" : "Failed Stage"}: ${failure.stage}`,
    `- ${locale === "zh" ? "错误摘要" : "Error Summary"}: ${failure.message}`
  ];
  if (failure.rawSummary) {
    lines.push(`- ${locale === "zh" ? "原始错误" : "Raw Error"}: ${failure.rawSummary}`);
  }
  const nextSteps = failure.nextSteps ?? [];
  if (nextSteps.length > 0) {
    lines.push(locale === "zh" ? "- 建议排查：" : "- Suggested Next Steps:");
    for (const step of nextSteps) {
      lines.push(`  - ${step}`);
    }
  }
  lines.push("");
  return lines;
}

function renderArtifactSection(options: RenderOptions): string[] {
  const { locale, input } = options;
  const artifacts = input.artifacts ?? {};
  const lines = [locale === "zh" ? "## 9. 关键产物索引" : "## 9. Artifact Index", ""];
  const items: Array<[string, string | null | undefined]> = [
    ["preflight.json", artifacts.preflightPath],
    ["recommendation.json", artifacts.recommendationPath],
    ["execution-summary.json", artifacts.executionSummaryPath],
    ["error.json", artifacts.errorPath],
    ["pulse markdown", artifacts.pulseMarkdownPath],
    ["pulse json", artifacts.pulseJsonPath],
    ["runtime-log", artifacts.runtimeLogPath]
  ];
  for (const extra of artifacts.additionalPaths ?? []) {
    items.push([path.basename(extra), extra]);
  }

  for (const [label, value] of items) {
    const relativePath = relativeArtifactPath(input.archiveDir, value);
    lines.push(`- ${label}: ${relativePath}`);
  }
  lines.push("");
  return lines;
}

function renderMarkdown(options: RenderOptions): string {
  const { locale, input } = options;
  const title = locale === "zh" ? "# 运行总结" : "# Run Summary";
  const lines: string[] = [title, ""];
  lines.push(...renderOverviewSection(options));
  lines.push(...renderActionSection(options));
  lines.push(...renderExecutionSection(options));
  lines.push(...renderBlockedSection(options));
  lines.push(...renderPortfolioSection(options));
  lines.push(...renderPnlAttributionSection(options));
  lines.push(...renderReasoningSection(options));
  lines.push(...renderFailureSection(options));
  lines.push(...renderArtifactSection(options));
  return lines.join("\n").trimEnd() + "\n";
}

function normalizePortfolio(overview: OverviewResponse): SummaryPortfolioSnapshot {
  return {
    cashUsd: overview.cash_balance_usd,
    equityUsd: overview.total_equity_usd,
    openPositions: overview.open_positions,
    drawdownPct: overview.drawdown_pct
  };
}

export function buildRunSummaryMarkdown(input: LiveRunSummaryInput): { zh: string; en: string } {
  return {
    zh: renderMarkdown({ locale: "zh", input }),
    en: renderMarkdown({ locale: "en", input })
  };
}

export async function writeRunSummaryArtifacts(input: LiveRunSummaryInput) {
  await mkdir(input.archiveDir, { recursive: true });
  const markdown = buildRunSummaryMarkdown(input);
  const zhPath = path.join(input.archiveDir, "run-summary.md");
  const enPath = path.join(input.archiveDir, "run-summary.en.md");
  await Promise.all([
    writeFile(zhPath, markdown.zh, "utf8"),
    writeFile(enPath, markdown.en, "utf8")
  ]);
  return {
    zhPath,
    enPath
  };
}

export function mapOverviewToSummarySnapshot(overview: OverviewResponse): SummaryPortfolioSnapshot {
  return normalizePortfolio(overview);
}
