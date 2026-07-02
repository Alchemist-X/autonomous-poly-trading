"use client";

// One iteration in the research feed: header row, annotatable "Raven's
// reasoning" note card, the evidence cards, and — while the round is live —
// the recent-reads trail plus the dashed "Reading …" shimmer skeleton.
// Finished rounds fold to a one-line receipt (Manus-style) while a newer
// round is running; click the receipt to expand.

import type { AnalystNote } from "../../lib/server/analyst";
import { AnnoBar, MarkOverlay, type Mark } from "./annotation";
import { EvidenceCard } from "./evidence-card";
import { CheckCircle } from "./plan";
import type { BlockVM, ReadingVM } from "./research-vm";
import { ShimmerBar } from "./shimmer";

function FoldChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s", flex: "none" }}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// One-line receipt for a folded (completed) iteration.
function FoldedRow({ block, onToggle }: { block: BlockVM; onToggle?: () => void }) {
  const n = block.evidence.length;
  return (
    <section style={{ marginTop: 18 }} aria-label={`Iteration ${block.n} (folded)`}>
      <button
        type="button"
        className="rvp-fold"
        onClick={onToggle}
        aria-expanded={false}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--line)",
          padding: "9px 2px",
          cursor: "pointer",
          color: "inherit",
          textAlign: "left"
        }}
      >
        <CheckCircle size={14} />
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
        <span style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 15, color: "var(--accent)" }}>{block.n}</span>
        <span
          style={{
            fontFamily: "var(--fm)",
            fontSize: 11,
            color: "var(--muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0
          }}
        >
          {block.status} · {n} source{n === 1 ? "" : "s"}
        </span>
        <span
          className={`mv-${block.moveDir}`}
          style={{ marginLeft: "auto", fontFamily: "var(--fm)", fontSize: 11, fontWeight: 600, flex: "none" }}
        >
          {block.move}
        </span>
        <span style={{ color: "var(--faint)" }}>
          <FoldChevron open={false} />
        </span>
      </button>
    </section>
  );
}

// Small "already read" rows shown above the live shimmer — the trail of
// sources the engine visited this round (Manus-style activity lines).
function ReadTrail({ reads }: { reads: readonly ReadingVM[] }) {
  if (reads.length === 0) return null;
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 6 }} aria-label="Sources visited this round">
      {reads.map((r, i) => (
        <div
          key={`${r.domain}-${i}`}
          style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4, fontFamily: "var(--fm)", fontSize: 10.5, color: "var(--faint)" }}
        >
          <CheckCircle size={11} />
          <span>
            Read <b style={{ color: "var(--muted)", fontWeight: 600 }}>{r.domain}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

export function IterationBlock({
  block,
  marks,
  onMark,
  notes,
  noteFor,
  onToggleNote,
  noteDraft,
  onNoteDraft,
  onNoteSubmit,
  animatedIds,
  collapsed = false,
  onToggleCollapse,
  recentReads = []
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
  animatedIds?: ReadonlySet<string>; // feed items that just streamed in (get the entrance animation)
  collapsed?: boolean; // folded to a one-line receipt (completed rounds while a newer one runs)
  onToggleCollapse?: () => void;
  recentReads?: readonly ReadingVM[]; // sources visited so far this round (live block only)
}) {
  const rMark = marks[block.reasoningId];
  if (collapsed) return <FoldedRow block={block} onToggle={onToggleCollapse} />;
  return (
    <section
      className={animatedIds?.has(`it${block.n}`) ? "rv-reveal" : undefined}
      style={{ marginTop: 26 }}
      aria-label={`Iteration ${block.n}`}
    >
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
        {onToggleCollapse && (
          <button
            type="button"
            className="rvp-fold"
            onClick={onToggleCollapse}
            aria-expanded={true}
            aria-label={`Fold iteration ${block.n}`}
            style={{
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              color: "var(--faint)",
              alignSelf: "center"
            }}
          >
            <FoldChevron open={true} />
          </button>
        )}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontFamily: "var(--fm)",
              fontSize: 9,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--faint)"
            }}
          >
            Raven's reasoning
          </span>
          {block.analystFolded > 0 && (
            <span
              title="Your queued notes were injected into this round's research prompt"
              style={{
                fontFamily: "var(--fm)",
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--accent)",
                border: "1px solid color-mix(in srgb,var(--accent) 40%,transparent)",
                background: "color-mix(in srgb,var(--accent) 9%,transparent)",
                borderRadius: 4,
                padding: "1px 6px"
              }}
            >
              ↳ analyst pushback folded in ({block.analystFolded})
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>{block.note}</p>
      </div>

      {block.evidence.map((ev) => (
        <EvidenceCard
          key={ev.id}
          ev={ev}
          animated={animatedIds?.has(ev.id) ?? false}
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

      {block.reading && <ReadTrail reads={recentReads} />}

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
