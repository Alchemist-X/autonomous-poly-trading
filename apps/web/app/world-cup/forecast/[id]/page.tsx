import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllForecasts, getForecastByDir } from "../../../../lib/world-cup/forecast-store";
import { mdToHtml } from "../../../../lib/world-cup/markdown";
import reportsData from "../../../../lib/world-cup/generated/reports.generated.json";
import styles from "../../../../components/world-cup/world-cup.module.css";

// Full forecasting-workflow report for one question, rendered from the
// harness's archived markdown (CN by default, ?lang=en for English).

interface ReportsFile {
  readonly reports: Record<string, { mdCn: string; mdEn: string }>;
}

export function generateStaticParams(): Array<{ id: string }> {
  return getAllForecasts().map((f) => ({ id: f.dir }));
}

export default async function ForecastReportPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const forecast = getForecastByDir(id);
  if (!forecast) notFound();

  const reports = (reportsData as unknown as ReportsFile).reports[forecast.id];
  if (!reports) notFound();
  const useEn = lang === "en" && reports.mdEn.length > 0;
  const html = mdToHtml(useEn ? reports.mdEn : reports.mdCn);

  return (
    <div>
      <p className={styles.muted} style={{ marginTop: 24 }}>
        <Link href="/world-cup" style={{ color: "#8fa3c8" }}>
          ← 全部预测
        </Link>
        {" · "}
        <Link href={`/world-cup/forecast/${forecast.dir}${useEn ? "" : "?lang=en"}`} style={{ color: "#8fa3c8" }}>
          {useEn ? "中文版" : "English"}
        </Link>
        {" · "}生成于 {forecast.generated_at.slice(0, 16).replace("T", " ")} UTC
      </p>
      <article className={styles.reportProse} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
