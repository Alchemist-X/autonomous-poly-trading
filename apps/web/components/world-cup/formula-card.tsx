import { t, type Lang } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// Typeset baseline formulas (Davidson three-way Elo + bounded Bayesian
// update). Pure HTML/CSS math — no rendering library.

function Frac({ num, den }: { num: React.ReactNode; den: React.ReactNode }) {
  return (
    <span className={styles.frac}>
      <span className={styles.fracNum}>{num}</span>
      <span className={styles.fracDen}>{den}</span>
    </span>
  );
}

const PiA = (
  <span>
    π<sub>A</sub>
  </span>
);
const PiB = (
  <span>
    π<sub>B</sub>
  </span>
);
const Root = (
  <span>
    ν·√(π<sub>A</sub>π<sub>B</sub>)
  </span>
);

export function FormulaCard({ lang }: { lang: Lang }) {
  return (
    <section className={styles.formulaCard}>
      <h2 className={styles.panelTitle} style={{ marginBottom: 14 }}>
        {t(lang, "formulaTitle")}
      </h2>
      <div className={styles.formulaRow}>
        <span className={styles.formulaPiece}>
          π = 10<sup>R/400</sup>
        </span>
        <span className={styles.formulaPiece}>
          P(A) = <Frac num={PiA} den={<span>{PiA} + {PiB} + {Root}</span>} />
        </span>
        <span className={styles.formulaPiece}>
          P(draw) = <Frac num={Root} den={<span>{PiA} + {PiB} + {Root}</span>} />
        </span>
        <span className={styles.formulaPiece}>
          p<sub>final</sub> = norm(p<sub>stat</sub> + Δ<sub>evidence</sub>)
        </span>
      </div>
      <p className={styles.formulaLegend}>{t(lang, "formulaLegend")}</p>
    </section>
  );
}
