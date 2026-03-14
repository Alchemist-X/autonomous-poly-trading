"use client";

import type { PublicRunDetail } from "@autopoly/contracts";
import { formatDate, formatPct, formatUsd } from "../lib/format";
import { usePollingJson } from "../lib/use-polling";

function formatRunMode(mode: PublicRunDetail["mode"]): string {
  switch (mode) {
    case "full":
      return "全量";
    case "review":
      return "复盘";
    case "scan":
      return "扫描";
  }
}

function formatRunStatus(status: string): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "running":
      return "运行中";
    case "failed":
      return "失败";
    case "queued":
      return "排队中";
    default:
      return status;
  }
}

function formatDecisionAction(action: PublicRunDetail["decisions"][number]["action"]): string {
  switch (action) {
    case "open":
      return "开仓";
    case "close":
      return "平仓";
    case "reduce":
      return "减仓";
    case "hold":
      return "持有";
    case "skip":
      return "跳过";
  }
}

function formatDecisionSide(side: PublicRunDetail["decisions"][number]["side"]): string {
  return side === "BUY" ? "买入" : "卖出";
}

function formatConfidence(confidence: PublicRunDetail["decisions"][number]["confidence"]): string {
  switch (confidence) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "medium-high":
      return "中高";
    case "high":
      return "高";
  }
}

export function RunDetail({ runId, initialData }: { runId: string; initialData: PublicRunDetail }) {
  const { data } = usePollingJson(`/api/public/runs/${runId}`, initialData);

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">运行详情</p>
            <h2>{data.runtime}</h2>
          </div>
          <span className="badge">{formatRunMode(data.mode)}</span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>生成时间</dt>
            <dd>{formatDate(data.generated_at_utc)}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{formatRunStatus(data.status)}</dd>
          </div>
          <div>
            <dt>资金规模</dt>
            <dd>{formatUsd(data.bankroll_usd)}</dd>
          </div>
          <div>
            <dt>运行摘要</dt>
            <dd>{data.prompt_summary}</dd>
          </div>
        </dl>
      </section>

      <section className="panel prose-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">推理</p>
            <h2>决策日志</h2>
          </div>
        </div>
        <pre>{data.reasoning_md}</pre>
        <pre>{data.logs_md}</pre>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">决策</p>
            <h2>交易集合</h2>
          </div>
        </div>
        <div className="decision-grid">
          {data.decisions.map((decision, index) => (
            <article key={`${decision.market_slug}-${index}`} className="decision-card">
              <span className="badge">{formatDecisionAction(decision.action)}</span>
              <h3>{decision.market_slug}</h3>
              <p>{decision.thesis_md}</p>
              <dl>
                <div>
                  <dt>方向</dt>
                  <dd>{formatDecisionSide(decision.side)}</dd>
                </div>
                <div>
                  <dt>金额</dt>
                  <dd>{formatUsd(decision.notional_usd)}</dd>
                </div>
                <div>
                  <dt>市场概率</dt>
                  <dd>{formatPct(decision.market_prob)}</dd>
                </div>
                <div>
                  <dt>AI 概率</dt>
                  <dd>{formatPct(decision.ai_prob)}</dd>
                </div>
                <div>
                  <dt>优势</dt>
                  <dd>{formatPct(decision.edge)}</dd>
                </div>
                <div>
                  <dt>置信度</dt>
                  <dd>{formatConfidence(decision.confidence)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
