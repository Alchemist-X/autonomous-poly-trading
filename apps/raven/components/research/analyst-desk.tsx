"use client";

// The sticky right rail: hypothesis composer (textarea + 3-way stance control
// + queue button) and the queued-notes list with per-note status tags.

import type { AnalystStance } from "../../lib/server/analyst";
import type { QueuedVM } from "./research-vm";

const STANCES: Array<{ key: AnalystStance; label: string }> = [
  { key: "yes", label: "PUSHES YES" },
  { key: "no", label: "PUSHES NO" },
  { key: "question", label: "QUESTION" }
];

export function AnalystDesk({
  markSummary,
  nextRound,
  complete,
  composerText,
  onComposerText,
  stance,
  onStance,
  onSubmit,
  queued,
  onRemove
}: {
  markSummary: string;
  nextRound: number;
  complete: boolean;
  composerText: string;
  onComposerText: (value: string) => void;
  stance: AnalystStance;
  onStance: (stance: AnalystStance) => void;
  onSubmit: () => void;
  queued: readonly QueuedVM[];
  onRemove: (noteId: string) => void;
}) {
  return (
    <div className="rvp-rail">
      <div style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 18px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <div
            style={{
              fontFamily: "var(--fm)",
              fontSize: 10,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--accent)"
            }}
          >
            Analyst desk
          </div>
          <span style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--faint)" }}>{markSummary}</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
          {complete ? (
            <>
              Queue a hypothesis or a lead. The run is complete, so notes are{" "}
              <b style={{ color: "var(--text)" }}>saved with the dossier</b>.
            </>
          ) : (
            <>
              Queue a hypothesis or a lead. Raven treats each one as a claim to test in{" "}
              <b style={{ color: "var(--text)" }}>iteration {nextRound}</b>.
            </>
          )}
        </p>
        <textarea
          value={composerText}
          onChange={(e) => onComposerText(e.target.value)}
          placeholder="e.g. Check retailer supply-chain listings — physical stock timelines would confirm the date better than press."
          aria-label="Queue a hypothesis or a lead"
          style={{
            width: "100%",
            marginTop: 12,
            height: 76,
            resize: "vertical",
            background: "var(--bg)",
            border: "1px solid var(--line2)",
            borderRadius: 9,
            outline: "none",
            color: "var(--text)",
            fontFamily: "var(--fd)",
            fontSize: 13,
            lineHeight: 1.5,
            padding: "10px 12px"
          }}
        />
        <div role="radiogroup" aria-label="How this note pushes the forecast" style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {STANCES.map((s) => {
            const on = stance === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                className="stanceb"
                onClick={() => onStance(s.key)}
                style={{
                  flex: 1,
                  border: `1px solid ${on ? "var(--accent)" : "var(--line2)"}`,
                  color: on ? "var(--accent)" : "var(--faint)",
                  borderRadius: 8,
                  fontFamily: "var(--fm)",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: ".05em",
                  padding: "7px 4px"
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="cta"
          onClick={onSubmit}
          style={{
            width: "100%",
            marginTop: 10,
            border: "none",
            cursor: "pointer",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            fontFamily: "var(--fm)",
            fontWeight: 600,
            fontSize: 10.5,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            padding: 12,
            borderRadius: 9
          }}
        >
          {complete ? "Save note for the dossier" : `Queue for iteration ${nextRound}`}
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontFamily: "var(--fm)",
            fontSize: 10,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "var(--faint)",
            marginBottom: 9
          }}
        >
          Queued · {String(queued.length).padStart(2, "0")}
        </div>
        {queued.length > 0 ? (
          queued.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                gap: 9,
                background: "var(--bg2)",
                border: "1px solid var(--line)",
                borderRadius: 11,
                padding: "11px 12px",
                marginBottom: 8
              }}
            >
              <span
                style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", marginTop: 5, background: n.dotColor }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--text)" }}>{n.text}</div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 5,
                    fontFamily: "var(--fm)",
                    fontSize: 8.5,
                    letterSpacing: ".06em",
                    color: "var(--faint)",
                    flexWrap: "wrap"
                  }}
                >
                  <span style={{ textTransform: "uppercase" }}>{n.stanceLabel}</span>
                  <span>·</span>
                  <span>{n.targetLabel}</span>
                  <span>·</span>
                  <span style={{ color: n.tagColor }}>{n.tagText}</span>
                </div>
              </div>
              {n.removable && (
                <button
                  type="button"
                  onClick={() => onRemove(n.id)}
                  title="Remove"
                  aria-label="Remove this note"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--faint)",
                    fontFamily: "var(--fm)",
                    fontSize: 12,
                    lineHeight: 1,
                    padding: "2px 4px",
                    height: "fit-content"
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))
        ) : (
          <div
            style={{
              border: "1px dashed var(--line2)",
              borderRadius: 11,
              padding: 14,
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--faint)"
            }}
          >
            Nothing queued yet. Your circles, strikes and notes land here — and in Raven's next research round.
          </div>
        )}
      </div>
    </div>
  );
}
