import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "../../../../lib/world-cup/report-store";
import { ReportView } from "../../../../components/world-cup/report-view";
import styles from "../../../../components/world-cup/world-cup.module.css";

export const dynamic = "force-dynamic";

export default async function WorldCupReportPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const report = await getReport(matchId);
  if (!report) notFound();

  return (
    <div>
      <p className={styles.muted} style={{ paddingTop: 16 }}>
        <Link href={`/world-cup/${matchId}`} style={{ color: "#8fa3c8" }}>
          ← {report.meta.homeTeam} vs {report.meta.awayTeam}
        </Link>
      </p>
      <ReportView report={report} />
      <div className={styles.ctaRow} style={{ marginTop: 8 }}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/prediction-engine?event=${matchId}`}>
          自己跑一个预测
        </Link>
        {report.meta.polymarketUrl ? (
          <a className={`${styles.btn} ${styles.btnGhost}`} href={report.meta.polymarketUrl} target="_blank" rel="noopener noreferrer">
            在 Polymarket 查看该市场
          </a>
        ) : null}
      </div>
    </div>
  );
}
