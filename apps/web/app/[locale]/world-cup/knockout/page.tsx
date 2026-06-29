import { getFifa8Fixtures, getForecasterMeta, getHeadlineForecasterId } from "../../../../lib/world-cup/fifa8-store";
import { LOCALES, localeOf, t } from "../../../../lib/world-cup/i18n";
import { WcHero } from "../../../../components/world-cup/wc-hero";
import { Fifa8MatchCard } from "../../../../components/world-cup/fifa8-match-card";
import styles from "../../../../components/world-cup/world-cup.module.css";

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((l) => ({ locale: l.code }));
}

// 淘汰赛预测 tab — market-blind Round-of-32 calls from eight statistical / ML
// models plus a multi-calibrated blend. Each card leads with the published
// (multi-calibrated) verdict, then compares all nine forecasters side by side.
// No market prices are read or shown on this page (blind-test policy).
export default async function KnockoutPredictionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  const fixtures = getFifa8Fixtures();
  const meta = getForecasterMeta();
  const headlineId = getHeadlineForecasterId();

  return (
    <div>
      <WcHero locale={locale} wide subKey="subKnockoutPred" />

      <p className={styles.knIntro}>{t(locale, "knIntro")}</p>

      <div className={styles.knGrid}>
        {fixtures.map((fixture) => (
          <Fifa8MatchCard
            key={fixture.fixtureId}
            fixture={fixture}
            meta={meta}
            headlineId={headlineId}
            locale={locale}
          />
        ))}
      </div>

      <p className={styles.disclaimer}>{t(locale, "knDisclaimer")}</p>
    </div>
  );
}
