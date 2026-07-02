import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllForecasts, getForecastByDir } from "../../../../../lib/world-cup/forecast-store";
import { LOCALES, localeOf, t, withLocale } from "../../../../../lib/world-cup/i18n";
import { mdToHtml } from "../../../../../lib/world-cup/markdown";
import reportsData from "../../../../../lib/world-cup/generated/reports.generated.json";
import styles from "../../../../../components/world-cup/world-cup.module.css";

// Full forecasting-workflow report for one question, rendered from the
// harness's archived markdown. English archive for en; the Chinese archive for
// zh-CN / zh-TW (the report archive is bilingual cn/en only).

interface ReportsFile {
  readonly reports: Record<string, { mdCn: string; mdEn: string }>;
}

export function generateStaticParams(): Array<{ locale: string; id: string }> {
  return LOCALES.flatMap((l) => getAllForecasts().map((f) => ({ locale: l.code, id: f.dir })));
}

export default async function ForecastReportPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: localeParam, id } = await params;
  const locale = localeOf(localeParam);
  const forecast = getForecastByDir(id);
  if (!forecast) notFound();

  const reports = (reportsData as unknown as ReportsFile).reports[forecast.id];
  if (!reports) notFound();
  // English archive only for en; zh-CN / zh-TW read the Chinese archive.
  const useEn = locale === "en" && reports.mdEn.length > 0;
  const html = mdToHtml(useEn ? reports.mdEn : reports.mdCn);
  // Toggle flips report language: from English → Simplified Chinese; from any
  // Chinese locale → English.
  const otherLocale = useEn ? "zh-CN" : "en";

  return (
    <div>
      <p className={styles.muted} style={{ marginTop: 24 }}>
        <Link href={withLocale("/world-cup", locale)} style={{ color: "#8a93a6" }}>
          {t(locale, "backToForecasts")}
        </Link>
        {" · "}
        <Link href={withLocale(`/world-cup/forecast/${forecast.dir}`, otherLocale)} style={{ color: "#8a93a6" }}>
          {useEn ? "中文版" : "English"}
        </Link>
        {" · "}
        {t(locale, "forecastTime")} {forecast.generated_at.slice(0, 10)}
      </p>
      <article className={styles.reportProse} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
