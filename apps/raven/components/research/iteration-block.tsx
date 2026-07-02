"use client";

// One iteration in the research feed: header row, annotatable "Raven's
// reasoning" note card, the evidence cards, and — while the round is live —
// the dashed "Reading …" shimmer skeleton.

import type { AnalystNote } from "../../lib/server/analyst";
import { AnnoBar, MarkOverlay, type Mark } from "./annotation";
import { EvidenceCard } from "./evidence-card";
import type { BlockVM } from "./research-vm";
import { ShimmerBar } from "./shimmer";

export function IterationBlock({
  block,
  marks,
  onMark,
  notes,
  noteFor,
  onToggleNote,
  noteDraft,
  onNoteDraft,
  onNoteSubmit
}: {
  block: BlockVM;
  marks: Record<string, Mark>;
  onMark: (targetId: string, val: Mark) => void;
  notes: readonly AnalystNote[];
  noteFor: string | null;
  onToggleNote: (evidenceId: string) => void;
  noteDraft: string;
  onNoteDraft: (value: string) => void;
  onNoteSubmit: (evidenceId: string) => void;
}) {
  const rMark = marks[block.reasoningId];
  return (
    <section style={{ marginTop: 26 }} aria-label={`Iteration ${block.n}`}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 9,
          borderBottom: "1px solid var(--line2)"
        }}
      >
        <span
          style={{
            fontFamily: "var(--fm)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--faint)"
          }}
        >
          Iteration
        </span>
        <span style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 20, color: "var(--accent)" }}>
          {block.n}
        </span>
        <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--muted)" }}>{block.status}</span>
        <span
          className={`mv-${block.moveDir}`}
          style={{ marginLeft: "auto", fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600 }}
        >
          {block.move}
        </span>
      </div>

      <div
        className="anno"
        tabIndex={0}
        aria-label={`Raven's reasoning — iteration ${block.n}`}
        style={{ position: "relative", marginTop: 12, padding: "11px 13px", borderRadius: 10, outline: "none" }}
      >
        {rMark && <MarkOverlay mark={rMark} variant="note" />}
        <AnnoBar
          mark={rMark}
          subject="reasoning"
          onKeep={() => onMark(block.reasoningId, "keep")}
          onDoubt={() => onMark(block.reasoningId, "doubt")}
        />
        <div
          style={{
            fontFamily: "var(--fm)",
            fontSize: 9,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--faint)",
            marginBottom: 6
          }}
        >
          Raven's reasoning
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>{block.note}</p>
      </div>

      {block.evidence.map((ev) => (
        <EvidenceCard
          key={ev.id}
          ev={ev}
          mark={marks[ev.id]}
          onMark={(val) => onMark(ev.id, val)}
          notes={notes.filter((n) => n.targetId === ev.id)}
          noteOpen={noteFor === ev.id}
          onToggleNote={() => onToggleNote(ev.id)}
          noteDraft={noteDraft}
          onNoteDraft={onNoteDraft}
          onNoteSubmit={() => onNoteSubmit(ev.id)}
        />
      ))}

      {block.reading && (
        <div
          style={{
            marginTop: 14,
            border: "1px dashed var(--line2)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 13
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
              animation: "rv-blink 1.1s ease infinite",
              flex: "none"
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--muted)" }}>
              {block.reading.domain ? (
                <>
                  Reading <b style={{ color: "var(--text)" }}>{block.reading.domain}</b>
                  {block.reading.text}
                </>
              ) : (
                block.reading.text
              )}
            </div>
            <ShimmerBar style={{ marginTop: 9 }} />
            <ShimmerBar style={{ marginTop: 6, width: "62%" }} />
          </div>
        </div>
      )}
    </section>
  );
}
