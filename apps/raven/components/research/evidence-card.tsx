"use client";

// One evidence card in the research feed: annotatable (KEEP / DOUBT / + NOTE),
// with side bar, index, source + credibility + value pills, analysis text,
// attached "Your note" strips and the inline note composer.

import type { AnalystNote } from "../../lib/server/analyst";
import { ShieldIcon, SrcIcon } from "../icons";
import { AnnoBar, MarkOverlay, type Mark } from "./annotation";
import type { EvidenceRowVM } from "./research-vm";

export function EvidenceCard({
  ev,
  mark,
  onMark,
  notes,
  noteOpen,
  onToggleNote,
  noteDraft,
  onNoteDraft,
  onNoteSubmit,
  animated = false
}: {
  ev: EvidenceRowVM;
  mark: Mark | undefined;
  onMark: (val: Mark) => void;
  notes: readonly AnalystNote[];
  noteOpen: boolean;
  onToggleNote: () => void;
  noteDraft: string;
  onNoteDraft: (value: string) => void;
  onNoteSubmit: () => void;
  animated?: boolean; // just streamed in — play the entrance animation
}) {
  return (
    <div
      className={`anno${animated ? " rv-reveal" : ""}`}
      tabIndex={0}
      aria-label={`Evidence ${ev.idx}: ${ev.title}`}
      style={{
        position: "relative",
        marginTop: 14,
        background: "var(--bg2)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "14px 16px"
      }}
    >
      {mark && <MarkOverlay mark={mark} variant="evidence" />}
      <AnnoBar
        mark={mark}
        subject="evidence"
        onKeep={() => onMark("keep")}
        onDoubt={() => onMark("doubt")}
        onNote={onToggleNote}
      />
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 13 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <span className={`sd-${ev.side}`} style={{ width: 3, alignSelf: "stretch", borderRadius: 2, opacity: 0.85 }} />
          <span
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 500,
              fontSize: 21,
              lineHeight: 1,
              color: "var(--faint)",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {ev.idx}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{ev.title}</span>
            {ev.revises && (
              <span
                style={{
                  fontFamily: "var(--fm)",
                  fontSize: 8.5,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--val)",
                  border: "1px solid color-mix(in srgb,var(--val) 40%,transparent)",
                  borderRadius: 4,
                  padding: "1px 5px"
                }}
              >
                ↻ Revises a prior source
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "var(--fm)",
                fontSize: 10,
                color: "var(--faint)"
              }}
            >
              <SrcIcon type={ev.srcType} />
              {ev.dom}
            </span>
            <span
              className={`cred-${ev.cred} bd-${ev.cred}`}
              title="How trustworthy the source is"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--fm)",
                fontSize: 9.5,
                fontWeight: 600,
                padding: "2px 7px",
                border: "1px solid",
                borderRadius: 20
              }}
            >
              <ShieldIcon />
              {ev.credLabel} credibility
            </span>
            <span
              title="How much this source adds to the forecast"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--fm)",
                fontSize: 9.5,
                fontWeight: 600,
                color: "var(--val)",
                padding: "2px 7px",
                border: "1px solid color-mix(in srgb,var(--val) 40%,transparent)",
                background: "color-mix(in srgb,var(--val) 11%,transparent)",
                borderRadius: 20
              }}
            >
              <span style={{ letterSpacing: 1 }}>{ev.valDiamonds}</span>
              {ev.valueLabel} value
            </span>
          </div>
          <p style={{ margin: "9px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
            <b style={{ color: "var(--text)", fontWeight: 600 }}>{ev.takeaway}</b> {ev.analysis}
          </p>
          {notes.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                marginTop: 9,
                padding: "8px 11px",
                borderLeft: "2px solid var(--accent)",
                background: "color-mix(in srgb,var(--accent) 7%,transparent)",
                borderRadius: "0 8px 8px 0"
              }}
            >
              <span
                style={{
                  fontFamily: "var(--fm)",
                  fontSize: 8.5,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  whiteSpace: "nowrap"
                }}
              >
                Your note
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--text)" }}>{n.text}</span>
            </div>
          ))}
          {noteOpen && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={noteDraft}
                onChange={(e) => onNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onNoteSubmit();
                }}
                placeholder="Attach a note to this evidence…"
                aria-label="Attach a note to this evidence"
                autoFocus
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "var(--bg)",
                  border: "1px solid var(--line2)",
                  borderRadius: 8,
                  outline: "none",
                  color: "var(--text)",
                  fontFamily: "var(--fd)",
                  fontSize: 13,
                  padding: "8px 11px"
                }}
              />
              <button
                type="button"
                className="cta"
                onClick={onNoteSubmit}
                style={{
                  border: "none",
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                  fontFamily: "var(--fm)",
                  fontWeight: 600,
                  fontSize: 9.5,
                  letterSpacing: ".08em",
                  padding: "0 14px",
                  borderRadius: 8
                }}
              >
                ADD
              </button>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <div className={`mv-${ev.dir}`} style={{ fontFamily: "var(--fm)", fontWeight: 600, fontSize: 14.5 }}>
            {ev.arrow} {ev.deltaAbs}
          </div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>
            {ev.from} → {ev.to}
          </div>
        </div>
      </div>
    </div>
  );
}
