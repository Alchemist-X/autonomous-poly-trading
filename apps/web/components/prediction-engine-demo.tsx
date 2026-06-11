"use client";

import { type CSSProperties, type FormEvent, useMemo, useState } from "react";
import type {
  PredictionEngineRun,
  PredictionEvidence,
  PredictionProgressItem,
  PredictionStage
} from "../lib/prediction-engine-demo";
import type { PredictionAccessState } from "../lib/prediction-access";

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "N/A";
  }
  const sign = value > 0 && value < 0.01 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatEdge(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}pp`;
}

function stageStatus(stage: PredictionStage, activeStage: number, isRunning: boolean): "queued" | "running" | "complete" {
  if (!isRunning) {
    return "complete";
  }
  if (stage.order - 1 < activeStage) {
    return "complete";
  }
  if (stage.order - 1 === activeStage) {
    return "running";
  }
  return "queued";
}

function progressStatus(item: PredictionProgressItem, activeStage: number, isRunning: boolean): "queued" | "running" | "complete" {
  if (!isRunning) {
    return "complete";
  }
  if (item.order - 1 < activeStage) {
    return "complete";
  }
  if (item.order - 1 === activeStage) {
    return "running";
  }
  return "queued";
}

function fallbackProgress(stages: PredictionStage[]): PredictionProgressItem[] {
  return stages.map((stage) => ({
    id: `fallback-${stage.id}`,
    stageId: stage.id,
    order: stage.order,
    title: stage.title,
    detail: stage.detail,
    outcome: stage.summary,
    artifactLabel: stage.id,
    durationMs: stage.durationMs
  }));
}

function formatServiceSource(value: string | undefined): string {
  if (value === "local") {
    return "Local host";
  }
  if (value === "vps") {
    return "VPS";
  }
  if (value === "demo") {
    return "Demo";
  }
  return value || "Unknown";
}

function formatLimit(used: number, limit: number | null): string {
  return limit == null ? `${used} / unlimited` : `${used} / ${limit}`;
}

function EvidenceButton({
  evidence,
  selected,
  onSelect
}: {
  evidence: PredictionEvidence;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`pe-evidence-row ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`pe-stance-dot is-${evidence.stance}`} />
      <span>
        <strong>{evidence.sourceType}</strong>
        <small>{evidence.title}</small>
      </span>
      <em>{evidence.weightPct > 0 ? "+" : ""}{evidence.weightPct.toFixed(1)}pp</em>
    </button>
  );
}

export function PredictionEngineDemo({
  initialRun,
  access
}: {
  initialRun: PredictionEngineRun;
  access?: PredictionAccessState;
}) {
  const [eventText, setEventText] = useState(initialRun.eventText);
  const [marketPrice, setMarketPrice] = useState(
    initialRun.conclusion.marketProbability == null
      ? ""
      : String(Math.round(initialRun.conclusion.marketProbability * 100))
  );
  const [run, setRun] = useState(initialRun);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(initialRun.evidence[0]?.id ?? "");
  const [activeStage, setActiveStage] = useState(initialRun.stages.length - 1);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEvidence = useMemo(
    () => run.evidence.find((item) => item.id === selectedEvidenceId) ?? run.evidence[0] ?? null,
    [run.evidence, selectedEvidenceId]
  );
  const progressItems = useMemo(
    () => run.progress?.length ? run.progress : fallbackProgress(run.stages),
    [run.progress, run.stages]
  );
  const activeProgress = progressItems[Math.min(activeStage, Math.max(progressItems.length - 1, 0))] ?? null;
  const serviceSource = run.service?.source ?? (run.mode === "local_proxy" ? "local" : run.mode === "vps_proxy" ? "vps" : "demo");
  const serviceLabel = run.service?.endpointLabel ?? "in-process demo builder";
  const serviceNote = run.service?.note ?? "未配置外部预测服务，当前展示 demo 数据。";

  const ringStyle = {
    "--pe-prob": `${run.conclusion.yesProbability * 360}deg`
  } as CSSProperties;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsRunning(true);
    setActiveStage(0);
    const stageCount = Math.max(1, run.stages.length);

    const timer = window.setInterval(() => {
      setActiveStage((current) => Math.min(current + 1, stageCount - 1));
    }, 360);
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/prediction-engine/run", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          eventText,
          marketPrice: marketPrice.trim() ? Number(marketPrice) : null
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string; redirectTo?: string } | null;
        const message = errorBody?.error ?? `Prediction API returned ${response.status}`;
        throw new Error(errorBody?.redirectTo ? `${message} (${errorBody.redirectTo})` : message);
      }

      const nextRun = await response.json() as PredictionEngineRun;
      const remainingDelay = Math.max(0, 2600 - (Date.now() - startedAt));
      await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
      setRun(nextRun);
      setSelectedEvidenceId(nextRun.evidence[0]?.id ?? "");
      setActiveStage(nextRun.stages.length - 1);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Prediction run failed.");
    } finally {
      window.clearInterval(timer);
      setIsRunning(false);
    }
  }

  return (
    <div className="pe-shell">
      <section className="pe-command">
        <div className="pe-command-copy">
          <span className="pe-kicker">Prediction Engine Demo</span>
          <h1>事件概率研究工作台</h1>
          <p>
            输入一个自然语言事件，系统会按 Pulse 七阶段流程返回概率、条件模型、证据权重和当前执行成果。
          </p>
        </div>
        <form className="pe-form" onSubmit={handleSubmit}>
          {access ? (
            <div className={`pe-access-strip is-${access.mode}`}>
              <span>Access</span>
              <strong>{access.mode.replace("_", " ")}</strong>
              {access.quota ? (
                <small>
                  Daily {formatLimit(access.quota.dailyUsed, access.quota.dailyLimit)}
                  {" · "}
                  Monthly {formatLimit(access.quota.monthlyUsed, access.quota.monthlyLimit)}
                  {" · "}
                  Running {formatLimit(access.quota.running, access.quota.concurrentLimit)}
                </small>
              ) : (
                <small>{access.message ?? "Prediction access is open for this deployment."}</small>
              )}
            </div>
          ) : null}
          <label htmlFor="prediction-event">Event</label>
          <textarea
            id="prediction-event"
            value={eventText}
            onChange={(item) => setEventText(item.target.value)}
            rows={4}
            maxLength={600}
            placeholder="例如：美国和伊朗能在 2026-06-30 前达成核协议吗？"
          />
          <div className="pe-form-row">
            <div>
              <label htmlFor="market-price">Market price</label>
              <input
                id="market-price"
                value={marketPrice}
                onChange={(item) => setMarketPrice(item.target.value)}
                inputMode="decimal"
                placeholder="30"
              />
              <small>可填 0-100 的 Yes 市场概率；留空则用 demo 估值。</small>
            </div>
            <button type="submit" disabled={isRunning}>
              {isRunning ? "Running" : "Run analysis"}
            </button>
          </div>
          {error ? <p className="pe-error">{error}</p> : null}
          <div className="pe-service-strip">
            <span>Service</span>
            <strong>{formatServiceSource(serviceSource)}</strong>
            <small>{serviceLabel}</small>
          </div>
        </form>
      </section>

      <section className="pe-workspace" aria-live="polite">
        <aside className="pe-stage-rail" aria-label="Analysis stages">
          <div className="pe-panel-head">
            <span>Stage Flow</span>
            <strong>{isRunning ? `0${activeStage + 1}/07` : "Complete"}</strong>
          </div>
          <div className="pe-stage-list">
            {run.stages.map((stage) => {
              const status = stageStatus(stage, activeStage, isRunning);
              return (
                <article key={stage.id} className={`pe-stage is-${status}`}>
                  <div>
                    <span>{String(stage.order).padStart(2, "0")}</span>
                    <strong>{stage.title}</strong>
                  </div>
                  <p>{stage.summary}</p>
                </article>
              );
            })}
          </div>
        </aside>

        <main className="pe-result">
          <section className="pe-run-console" aria-label="Agent run progress">
            <div className="pe-panel-head">
              <span>Run Console</span>
              <strong>{isRunning ? "Running" : run.service?.status ?? "Complete"}</strong>
            </div>
            <div className="pe-current-output">
              <span>{isRunning ? "Current step" : "Current result"}</span>
              <strong>{activeProgress?.title ?? "等待输入"}</strong>
              <p>{isRunning ? activeProgress?.detail : activeProgress?.outcome}</p>
              <small>{serviceNote}</small>
            </div>
            <div className="pe-agent-timeline">
              {progressItems.map((item) => {
                const status = progressStatus(item, activeStage, isRunning);
                return (
                  <article key={item.id} className={`pe-agent-step is-${status}`}>
                    <div className="pe-agent-step-index">
                      <span>{String(item.order).padStart(2, "0")}</span>
                    </div>
                    <div className="pe-agent-step-main">
                      <strong>{item.title}</strong>
                      <p>{status === "complete" ? item.outcome : item.detail}</p>
                    </div>
                    <div className="pe-agent-step-meta">
                      <span>{item.artifactLabel ?? item.stageId}</span>
                      <em>{status}</em>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="pe-result-top">
            <div className="pe-probability-ring" style={ringStyle}>
              <div>
                <span>YES</span>
                <strong>{formatPercent(run.conclusion.yesProbability)}</strong>
              </div>
            </div>
            <div className="pe-result-copy">
              <span className="pe-kicker">Run {run.id}</span>
              <h2>{run.eventText}</h2>
              <p>{run.conclusion.verdict}</p>
              <div className="pe-metrics">
                <span>
                  <strong>{formatPercent(run.conclusion.confidenceInterval[0])} - {formatPercent(run.conclusion.confidenceInterval[1])}</strong>
                  80% interval
                </span>
                <span>
                  <strong>{formatPercent(run.conclusion.marketProbability)}</strong>
                  market
                </span>
                <span>
                  <strong>{formatEdge(run.conclusion.edge)}</strong>
                  edge
                </span>
              </div>
            </div>
          </div>

          <div className="pe-model-grid">
            {run.model.map((node) => (
              <article key={node.id} className="pe-model-node">
                <span>{node.id}</span>
                <strong>{formatPercent(node.probability)}</strong>
                <p>{node.label}</p>
                <small>{node.rationale}</small>
              </article>
            ))}
          </div>

          <div className="pe-update-log">
            <div className="pe-panel-head">
              <span>Bayesian Update</span>
              <strong>{new Date(run.generatedAtUtc).toISOString().slice(11, 19)} UTC</strong>
            </div>
            {run.updates.map((update) => (
              <div key={update.label} className="pe-update-row">
                <span>{update.label}</span>
                <strong>{formatPercent(update.from)}{" -> "}{formatPercent(update.to)}</strong>
                <p>{update.explanation}</p>
              </div>
            ))}
          </div>
        </main>

        <aside className="pe-evidence-panel" aria-label="Evidence">
          <div className="pe-panel-head">
            <span>Evidence</span>
            <strong>{formatServiceSource(serviceSource)}</strong>
          </div>
          <div className="pe-evidence-list">
            {run.evidence.map((item) => (
              <EvidenceButton
                key={item.id}
                evidence={item}
                selected={item.id === selectedEvidence?.id}
                onSelect={() => setSelectedEvidenceId(item.id)}
              />
            ))}
          </div>

          {selectedEvidence ? (
            <article className="pe-evidence-detail">
              <span className={`pe-stance-pill is-${selectedEvidence.stance}`}>{selectedEvidence.stance}</span>
              <h3>{selectedEvidence.title}</h3>
              <dl>
                <div>
                  <dt>Date</dt>
                  <dd>{selectedEvidence.date}</dd>
                </div>
                <div>
                  <dt>Node</dt>
                  <dd>{selectedEvidence.node}</dd>
                </div>
                <div>
                  <dt>Reliability</dt>
                  <dd>{formatPercent(selectedEvidence.reliability)}</dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd>{selectedEvidence.weightPct > 0 ? "+" : ""}{selectedEvidence.weightPct.toFixed(1)}pp</dd>
                </div>
              </dl>
              <p>{selectedEvidence.excerpt}</p>
              {selectedEvidence.url ? (
                <a href={selectedEvidence.url} target="_blank" rel="noreferrer">
                  Open source
                </a>
              ) : null}
            </article>
          ) : null}

          <div className="pe-limitations">
            <span>Known gaps</span>
            {run.limitations.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
