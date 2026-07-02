import * as React from "react";

export interface SummaryPanelProps {
  /** The forecaster's plain-language verdict, rendered as the serif paragraph. */
  verdict: string;
  /** Bullet points pushing the probability toward YES (green column). */
  keyFactorsYes?: string[];
  /** Bullet points pushing the probability toward NO (red column). */
  keyFactorsNo?: string[];
  /** Free-text describing what the forecaster still can't resolve. */
  uncertainties?: string;
  /**
   * When true, marks the verdict as read off the final iteration's reasoning
   * (no dedicated summary was produced), showing a "(final-iteration read)" note.
   */
  fallbackNote?: boolean;
}

const factorHead: React.CSSProperties = {
  fontFamily: "var(--rv-font-mono)",
  fontSize: 10,
  letterSpacing: 1,
  marginBottom: 9,
};

/**
 * The "RAVEN'S SUMMARY" result card: the forecaster's verdict in serif, plus an
 * optional two-column breakdown of the factors pushing toward YES / NO and a
 * paragraph of open uncertainties.
 */
export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  verdict,
  keyFactorsYes,
  keyFactorsNo,
  uncertainties,
  fallbackNote = false,
}) => {
  const hasFactors =
    (keyFactorsYes && keyFactorsYes.length > 0) || (keyFactorsNo && keyFactorsNo.length > 0);

  return (
    <div
      style={{
        background: "var(--rv-bg2)",
        border: "1px solid var(--rv-line)",
        borderRadius: 16,
        padding: "22px 24px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--rv-font-mono)",
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--rv-orange)",
          marginBottom: 13,
        }}
      >
        RAVEN’S SUMMARY
        {fallbackNote && (
          <span
            style={{
              fontFamily: "var(--rv-font-mono)",
              fontSize: 9,
              letterSpacing: 1,
              color: "var(--rv-ink3)",
              marginLeft: 8,
            }}
          >
            (final-iteration read)
          </span>
        )}
      </div>

      <p
        style={{
          fontFamily: "var(--rv-font-serif)",
          fontSize: 19,
          lineHeight: 1.55,
          color: "var(--rv-ink)",
          margin: 0,
        }}
      >
        {verdict}
      </p>

      {hasFactors && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px 34px",
            marginTop: 18,
            paddingTop: 18,
            borderTop: "1px solid var(--rv-line)",
          }}
        >
          <FactorList list={keyFactorsYes} kind="yes" />
          <FactorList list={keyFactorsNo} kind="no" />
        </div>
      )}

      {uncertainties && (
        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid var(--rv-line)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--rv-font-mono)",
              fontSize: 10,
              letterSpacing: 1,
              color: "var(--rv-ink3)",
              marginBottom: 8,
            }}
          >
            OPEN UNCERTAINTIES
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--rv-ink2)", margin: 0 }}>
            {uncertainties}
          </p>
        </div>
      )}
    </div>
  );
};

const FactorList: React.FC<{ list?: string[]; kind: "yes" | "no" }> = ({ list, kind }) => {
  if (!list || list.length === 0) return null;
  const isYes = kind === "yes";
  return (
    <div style={{ flex: "1 1 280px", minWidth: 240 }}>
      <div style={{ ...factorHead, color: isYes ? "var(--rv-yes)" : "var(--rv-no)" }}>
        {isYes ? "▲ PUSHING TOWARD YES" : "▼ PUSHING TOWARD NO"}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {list.map((f, i) => (
          <li
            key={i}
            style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--rv-ink2)", margin: "0 0 8px" }}
          >
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
};
