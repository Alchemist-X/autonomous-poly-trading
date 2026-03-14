import { getBacktests } from "@autopoly/db";
import { ReportsList } from "../../components/reports-list";

export default async function BacktestsPage() {
  const reports = await getBacktests();
  return (
    <ReportsList
      initialData={reports.map((report) => ({
        ...report,
        published_at_utc: String(report.published_at_utc)
      }))}
      endpoint="/api/public/backtests"
      title="每日回测与校准报告"
      kicker="回测"
    />
  );
}
