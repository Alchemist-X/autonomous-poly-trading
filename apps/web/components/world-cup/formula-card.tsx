import { t, type Locale } from "../../lib/world-cup/i18n";
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

export function FormulaCard({ locale }: { locale: Locale }) {
  return (
    <details className={styles.formulaCard}>
      <summary className={styles.formulaSummary}>{t(locale, "formulaTitle")}</summary>
      <div className={styles.formulaRow} style={{ marginTop: 14 }}>
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
      <p className={styles.formulaLegend}>{t(locale, "formulaLegend")}</p>
    </details>
  );
}
