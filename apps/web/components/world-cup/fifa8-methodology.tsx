import { withLocale, t, type Locale, type StrKey } from "../../lib/world-cup/i18n";
import styles from "./fifa8-methodology.module.css";

// Long-form methodology page for the FIFA 8-model knockout feature. A diagram-led
// narrative: FIFA match PDF → the stats we read → a team's profile → the eight
// models → the published call. Server component — no client hooks. Every string
// is i18n. Market-blind throughout: no prices, odds or betting data appear here.
// The pipeline diagram is an inline SVG (themed with CSS colour vars) plus a
// CSS-stacked mobile variant so nothing overflows on narrow screens.

// One data field we read off the FIFA report, for the "what we read" grid.
interface DataField {
  readonly nameKey: StrKey;
  readonly meaningKey: StrKey;
  readonly example: string;
}

const DATA_FIELDS: readonly DataField[] = [
  { nameKey: "mthFieldAttack", meaningKey: "mthFieldAttackMeaning", example: "1.94" },
  { nameKey: "mthFieldDefence", meaningKey: "mthFieldDefenceMeaning", example: "0.74" },
  { nameKey: "mthFieldPossession", meaningKey: "mthFieldPossessionMeaning", example: "54.0%" },
  { nameKey: "mthFieldHighPress", meaningKey: "mthFieldHighPressMeaning", example: "22.0%" },
  { nameKey: "mthFieldCounter", meaningKey: "mthFieldCounterMeaning", example: "18.0%" },
  { nameKey: "mthFieldLowBlock", meaningKey: "mthFieldLowBlockMeaning", example: "15.0%" },
  { nameKey: "mthFieldIntensity", meaningKey: "mthFieldIntensityMeaning", example: "9.6 km" },
  { nameKey: "mthFieldStrength", meaningKey: "mthFieldStrengthMeaning", example: "1932" },
  { nameKey: "mthFieldMatches", meaningKey: "mthFieldMatchesMeaning", example: "3" }
];

// The eight base models, in narrative depth. nameKey is the model's title; the
// body is one full plain-language paragraph keyed by descKey.
interface ModelEntry {
  readonly nameKey: StrKey;
  readonly familyKey: StrKey;
  readonly descKey: StrKey;
}

const MODELS: readonly ModelEntry[] = [
  { nameKey: "mthModel1Name", familyKey: "kgFamilyStatistical", descKey: "mthModel1Desc" },
  { nameKey: "mthModel2Name", familyKey: "kgFamilyElo", descKey: "mthModel2Desc" },
  { nameKey: "mthModel3Name", familyKey: "kgFamilyElo", descKey: "mthModel3Desc" },
  { nameKey: "mthModel4Name", familyKey: "kgFamilyElo", descKey: "mthModel4Desc" },
  { nameKey: "mthModel5Name", familyKey: "kgFamilyElo", descKey: "mthModel5Desc" },
  { nameKey: "mthModel6Name", familyKey: "kgFamilyMl", descKey: "mthModel6Desc" },
  { nameKey: "mthModel7Name", familyKey: "kgFamilyMl", descKey: "mthModel7Desc" },
  { nameKey: "mthModel8Name", familyKey: "kgFamilyEnsemble", descKey: "mthModel8Desc" }
];

// The pipeline stages, in order. Each has a short box label and a caption. The
// same list drives both the desktop SVG flowchart and the mobile stacked list,
// so the two variants can never drift apart.
interface Stage {
  readonly labelKey: StrKey;
  readonly captionKey: StrKey;
}

const STAGES: readonly Stage[] = [
  { labelKey: "mthStage1", captionKey: "mthStage1Cap" },
  { labelKey: "mthStage2", captionKey: "mthStage2Cap" },
  { labelKey: "mthStage3", captionKey: "mthStage3Cap" },
  { labelKey: "mthStage4", captionKey: "mthStage4Cap" },
  { labelKey: "mthStage5", captionKey: "mthStage5Cap" },
  { labelKey: "mthStage6", captionKey: "mthStage6Cap" },
  { labelKey: "mthStage7", captionKey: "mthStage7Cap" },
  { labelKey: "mthStage8", captionKey: "mthStage8Cap" }
];

// Wrap text onto up to three lines for an SVG box. Splits on word boundaries so
// long labels stay inside their rounded box rather than overflowing.
function wrapLabel(text: string, maxChars: number): readonly string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

// Desktop pipeline diagram: a horizontal SVG flowchart of the eight stages,
// connected by arrows, themed via CSS colour variables (currentColor + fills set
// by the stylesheet through CSS classes). viewBox-scaled so it never overflows
// its column. Hidden ≤720px in favour of the stacked list below.
function PipelineSvg({ locale }: { locale: Locale }) {
  const cols = 4;
  const boxW = 150;
  const boxH = 78;
  const gapX = 56;
  const gapY = 70;
  const padX = 12;
  const padY = 12;
  const rowW = cols * boxW + (cols - 1) * gapX;
  const width = rowW + padX * 2;
  const height = 2 * boxH + gapY + padY * 2;

  const positions = STAGES.map((_, i) => {
    const row = Math.floor(i / cols);
    // Serpentine layout: row 0 runs left→right, row 1 right→left, so arrows flow
    // continuously without crossing.
    const colInRow = i % cols;
    const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;
    const x = padX + col * (boxW + gapX);
    const y = padY + row * (boxH + gapY);
    return { x, y, row, col };
  });

  return (
    <svg
      className={styles.pipelineSvg}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t(locale, "mthPipelineAria")}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="mth-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className={styles.svgArrowHead} />
        </marker>
      </defs>

      {/* Connectors first, so boxes paint on top of arrow ends. */}
      {positions.map((p, i) => {
        if (i === STAGES.length - 1) return null;
        const next = positions[i + 1];
        if (!next) return null;
        const fromCx = p.x + boxW / 2;
        const fromCy = p.y + boxH / 2;
        if (p.row === next.row) {
          // Horizontal arrow between siblings in a row.
          const goingRight = next.x > p.x;
          const x1 = goingRight ? p.x + boxW : p.x;
          const x2 = goingRight ? next.x : next.x + boxW;
          const y = p.y + boxH / 2;
          return (
            <line
              key={`c${i}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              className={styles.svgConnector}
              markerEnd="url(#mth-arrow)"
            />
          );
        }
        // Vertical drop to the next row (serpentine turn).
        const x = fromCx;
        const y1 = p.y + boxH;
        const y2 = next.y;
        return (
          <line
            key={`c${i}`}
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            className={styles.svgConnector}
            markerEnd="url(#mth-arrow)"
          />
        );
      })}

      {positions.map((p, i) => {
        const stage = STAGES[i];
        if (!stage) return null;
        const isFinal = i === STAGES.length - 1;
        const lines = wrapLabel(t(locale, stage.labelKey), 18);
        const cx = p.x + boxW / 2;
        const startY = p.y + boxH / 2 - (lines.length - 1) * 7;
        return (
          <g key={`b${i}`}>
            <rect
              x={p.x}
              y={p.y}
              width={boxW}
              height={boxH}
              rx="12"
              className={isFinal ? styles.svgBoxFinal : styles.svgBox}
            />
            <text x={cx} y={startY} className={isFinal ? styles.svgLabelFinal : styles.svgLabel}>
              {lines.map((ln, li) => (
                <tspan key={li} x={cx} dy={li === 0 ? 0 : 14}>
                  {ln}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Mobile pipeline: the same eight stages stacked vertically with down-arrows.
// Shown ≤720px (the SVG is hidden there). Pure layout — no overflow risk.
function PipelineStack({ locale }: { locale: Locale }) {
  return (
    <ol className={styles.stack} aria-label={t(locale, "mthPipelineAria")}>
      {STAGES.map((stage, i) => (
        <li key={stage.labelKey} className={styles.stackItem}>
          <div className={`${styles.stackBox} ${i === STAGES.length - 1 ? styles.stackBoxFinal : ""}`}>
            <span className={styles.stackLabel}>{t(locale, stage.labelKey)}</span>
            <span className={styles.stackCaption}>{t(locale, stage.captionKey)}</span>
          </div>
          {i < STAGES.length - 1 ? (
            <span className={styles.stackArrow} aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function Fifa8Methodology({ locale }: { locale: Locale }) {
  const backHref = withLocale("/world-cup/knockout", locale);

  return (
    <div className={styles.page}>
      <a href={backHref} className={styles.back}>
        {t(locale, "mthBack")}
      </a>

      {/* 1 — hero */}
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t(locale, "mthEyebrow")}</p>
        <h1 className={styles.title}>{t(locale, "mthTitle")}</h1>
        <p className={styles.intro}>{t(locale, "mthIntro")}</p>
      </header>

      {/* 2 — the pipeline diagram (centrepiece) */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t(locale, "mthPipelineTitle")}</h2>
        <p className={styles.lead}>{t(locale, "mthPipelineLead")}</p>
        <figure className={styles.pipelineFig}>
          <PipelineSvg locale={locale} />
          <PipelineStack locale={locale} />
          <figcaption className={styles.pipelineCap}>{t(locale, "mthPipelineCaption")}</figcaption>
        </figure>
        {/* Stage captions, readable on every screen (the SVG boxes are terse). */}
        <ol className={styles.stageCaptions}>
          {STAGES.map((stage, i) => (
            <li key={stage.captionKey} className={styles.stageCaptionItem}>
              <span className={styles.stageNo}>{i + 1}</span>
              <span>
                <strong className={styles.stageName}>{t(locale, stage.labelKey)}</strong>
                {" — "}
                {t(locale, stage.captionKey)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* 3 — the source */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t(locale, "mthSourceTitle")}</h2>
        <p className={styles.body}>{t(locale, "mthSourceP1")}</p>
        <p className={styles.body}>{t(locale, "mthSourceP2")}</p>
      </section>

      {/* 4 — what we read, field by field */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t(locale, "mthFieldsTitle")}</h2>
        <p className={styles.body}>{t(locale, "mthFieldsIntro")}</p>
        <div className={styles.fieldGrid}>
          {DATA_FIELDS.map((field) => (
            <div key={field.nameKey} className={styles.fieldCard}>
              <div className={styles.fieldName}>{t(locale, field.nameKey)}</div>
              <p className={styles.fieldMeaning}>{t(locale, field.meaningKey)}</p>
              <div className={styles.fieldExample}>
                <span className={styles.fieldExampleLabel}>{t(locale, "mthFieldExample")}</span>
                <span className={styles.fieldExampleVal}>{field.example}</span>
              </div>
            </div>
          ))}
        </div>
        <p className={styles.note}>{t(locale, "mthXgNote")}</p>
      </section>

      {/* 5 — data → team profile */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t(locale, "mthProfileTitle")}</h2>
        <p className={styles.body}>{t(locale, "mthProfileP1")}</p>
        <div className={styles.profileDiagram} aria-hidden>
          <span className={styles.profileChip}>{t(locale, "mthProfileGame1")}</span>
          <span className={styles.profileChip}>{t(locale, "mthProfileGame2")}</span>
          <span className={styles.profileChip}>{t(locale, "mthProfileGame3")}</span>
          <span className={styles.profileArrow}>→</span>
          <span className={styles.profileResult}>{t(locale, "mthProfileOut")}</span>
        </div>
        <p className={styles.body}>{t(locale, "mthProfileP2")}</p>
      </section>

      {/* 6 — the eight models, in depth */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t(locale, "mthModelsTitle")}</h2>
        <p className={styles.body}>{t(locale, "mthModelsIntro")}</p>
        <div className={styles.modelGrid}>
          {MODELS.map((model, i) => (
            <article key={model.nameKey} className={styles.modelCard}>
              <div className={styles.modelHead}>
                <span className={styles.modelNo}>{i + 1}</span>
                <span className={styles.modelName}>{t(locale, model.nameKey)}</span>
                <span className={styles.modelFamily}>{t(locale, model.familyKey)}</span>
              </div>
              <p className={styles.modelDesc}>{t(locale, model.descKey)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 7 — from eight reads to one published call */}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t(locale, "mthFinalTitle")}</h2>
        <p className={styles.body}>{t(locale, "mthFinalP1")}</p>
        <div className={styles.finalDiagram} aria-hidden>
          <span className={styles.finalStep}>{t(locale, "mthFinalStep1")}</span>
          <span className={styles.finalArrow}>→</span>
          <span className={styles.finalStep}>{t(locale, "mthFinalStep2")}</span>
          <span className={styles.finalArrow}>→</span>
          <span className={styles.finalStep}>{t(locale, "mthFinalStep3")}</span>
          <span className={styles.finalArrow}>→</span>
          <span className={styles.finalStepOut}>{t(locale, "mthFinalStep4")}</span>
        </div>
        <p className={styles.body}>{t(locale, "mthFinalP2")}</p>
      </section>

      {/* 8 — market-blind footer + back link */}
      <footer className={styles.footer}>
        <p className={styles.footerNote}>{t(locale, "mthFooterBlind")}</p>
        <a href={backHref} className={styles.back}>
          {t(locale, "mthBack")}
        </a>
      </footer>
    </div>
  );
}
