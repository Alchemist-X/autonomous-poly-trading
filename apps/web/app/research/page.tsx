import type { Metadata } from "next";
import Link from "next/link";
import { ResearchConsole } from "../../components/research/research-console";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import styles from "../../components/research/research.module.css";

export const metadata: Metadata = {
  title: "Forecasting Engine — Predict Raven",
  description:
    "Ask any verifiable future event in natural language and watch an AI superforecaster reason in the open: layered evidence, a conditional-probability model, Bayesian updates, and a calibrated probability with an 80% confidence interval."
};

// Public C-end surface. Streaming + interactivity live in the client console;
// this shell only provides metadata, chrome, and the compliance footer.
export const dynamic = "force-dynamic";

export default function ResearchPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <Link href="/research" className={styles.brand}>
            Predict Raven
            <span className={styles.brandTag}>Forecasting Engine</span>
          </Link>
          <Link href="/world-cup" className={styles.brandTag} style={{ textDecoration: "none" }}>
            世界杯预测 →
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <ResearchConsole />
      </main>
      <LegalFooter locale="zh-CN" />
    </div>
  );
}
