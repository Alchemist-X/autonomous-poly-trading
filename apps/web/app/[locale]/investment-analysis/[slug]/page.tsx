import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "../../../../components/investment-analysis/investment-analysis.module.css";
import {
  INVESTMENT_CASE_SLUGS,
  investmentHref,
  isInvestmentCaseSlug,
  type InvestmentCaseSlug
} from "../../../../lib/investment-analysis/routes";
import { localeOf, t, type Locale, type StrKey } from "../../../../lib/world-cup/i18n";

const ORIGIN = "https://forecasting-agent.com";

const REPORTS: Record<
  InvestmentCaseSlug,
  { titleKey: StrKey; descriptionKey: StrKey; iframeTitleKey: StrKey; src: string; interactive?: boolean }
> = {
  "tencent-hunyuan-workbuddy": {
    titleKey: "iaTencentMetaTitle",
    descriptionKey: "iaTencentMetaDescription",
    iframeTitleKey: "iaTencentFrameTitle",
    src: "/investment-analysis/reports/tencent-hunyuan-workbuddy.html"
  },
  "google-hassabis": {
    titleKey: "iaGoogleMetaTitle",
    descriptionKey: "iaGoogleMetaDescription",
    iframeTitleKey: "iaGoogleFrameTitle",
    src: "/investment-analysis/reports/google-hassabis.html"
  },
  "meta-capex-6m": {
    titleKey: "iaMetaCapexMetaTitle",
    descriptionKey: "iaMetaCapexMetaDescription",
    iframeTitleKey: "iaMetaCapexFrameTitle",
    src: "/investment-analysis/reports/meta-capex-6m.html",
    interactive: true
  }
};

export function generateStaticParams() {
  return INVESTMENT_CASE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isInvestmentCaseSlug(slug)) return {};

  const locale: Locale = localeOf(localeParam);
  const report = REPORTS[slug];
  const canonical = `${ORIGIN}${investmentHref(`/investment-analysis/${slug}`, locale)}`;

  return {
    title: t(locale, report.titleKey),
    description: t(locale, report.descriptionKey),
    alternates: { canonical },
    openGraph: {
      title: t(locale, report.titleKey),
      description: t(locale, report.descriptionKey),
      siteName: "Predict Raven",
      url: canonical,
      type: "article",
      images: [
        {
          url: `${ORIGIN}/brand/raven-icon.png`,
          width: 256,
          height: 256,
          alt: "Predict Raven"
        }
      ]
    },
    twitter: {
      card: "summary",
      title: t(locale, report.titleKey),
      description: t(locale, report.descriptionKey),
      images: [`${ORIGIN}/brand/raven-icon.png`]
    }
  };
}

export default async function InvestmentReportPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  if (!isInvestmentCaseSlug(slug)) notFound();

  const locale: Locale = localeOf(localeParam);
  const report = REPORTS[slug];

  return (
    <main className={styles.reportMain}>
      <iframe
        className={styles.reportFrame}
        src={report.src}
        title={t(locale, report.iframeTitleKey)}
        sandbox={report.interactive
          ? "allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox"
          : "allow-popups allow-popups-to-escape-sandbox"}
      />
    </main>
  );
}
