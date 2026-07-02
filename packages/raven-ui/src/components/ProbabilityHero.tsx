import * as React from "react";
import { arrow, chipStyle, pct, signPp } from "../lib/format";

export interface ProbabilityHeroProps {
  /** Current P(YES) belief (0..1). Rendered huge via pct(). */
  prob: number;
  /** Mono eyebrow above the number. */
  label?: string;
  /**
   * Signed percentage-point move of the latest source. When non-null, shows a
   * colored delta chip (green up / red down). Pass null to suppress it.
   */
  deltaPp?: number | null;
  /** When true and deltaPp is null, shows a muted "base rate" chip instead. */
  baseRate?: boolean;
}

/**
 * The big centered P(YES) belief readout. A mono eyebrow, a huge orange
 * percentage, and an optional chip: a colored delta (▲/▼ signed pp) when a
 * source just moved the belief, or a muted "base rate" chip at the prior.
 */
export const ProbabilityHero: React.FC<ProbabilityHeroProps> = ({
  prob,
  label = "RAVEN'S BELIEF · P(YES)",
  deltaPp = null,
  baseRate = false,
}) => {
  return (
    <div
      style={{
        textAlign: "center",
        background: "var(--rv-bg2)",
        border: "1px solid var(--rv-line)",
        borderRadius: 18,
        padding: "26px 24px 28px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--rv-font-mono)",
          fontSize: 10.5,
          letterSpacing: 2.5,
          color: "var(--rv-ink3)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(56px,11vw,84px)",
          fontWeight: 600,
          lineHeight: 0.9,
          letterSpacing: -2,
          color: "var(--rv-orange)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct(prob)}
      </div>
      {deltaPp != null ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            fontWeight: 700,
            fontSize: 21,
            letterSpacing: -0.5,
            padding: "6px 14px",
            borderRadius: 10,
            ...chipStyle(deltaPp),
          }}
        >
          <span style={{ fontSize: 16 }}>{arrow(deltaPp)}</span>
          {signPp(deltaPp)} pp
        </div>
      ) : baseRate ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            fontWeight: 700,
            fontSize: 18,
            padding: "6px 14px",
            borderRadius: 10,
            color: "var(--rv-ink2)",
            background: "var(--rv-bg3)",
          }}
        >
          base rate
        </div>
      ) : null}
    </div>
  );
};
