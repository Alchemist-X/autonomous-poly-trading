import * as React from "react";
import { verdictLabel } from "../lib/format";

export interface VerdictBadgeProps {
  /** Final P(YES) (0..1). Mapped to a plain-language verdict via `verdictLabel`. */
  prob: number;
  /** Optional sub-line below the verdict (e.g. "started 15% prior"), shown in mono. */
  caption?: string;
}

/**
 * The plain-language verdict label derived from a probability — the italic
 * "Toss-up" / "Very unlikely" / "Likely" that sits beside Raven's final P(YES)
 * estimate. Optionally carries a mono caption underneath (e.g. the prior).
 */
export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ prob, caption }) => (
  <div style={{ paddingBottom: 8 }}>
    <div
      style={{
        fontFamily: "var(--rv-font-serif)",
        fontStyle: "italic",
        fontSize: 26,
        color: "var(--rv-ink)",
      }}
    >
      {verdictLabel(prob)}
    </div>
    {caption && (
      <div
        style={{
          fontFamily: "var(--rv-font-mono)",
          fontSize: 11,
          color: "var(--rv-ink3)",
          marginTop: 6,
        }}
      >
        {caption}
      </div>
    )}
  </div>
);
