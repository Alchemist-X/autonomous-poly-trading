import * as React from "react";

export interface FramingPanelProps {
  /**
   * Framing rows shown when the panel is open. Each row pairs a mono uppercase
   * label (e.g. "NORMALIZED QUESTION") with its prose value.
   */
  rows: Array<{
    /** Mono, orange, uppercase eyebrow for the row (e.g. "RESOLUTION DATE"). */
    label: string;
    /** The framing text for that label. */
    value: string;
  }>;
  /** Initial open state when uncontrolled. Defaults to false (collapsed). */
  defaultOpen?: boolean;
}

/**
 * Collapsible "RESOLUTION & FRAMING" disclosure. The header toggles a flex-wrap
 * grid of framing rows (normalized question, resolution criteria, prior, etc.).
 * Self-contained: open state is managed internally, seeded by `defaultOpen`.
 */
export const FramingPanel: React.FC<FramingPanelProps> = ({ rows, defaultOpen = false }) => {
  const [open, setOpen] = React.useState(defaultOpen ?? false);

  return (
    <div
      style={{
        background: "var(--rv-bg2)",
        border: "1px solid var(--rv-line)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: "var(--rv-font-mono)",
            fontSize: 11,
            letterSpacing: 2,
            color: "var(--rv-ink2)",
          }}
        >
          RESOLUTION &amp; FRAMING
        </span>
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
        <div
          style={{
            padding: "0 18px 22px",
            display: "flex",
            flexWrap: "wrap",
            gap: "22px 40px",
          }}
        >
          {rows.map((r, i) => (
            <div key={i} style={{ flex: "1 1 280px", minWidth: 240 }}>
              <div
                style={{
                  fontFamily: "var(--rv-font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: "var(--rv-orange)",
                  marginBottom: 7,
                }}
              >
                {r.label}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--rv-ink2)" }}>
                {r.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
