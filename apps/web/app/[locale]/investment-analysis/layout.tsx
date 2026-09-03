import type { Metadata } from "next";
import type { ReactNode } from "react";
import { InvestmentHeader } from "../../../components/investment-analysis/investment-header";
import styles from "../../../components/investment-analysis/investment-analysis.module.css";
import { investmentHref } from "../../../lib/investment-analysis/routes";
import { localeOf, t, type Locale } from "../../../lib/world-cup/i18n";

const ORIGIN = "https://forecasting-agent.com";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = localeOf(localeParam);
  const path = investmentHref("/investment-analysis", locale);
  const canonical = `${ORIGIN}${path}`;

  return {
    title: t(locale, "iaMetaTitle"),
    description: t(locale, "iaMetaDescription"),
    alternates: {
      canonical,
      languages: {
        en: `${ORIGIN}${investmentHref("/investment-analysis", "en")}`,
        "zh-CN": `${ORIGIN}${investmentHref("/investment-analysis", "zh-CN")}`,
        "zh-TW": `${ORIGIN}${investmentHref("/investment-analysis", "zh-TW")}`
      }
    },
    openGraph: {
      title: t(locale, "iaMetaTitle"),
      description: t(locale, "iaMetaDescription"),
      siteName: "Predict Raven",
      url: canonical,
      type: "website",
      locale: locale === "en" ? "en_US" : locale === "zh-TW" ? "zh_TW" : "zh_CN",
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
      title: t(locale, "iaMetaTitle"),
      description: t(locale, "iaMetaDescription"),
      images: [`${ORIGIN}/brand/raven-icon.png`]
    }
  };
}

export default async function InvestmentAnalysisLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale: Locale = localeOf(localeParam);

  return (
    <div className={styles.surface}>
      <InvestmentHeader locale={locale} />
      {children}
    </div>
  );
}
