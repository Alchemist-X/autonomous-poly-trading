"use client";

// Hand-drawn annotation overlays (KEPT double-ellipse / DOUBTED ellipse+strike)
// and the hover-revealed KEEP / DOUBT / + NOTE toolbar. SVG geometry is copied
// exactly from the design handoff — preserveAspectRatio="none" plus
// vector-effect="non-scaling-stroke" stretch the 100×40 ellipse to the card
// while keeping the stroke width constant.

import type { CSSProperties } from "react";
import { useT, type Entry } from "../../lib/i18n";
import { RP } from "../../lib/i18n/research-parts";

export type Mark = "keep" | "doubt";

// Subject words used in the toolbar aria-labels ("evidence" | "reasoning").
const SUBJECT_WORDS: Record<string, Entry> = {
  evidence: RP.subjectEvidence,
  reasoning: RP.subjectReasoning
};
type OverlayVariant = "note" | "evidence";

function overlaySvgStyle(variant: OverlayVariant): CSSProperties {
  const grow = variant === "evidence" ? 12 : 10;
  return {
    position: "absolute",
    inset: variant === "evidence" ? -6 : -5,
    width: `calc(100% + ${grow}px)`,
    height: `calc(100% + ${grow}px)`,
    pointerEvents: "none",
    overflow: "visible",
    ...(variant === "evidence" ? { zIndex: 4 } : {})
  };
}

function badgeStyle(color: string, rotate: string, variant: OverlayVariant): CSSProperties {
  return {
    position: "absolute",
    top: -11,
    right: 14,
    ...(variant === "evidence" ? { zIndex: 5 } : {}),
    fontFamily: "var(--fm)",
    fontSize: 8.5,
    fontWeight: 600,
    letterSpacing: ".1em",
    color,
    background: "var(--bg)",
    border: `1px solid ${color}`,
    borderRadius: 4,
    padding: "2px 6px",
    transform: rotate
  };
}

export function MarkOverlay({ mark, variant }: { mark: Mark; variant: OverlayVariant }) {
  const t = useT();
  if (mark === "keep") {
    return (
      <>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={overlaySvgStyle(variant)} aria-hidden="true">
          <ellipse
            cx="50"
            cy="20"
            rx="48.6"
            ry="18.6"
            fill="none"
            stroke="var(--pos)"
            strokeWidth="2.4"
            vectorEffect="non-scaling-stroke"
            transform="rotate(-1.1 50 20)"
            strokeLinecap="round"
            opacity="0.95"
          />
          <ellipse
            cx="50.6"
            cy="19.4"
            rx="47.6"
            ry="17.9"
            fill="none"
            stroke="var(--pos)"
            strokeWidth="1.3"
            vectorEffect="non-scaling-stroke"
            transform="rotate(0.9 50 20)"
            opacity="0.4"
          />
        </svg>
        <span style={badgeStyle("var(--pos)", "rotate(-3deg)", variant)}>{t(RP.annoKept)}</span>
      </>
    );
  }
  return (
    <>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={overlaySvgStyle(variant)} aria-hidden="true">
        <ellipse
          cx="50"
          cy="20"
          rx="48.6"
          ry="18.6"
          fill="none"
          stroke="var(--neg)"
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
          transform="rotate(1.3 50 20)"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M6 34 L 94 7"
          stroke="var(--neg)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          opacity="0.55"
          strokeLinecap="round"
        />
      </svg>
      <span style={badgeStyle("var(--neg)", "rotate(2deg)", variant)}>{t(RP.annoDoubted)}</span>
    </>
  );
}

const ABTN: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: "1px solid var(--line2)",
  borderRadius: 20,
  fontFamily: "var(--fm)",
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: ".06em",
  padding: "3px 9px"
};

export function AnnoBar({
  mark,
  subject,
  onKeep,
  onDoubt,
  onNote
}: {
  mark: Mark | undefined;
  subject: string; // "evidence" | "reasoning" — used in the aria-labels
  onKeep: () => void;
  onDoubt: () => void;
  onNote?: () => void;
}) {
  const t = useT();
  const subjectWord = SUBJECT_WORDS[subject] ? t(SUBJECT_WORDS[subject]) : subject;
  return (
    <div
      className="anno-bar"
      style={{ position: "absolute", top: -13, left: 10, display: "flex", gap: 6, zIndex: onNote ? 6 : 5 }}
    >
      <button
        type="button"
        className="abtn"
        onClick={onKeep}
        aria-label={t(RP.annoKeepAria, { subject: subjectWord })}
        aria-pressed={mark === "keep"}
        style={{ ...ABTN, color: "var(--pos)" }}
      >
        <svg viewBox="0 0 20 14" style={{ width: 14, height: 10 }} aria-hidden="true">
          <ellipse cx="10" cy="7" rx="8.5" ry="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        {t(RP.annoKeep)}
      </button>
      <button
        type="button"
        className="abtn"
        onClick={onDoubt}
        aria-label={t(RP.annoDoubtAria, { subject: subjectWord })}
        aria-pressed={mark === "doubt"}
        style={{ ...ABTN, color: "var(--neg)" }}
      >
        <svg viewBox="0 0 20 14" style={{ width: 14, height: 10 }} aria-hidden="true">
          <ellipse cx="10" cy="7" rx="8.5" ry="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12 L17 2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {t(RP.annoDoubt)}
      </button>
      {onNote && (
        <button
          type="button"
          className="abtn"
          onClick={onNote}
          aria-label={t(RP.annoNoteAria)}
          style={{ ...ABTN, color: "var(--muted)" }}
        >
          {t(RP.annoNote)}
        </button>
      )}
    </div>
  );
}
