import { LOCALES, localeOf } from "../../../../lib/world-cup/i18n";
import { WcHero } from "../../../../components/world-cup/wc-hero";
import { PerformanceDetail } from "../../../../components/world-cup/performance-detail";

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((l) => ({ locale: l.code }));
}

// 预测效果 tab — how our market-blind forecasts scored against the market
// (prediction-time Polymarket prices): best-pick hit rate, mock P&L, Brier skill
// vs the market, and calibration, with a per-match breakdown. Percentages only.
export default async function PerformancePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  return (
    <div>
      <WcHero locale={locale} wide subKey="subPerformance" />
      <PerformanceDetail locale={locale} />
    </div>
  );
}
