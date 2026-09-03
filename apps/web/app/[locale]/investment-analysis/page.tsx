import Link from "next/link";
import styles from "../../../components/investment-analysis/investment-analysis.module.css";
import { investmentHref } from "../../../lib/investment-analysis/routes";
import { localeOf, t, type Locale, type StrKey } from "../../../lib/world-cup/i18n";

interface CaseStudy {
  readonly slug: string;
  readonly index: string;
  readonly companyKey: StrKey;
  readonly titleKey: StrKey;
  readonly summaryKey: StrKey;
  readonly signalLabelKey: StrKey;
  readonly signalKey: StrKey;
}

const CASES: ReadonlyArray<CaseStudy> = [
  {
    slug: "tencent-hunyuan-workbuddy",
    index: "01",
    companyKey: "iaTencentCompany",
    titleKey: "iaTencentTitle",
    summaryKey: "iaTencentSummary",
    signalLabelKey: "iaTencentSignalLabel",
    signalKey: "iaTencentSignal"
  },
  {
    slug: "google-hassabis",
    index: "02",
    companyKey: "iaGoogleCompany",
    titleKey: "iaGoogleTitle",
    summaryKey: "iaGoogleSummary",
    signalLabelKey: "iaGoogleSignalLabel",
    signalKey: "iaGoogleSignal"
  }
];

export default async function InvestmentAnalysisPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = localeOf(localeParam);

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="investment-analysis-title">
        <div>
          <p className={styles.eyebrow}>{t(locale, "iaEyebrow")}</p>
          <h1 id="investment-analysis-title">{t(locale, "iaTitle")}</h1>
        </div>
        <div className={styles.heroAside}>
          <p>{t(locale, "iaIntro")}</p>
        </div>
      </section>

      <section className={styles.metaStrip} aria-label={t(locale, "iaCollectionMetaLabel")}>
        <div className={styles.metaItem}>
          <span>{t(locale, "iaCaseCountLabel")}</span>
          <strong>{t(locale, "iaCaseCount")}</strong>
        </div>
        <div className={styles.metaItem}>
          <span>{t(locale, "iaAsOfLabel")}</span>
          <strong>2026-09-01</strong>
        </div>
        <div className={styles.metaItem}>
          <span>{t(locale, "iaMethodLabel")}</span>
          <strong>{t(locale, "iaMarketBlind")}</strong>
        </div>
      </section>

      <section className={styles.cases} aria-label={t(locale, "iaCasesLabel")}>
        {CASES.map((caseStudy) => (
          <article className={styles.case} key={caseStudy.slug}>
            <div className={styles.caseIndex} aria-hidden="true">
              {caseStudy.index}
            </div>
            <div className={styles.caseBody}>
              <p className={styles.caseCompany}>{t(locale, caseStudy.companyKey)}</p>
              <h2>{t(locale, caseStudy.titleKey)}</h2>
              <p className={styles.caseSummary}>{t(locale, caseStudy.summaryKey)}</p>
            </div>
            <div className={styles.caseSignal}>
              <span className={styles.signalLabel}>{t(locale, caseStudy.signalLabelKey)}</span>
              <strong className={styles.signalValue}>{t(locale, caseStudy.signalKey)}</strong>
              <Link
                className={styles.caseLink}
                href={investmentHref(`/investment-analysis/${caseStudy.slug}`, locale)}
                aria-label={`${t(locale, "iaViewReport")}: ${t(locale, caseStudy.titleKey)}`}
              >
                <span>{t(locale, "iaViewReport")}</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>{t(locale, "iaDisclaimer")}</p>
        <p>{t(locale, "iaFooterMethod")}</p>
      </footer>
    </main>
  );
}
