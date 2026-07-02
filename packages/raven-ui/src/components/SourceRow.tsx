import * as React from "react";
import { canon, dirColor, pct, reflectionTitle } from "../lib/format";
import { DeltaChip } from "./DeltaChip";

export interface SourceRowProps {
  /** Source title (a reflection's "↻ reflection on:" prefix is stripped). */
  title: string;
  url: string;
  /** Signed pp this source moved P(YES). Sign drives the color. */
  deltaPp: number;
  /** Running P(YES) before/after this source (0..1). */
  from: number;
  to: number;
  /** Why it moved the probability (shown when expanded). */
  explanation?: string;
  verified?: boolean;
  kind?: "evidence" | "reflection";
  defaultOpen?: boolean;
}

/**
 * A compact, expandable evidence row used inside an iteration: a colored dot +
 * source title + pp chip; expands to the verification badge, the explanation,
 * and the belief move.
 */
export const SourceRow: React.FC<SourceRowProps> = ({
  title,
  url,
  deltaPp,
  from,
  to,
  explanation,
  verified = true,
  kind = "evidence",
  defaultOpen = false,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const isReflection = kind === "reflection";
  const badge = verified
    ? { text: "✓ VERIFIED", style: { color: "var(--rv-yes)", background: "rgba(70,196,154,0.10)" } }
    : { text: "⚠ UNVERIFIED", style: { color: "var(--rv-warn)", background: "rgba(224,169,60,0.12)" } };

  return (
    <div style={{ border: "1px solid var(--rv-line)", borderRadius: 11, overflow: "hidden", background: "var(--rv-bg3)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flex: "none", background: dirColor(deltaPp) }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.35, fontWeight: 500, color: dirColor(deltaPp), flex: 1 }}>
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
              }}
            >
              ↻ REVISION
            </span>
          )}
          {isReflection ? reflectionTitle(title) : title}
        </span>
        <DeltaChip deltaPp={deltaPp} />
        <span
          style={{
            fontFamily: "var(--rv-font-mono)",
            fontSize: 14,
            color: "var(--rv-ink3)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px 34px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              fontFamily: "var(--rv-font-mono)",
              fontSize: 10.5,
              color: "var(--rv-ink3)",
            }}
          >
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--rv-ink3)", textDecoration: "none" }}>
              {canon(url)}
            </a>
            <span style={{ padding: "2px 7px", borderRadius: 5, ...badge.style }}>{badge.text}</span>
            {isReflection && (
              <span style={{ padding: "2px 7px", borderRadius: 5, color: "var(--rv-warn)", background: "rgba(224,169,60,0.10)" }}>
                REVISES A PRIOR SOURCE
              </span>
            )}
          </div>
          {explanation && <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--rv-ink2)", margin: 0 }}>{explanation}</p>}
          <div style={{ marginTop: 10, fontFamily: "var(--rv-font-mono)", fontSize: 11, color: "var(--rv-ink3)" }}>
            moved belief {pct(from, 0)} → <span style={{ color: "var(--rv-ink)" }}>{pct(to, 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
