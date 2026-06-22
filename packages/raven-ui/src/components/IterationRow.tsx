import * as React from "react";
import { absPp, dirColor, pct, reflectionTitle, signPp } from "../lib/format";
import { DeltaChip } from "./DeltaChip";
import { SourceRow, type SourceRowProps } from "./SourceRow";

export interface WhyChanged {
  /** Net pp move this iteration (post − prior). */
  netPp: number;
  /** Sum of positive (toward-YES) pp. */
  upPp: number;
  /** Sum of negative (toward-NO) pp (≤ 0). */
  downPp: number;
  /** Title of the single biggest mover this iteration. */
  dominantTitle?: string;
}

export interface IterationRowProps {
  /** Iteration number (1-based). */
  round: number;
  /** P(YES) at the start/end of the iteration (0..1). */
  priorProb: number;
  postProb: number;
  /** The agent's narrative for the iteration. */
  reasoning: string;
  /** The per-source updates applied this iteration. */
  sources: SourceRowProps[];
  /** Optional decomposition of the net move. */
  whyChanged?: WhyChanged;
  defaultOpen?: boolean;
}

/**
 * One iteration in the forecast timeline: an expandable header (prior → posterior
 * + net pp chip), and when open, the why-it-changed decomposition, the agent's
 * reasoning, and each source as an expandable {@link SourceRow}.
 */
export const IterationRow: React.FC<IterationRowProps> = ({
  round,
  priorProb,
  postProb,
  reasoning,
  sources,
  whyChanged,
  defaultOpen = false,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const net = (postProb - priorProb) * 100;

  return (
    <div style={{ background: "var(--rv-bg2)", border: "1px solid var(--rv-line)", borderRadius: 14, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontFamily: "var(--rv-font-serif)", fontSize: 15, letterSpacing: 1, color: "var(--rv-ink3)", flex: "none" }}>
          ITERATION
        </span>
        <span style={{ fontFamily: "var(--rv-font-serif)", fontSize: 26, color: "var(--rv-ink)", width: 30, flex: "none" }}>
          {round < 10 ? "0" : ""}
          {round}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1 }}>
          <span style={{ fontSize: 16, color: "var(--rv-ink3)", fontVariantNumeric: "tabular-nums" }}>{pct(priorProb, 0)}</span>
          <span style={{ color: "var(--rv-ink3)" }}>→</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: "var(--rv-ink)", fontVariantNumeric: "tabular-nums" }}>{pct(postProb, 0)}</span>
        </div>
        <DeltaChip deltaPp={net} />
        <span
          style={{
            fontFamily: "var(--rv-font-mono)",
            fontSize: 18,
            color: "var(--rv-ink3)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px" }}>
          {whyChanged && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 18px",
                margin: "0 0 14px",
                fontFamily: "var(--rv-font-mono)",
                fontSize: 10.5,
                color: "var(--rv-ink3)",
              }}
            >
              <span>
                net <span style={{ color: dirColor(whyChanged.netPp) }}>{signPp(whyChanged.netPp)}pp</span>
              </span>
              <span style={{ color: "var(--rv-yes)" }}>▲ +{absPp(whyChanged.upPp)}</span>
              <span style={{ color: "var(--rv-no)" }}>▼ −{absPp(whyChanged.downPp)}</span>
              {whyChanged.dominantTitle && (
                <span>
                  led by <span style={{ color: "var(--rv-ink2)" }}>{reflectionTitle(whyChanged.dominantTitle).slice(0, 52)}</span>
                </span>
              )}
            </div>
          )}
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--rv-ink2)",
              margin: "0 0 18px",
              borderLeft: "2px solid var(--rv-orange)",
              paddingLeft: 13,
            }}
          >
            {reasoning}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sources.map((s, i) => (
              <SourceRow key={i} {...s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
