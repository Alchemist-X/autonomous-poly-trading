"use client";

import { usePollingJson } from "../lib/use-polling";
import { formatDate } from "../lib/format";

interface ReportItem {
  id: string;
  title: string;
  kind: string;
  path: string;
  published_at_utc: string | Date;
}

export function ReportsList(props: { initialData: ReportItem[]; endpoint: string; title: string; kicker: string }) {
  const { data } = usePollingJson(props.endpoint, props.initialData);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">{props.kicker}</p>
          <h2>{props.title}</h2>
        </div>
      </div>
      <div className="report-list">
        {data.map((report) => (
          <article key={report.id} className="report-card">
            <span className="badge">{report.kind}</span>
            <h3>{report.title}</h3>
            <p>{report.path}</p>
            <small>{formatDate(String(report.published_at_utc))}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

