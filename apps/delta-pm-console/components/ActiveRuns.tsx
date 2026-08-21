"use client";

// 进行中的分析 — the centerpiece. One card per active run with a 5-segment
// stage bar (接收→重要性→已定价→影响分析→决策), the running segment shimmering,
// an overall stagePct bar and a live mm:ss elapsed timer.

import type { RunStatus, RunStage, StageStatus } from "../lib/types";
import { fmtClock, fmtElapsed } from "../lib/format";

const BAR_STAGES: Array<{ stage: RunStage; label: string }> = [
  { stage: "ingest", label: "接收" },
  { stage: "gate1", label: "重要性" },
  { stage: "gate2", label: "已定价" },
  { stage: "analysis", label: "影响分析" },
  { stage: "decision", label: "决策" }
];

const STAGE_ORDER: RunStage[] = ["ingest", "gate1", "gate2", "analysis", "decision", "done"];

/** Segment status: prefer the run's stages array, fall back to deriving from run.stage. */
function segStatus(run: RunStatus, stage: RunStage): StageStatus {
  const reported = run.stages.find((s) => s.stage === stage)?.status;
  if (reported) return reported;
  if (run.stage === "done") return "done";
  const cur = STAGE_ORDER.indexOf(run.stage);
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < cur) return "done";
  if (idx === cur) return "running";
  return "pending";
}

function RunCard({ run, nowMs }: { run: RunStatus; nowMs: number }) {
  const runningNote = run.stages.find((s) => s.status === "running")?.note ?? null;
  return (
    <article className="run-card">
      <div className="run-head">
        <span className="run-dot" aria-hidden />
        <h3 className="run-title" style={{ margin: 0 }}>
          {run.title}
        </h3>
        <span className="run-elapsed">已耗时 {fmtElapsed(run.startedAtUtc, nowMs)}</span>
      </div>
      {run.tickers.length > 0 ? (
        <div className="run-chips">
          {run.tickers.map((t) => (
            <span key={t} className="chip ticker">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className="stagebar" role="img" aria-label={`分析进度 ${run.stagePct}%`}>
        {BAR_STAGES.map(({ stage, label }) => {
          const st = segStatus(run, stage);
          return (
            <div key={stage} className={`seg ${st}`}>
              <div className="seg-fill" />
              <div className="seg-lbl">{label}</div>
            </div>
          );
        })}
      </div>
      {runningNote ? (
        <div className="run-note">
          <b>当前:</b> {runningNote}
        </div>
      ) : null}
      <div className="run-foot">
        <div className="pctbar">
          <div className="pctbar-fill" style={{ width: `${run.stagePct}%` }} />
        </div>
        <span className="pct">{Math.round(run.stagePct)}%</span>
        <span className="meta">起始 {fmtClock(run.startedAtUtc)}</span>
      </div>
    </article>
  );
}

export function ActiveRuns({ runs, nowMs }: { runs: RunStatus[]; nowMs: number }) {
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        进行中的分析 <span className="cnt">{runs.length}</span>
      </h2>
      {runs.length === 0 ? (
        <div className="empty">暂无进行中的分析 — 等待新闻</div>
      ) : (
        runs.map((run) => <RunCard key={run.runId || run.newsId} run={run} nowMs={nowMs} />)
      )}
    </section>
  );
}
