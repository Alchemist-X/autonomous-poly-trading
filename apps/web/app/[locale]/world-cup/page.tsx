import Link from "next/link";
import { contentFor, getByFamily, sortedOutcomes } from "../../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../../lib/world-cup/team-meta";
import { LOCALES, localeOf, t, teamLabel, tierLabel, withLocale } from "../../../lib/world-cup/i18n";
import { WcHero } from "../../../components/world-cup/wc-hero";
import styles from "../../../components/world-cup/world-cup.module.css";

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((l) => ({ locale: l.code }));
}

// 冠军 tab — flag-cloud display of champion probabilities + full 48-team
// ranking. Every number is our own market-blind model output.

const CLOUD_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [50, 36], [27, 28], [71, 30], [38, 58], [62, 56],
  [18, 50], [83, 52], [30, 78], [55, 79], [74, 74],
  [12, 71], [88, 73], [20, 13], [44, 14], [66, 12], [86, 16]
];

function pct(p: number): string {
  if (p < 0.0001) return "<0.01%";
  return `${(p * 100).toFixed(2)}%`;
}

export default async function ChampionPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  const champion = getByFamily("champion")[0];
  const outcomes = champion ? sortedOutcomes(champion) : [];
  const cloud = outcomes.slice(0, CLOUD_SLOTS.length);
  const detailHref = champion ? withLocale(`/world-cup/forecast/${champion.dir}`, locale) : "#";
  const teamName = (key: string) => teamLabel(resolveTeam(key), locale);
  const content = champion ? contentFor(champion, locale) : null;

  return (
    <div>
      <WcHero locale={locale} subKey="subChampion" />

      {champion ? (
        <div className={styles.champLayout}>
          <div className={styles.flagCloud}>
            {cloud.map((o, i) => {
              const meta = resolveTeam(o.key);
              const size = Math.round(30 + Math.sqrt(o.p) * 110);
              const [x, y] = CLOUD_SLOTS[i] ?? [50, 50];
              return (
                <Link
                  key={o.key}
                  href={detailHref}
                  className={styles.cloudTile}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${teamName(o.key)} ${pct(o.p)}`}
                >
                  <span className={styles.cloudFlag} style={{ fontSize: size }}>
                    {meta.flag}
                  </span>
                  <span className={styles.cloudPct}>{pct(o.p)}</span>
                  <span className={styles.cloudName}>{teamName(o.key)}</span>
                </Link>
              );
            })}
            <span className={styles.cloudNote}>{t(locale, "cloudNote")}</span>
          </div>

          <div className={styles.rankList}>
            {outcomes.map((o, i) => {
              const meta = resolveTeam(o.key);
              return (
                <Link key={o.key} href={detailHref} className={styles.rankRow}>
                  <span className={styles.rankIdx}>{i + 1}</span>
                  <span className={styles.rankFlag}>{meta.flag}</span>
                  <span className={styles.rankName}>
                    <span className={styles.rankNameCn}>{teamName(o.key)}</span>
                    <span className={styles.rankTrack}>
                      <span
                        className={styles.rankFill}
                        style={{ width: `${Math.max(o.p / (outcomes[0]?.p ?? 1), 0.012) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className={styles.rankPct}>{pct(o.p)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.panel}>
          <p className={styles.muted}>{t(locale, "importing")}</p>
        </div>
      )}

      {champion ? (
        <>
          <h2 className={styles.sectionTitle}>{t(locale, "ourTake")}</h2>
          <div className={styles.panel}>
            <p className={styles.oneLiner}>{content?.oneLiner}</p>
            <ul className={styles.reasonList}>
              {champion.key_reasons.map((r, i) => (
                <li key={r.source_url + r.source_date} className={styles.reasonItem}>
                  {content?.reasons[i]}{" "}
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                    {t(locale, "source")} · {r.source_date}
                  </a>
                </li>
              ))}
            </ul>
            <div className={styles.cardActions}>
              <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} href={detailHref}>
                {t(locale, "fullReasoning")}
              </Link>
              <span className={styles.muted}>
                {champion.n_sources} {t(locale, "sources")} · {t(locale, "confidence")} {tierLabel(locale, champion.confidence_tier)}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
