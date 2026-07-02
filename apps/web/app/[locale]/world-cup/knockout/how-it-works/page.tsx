import type { Metadata } from "next";
import { LOCALES, localeOf, t } from "../../../../../lib/world-cup/i18n";
import { Fifa8Methodology } from "../../../../../components/world-cup/fifa8-methodology";

// "How it works" methodology page for the live FIFA 8-model knockout feature.
// A long-form, diagram-led walkthrough of the whole chain — FIFA match PDF →
// the stats we read → a team's profile → the eight models → the published call.
// It is the depth companion to the inline "i" model guide (which links here).
// Fully prerendered: one static page per locale. Market-blind throughout — no
// prices, no odds, no betting data anywhere (blind-test policy).

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((l) => ({ locale: l.code }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = localeOf((await params).locale);
  return { title: `${t(locale, "mthTitle")} — Predict Raven` };
}

export default async function KnockoutMethodologyPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  return <Fifa8Methodology locale={locale} />;
}
