"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./world-cup.module.css";

// Sample-run picker: a few real archived forecasts the visitor can flip
// between to see what the agent's output looks like. All strings arrive
// pre-localized from the server page.

export interface SampleView {
  id: string;
  chip: string;
  question: string;
  outcomes: Array<{ label: string; p: number }>;
  oneLiner: string;
  reasons: string[];
  reportHref: string;
  meta: string;
  reportLabel: string;
}

function pct(p: number): string {
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

export function SampleRun({ samples, title, hint }: { samples: SampleView[]; title: string; hint: string }) {
  const [idx, setIdx] = useState(0);
  const s = samples[idx] ?? samples[0];
  if (!s) return null;
  const top = Math.max(...s.outcomes.map((o) => o.p));

  return (
    <section className={styles.sampleCard}>
      <div className={styles.sampleHead}>
        <div>
          <h2 className={styles.panelTitle} style={{ margin: 0 }}>
            {title}
          </h2>
          <p className={styles.muted} style={{ margin: "4px 0 0", fontSize: 13 }}>
            {hint}
          </p>
        </div>
        <div className={styles.sampleChips}>
          {samples.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`${styles.sampleChip} ${i === idx ? styles.sampleChipActive : ""}`}
            >
              {x.chip}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.sampleQuestion}>{s.question}</p>

      <div className={styles.sampleOutcomes}>
        {s.outcomes.map((o) => (
          <div key={o.label} className={`${styles.sampleOutcome} ${o.p === top ? styles.sampleOutcomeTop : ""}`}>
            <span className={styles.sampleOutcomeLabel}>{o.label}</span>
            <span className={styles.sampleBarTrack}>
              <span className={styles.sampleBarFill} style={{ width: `${Math.max(o.p * 100, 1.5)}%` }} />
            </span>
            <span className={styles.sampleOutcomePct}>{pct(o.p)}</span>
          </div>
        ))}
      </div>

      <p className={styles.oneLiner}>{s.oneLiner}</p>
      <ul className={styles.reasonList}>
        {s.reasons.map((r) => (
          <li key={r.slice(0, 40)} className={styles.reasonItem}>
            {r}
          </li>
        ))}
      </ul>
      <div className={styles.cardActions}>
        <Link className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} href={s.reportHref}>
          {s.reportLabel}
        </Link>
        <span className={styles.muted}>{s.meta}</span>
      </div>
    </section>
  );
}
