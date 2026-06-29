import type {
  Fifa8Fixture,
  ForecasterMeta,
  ForecasterRow,
  Pick,
  TeamStats,
  Tier
} from "../../lib/world-cup/fifa8-store";
import { getFifa8GeneratedAt } from "../../lib/world-cup/fifa8-store";
import { resolveTeam } from "../../lib/world-cup/team-meta";
import { pct3 } from "../../lib/world-cup/pct";
import { t, teamLabel, type Locale, type StrKey } from "../../lib/world-cup/i18n";
import styles from "./fifa8-detail.module.css";

// Per-match detail page for one Round-of-32 tie. Forecasting-engine style:
// decision-first verdict up top, then the market-blind FIFA-stat evidence as
// comparison cards, then how all nine models read the tie. No prices anywhere
// (blind-test policy) — only model probabilities and on-pitch stats.

const TIER_LABEL_KEY: Record<Tier, StrKey> = {
  high: "tierHigh",
  medium: "tierMedium",
  low: "tierLow"
};

// The published (multi-calibrated) headline emits a small fixed driver set; map
// those to i18n keys. Other models emit free-form generated labels, which we
// render as-is (they are content, like the archived report prose).
const DRIVER_KEY: Record<string, StrKey> = {
  "Consensus of all models": "knDriverConsensus",
  "Bias correction": "knDriverBias"
};

// One evidence dimension. `better` says which direction wins the read: for
// xG-against / low-block, the LOWER value is the stronger team.
interface Dimension {
  readonly labelKey: StrKey;
  readonly readKey: StrKey;
  readonly pick: (s: TeamStats) => number;
  readonly lowerIsBetter: boolean;
  readonly format: (v: number) => string;
}

function fmtXg(v: number): string {
  return v.toFixed(2);
}
function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}
function fmtKm(v: number): string {
  return `${v.toFixed(1)} km`;
}
function fmtElo(v: number): string {
  return String(Math.round(v));
}

const DIMENSIONS: readonly Dimension[] = [
  { labelKey: "kndDimStrength", readKey: "kndReadStrength", pick: (s) => s.elo, lowerIsBetter: false, format: fmtElo },
  { labelKey: "kndDimAttack", readKey: "kndReadAttack", pick: (s) => s.xgFor, lowerIsBetter: false, format: fmtXg },
  { labelKey: "kndDimDefence", readKey: "kndReadDefence", pick: (s) => s.xgAgainst, lowerIsBetter: true, format: fmtXg },
  { labelKey: "kndDimPossession", readKey: "kndReadPossession", pick: (s) => s.possessionPct, lowerIsBetter: false, format: fmtPct },
  { labelKey: "kndDimHighPress", readKey: "kndReadHighPress", pick: (s) => s.highPressPct, lowerIsBetter: false, format: fmtPct },
  { labelKey: "kndDimCounter", readKey: "kndReadCounter", pick: (s) => s.counterAttackPct, lowerIsBetter: false, format: fmtPct },
  { labelKey: "kndDimLowBlock", readKey: "kndReadLowBlock", pick: (s) => s.lowBlockPct, lowerIsBetter: false, format: fmtPct },
  { labelKey: "kndDimIntensity", readKey: "kndReadIntensity", pick: (s) => s.highIntensityKm, lowerIsBetter: false, format: fmtKm }
];

// Plain-language verdict, templated per locale so prose stays jargon-free.
function verdict(locale: Locale, pick: Pick, favouredName: string, pct: number): string {
  const key: StrKey = pick === "draw" ? "knTplDraw" : "knTplPick";
  return t(locale, key).replace("{team}", favouredName).replace("{pct}", String(pct));
}

// Localized "{sign}{pp} pts → {team}" line for a model's top driver.
function driverPp(locale: Locale, contributionPp: number, nameA: string, nameB: string): string {
  const fav = contributionPp >= 0 ? nameA : nameB;
  const sign = contributionPp >= 0 ? "+" : "−";
  return t(locale, "knDriverPp")
    .replace("{sign}", sign)
    .replace("{pp}", Math.abs(contributionPp).toFixed(1))
    .replace("{team}", fav);
}

function Splits({ a, draw, b }: { a: number; draw: number; b: number }) {
  return (
    <span className={styles.bar} aria-hidden>
      <span className={styles.segA} style={{ width: `${a * 100}%` }} />
      <span className={styles.segD} style={{ width: `${draw * 100}%` }} />
      <span className={styles.segB} style={{ width: `${b * 100}%` }} />
    </span>
  );
}

// Which side a model favours: a / draw / b, by its own highest probability.
function favourOf(row: ForecasterRow): Pick {
  if (row.a >= row.draw && row.a >= row.b) return "a";
  if (row.b >= row.a && row.b >= row.draw) return "b";
  return "draw";
}

function EvidenceCard({
  dim,
  statsA,
  statsB,
  nameA,
  nameB,
  locale
}: {
  dim: Dimension;
  statsA: TeamStats;
  statsB: TeamStats;
  nameA: string;
  nameB: string;
  locale: Locale;
}) {
  const va = dim.pick(statsA);
  const vb = dim.pick(statsB);
  // Higher raw value leans toward the side with the longer bar; for
  // lower-is-better dimensions the leader is the smaller value.
  const aLeads = dim.lowerIsBetter ? va <= vb : va >= vb;
  const leaderName = va === vb ? "" : aLeads ? nameA : nameB;
  const otherName = aLeads ? nameB : nameA;
  // Bar widths: fill is proportional within the pair so the contrast is visible
  // even when the two values are close. Guard against a zero/negative total.
  const total = Math.abs(va) + Math.abs(vb);
  const aWidth = total > 0 ? (Math.abs(va) / total) * 100 : 50;
  const bWidth = 100 - aWidth;
  const read =
    va === vb
      ? t(locale, "kndEven").replace("{a}", nameA).replace("{b}", nameB)
      : t(locale, dim.readKey)
          .replace("{team}", leaderName)
          .replace("{other}", otherName)
          .replace("{lead}", dim.format(aLeads ? va : vb))
          .replace("{trail}", dim.format(aLeads ? vb : va));

  return (
    <div className={styles.evCard}>
      <div className={styles.evLabel}>{t(locale, dim.labelKey)}</div>
      <div className={styles.evRow}>
        <span className={`${styles.evVal} ${aLeads && va !== vb ? styles.evValLead : ""}`}>{dim.format(va)}</span>
        <span className={styles.evMini} aria-hidden>
          <span className={`${styles.evMiniA} ${aLeads && va !== vb ? styles.evMiniLead : ""}`} style={{ width: `${aWidth}%` }} />
          <span className={`${styles.evMiniB} ${!aLeads && va !== vb ? styles.evMiniLead : ""}`} style={{ width: `${bWidth}%` }} />
        </span>
        <span className={`${styles.evVal} ${styles.evValRight} ${!aLeads && va !== vb ? styles.evValLead : ""}`}>
          {dim.format(vb)}
        </span>
      </div>
      <p className={styles.evRead}>{read}</p>
    </div>
  );
}

function ModelRow({
  row,
  meta,
  isHeadline,
  nameA,
  nameB,
  locale
}: {
  row: ForecasterRow;
  meta: ForecasterMeta | undefined;
  isHeadline: boolean;
  nameA: string;
  nameB: string;
  locale: Locale;
}) {
  const [ra, rd, rb] = pct3(row.a, row.draw, row.b);
  const topDriver = row.drivers[0];
  const driverLabelKey = topDriver ? DRIVER_KEY[topDriver.label] : undefined;
  return (
    <div className={`${styles.modelRow} ${isHeadline ? styles.modelRowLead : ""}`}>
      <div className={styles.modelHead}>
        <span className={styles.modelName}>
          {meta?.name ?? row.id}
          {isHeadline ? <span className={styles.modelBadge}>{t(locale, "knPublished")}</span> : null}
        </span>
        <span className={styles.modelNums}>
          <span className={styles.numA}>{ra}</span>
          <span className={styles.numD}>{rd}</span>
          <span className={styles.numB}>{rb}</span>
        </span>
      </div>
      <Splits a={row.a} draw={row.draw} b={row.b} />
      <p className={styles.modelReason}>{row.headline}</p>
      {topDriver ? (
        <p className={styles.modelDriver}>
          <span className={styles.modelDriverLabel}>
            {driverLabelKey ? t(locale, driverLabelKey) : topDriver.label}
          </span>
          {topDriver.contributionPp !== 0 ? (
            <span className={styles.modelDriverPp}>{driverPp(locale, topDriver.contributionPp, nameA, nameB)}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function Fifa8MatchDetail({
  fixture,
  meta,
  headlineId,
  locale,
  backHref
}: {
  fixture: Fifa8Fixture;
  meta: readonly ForecasterMeta[];
  headlineId: string;
  locale: Locale;
  backHref: string;
}) {
  const headline = fixture.headline;
  const teamA = resolveTeam(fixture.teamA);
  const teamB = resolveTeam(fixture.teamB);
  const nameA = teamLabel(teamA, locale);
  const nameB = teamLabel(teamB, locale);
  const favouredMeta = headline.pick === "b" ? teamB : teamA;
  const favouredName = teamLabel(favouredMeta, locale);

  // Sum-to-100 percents drive both the verdict number and the split labels, so
  // the headline % and the bar labels can never disagree.
  const [pa, pd, pb] = pct3(headline.a, headline.draw, headline.b);
  const headlinePct = headline.pick === "b" ? pb : headline.pick === "draw" ? pd : pa;

  const metaById = new Map(meta.map((m) => [m.id, m]));

  // Group the nine models by who they favour so agreement vs disagreement reads
  // at a glance: A-favouring first, then draw, then B-favouring. The published
  // (multi-calibrated) blend leads its group.
  const groups: ReadonlyArray<{ pick: Pick; headingKey: StrKey; rows: readonly ForecasterRow[] }> = (
    ["a", "draw", "b"] as const
  ).map((p) => {
    const rows = fixture.forecasters.filter((r) => favourOf(r) === p);
    const ordered = [...rows].sort((x, y) => (x.id === headlineId ? -1 : y.id === headlineId ? 1 : 0));
    const headingKey: StrKey = p === "draw" ? "kndFavoursDraw" : "kndFavours";
    return { pick: p, headingKey, rows: ordered };
  });

  const groupHeading = (pick: Pick, headingKey: StrKey): string => {
    if (pick === "draw") return t(locale, headingKey);
    const name = pick === "b" ? nameB : nameA;
    return t(locale, headingKey).replace("{team}", name);
  };

  return (
    <div className={styles.page}>
      <a href={backHref} className={styles.back}>
        {t(locale, "kndBack")}
      </a>

      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.matchNo}>{t(locale, "knMatch").replace("{n}", String(fixture.matchNo))}</span>
          <span className={`${styles.tierChip} ${tierClass(headline.tier)}`}>
            {t(locale, "confidence")} · {t(locale, TIER_LABEL_KEY[headline.tier])}
          </span>
        </div>

        <div className={styles.matchup}>
          <span className={styles.team}>
            <span className={styles.flag}>{teamA.flag}</span>
            <span className={styles.teamName}>{nameA}</span>
          </span>
          <span className={styles.vs}>{t(locale, "knVs")}</span>
          <span className={`${styles.team} ${styles.teamAway}`}>
            <span className={styles.teamName}>{nameB}</span>
            <span className={styles.flag}>{teamB.flag}</span>
          </span>
        </div>

        <p className={styles.verdict}>{verdict(locale, headline.pick, favouredName, headlinePct)}</p>

        <div className={styles.splitWrap}>
          <Splits a={headline.a} draw={headline.draw} b={headline.b} />
          <span className={styles.splitLabels}>
            <span className={styles.splitA}>
              {nameA} {pa}%
            </span>
            <span className={styles.splitD}>
              {t(locale, "draw")} {pd}%
            </span>
            <span className={styles.splitB}>
              {nameB} {pb}%
            </span>
          </span>
        </div>
      </section>

      {fixture.statsA && fixture.statsB ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t(locale, "kndEvidenceTitle")}</h2>
          <div className={styles.evGrid}>
            {DIMENSIONS.map((dim) => (
              <EvidenceCard
                key={dim.labelKey}
                dim={dim}
                statsA={fixture.statsA!}
                statsB={fixture.statsB!}
                nameA={nameA}
                nameB={nameB}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t(locale, "kndModelsTitle")}</h2>
        {groups.map((g) =>
          g.rows.length === 0 ? null : (
            <div key={g.pick} className={styles.modelGroup}>
              <div className={styles.modelGroupHead}>{groupHeading(g.pick, g.headingKey)}</div>
              <div className={styles.modelList}>
                {g.rows.map((row) => (
                  <ModelRow
                    key={row.id}
                    row={row}
                    meta={metaById.get(row.id)}
                    isHeadline={row.id === headlineId}
                    nameA={nameA}
                    nameB={nameB}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          )
        )}
        <div className={styles.legend}>
          <span>
            <span className={`${styles.dot} ${styles.dotA}`} />
            {nameA}
          </span>
          <span>
            <span className={`${styles.dot} ${styles.dotD}`} />
            {t(locale, "draw")}
          </span>
          <span>
            <span className={`${styles.dot} ${styles.dotB}`} />
            {nameB}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t(locale, "kndMethodTitle")}</h2>
        <p className={styles.methodNote}>{headline.methodNote}</p>
        <p className={styles.disclaimer}>{t(locale, "kndPredictedAt").replace("{date}", getFifa8GeneratedAt().slice(0, 10))}</p>
        <p className={styles.disclaimer}>{t(locale, "knMarketBlindNote")}</p>
      </section>
    </div>
  );
}

function tierClass(tier: Tier) {
  if (tier === "high") return styles.tierHigh;
  if (tier === "medium") return styles.tierMedium;
  return styles.tierLow;
}
