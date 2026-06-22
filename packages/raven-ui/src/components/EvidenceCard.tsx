import * as React from "react";
import { absPp, arrow, canon, dirColor, pct, reflectionTitle, signPp } from "../lib/format";

export interface EvidenceCardProps {
  /** Source title. For a reflection, the "↻ reflection on:" prefix is stripped automatically. */
  title: string;
  /** Source URL (its domain is shown as the eyebrow). */
  url: string;
  /** Signed percentage-point move this source made. Its sign drives the color: green up, red down. */
  deltaPp: number;
  /** Running P(YES) before this source (0..1). */
  from: number;
  /** Running P(YES) after this source (0..1). */
  to: number;
  /** Whether the URL was confirmed in the agent's search trace. */
  verified?: boolean;
  /** "reflection" tags the card as a correction to a prior source. */
  kind?: "evidence" | "reflection";
  /** Fades the card out toward the bottom (used for the 3rd card in the live evidence stream). */
  faded?: boolean;
}

/**
 * One piece of evidence in the forecaster's belief update: a cited source, the
 * percentage points it moved P(YES) (green = toward YES, red = toward NO), and
 * the running probability before → after.
 */
export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  title,
  url,
  deltaPp,
  from,
  to,
  verified = true,
  kind = "evidence",
  faded = false,
}) => {
  const up = deltaPp >= 0;
  const color = dirColor(deltaPp);
  const isReflection = kind === "reflection";
  const fadeMask = faded
    ? "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)"
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "var(--rv-bg2)",
        border: "1px solid var(--rv-line)",
        borderLeft: `3px solid ${up ? "var(--rv-yes)" : "var(--rv-no)"}`,
        borderRadius: 13,
        padding: "15px 18px",
        WebkitMaskImage: fadeMask,
        maskImage: fadeMask,
        animation: "rv-rise 0.5s ease both",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--rv-font-mono)",
            fontSize: 10,
            letterSpacing: 0.5,
            color: "var(--rv-ink3)",
            marginBottom: 5,
          }}
        >
          {canon(url)}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.4, fontWeight: 500, color }}>
          {isReflection && (
            <span
              style={{
                fontFamily: "var(--rv-font-mono)",
                fontSize: 8.5,
                letterSpacing: 0.5,
                color: "var(--rv-warn)",
                border: "1px solid rgba(224,169,60,0.4)",
                borderRadius: 4,
                padding: "1px 5px",
                marginRight: 7,
                verticalAlign: "middle",
              }}
            >
              ↻ REVISION
            </span>
          )}
          {isReflection ? reflectionTitle(title) : title}
        </div>
      </div>
      <div style={{ textAlign: "right", flex: "none" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "flex-end",
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: -1,
            lineHeight: 1,
            color,
          }}
        >
          <span style={{ fontSize: 17 }}>{arrow(deltaPp)}</span>
          {signPp(deltaPp)}
          <span style={{ fontSize: 13, fontWeight: 500 }}>pp</span>
        </div>
        <div
          style={{
            fontFamily: "var(--rv-font-mono)",
            fontSize: 10.5,
            color: "var(--rv-ink3)",
            marginTop: 5,
          }}
        >
          {pct(from, 0)} → <span style={{ color: "var(--rv-ink)" }}>{pct(to, 0)}</span>
          {!verified && (
            <span style={{ color: "var(--rv-warn)", marginLeft: 8 }}>⚠ unverified</span>
          )}
        </div>
      </div>
    </div>
  );
};
