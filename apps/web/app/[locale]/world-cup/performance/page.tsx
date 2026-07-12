import { LOCALES, localeOf, t } from "../../../../lib/world-cup/i18n";
import { getPerformance } from "../../../../lib/world-cup/performance";
import { getKnockoutPerformance } from "../../../../lib/world-cup/fifa8-performance";
import { getFifa8GeneratedAt } from "../../../../lib/world-cup/fifa8-store";
import { WcHero } from "../../../../components/world-cup/wc-hero";
import { PerformanceDetail } from "../../../../components/world-cup/performance-detail";
import { PerfStageTabs } from "../../../../components/world-cup/perf-stage-tabs";
import styles from "../../../../components/world-cup/world-cup.module.css";

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((l) => ({ locale: l.code }));
}

// 预测效果 tab — how our market-blind forecasts scored against the market
// (prediction-time Polymarket prices): best-pick hit rate, mock P&L, Brier skill
// vs the market, and calibration, with a per-match breakdown. Percentages only.
// Two stage tabs share one presentation: group stage (72 matches) and the
// knockout R32 (the published multi-calibrated blend, 15 matches).
export default async function PerformancePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  const knockoutNote = t(locale, "perfKnockoutScope").replace("{date}", getFifa8GeneratedAt().slice(0, 10));
  return (
    <div>
      <WcHero locale={locale} wide subKey="subPerformance" />
      <PerfStageTabs
        ariaLabel={t(locale, "tabPerformance")}
        tabs={[
          {
            key: "groups",
            label: t(locale, "perfTabGroups"),
            content: <PerformanceDetail locale={locale} perf={getPerformance()} />
          },
          {
            key: "knockout",
            label: t(locale, "perfTabKnockout"),
            content: (
              <>
                <p className={styles.perfStageNote}>{knockoutNote}</p>
                <PerformanceDetail locale={locale} perf={getKnockoutPerformance()} />
              </>
            )
          }
        ]}
      />
    </div>
  );
}
