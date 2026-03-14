import { getReports } from "@autopoly/db";
import { ReportsList } from "../../components/reports-list";

export default async function ReportsPage() {
  const reports = await getReports();
  return (
    <ReportsList
      initialData={reports.map((report) => ({
        ...report,
        published_at_utc: String(report.published_at_utc)
      }))}
      endpoint="/api/public/reports"
      title="每日脉冲、复盘与结算跟踪产物"
      kicker="报告"
    />
  );
}
