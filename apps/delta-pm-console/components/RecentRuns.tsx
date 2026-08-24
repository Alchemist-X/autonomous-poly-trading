"use client";

// 最近完成 — compact outcome lines.

import type { RunStatus } from "../lib/types";
import { fmtRelative } from "../lib/format";
import { t, type Lang } from "../lib/i18n";

export function RecentRuns({ runs, nowMs, lang }: { runs: RunStatus[]; nowMs: number; lang: Lang }) {
  const tt = t(lang);
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        {tt("recentTitle")} <span className="cnt">{runs.length}</span>
      </h2>
      {runs.length === 0 ? (
        <div className="empty">{tt("recentEmpty")}</div>
      ) : (
        <div className="done-list">
          {runs.map((run) => (
            <div className="done-row" key={run.runId || run.newsId}>
              <span className="done-title">{run.title}</span>
              <span className="done-outcome">{run.outcome ?? tt("noOutcome")}</span>
              <span className="done-time">{fmtRelative(run.updatedAtUtc, nowMs, lang)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
