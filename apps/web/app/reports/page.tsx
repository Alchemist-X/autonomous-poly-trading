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
      title="Daily pulse, review, and resolution artifacts"
      kicker="Reports"
    />
  );
}

