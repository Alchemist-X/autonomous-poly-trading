import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllForecasts, getForecastByDir } from "../../../../lib/world-cup/forecast-store";
import { langOf, withLang } from "../../../../lib/world-cup/i18n";
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
  const lang = langOf((await searchParams).lang);
  const forecast = getForecastByDir(id);
  if (!forecast) notFound();

  const reports = (reportsData as unknown as ReportsFile).reports[forecast.id];
  if (!reports) notFound();
  // ja/es have no translated full report; they fall back to the English archive.
  const useEn = lang !== "zh" && reports.mdEn.length > 0;
  const html = mdToHtml(useEn ? reports.mdEn : reports.mdCn);

  return (
    <div>
      <p className={styles.muted} style={{ marginTop: 24 }}>
        <Link href={withLang("/world-cup", lang)} style={{ color: "#8a93a6" }}>
          {useEn ? "← All forecasts" : "← 全部预测"}
        </Link>
        {" · "}
        <Link href={`/world-cup/forecast/${forecast.dir}${useEn ? "" : "?lang=en"}`} style={{ color: "#8a93a6" }}>
          {useEn ? "中文版" : "English"}
        </Link>
        {" · "}{useEn ? "forecast time" : "预测时间"} {forecast.generated_at.slice(0, 16).replace("T", " ")} UTC
      </p>
      <article className={styles.reportProse} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
