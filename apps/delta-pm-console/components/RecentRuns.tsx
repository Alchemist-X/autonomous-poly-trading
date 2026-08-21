"use client";

// 最近完成 — compact outcome lines.

import type { RunStatus } from "../lib/types";
import { fmtRelative } from "../lib/format";

export function RecentRuns({ runs, nowMs }: { runs: RunStatus[]; nowMs: number }) {
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        最近完成 <span className="cnt">{runs.length}</span>
      </h2>
      {runs.length === 0 ? (
        <div className="empty">暂无已完成的分析</div>
      ) : (
        <div className="done-list">
          {runs.map((run) => (
            <div className="done-row" key={run.runId || run.newsId}>
              <span className="done-title">{run.title}</span>
              <span className="done-outcome">{run.outcome ?? "(无结论)"}</span>
              <span className="done-time">{fmtRelative(run.updatedAtUtc, nowMs)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
