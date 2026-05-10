import type {
  Artifact,
  OverviewResponse,
  PublicPosition,
  PublicRunDetail,
  PublicTrade,
  TradeDecision,
  TradeDecisionSet
} from "@autopoly/contracts";
import type { OrchestratorConfig } from "../config.js";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { PositionReviewResult, PulseEntryPlan } from "../runtime/decision-metadata.js";
import {
  buildArtifactRelativePath,
  writeStoredMarkdownPair
} from "./artifacts.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatUsd(value: number): string {
  return currencyFormatter.format(value);
}

function formatSignedUsd(value: number): string {
  if (Math.abs(value) < 1e-9) {
    return formatUsd(0);
  }
  return `${value > 0 ? "+" : "-"}${formatUsd(Math.abs(value))}`;
}

function formatPct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPct(value: number, digits = 2): string {
  const formatted = formatPct(Math.abs(value), digits);
  if (Math.abs(value) < 1e-9) {
    return formatted;
  }
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function formatExecutionAmount(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function formatTimestampUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const iso = parsed.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function escapeMarkdownCell(value: string): string {
  const collapsed = value.replace(/\s*\n+\s*/g, "<br>").replace(/\|/g, "/").trim();
  return collapsed.length === 0 ? "-" : collapsed;
}

function buildMarkdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return "";
  }
  return [
    `| ${headers.map(escapeMarkdownCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeMarkdownCell).join(" | ")} |`)
  ].join("\n");
}

function sumPositionValueUsd(positions: PublicPosition[]): number {
  return positions.reduce((sum, position) => sum + position.current_value_usd, 0);
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function summarizeCountMap(counts: Map<string, number>): string {
  if (counts.size === 0) {
    return "none";
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ");
}

function estimatePreRiskOpenUsd(decision: TradeDecision): number {
  if (decision.action !== "open") {
    return decision.notional_usd;
  }
  return decision.liquidity_cap_usd != null
    ? Math.min(decision.notional_usd, decision.liquidity_cap_usd)
    : decision.notional_usd;
}

function buildEntryLineZh(plan: PulseEntryPlan) {
  const liquidityCappedUsd = plan.liquidityCapUsd != null
    ? Math.min(plan.decision.notional_usd, plan.liquidityCapUsd)
    : plan.decision.notional_usd;
  const grossEdge = plan.aiProb - plan.marketProb;
  const parts = [
    `- ${plan.marketSlug}`,
    `Edge: +${formatPct(grossEdge)} (net +${formatPct(plan.netEdge)} after ${formatPct(plan.entryFeePct)} fee)`,
    `1/4 Kelly ${formatPct(plan.quarterKellyPct)} -> ${formatUsd(plan.decision.notional_usd)}`
  ];
  if (plan.categorySlug) {
    parts.push(`类别: ${plan.categorySlug} (${formatPct(plan.roundTripFeePct)} 往返费率)`);
  }
  if (plan.liquidityCapUsd != null) {
    parts.push(`流动性上限 ${formatUsd(plan.liquidityCapUsd)}`);
    if (liquidityCappedUsd + 1e-9 < plan.decision.notional_usd) {
      parts.push(`流动性裁剪后 ${formatUsd(liquidityCappedUsd)}`);
    }
  }
  if (plan.reportedSuggestedPct != null) {
    parts.push(`Pulse 报告仓位 ${formatPct(plan.reportedSuggestedPct)}`);
  }
  parts.push(`理由：${plan.thesisMd}`);
  return parts.join(" | ");
}

function buildEntryLineEn(plan: PulseEntryPlan) {
  const liquidityCappedUsd = plan.liquidityCapUsd != null
    ? Math.min(plan.decision.notional_usd, plan.liquidityCapUsd)
    : plan.decision.notional_usd;
  const grossEdge = plan.aiProb - plan.marketProb;
  const parts = [
    `- ${plan.marketSlug}`,
    `Edge: +${formatPct(grossEdge)} (net +${formatPct(plan.netEdge)} after ${formatPct(plan.entryFeePct)} fee)`,
    `Quarter Kelly ${formatPct(plan.quarterKellyPct)} -> ${formatUsd(plan.decision.notional_usd)}`
  ];
  if (plan.categorySlug) {
    parts.push(`Category: ${plan.categorySlug} (${formatPct(plan.roundTripFeePct)} round-trip fee)`);
  }
  if (plan.liquidityCapUsd != null) {
    parts.push(`liquidity cap ${formatUsd(plan.liquidityCapUsd)}`);
    if (liquidityCappedUsd + 1e-9 < plan.decision.notional_usd) {
      parts.push(`after liquidity clip ${formatUsd(liquidityCappedUsd)}`);
    }
  }
  if (plan.reportedSuggestedPct != null) {
    parts.push(`Pulse markdown size ${formatPct(plan.reportedSuggestedPct)}`);
  }
  parts.push(`reason: ${plan.thesisMd}`);
  return parts.join(" | ");
}

function describeDecisionAmountZh(decision: TradeDecision) {
  if (decision.action === "open") {
    const preRiskOpenUsd = estimatePreRiskOpenUsd(decision);
    return preRiskOpenUsd + 1e-9 < decision.notional_usd
      ? `1/4 Kelly ${formatUsd(decision.notional_usd)} -> 流动性裁剪后 ${formatUsd(preRiskOpenUsd)}`
      : `1/4 Kelly ${formatUsd(decision.notional_usd)}`;
  }
  if (decision.execution_unit === "shares" && decision.execution_amount != null) {
    const parts = [`影响 ${formatUsd(decision.notional_usd)}`];
    if (decision.position_value_usd != null) {
      parts.push(`当前仓位 ${formatUsd(decision.position_value_usd)}`);
    }
    parts.push(`执行 ${formatExecutionAmount(decision.execution_amount)} shares`);
    return parts.join(" | ");
  }
  return formatUsd(decision.notional_usd);
}

function describeDecisionAmountEn(decision: TradeDecision) {
  if (decision.action === "open") {
    const preRiskOpenUsd = estimatePreRiskOpenUsd(decision);
    return preRiskOpenUsd + 1e-9 < decision.notional_usd
      ? `Quarter Kelly ${formatUsd(decision.notional_usd)} -> after liquidity clip ${formatUsd(preRiskOpenUsd)}`
      : `Quarter Kelly ${formatUsd(decision.notional_usd)}`;
  }
  if (decision.execution_unit === "shares" && decision.execution_amount != null) {
    const parts = [`impact ${formatUsd(decision.notional_usd)}`];
    if (decision.position_value_usd != null) {
      parts.push(`current position ${formatUsd(decision.position_value_usd)}`);
    }
    parts.push(`execute ${formatExecutionAmount(decision.execution_amount)} shares`);
    return parts.join(" | ");
  }
  return formatUsd(decision.notional_usd);
}

function summarizeActions(decisions: TradeDecision[]) {
  const counts = {
    open: 0,
    close: 0,
    reduce: 0,
    hold: 0,
    skip: 0
  };
  for (const decision of decisions) {
    counts[decision.action] += 1;
  }
  return counts;
}

function buildEventExposureMap(positions: PublicPosition[]) {
  const exposure = new Map<string, number>();
  for (const position of positions) {
    exposure.set(position.event_slug, (exposure.get(position.event_slug) ?? 0) + position.current_value_usd);
  }
  return exposure;
}

function applyDecisionExposureDelta(
  before: Map<string, number>,
  positions: PublicPosition[],
  decisions: TradeDecision[]
) {
  const after = new Map(before);
  const setExposure = (eventSlug: string, value: number) => {
    if (value <= 0) {
      after.delete(eventSlug);
      return;
    }
    after.set(eventSlug, value);
  };
  for (const decision of decisions) {
    if (decision.action === "open") {
      setExposure(decision.event_slug, (after.get(decision.event_slug) ?? 0) + estimatePreRiskOpenUsd(decision));
      continue;
    }
    if (decision.action === "close") {
      const current = positions.find((position) => position.token_id === decision.token_id)?.current_value_usd ?? 0;
      setExposure(decision.event_slug, Math.max(0, (after.get(decision.event_slug) ?? 0) - current));
      continue;
    }
    if (decision.action === "reduce") {
      setExposure(decision.event_slug, Math.max(0, (after.get(decision.event_slug) ?? 0) - decision.notional_usd));
    }
  }
  return after;
}

function topEntries(exposure: Map<string, number>, limit = 5) {
  return [...exposure.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function buildReviewMarkdown(input: {
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
  decisionSet: TradeDecisionSet;
  promptSummary: string;
  reasoningMd: string;
  positionReviews?: PositionReviewResult[];
  entryPlans?: PulseEntryPlan[];
}) {
  const counts = summarizeActions(input.decisionSet.decisions);
  const keyDecisions = input.decisionSet.decisions.filter((decision) => decision.action !== "hold").slice(0, 6);
  const positionReviews = input.positionReviews ?? [];
  const entryPlans = input.entryPlans ?? [];
  const totalMarkedExposureUsd = sumPositionValueUsd(input.positions);
  const manualReviewCount = positionReviews.filter((review) => review.humanReviewFlag).length;
  const stillHasEdgeCount = positionReviews.filter((review) => review.stillHasEdge).length;
  const losingPositions = [...input.positions]
    .filter((position) => position.unrealized_pnl_pct < 0)
    .sort((left, right) => left.unrealized_pnl_pct - right.unrealized_pnl_pct)
    .slice(0, 3);
  const pulseCoverageCounts = summarizeCountMap(countValues(positionReviews.map((review) => review.pulseCoverage)));

  const reviewLinesZh = positionReviews.length === 0
    ? ["- 当前没有独立的已有仓位复审结果。"]
    : positionReviews.map((review) =>
        `- ${review.position.market_slug} | 结论 ${review.action} | 仍有 edge：${review.stillHasEdge ? "是" : "否"} | edge=${review.edgeValue.toFixed(4)} | Pulse 覆盖：${review.pulseCoverage} | 证据刷新：${review.evidenceRefreshStatus} | 人工复核：${review.humanReviewFlag ? "是" : "否"} | fresh evidence：${review.freshEvidence.join(" / ")} | adverse：${review.adverseSignals.length > 0 ? review.adverseSignals.join(" / ") : "无"} | trigger：${review.stopOrReduceTriggers.join(" / ")} | 归因：${review.basis} | ${review.reviewConclusion} | 原因：${review.reason}`
      );
  const reviewLinesEn = positionReviews.length === 0
    ? ["- No standalone existing-position review results were produced."]
    : positionReviews.map((review) =>
        `- ${review.position.market_slug} | action ${review.action} | still has edge: ${review.stillHasEdge ? "yes" : "no"} | edge=${review.edgeValue.toFixed(4)} | pulse coverage: ${review.pulseCoverage} | evidence refresh: ${review.evidenceRefreshStatus} | human review: ${review.humanReviewFlag ? "yes" : "no"} | fresh evidence: ${review.freshEvidence.join(" / ")} | adverse: ${review.adverseSignals.length > 0 ? review.adverseSignals.join(" / ") : "none"} | trigger: ${review.stopOrReduceTriggers.join(" / ")} | basis: ${review.basis} | ${review.reviewConclusion} | reason: ${review.reason}`
      );
  const entryLinesZh = entryPlans.length === 0
    ? ["- 本轮没有新的开仓建议。"]
    : entryPlans.slice(0, 6).map(buildEntryLineZh);
  const entryLinesEn = entryPlans.length === 0
    ? ["- No new entry suggestions were produced in this run."]
    : entryPlans.slice(0, 6).map(buildEntryLineEn);

  const reviewTableZh = buildMarkdownTable(
    ["市场", "结果", "当前价值", "浮盈亏", "结论", "Pulse 覆盖", "证据刷新", "人工复核"],
    positionReviews.slice(0, 8).map((review) => [
      review.position.market_slug,
      review.position.outcome_label,
      formatUsd(review.position.current_value_usd),
      formatSignedPct(review.position.unrealized_pnl_pct),
      review.action,
      review.pulseCoverage,
      review.evidenceRefreshStatus,
      review.humanReviewFlag ? "是" : "否"
    ])
  );
  const entryTableZh = buildMarkdownTable(
    ["市场", "方向", "市场价", "AI", "Edge", "Net Edge", "费率", "1/4 Kelly", "建议金额", "流动性上限"],
    entryPlans.slice(0, 8).map((plan) => [
      plan.marketSlug,
      `买入 ${plan.outcomeLabel}`,
      formatPct(plan.marketProb),
      formatPct(plan.aiProb),
      formatSignedPct(plan.aiProb - plan.marketProb),
      formatSignedPct(plan.netEdge),
      formatPct(plan.entryFeePct),
      formatPct(plan.quarterKellyPct),
      formatUsd(plan.decision.notional_usd),
      plan.liquidityCapUsd == null ? "无" : formatUsd(plan.liquidityCapUsd)
    ])
  );
  const reviewTableEn = buildMarkdownTable(
    ["Market", "Outcome", "Current Value", "Unrealized PnL", "Action", "Pulse Coverage", "Evidence Refresh", "Human Review"],
    positionReviews.slice(0, 8).map((review) => [
      review.position.market_slug,
      review.position.outcome_label,
      formatUsd(review.position.current_value_usd),
      formatSignedPct(review.position.unrealized_pnl_pct),
      review.action,
      review.pulseCoverage,
      review.evidenceRefreshStatus,
      review.humanReviewFlag ? "yes" : "no"
    ])
  );
  const entryTableEn = buildMarkdownTable(
    ["Market", "Direction", "Market", "AI", "Edge", "Net Edge", "Fee", "Quarter Kelly", "Suggested Notional", "Liquidity Cap"],
    entryPlans.slice(0, 8).map((plan) => [
      plan.marketSlug,
      `Buy ${plan.outcomeLabel}`,
      formatPct(plan.marketProb),
      formatPct(plan.aiProb),
      formatSignedPct(plan.aiProb - plan.marketProb),
      formatSignedPct(plan.netEdge),
      formatPct(plan.entryFeePct),
      formatPct(plan.quarterKellyPct),
      formatUsd(plan.decision.notional_usd),
      plan.liquidityCapUsd == null ? "none" : formatUsd(plan.liquidityCapUsd)
    ])
  );

  const reviewHotspotsZh = [
    ...keyDecisions.slice(0, 3).map((decision) =>
      `- 新决策 ${decision.action} ${decision.market_slug} | edge ${formatSignedPct(decision.edge)} | ${describeDecisionAmountZh(decision)} | 原因：${decision.thesis_md}`
    ),
    ...positionReviews
      .filter((review) => review.humanReviewFlag)
      .slice(0, 3)
      .map((review) =>
        `- 已有仓位 ${review.position.market_slug} | 当前价值 ${formatUsd(review.position.current_value_usd)} | 浮盈亏 ${formatSignedPct(review.position.unrealized_pnl_pct)} | 结论 ${review.action} | 原因：${review.reason}`
      ),
    ...(input.pulse.riskFlags.length === 0
      ? []
      : [`- Pulse 风险标记：${input.pulse.riskFlags.join("；")}`])
  ];
  const reviewHotspotsEn = [
    ...keyDecisions.slice(0, 3).map((decision) =>
      `- New decision ${decision.action} ${decision.market_slug} | edge ${formatSignedPct(decision.edge)} | ${describeDecisionAmountEn(decision)} | reason: ${decision.thesis_md}`
    ),
    ...positionReviews
      .filter((review) => review.humanReviewFlag)
      .slice(0, 3)
      .map((review) =>
        `- Existing position ${review.position.market_slug} | current value ${formatUsd(review.position.current_value_usd)} | unrealized PnL ${formatSignedPct(review.position.unrealized_pnl_pct)} | action ${review.action} | reason: ${review.reason}`
      ),
    ...(input.pulse.riskFlags.length === 0
      ? []
      : [`- Pulse risk flags: ${input.pulse.riskFlags.join("; ")}`])
  ];

  const gapLinesZh = [
    `- 需要人工复核的已有仓位：${manualReviewCount} 笔；仍有 edge 的复审结论：${stillHasEdgeCount}/${positionReviews.length || 0}。`,
    `- Pulse 覆盖分布：${pulseCoverageCounts}。如果大部分都是 none，说明这轮更多是在做持仓保守复查，而不是拿到了新的强证据。`,
    `- 这份报告基于当前组合快照 + 本轮 decision set，不等于最终成交后的账户状态；live 风控、最小交易额和交易所门槛仍可能继续裁剪。`,
    ...(losingPositions.length === 0
      ? ["- 当前没有浮亏仓位进入人工优先核对列表。"]
      : losingPositions.map((position) =>
          `- 浮亏关注：${position.market_slug} | 当前价值 ${formatUsd(position.current_value_usd)} | 浮盈亏 ${formatSignedPct(position.unrealized_pnl_pct)} | 止损 ${formatPct(position.stop_loss_pct)}`
        ))
  ];
  const gapLinesEn = [
    `- Existing positions needing human review: ${manualReviewCount}; review results still claiming edge: ${stillHasEdgeCount}/${positionReviews.length || 0}.`,
    `- Pulse coverage distribution: ${pulseCoverageCounts}. If most entries are none, this run behaved more like a defensive portfolio review than a fresh edge refresh.`,
    `- This report is based on the current portfolio snapshot plus the current decision set. It is not the final post-fill account state; live risk caps, minimum order size, and exchange thresholds may still clip further.`,
    ...(losingPositions.length === 0
      ? ["- No losing positions are currently in the top human-review queue."]
      : losingPositions.map((position) =>
          `- Losing position to watch: ${position.market_slug} | current value ${formatUsd(position.current_value_usd)} | unrealized PnL ${formatSignedPct(position.unrealized_pnl_pct)} | stop loss ${formatPct(position.stop_loss_pct)}`
        ))
  ];

  const zh = [
    "# 组合复盘报告",
    "",
    "## 人工优先核对",
    "",
    ...(reviewHotspotsZh.length === 0 ? ["- 本轮没有额外的人类优先核对项。"] : reviewHotspotsZh),
    "",
    "## 本轮概览",
    "",
    `- 运行 ID：${input.decisionSet.run_id}`,
    `- 决策运行时：${input.decisionSet.runtime}`,
    `- 脉冲候选数：${input.pulse.selectedCandidates}`,
    `- 当前持仓数：${input.positions.length}`,
    `- 现金：${formatUsd(input.overview.cash_balance_usd)}`,
    `- 净值：${formatUsd(input.overview.total_equity_usd)}`,
    `- 已标记持仓敞口：${formatUsd(totalMarkedExposureUsd)}`,
    `- 回撤：${formatPct(input.overview.drawdown_pct)}`,
    "",
    "## 动作统计",
    "",
    `- open：${counts.open}`,
    `- close：${counts.close}`,
    `- reduce：${counts.reduce}`,
    `- hold：${counts.hold}`,
    `- skip：${counts.skip}`,
    "",
    "## 已有仓位复审摘要",
    "",
    `- 总复审笔数：${positionReviews.length}`,
    `- 需要人工复核：${manualReviewCount}`,
    `- 仍有 edge：${stillHasEdgeCount}`,
    `- Pulse 覆盖分布：${pulseCoverageCounts}`,
    "",
    "## 已有仓位复审表",
    "",
    ...(reviewTableZh ? [reviewTableZh, ""] : ["- 当前没有独立的已有仓位复审表。", ""]),
    "## 已有仓位复审结果",
    "",
    ...reviewLinesZh,
    "",
    "## 新开仓建议摘要",
    "",
    "> 口径：这里先展示程序内重算的 1/4 Kelly 目标，并单列流动性上限；live 执行时仍会继续套用仓位上限、事件敞口、最小交易额和交易所门槛。",
    "",
    ...(entryTableZh ? [entryTableZh, ""] : ["- 本轮没有新的开仓建议表。", ""]),
    "## 新开仓建议",
    "",
    ...entryLinesZh,
    "",
    "## 关键决策与原因",
    "",
    ...(keyDecisions.length === 0
      ? ["- 本轮没有非 hold 决策。"]
      : keyDecisions.map((decision) => `- ${decision.action} ${decision.market_slug} | ${describeDecisionAmountZh(decision)} | ${decision.thesis_md}`)),
    "",
    "## 缺口与下一步",
    "",
    ...gapLinesZh,
    "",
    "## 模型反思",
    "",
    `- Prompt 摘要：${input.promptSummary}`,
    `- 推理摘要：${input.reasoningMd.replaceAll("\n", " | ")}`,
    `- Pulse 风险标记：${input.pulse.riskFlags.length === 0 ? "无" : input.pulse.riskFlags.join("；")}`,
    ""
  ].join("\n");

  const en = [
    "# Portfolio Review Report",
    "",
    "## Human Review First",
    "",
    ...(reviewHotspotsEn.length === 0 ? ["- No additional human-priority review items were produced."] : reviewHotspotsEn),
    "",
    "## Run Overview",
    "",
    `- Run ID: ${input.decisionSet.run_id}`,
    `- Runtime: ${input.decisionSet.runtime}`,
    `- Pulse candidates: ${input.pulse.selectedCandidates}`,
    `- Current positions: ${input.positions.length}`,
    `- Cash: ${formatUsd(input.overview.cash_balance_usd)}`,
    `- Equity: ${formatUsd(input.overview.total_equity_usd)}`,
    `- Marked exposure: ${formatUsd(totalMarkedExposureUsd)}`,
    `- Drawdown: ${formatPct(input.overview.drawdown_pct)}`,
    "",
    "## Action Counts",
    "",
    `- open: ${counts.open}`,
    `- close: ${counts.close}`,
    `- reduce: ${counts.reduce}`,
    `- hold: ${counts.hold}`,
    `- skip: ${counts.skip}`,
    "",
    "## Existing Position Review Summary",
    "",
    `- Reviewed positions: ${positionReviews.length}`,
    `- Human-review flags: ${manualReviewCount}`,
    `- Still-has-edge results: ${stillHasEdgeCount}`,
    `- Pulse coverage distribution: ${pulseCoverageCounts}`,
    "",
    "## Existing Position Review Table",
    "",
    ...(reviewTableEn ? [reviewTableEn, ""] : ["- No standalone existing-position review table was produced.", ""]),
    "## Existing Position Review Results",
    "",
    ...reviewLinesEn,
    "",
    "## New Entry Suggestions Summary",
    "",
    "> Basis: this section shows the programmatic quarter-Kelly target first and lists any liquidity cap separately. Live execution may still clip further for bankroll, exposure, minimum trade size, and exchange thresholds.",
    "",
    ...(entryTableEn ? [entryTableEn, ""] : ["- No new entry summary table was produced in this run.", ""]),
    "## New Entry Suggestions",
    "",
    ...entryLinesEn,
    "",
    "## Key Decisions and Reasons",
    "",
    ...(keyDecisions.length === 0
      ? ["- No non-hold decisions were produced in this run."]
      : keyDecisions.map((decision) => `- ${decision.action} ${decision.market_slug} | ${describeDecisionAmountEn(decision)} | ${decision.thesis_md}`)),
    "",
    "## Gaps and Follow-up",
    "",
    ...gapLinesEn,
    "",
    "## Model Reflection",
    "",
    `- Prompt summary: ${input.promptSummary}`,
    `- Reasoning summary: ${input.reasoningMd.replaceAll("\n", " | ")}`,
    `- Pulse risk flags: ${input.pulse.riskFlags.length === 0 ? "none" : input.pulse.riskFlags.join("; ")}`,
    ""
  ].join("\n");

  return { zh, en };
}

function buildMonitorMarkdown(input: {
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
}) {
  const totalMarkedExposureUsd = sumPositionValueUsd(input.positions);
  const negativePositions = input.positions
    .filter((position) => position.unrealized_pnl_pct < 0)
    .sort((left, right) => left.unrealized_pnl_pct - right.unrealized_pnl_pct)
    .slice(0, 5);
  const nearStopLoss = input.positions.filter((position) => position.unrealized_pnl_pct <= -(position.stop_loss_pct * 0.7));
  const exposureRows = topEntries(buildEventExposureMap(input.positions), 5);

  const watchTableZh = buildMarkdownTable(
    ["市场", "结果", "当前价值", "浮盈亏", "止损", "距止损余量"],
    negativePositions.map((position) => [
      position.market_slug,
      position.outcome_label,
      formatUsd(position.current_value_usd),
      formatSignedPct(position.unrealized_pnl_pct),
      formatPct(position.stop_loss_pct),
      formatPct(position.stop_loss_pct + position.unrealized_pnl_pct)
    ])
  );
  const exposureTableZh = buildMarkdownTable(
    ["事件", "敞口", "净值占比"],
    exposureRows.map(([eventSlug, exposure]) => [
      eventSlug,
      formatUsd(exposure),
      formatPct(input.overview.total_equity_usd > 0 ? exposure / input.overview.total_equity_usd : 0)
    ])
  );
  const watchTableEn = buildMarkdownTable(
    ["Market", "Outcome", "Current Value", "Unrealized PnL", "Stop Loss", "Buffer to Stop"],
    negativePositions.map((position) => [
      position.market_slug,
      position.outcome_label,
      formatUsd(position.current_value_usd),
      formatSignedPct(position.unrealized_pnl_pct),
      formatPct(position.stop_loss_pct),
      formatPct(position.stop_loss_pct + position.unrealized_pnl_pct)
    ])
  );
  const exposureTableEn = buildMarkdownTable(
    ["Event", "Exposure", "Share of Equity"],
    exposureRows.map(([eventSlug, exposure]) => [
      eventSlug,
      formatUsd(exposure),
      formatPct(input.overview.total_equity_usd > 0 ? exposure / input.overview.total_equity_usd : 0)
    ])
  );

  const zh = [
    "# 组合监控报告",
    "",
    "## 人工优先核对",
    "",
    ...(nearStopLoss.length === 0
      ? ["- 当前没有逼近止损线的仓位。"]
      : nearStopLoss.slice(0, 3).map((position) =>
          `- ${position.market_slug} | 浮盈亏 ${formatSignedPct(position.unrealized_pnl_pct)} | 止损 ${formatPct(position.stop_loss_pct)} | 当前价值 ${formatUsd(position.current_value_usd)}`
        )),
    ...(input.pulse.riskFlags.length === 0 ? [] : [`- Pulse 风险标记：${input.pulse.riskFlags.join("；")}`]),
    "",
    "## 当前快照",
    "",
    `- 系统状态：${input.overview.status}`,
    `- 净值：${formatUsd(input.overview.total_equity_usd)}`,
    `- 现金：${formatUsd(input.overview.cash_balance_usd)}`,
    `- 回撤：${formatPct(input.overview.drawdown_pct)}`,
    `- 未平仓数量：${input.overview.open_positions}`,
    `- 已标记持仓敞口：${formatUsd(totalMarkedExposureUsd)}`,
    "",
    "## 风险观察",
    "",
    `- Pulse 风险标记：${input.pulse.riskFlags.length === 0 ? "无" : input.pulse.riskFlags.join("；")}`,
    `- 接近止损仓位：${nearStopLoss.length}`,
    `- 浮亏仓位：${negativePositions.length}`,
    "",
    "## 事件集中度",
    "",
    ...(exposureTableZh ? [exposureTableZh, ""] : ["- 当前没有事件敞口。", ""]),
    "## 重点盯防仓位",
    "",
    ...(watchTableZh ? [watchTableZh, ""] : ["- 当前没有浮亏仓位。", ""]),
    "## 说明",
    "",
    "- 监控报告基于最新持仓快照，不含盘中逐笔价格路径。",
    "- 若要达到更接近标准 backtest/monitor 的效果，还需要按 token 保存历史 mark 序列和止损触发轨迹。",
    ""
  ].join("\n");

  const en = [
    "# Portfolio Monitor Report",
    "",
    "## Human Review First",
    "",
    ...(nearStopLoss.length === 0
      ? ["- No positions are close to the stop-loss line right now."]
      : nearStopLoss.slice(0, 3).map((position) =>
          `- ${position.market_slug} | unrealized PnL ${formatSignedPct(position.unrealized_pnl_pct)} | stop loss ${formatPct(position.stop_loss_pct)} | current value ${formatUsd(position.current_value_usd)}`
        )),
    ...(input.pulse.riskFlags.length === 0 ? [] : [`- Pulse risk flags: ${input.pulse.riskFlags.join("; ")}`]),
    "",
    "## Current Snapshot",
    "",
    `- System status: ${input.overview.status}`,
    `- Equity: ${formatUsd(input.overview.total_equity_usd)}`,
    `- Cash: ${formatUsd(input.overview.cash_balance_usd)}`,
    `- Drawdown: ${formatPct(input.overview.drawdown_pct)}`,
    `- Open positions: ${input.overview.open_positions}`,
    `- Marked exposure: ${formatUsd(totalMarkedExposureUsd)}`,
    "",
    "## Risk Observations",
    "",
    `- Pulse risk flags: ${input.pulse.riskFlags.length === 0 ? "none" : input.pulse.riskFlags.join("; ")}`,
    `- Positions near stop loss: ${nearStopLoss.length}`,
    `- Losing positions: ${negativePositions.length}`,
    "",
    "## Event Concentration",
    "",
    ...(exposureTableEn ? [exposureTableEn, ""] : ["- No event exposure is currently open.", ""]),
    "## Positions to Watch",
    "",
    ...(watchTableEn ? [watchTableEn, ""] : ["- There are no losing positions right now.", ""]),
    "## Notes",
    "",
    "- This monitor report is built from the latest marked-position snapshot; it does not include intraday price paths.",
    "- To reach a more standard backtest/monitor view, the system still needs token-level historical mark series and stop-loss trigger traces.",
    ""
  ].join("\n");

  return { zh, en };
}

function buildRebalanceMarkdown(input: {
  overview: OverviewResponse;
  positions: PublicPosition[];
  decisionSet: TradeDecisionSet;
}) {
  const before = buildEventExposureMap(input.positions);
  const after = applyDecisionExposureDelta(before, input.positions, input.decisionSet.decisions);
  const beforeRows = topEntries(before);
  const afterRows = topEntries(after);
  const beforeTotalExposureUsd = [...before.values()].reduce((sum, value) => sum + value, 0);
  const afterTotalExposureUsd = [...after.values()].reduce((sum, value) => sum + value, 0);
  const exposureDeltaRows = [...new Set([...before.keys(), ...after.keys()])]
    .map((eventSlug) => {
      const beforeExposure = before.get(eventSlug) ?? 0;
      const afterExposure = after.get(eventSlug) ?? 0;
      return {
        eventSlug,
        beforeExposure,
        afterExposure,
        delta: afterExposure - beforeExposure
      };
    })
    .filter((row) => Math.abs(row.delta) > 1e-9 || row.beforeExposure > 0 || row.afterExposure > 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 8);
  const newEvents = exposureDeltaRows.filter((row) => row.beforeExposure === 0 && row.afterExposure > 0).length;
  const removedEvents = exposureDeltaRows.filter((row) => row.beforeExposure > 0 && row.afterExposure === 0).length;
  const highConcentrationAfter = exposureDeltaRows
    .filter((row) => input.overview.total_equity_usd > 0 && row.afterExposure / input.overview.total_equity_usd >= 0.2)
    .slice(0, 3);

  const deltaTableZh = buildMarkdownTable(
    ["事件", "运行前", "运行后", "变化", "运行后占比"],
    exposureDeltaRows.map((row) => [
      row.eventSlug,
      formatUsd(row.beforeExposure),
      formatUsd(row.afterExposure),
      formatSignedUsd(row.delta),
      formatPct(input.overview.total_equity_usd > 0 ? row.afterExposure / input.overview.total_equity_usd : 0)
    ])
  );
  const topBeforeTableZh = buildMarkdownTable(
    ["事件", "敞口", "净值占比"],
    beforeRows.map(([eventSlug, exposure]) => [
      eventSlug,
      formatUsd(exposure),
      formatPct(input.overview.total_equity_usd > 0 ? exposure / input.overview.total_equity_usd : 0)
    ])
  );
  const topAfterTableZh = buildMarkdownTable(
    ["事件", "敞口", "净值占比"],
    afterRows.map(([eventSlug, exposure]) => [
      eventSlug,
      formatUsd(exposure),
      formatPct(input.overview.total_equity_usd > 0 ? exposure / input.overview.total_equity_usd : 0)
    ])
  );
  const deltaTableEn = buildMarkdownTable(
    ["Event", "Before", "After", "Delta", "After Share"],
    exposureDeltaRows.map((row) => [
      row.eventSlug,
      formatUsd(row.beforeExposure),
      formatUsd(row.afterExposure),
      formatSignedUsd(row.delta),
      formatPct(input.overview.total_equity_usd > 0 ? row.afterExposure / input.overview.total_equity_usd : 0)
    ])
  );
  const topBeforeTableEn = buildMarkdownTable(
    ["Event", "Exposure", "Share of Equity"],
    beforeRows.map(([eventSlug, exposure]) => [
      eventSlug,
      formatUsd(exposure),
      formatPct(input.overview.total_equity_usd > 0 ? exposure / input.overview.total_equity_usd : 0)
    ])
  );
  const topAfterTableEn = buildMarkdownTable(
    ["Event", "Exposure", "Share of Equity"],
    afterRows.map(([eventSlug, exposure]) => [
      eventSlug,
      formatUsd(exposure),
      formatPct(input.overview.total_equity_usd > 0 ? exposure / input.overview.total_equity_usd : 0)
    ])
  );

  const zh = [
    "# 再平衡报告",
    "",
    "> 口径：基于当前持仓 + 本轮决策提案估算结构变化；在 recommend-only / preview 链路中，这不等于实际成交后的账户状态。",
    "",
    "## 人工优先核对",
    "",
    ...(highConcentrationAfter.length === 0
      ? ["- 运行后没有任何单一事件敞口达到净值的 20%。"]
      : highConcentrationAfter.map((row) =>
          `- ${row.eventSlug} | 运行后敞口 ${formatUsd(row.afterExposure)} | 占净值 ${formatPct(row.afterExposure / input.overview.total_equity_usd)}`
        )),
    ...(exposureDeltaRows.length === 0
      ? []
      : [`- 本轮最大敞口变化：${exposureDeltaRows[0]!.eventSlug} | 变化 ${formatSignedUsd(exposureDeltaRows[0]!.delta)}`]),
    "",
    "## 结构变化",
    "",
    `- 运行前事件敞口数：${before.size}`,
    `- 运行后事件敞口数：${after.size}`,
    `- 运行前总敞口：${formatUsd(beforeTotalExposureUsd)}`,
    `- 运行后总敞口：${formatUsd(afterTotalExposureUsd)}`,
    `- 总敞口变化：${formatSignedUsd(afterTotalExposureUsd - beforeTotalExposureUsd)}`,
    `- 新增事件敞口：${newEvents}`,
    `- 清空事件敞口：${removedEvents}`,
    `- 当前净值基准：${formatUsd(input.overview.total_equity_usd)}`,
    `- 敞口占比口径：事件敞口 / ${formatUsd(input.overview.total_equity_usd)}`,
    "",
    "## 这些数字怎么来的",
    "",
    "- 运行前事件敞口数：按当前持仓里的 event_slug 去重后计数。",
    "- 运行后事件敞口数：在运行前的事件敞口基础上，按本轮决策做一遍假设增减后的去重计数。",
    "- open：按 1/4 Kelly 目标与 liquidity_cap_usd 取更小值后，加到对应 event_slug；还未扣除后续 live 风控裁剪。",
    "- close：按该 token 当前持仓市值，从对应 event_slug 扣减。",
    "- reduce：按 decision.notional_usd 从对应 event_slug 扣减。",
    "- 当前净值基准：直接使用 overview.total_equity_usd。",
    "",
    "## 主要事件敞口变化",
    "",
    ...(deltaTableZh ? [deltaTableZh, ""] : ["- 本轮没有产生可计算的事件敞口变化。", ""]),
    "## 运行前 Top 事件敞口",
    "",
    ...(topBeforeTableZh ? [topBeforeTableZh, ""] : ["- 空组合。", ""]),
    "## 运行后 Top 事件敞口",
    "",
    ...(topAfterTableZh ? [topAfterTableZh, ""] : ["- 空组合。", ""]),
    "## 假设与缺口",
    "",
    "- 这里是 proposal-based 视图，不包含成交失败、部分成交、后续止损和行情波动带来的偏差。",
    "- 如果要达到标准稿里的真实再平衡归因，还需要保存每次 fill 之后的实际仓位快照与事件级历史敞口轨迹。",
    ""
  ].join("\n");

  const en = [
    "# Rebalance Report",
    "",
    "> Basis: this is a proposal-based structure view built from current positions plus this run's decisions. On recommend-only / preview flows, it is not the same as the post-fill account state.",
    "",
    "## Human Review First",
    "",
    ...(highConcentrationAfter.length === 0
      ? ["- No single event exposure reaches 20% of equity after the proposed rebalance."]
      : highConcentrationAfter.map((row) =>
          `- ${row.eventSlug} | after exposure ${formatUsd(row.afterExposure)} | share of equity ${formatPct(row.afterExposure / input.overview.total_equity_usd)}`
        )),
    ...(exposureDeltaRows.length === 0
      ? []
      : [`- Largest exposure swing this run: ${exposureDeltaRows[0]!.eventSlug} | delta ${formatSignedUsd(exposureDeltaRows[0]!.delta)}`]),
    "",
    "## Structure Change",
    "",
    `- Event exposures before run: ${before.size}`,
    `- Event exposures after run: ${after.size}`,
    `- Total exposure before: ${formatUsd(beforeTotalExposureUsd)}`,
    `- Total exposure after: ${formatUsd(afterTotalExposureUsd)}`,
    `- Total exposure delta: ${formatSignedUsd(afterTotalExposureUsd - beforeTotalExposureUsd)}`,
    `- Newly added event exposures: ${newEvents}`,
    `- Fully removed event exposures: ${removedEvents}`,
    `- Equity baseline: ${formatUsd(input.overview.total_equity_usd)}`,
    `- Exposure ratio basis: event exposure / ${formatUsd(input.overview.total_equity_usd)}`,
    "",
    "## How These Numbers Are Computed",
    "",
    "- Event exposures before run: count distinct event_slug values in the current positions.",
    "- Event exposures after run: count distinct event_slug values after applying the proposed decision deltas to the before-run map.",
    "- open: add the smaller of quarter-Kelly target and liquidity_cap_usd to the target event_slug; later live risk clipping is still excluded here.",
    "- close: subtract the current marked value of the matching token from the target event_slug.",
    "- reduce: subtract decision.notional_usd from the target event_slug.",
    "- Equity baseline: copied directly from overview.total_equity_usd.",
    "",
    "## Main Event Exposure Deltas",
    "",
    ...(deltaTableEn ? [deltaTableEn, ""] : ["- No computable event exposure change was produced in this run.", ""]),
    "## Top Event Exposures Before",
    "",
    ...(topBeforeTableEn ? [topBeforeTableEn, ""] : ["- Empty portfolio.", ""]),
    "## Top Event Exposures After",
    "",
    ...(topAfterTableEn ? [topAfterTableEn, ""] : ["- Empty portfolio.", ""]),
    "## Assumptions and Gaps",
    "",
    "- This is a proposal-based view. It excludes failed fills, partial fills, later stop losses, and price drift after the decision set was generated.",
    "- To reach a standard realized rebalance attribution report, the system still needs post-fill position snapshots and historical event-exposure time series.",
    ""
  ].join("\n");

  return { zh, en };
}

async function writePortfolioArtifact(input: {
  config: Pick<OrchestratorConfig, "artifactStorageRoot">;
  kind: Artifact["kind"];
  title: string;
  publishedAtUtc: string;
  runtime: string;
  mode: string;
  runId: string;
  markdown: { zh: string; en: string };
}) {
  const relativePath = buildArtifactRelativePath({
    kind: input.kind,
    publishedAtUtc: input.publishedAtUtc,
    runtime: input.runtime,
    mode: input.mode,
    runId: input.runId,
    extension: "md"
  });

  await writeStoredMarkdownPair({
    storageRoot: input.config.artifactStorageRoot,
    relativePath,
    zhContent: input.markdown.zh,
    enContent: input.markdown.en
  });

  return {
    kind: input.kind,
    title: input.title,
    path: relativePath,
    content: input.markdown.zh,
    published_at_utc: input.publishedAtUtc
  } satisfies Artifact;
}

export async function buildPortfolioReportArtifacts(input: {
  config: Pick<OrchestratorConfig, "artifactStorageRoot">;
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
  decisionSet: TradeDecisionSet;
  promptSummary: string;
  reasoningMd: string;
  positionReviews?: PositionReviewResult[];
  entryPlans?: PulseEntryPlan[];
}) {
  const publishedAtUtc = input.decisionSet.generated_at_utc;
  return Promise.all([
    writePortfolioArtifact({
      config: input.config,
      kind: "review-report",
      title: `Portfolio review ${publishedAtUtc}`,
      publishedAtUtc,
      runtime: input.decisionSet.runtime,
      mode: input.decisionSet.mode,
      runId: input.decisionSet.run_id,
      markdown: buildReviewMarkdown(input)
    }),
    writePortfolioArtifact({
      config: input.config,
      kind: "monitor-report",
      title: `Portfolio monitor ${publishedAtUtc}`,
      publishedAtUtc,
      runtime: input.decisionSet.runtime,
      mode: input.decisionSet.mode,
      runId: input.decisionSet.run_id,
      markdown: buildMonitorMarkdown(input)
    }),
    writePortfolioArtifact({
      config: input.config,
      kind: "rebalance-report",
      title: `Portfolio rebalance ${publishedAtUtc}`,
      publishedAtUtc,
      runtime: input.decisionSet.runtime,
      mode: input.decisionSet.mode,
      runId: input.decisionSet.run_id,
      markdown: buildRebalanceMarkdown(input)
    })
  ]);
}

function buildBacktestReportMarkdown(input: {
  generatedAtUtc: string;
  lookbackDays: number;
  overview: OverviewResponse;
  positions: PublicPosition[];
  runDetails: PublicRunDetail[];
  trades: PublicTrade[];
}) {
  const sortedRuns = [...input.runDetails].sort((left, right) =>
    right.generated_at_utc.localeCompare(left.generated_at_utc)
  );
  const runWindowEnd = formatTimestampUtc(input.generatedAtUtc);
  const windowStartDate = new Date(new Date(input.generatedAtUtc).getTime() - input.lookbackDays * 24 * 60 * 60 * 1000);
  const runWindowStart = formatTimestampUtc(windowStartDate.toISOString());
  const decisions = sortedRuns.flatMap((run) =>
    run.decisions.map((decision) => ({
      ...decision,
      runId: run.id,
      runGeneratedAtUtc: run.generated_at_utc,
      runtime: run.runtime,
      mode: run.mode,
      status: run.status
    }))
  );
  const executableDecisions = decisions.filter((decision) => ["open", "close", "reduce"].includes(decision.action));
  const openDecisions = executableDecisions.filter((decision) => decision.action === "open");
  const avgEdge = executableDecisions.length === 0
    ? 0
    : executableDecisions.reduce((sum, decision) => sum + decision.edge, 0) / executableDecisions.length;
  const avgSuggestedNotional = executableDecisions.length === 0
    ? 0
    : executableDecisions.reduce((sum, decision) => sum + decision.notional_usd, 0) / executableDecisions.length;
  const matchedOpenDecisionCount = openDecisions.filter((decision) =>
    input.positions.some((position) => position.token_id === decision.token_id)
  ).length;
  const runStatusCounts = summarizeCountMap(countValues(sortedRuns.map((run) => run.status)));
  const runtimeCounts = summarizeCountMap(countValues(sortedRuns.map((run) => run.runtime)));
  const confidenceCounts = summarizeCountMap(countValues(executableDecisions.map((decision) => decision.confidence)));
  const actionCounts = summarizeActions(decisions);
  const topMarkets = [...openDecisions.reduce((map, decision) => {
    const current = map.get(decision.market_slug) ?? {
      count: 0,
      notionalUsd: 0,
      edgeSum: 0,
      latestAction: decision.action,
      latestAt: decision.runGeneratedAtUtc
    };
    current.count += 1;
    current.notionalUsd += decision.notional_usd;
    current.edgeSum += decision.edge;
    if (decision.runGeneratedAtUtc > current.latestAt) {
      current.latestAt = decision.runGeneratedAtUtc;
      current.latestAction = decision.action;
    }
    map.set(decision.market_slug, current);
    return map;
  }, new Map<string, {
    count: number;
    notionalUsd: number;
    edgeSum: number;
    latestAction: string;
    latestAt: string;
  }>()).entries()]
    .map(([marketSlug, summary]) => ({
      marketSlug,
      count: summary.count,
      notionalUsd: summary.notionalUsd,
      avgEdge: summary.count === 0 ? 0 : summary.edgeSum / summary.count,
      latestAction: summary.latestAction,
      latestAt: summary.latestAt
    }))
    .sort((left, right) => right.count - left.count || right.notionalUsd - left.notionalUsd)
    .slice(0, 8);
  const recentTrades = [...input.trades]
    .sort((left, right) => right.timestamp_utc.localeCompare(left.timestamp_utc))
    .slice(0, 8);
  const openPositionTableZh = buildMarkdownTable(
    ["市场", "结果", "当前价值", "浮盈亏", "开仓时间", "与推荐匹配"],
    input.positions.map((position) => [
      position.market_slug,
      position.outcome_label,
      formatUsd(position.current_value_usd),
      formatSignedPct(position.unrealized_pnl_pct),
      formatTimestampUtc(position.opened_at),
      openDecisions.some((decision) => decision.token_id === position.token_id) ? "是" : "否"
    ])
  );
  const openPositionTableEn = buildMarkdownTable(
    ["Market", "Outcome", "Current Value", "Unrealized PnL", "Opened At", "Matched to Recommendation"],
    input.positions.map((position) => [
      position.market_slug,
      position.outcome_label,
      formatUsd(position.current_value_usd),
      formatSignedPct(position.unrealized_pnl_pct),
      formatTimestampUtc(position.opened_at),
      openDecisions.some((decision) => decision.token_id === position.token_id) ? "yes" : "no"
    ])
  );
  const topMarketsTableZh = buildMarkdownTable(
    ["市场", "推荐次数", "累计建议金额", "平均 Edge", "最近动作", "最近时间"],
    topMarkets.map((market) => [
      market.marketSlug,
      String(market.count),
      formatUsd(market.notionalUsd),
      formatSignedPct(market.avgEdge),
      market.latestAction,
      formatTimestampUtc(market.latestAt)
    ])
  );
  const topMarketsTableEn = buildMarkdownTable(
    ["Market", "Recommendation Count", "Total Suggested Notional", "Average Edge", "Latest Action", "Latest Time"],
    topMarkets.map((market) => [
      market.marketSlug,
      String(market.count),
      formatUsd(market.notionalUsd),
      formatSignedPct(market.avgEdge),
      market.latestAction,
      formatTimestampUtc(market.latestAt)
    ])
  );
  const recentTradesTableZh = buildMarkdownTable(
    ["时间", "市场", "方向", "状态", "请求金额", "成交金额", "均价"],
    recentTrades.map((trade) => [
      formatTimestampUtc(trade.timestamp_utc),
      trade.market_slug,
      trade.side,
      trade.status,
      formatUsd(trade.requested_notional_usd),
      formatUsd(trade.filled_notional_usd),
      trade.avg_price == null ? "无" : formatPct(trade.avg_price)
    ])
  );
  const recentTradesTableEn = buildMarkdownTable(
    ["Time", "Market", "Side", "Status", "Requested", "Filled", "Average Price"],
    recentTrades.map((trade) => [
      formatTimestampUtc(trade.timestamp_utc),
      trade.market_slug,
      trade.side,
      trade.status,
      formatUsd(trade.requested_notional_usd),
      formatUsd(trade.filled_notional_usd),
      trade.avg_price == null ? "none" : formatPct(trade.avg_price)
    ])
  );
  const sufficiencyTableZh = buildMarkdownTable(
    ["能力", "状态", "当前说明"],
    [
      ["推荐运行与决策历史", "可用", `最近 ${input.lookbackDays} 天共 ${sortedRuns.length} 次运行、${decisions.length} 条决策。`],
      ["当前仍持有仓位的浮盈亏", "可用", `当前有 ${input.positions.length} 笔 open positions，可直接读取 mark-to-market。`],
      ["最近成交样本", recentTrades.length > 0 ? "部分可用" : "数据不足", recentTrades.length > 0 ? `可看到最近 ${recentTrades.length} 笔 execution event，但 PublicTrade 不带 run_id。` : "当前没有可用的 recent trade 样本。"],
      ["已实现 / 未实现盈亏拆分", "数据不足", "当前没有按 recommendation 持久化的 closed-position ledger，无法像标准稿那样做准确拆分。"],
      ["胜率 / 已结算统计", "数据不足", "缺少按推荐归因的 resolved outcome 历史，无法可靠统计 won/lost。"],
      ["Buy Yes / Buy No 方向分析", "数据不足", "历史 decision 行没有 outcome_label，无法稳妥回放历史方向。"],
      ["分类归因", "数据不足", "当前没有市场级 canonical taxonomy，无法像标准稿那样稳定输出品类 PnL。"],
      ["Edge 校准 vs 最终结果", "数据不足", "缺少逐推荐的历史 mark 序列和 resolution ledger，无法计算真实 edge 转化率。"]
    ]
  );
  const sufficiencyTableEn = buildMarkdownTable(
    ["Capability", "Status", "Current Explanation"],
    [
      ["Recommendation runs and decision history", "available", `There are ${sortedRuns.length} runs and ${decisions.length} decisions in the last ${input.lookbackDays} days.`],
      ["Mark-to-market for still-open positions", "available", `${input.positions.length} open positions are still available in the current snapshot.`],
      ["Recent execution sample", recentTrades.length > 0 ? "partial" : "missing", recentTrades.length > 0 ? `Recent execution events are available, but PublicTrade does not expose run_id.` : "No recent trade sample is available right now."],
      ["Realized vs unrealized PnL split", "missing", "There is no recommendation-level closed-position ledger yet, so the standard realized/unrealized split cannot be reconstructed accurately."],
      ["Win rate / settled outcomes", "missing", "Resolved outcomes are not persisted with recommendation attribution."],
      ["Buy Yes / Buy No direction split", "missing", "Historical decision rows do not store outcome_label."],
      ["Category attribution", "missing", "There is no canonical market taxonomy for stable category PnL reporting."],
      ["Edge calibration vs final outcome", "missing", "Historical mark series and resolution ledger are not stored per recommendation."]
    ]
  );
  const nextSchemaTableZh = buildMarkdownTable(
    ["需要补的状态", "补完后能解锁什么"],
    [
      ["decision 历史保存 outcome_label", "回放 Buy Yes / Buy No 方向分布与方向胜率。"],
      ["closed position ledger（含 entry/exit fills）", "准确拆出已实现 / 未实现盈亏与已结算胜率。"],
      ["token 级历史 mark 序列", "做标准稿风格的回撤、持有期表现和 edge 校准。"],
      ["execution event 挂上 run_id / decision_id 对外查询", "把推荐、成交、持仓三条链严丝合缝串起来。"],
      ["市场分类字典", "稳定输出地缘/加密/科技等类别归因。"]
    ]
  );
  const nextSchemaTableEn = buildMarkdownTable(
    ["State Addition Needed", "What It Unlocks"],
    [
      ["Persist outcome_label on historical decisions", "Replay Buy Yes / Buy No direction mix and directional win rate."],
      ["Closed-position ledger with entry/exit fills", "Accurate realized vs unrealized PnL and settled win rate."],
      ["Token-level historical mark series", "Standard drawdown, holding-period performance, and edge calibration."],
      ["Expose run_id / decision_id on execution-event queries", "Cleanly link recommendations, fills, and live positions."],
      ["Canonical market taxonomy", "Stable geopolitics/crypto/tech category attribution."]
    ]
  );

  const overviewLineZh = sortedRuns.length === 0
    ? `> 最近 ${input.lookbackDays} 天没有可用的 recommendation run 详情，因此这份回测报告只能说明当前组合快照，无法接近标准稿。`
    : `> 最近 ${input.lookbackDays} 天共记录 ${sortedRuns.length} 次 recommendation run，其中 ${sortedRuns.filter((run) => run.decisions.some((decision) => ["open", "close", "reduce"].includes(decision.action))).length} 次产出可执行动作，累计 ${executableDecisions.length} 条 open/close/reduce 建议。当前系统已经能稳定回看推荐产出、当前仍持有仓位和最近成交样本，但还不能像标准稿那样给出已实现/未实现拆分、胜率和 edge 校准，因为这些状态还没被完整落盘。`;
  const overviewLineEn = sortedRuns.length === 0
    ? `> No recommendation-run detail is available for the last ${input.lookbackDays} days, so this backtest can only describe the current portfolio snapshot.`
    : `> There were ${sortedRuns.length} recommendation runs in the last ${input.lookbackDays} days, with ${sortedRuns.filter((run) => run.decisions.some((decision) => ["open", "close", "reduce"].includes(decision.action))).length} runs producing executable actions and ${executableDecisions.length} open/close/reduce decisions in total. The system can already replay recommendation output, current open-position marks, and recent execution samples, but it still cannot produce the standard realized/unrealized split, win rate, or edge calibration because those states are not yet persisted.`;

  const markdown = {
    zh: [
      "# 推荐回测报告",
      "",
      `**报告时间：** ${runWindowEnd}`,
      `**数据窗口：** ${runWindowStart} — ${runWindowEnd}（最近 ${input.lookbackDays} 天）`,
      `**推荐运行数：** ${sortedRuns.length} | **决策数：** ${decisions.length} | **可执行动作：** ${executableDecisions.length}`,
      "",
      overviewLineZh,
      "",
      "## 数据充足度总览",
      "",
      sufficiencyTableZh,
      "",
      "## 推荐产出概览",
      "",
      `- 运行状态分布：${runStatusCounts}`,
      `- 运行时分布：${runtimeCounts}`,
      `- 动作统计：open ${actionCounts.open} / close ${actionCounts.close} / reduce ${actionCounts.reduce} / hold ${actionCounts.hold} / skip ${actionCounts.skip}`,
      `- 可执行动作平均 Edge：${formatSignedPct(avgEdge)}`,
      `- 可执行动作平均建议金额：${formatUsd(avgSuggestedNotional)}`,
      `- 可执行动作置信度分布：${confidenceCounts}`,
      `- 当前 open position 与历史开仓建议的 token 匹配数：${matchedOpenDecisionCount}/${input.positions.length}`,
      "",
      "## 重复最多的市场",
      "",
      ...(topMarketsTableZh ? [topMarketsTableZh, ""] : ["- 当前窗口内没有可统计的开仓建议。", ""]),
      "## 当前仍持有的仓位快照",
      "",
      ...(openPositionTableZh ? [openPositionTableZh, ""] : ["- 当前没有 open positions。", ""]),
      "## 最近执行样本",
      "",
      ...(recentTradesTableZh ? [recentTradesTableZh, ""] : ["- 当前窗口内没有 recent trade 样本。", ""]),
      "## 与标准稿相比仍缺什么",
      "",
      "- 标准稿里的“总投入 / 当前价值 / 已实现 / 未实现 / 胜率 / 分类分析 / 方向分析 / Edge 校准”都要求 recommendation、fill、持仓、结算四条链可精确对齐。",
      "- 当前仓库已经有 recommendation 历史、最近 execution event、当前 open positions，但还没有闭环到“每一笔推荐最终赚了多少、何时结算、属于哪个方向和类别”。",
      "- 所以这份回测报告现在选择明确承认缺口，不再假装已经具备完整后评估能力。",
      "",
      "## 要达到标准稿还需补哪些数据",
      "",
      nextSchemaTableZh,
      "",
      "## 元数据",
      "",
      `- 方法论：先输出当前可验证的 recommendation / execution / open-position 回看，再把不可验证指标单列为数据缺口。`,
      `- 当前净值：${formatUsd(input.overview.total_equity_usd)}`,
      `- 当前已标记仓位数：${input.positions.length}`,
      `- 当前已标记仓位总价值：${formatUsd(sumPositionValueUsd(input.positions))}`,
      `- 报告版本：1.1`,
      ""
    ].join("\n"),
    en: [
      "# Recommendation Backtest Report",
      "",
      `**Report Time:** ${runWindowEnd}`,
      `**Coverage Window:** ${runWindowStart} — ${runWindowEnd} (last ${input.lookbackDays} days)`,
      `**Recommendation Runs:** ${sortedRuns.length} | **Decisions:** ${decisions.length} | **Executable Actions:** ${executableDecisions.length}`,
      "",
      overviewLineEn,
      "",
      "## Data Sufficiency Overview",
      "",
      sufficiencyTableEn,
      "",
      "## Recommendation Output Overview",
      "",
      `- Run status mix: ${runStatusCounts}`,
      `- Runtime mix: ${runtimeCounts}`,
      `- Action counts: open ${actionCounts.open} / close ${actionCounts.close} / reduce ${actionCounts.reduce} / hold ${actionCounts.hold} / skip ${actionCounts.skip}`,
      `- Average executable edge: ${formatSignedPct(avgEdge)}`,
      `- Average executable suggested notional: ${formatUsd(avgSuggestedNotional)}`,
      `- Executable confidence mix: ${confidenceCounts}`,
      `- Current open positions matched to historical open recommendations by token: ${matchedOpenDecisionCount}/${input.positions.length}`,
      "",
      "## Most Repeated Markets",
      "",
      ...(topMarketsTableEn ? [topMarketsTableEn, ""] : ["- No open recommendations are available in the current window.", ""]),
      "## Current Open Position Snapshot",
      "",
      ...(openPositionTableEn ? [openPositionTableEn, ""] : ["- There are no open positions right now.", ""]),
      "## Recent Execution Sample",
      "",
      ...(recentTradesTableEn ? [recentTradesTableEn, ""] : ["- No recent trade sample is available in the current window.", ""]),
      "## What Is Still Missing vs. the Standard Report",
      "",
      "- The standard report's total deployed capital, current value, realized vs unrealized split, win rate, category analysis, direction analysis, and edge calibration all require precise alignment across recommendation, fill, position, and resolution histories.",
      "- This repository already has recommendation history, recent execution events, and current open positions, but it still cannot answer the full question of how much each recommendation ultimately made, when it resolved, and which direction/category it belonged to.",
      "- This backtest therefore makes the gaps explicit instead of pretending that full ex-post attribution already exists.",
      "",
      "## Data Needed to Reach the Standard Report",
      "",
      nextSchemaTableEn,
      "",
      "## Metadata",
      "",
      "- Methodology: first report the recommendation / execution / open-position facts that can be verified today, then list the metrics that remain blocked by missing state.",
      `- Current equity: ${formatUsd(input.overview.total_equity_usd)}`,
      `- Current marked positions: ${input.positions.length}`,
      `- Current marked position value: ${formatUsd(sumPositionValueUsd(input.positions))}`,
      "- Report version: 1.1",
      ""
    ].join("\n")
  };

  return markdown;
}

export async function buildBacktestReportArtifact(input: {
  config: Pick<OrchestratorConfig, "artifactStorageRoot">;
  generatedAtUtc: string;
  runId: string;
  overview: OverviewResponse;
  positions: PublicPosition[];
  runDetails: PublicRunDetail[];
  trades: PublicTrade[];
  lookbackDays?: number;
}) {
  const markdown = buildBacktestReportMarkdown({
    generatedAtUtc: input.generatedAtUtc,
    lookbackDays: input.lookbackDays ?? 21,
    overview: input.overview,
    positions: input.positions,
    runDetails: input.runDetails,
    trades: input.trades
  });

  return writePortfolioArtifact({
    config: input.config,
    kind: "backtest-report",
    title: `Backtest ${input.generatedAtUtc}`,
    publishedAtUtc: input.generatedAtUtc,
    runtime: "daily-pulse",
    mode: "review",
    runId: input.runId,
    markdown
  });
}
