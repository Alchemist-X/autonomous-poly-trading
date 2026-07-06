import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getFifa8FixtureById,
  getFifa8FixtureIds,
  getForecasterMeta,
  getHeadlineForecasterId
} from "../../../../../lib/world-cup/fifa8-store";
import { LOCALES, localeOf, teamLabel, withLocale } from "../../../../../lib/world-cup/i18n";
import { resolveTeam } from "../../../../../lib/world-cup/team-meta";
import { Fifa8MatchDetail } from "../../../../../components/world-cup/fifa8-match-detail";

// Per-match detail for one market-blind Round-of-32 tie: the published
// (multi-calibrated) verdict, the FIFA-stat evidence behind it, and how all
// nine models read the match. Fully prerendered — one static page per fixture
// id × locale. No prices anywhere (blind-test policy).

// Prerender every fixture id for every locale; reject any other id.
export function generateStaticParams(): Array<{ locale: string; id: string }> {
  return LOCALES.flatMap((l) => getFifa8FixtureIds().map((id) => ({ locale: l.code, id })));
}

export const dynamicParams = false;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: localeParam, id } = await params;
  const locale = localeOf(localeParam);
  const fixture = getFifa8FixtureById(id);
  if (!fixture) {
    return { title: "Predict Raven — 2026 World Cup forecasts" };
  }
  const nameA = teamLabel(resolveTeam(fixture.teamA), locale);
  const nameB = teamLabel(resolveTeam(fixture.teamB), locale);
  const sep = locale === "en" ? " vs " : " 对 ";
  const title = `${nameA}${sep}${nameB} — Predict Raven`;
  return { title };
}

export default async function KnockoutMatchDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: localeParam, id } = await params;
  const locale = localeOf(localeParam);
  const fixture = getFifa8FixtureById(id);
  if (!fixture) notFound();

  const meta = getForecasterMeta();
  const headlineId = getHeadlineForecasterId();
  const backHref = withLocale("/world-cup/knockout", locale);

  return (
    <Fifa8MatchDetail
      fixture={fixture}
      meta={meta}
      headlineId={headlineId}
      locale={locale}
      backHref={backHref}
    />
  );
}
