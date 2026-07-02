"use client";

// Status strip under the nav: the question, the blinking "Now: …" phase line,
// the provisional P(YES) number vs prior, and the mini range track.
// Layout classes (rvp-strip / rvp-quant / rvp-numblock / rvp-num) live in
// research.css so the mobile breakpoint can restack them.

import { arrowFor, dirFor } from "../../lib/vm/format";
import { axisScaleFor } from "./research-vm";

export interface NowLine {
  bold: string;
  rest: string;
}

export interface QuantVM {
  nowPct: number;
  priorPct: number;
  label: string; // "P(YES) · provisional" | "P(YES) · final"
}

export function StatusStrip({
  question,
  now,
  quant
}: {
  question: string;
  now: NowLine | null;
  quant: QuantVM | null;
}) {
  return (
    <div className="rvp-strip">
      <div>
        <h1 style={{ margin: 0, fontWeight: 500, fontSize: 24, lineHeight: 1.25, letterSpacing: "-.01em", maxWidth: "30ch" }}>
          {question}
        </h1>
        {now && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              fontFamily: "var(--fm)",
              fontSize: 11,
              color: "var(--muted)"
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "rv-blink 1.4s ease infinite",
                flex: "none"
              }}
            />
            <span>
              Now: <b style={{ color: "var(--text)" }}>{now.bold}</b>
              {now.rest}
            </span>
          </div>
        )}
      </div>
      {quant && <QuantBlock quant={quant} />}
    </div>
  );
}

function QuantBlock({ quant }: { quant: QuantVM }) {
  const { nowPct, priorPct, label } = quant;
  const d = nowPct - priorPct;
  const scale = axisScaleFor(priorPct, nowPct);
  const nowLeft = (nowPct / scale) * 100;
  const priorLeft = (priorPct / scale) * 100;
  const bandLeft = Math.min(nowLeft, priorLeft);
  const bandRight = 100 - Math.max(nowLeft, priorLeft);
  // Accent sits at the "now" end of the band and fades toward the prior.
  const gradient =
    nowLeft <= priorLeft
      ? "linear-gradient(90deg,color-mix(in srgb,var(--accent) 38%,transparent),transparent)"
      : "linear-gradient(270deg,color-mix(in srgb,var(--accent) 38%,transparent),transparent)";
  return (
    <div className="rvp-quant">
      <div className="rvp-numblock">
        <div
          style={{
            fontFamily: "var(--fm)",
            fontSize: 9,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            color: "var(--faint)",
            marginBottom: 5
          }}
        >
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="rvp-num">{nowPct}%</span>
          <span className={`mv-${dirFor(d)}`} style={{ fontFamily: "var(--fm)", fontWeight: 600, fontSize: 14 }}>
            {arrowFor(d)} {Math.abs(d)}%
          </span>
        </div>
        <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)", marginTop: 6 }}>
          from the {priorPct}% prior
        </div>
      </div>
      <div style={{ width: 190, paddingBottom: 4, flex: "none" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--fm)",
            fontSize: 9,
            color: "var(--faint)",
            marginBottom: 5
          }}
        >
          <span>0%</span>
          <span>{scale}%</span>
        </div>
        <div
          style={{
            position: "relative",
            height: 9,
            borderRadius: 5,
            background: "color-mix(in srgb,var(--text) 7%,transparent)"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${bandLeft}%`,
              right: `${bandRight}%`,
              borderRadius: 5,
              background: gradient
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${priorLeft}%`,
              width: 10,
              height: 10,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              border: "2px solid var(--faint)",
              background: "var(--bg)"
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${nowLeft}%`,
              width: 13,
              height: 13,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background: "var(--accent)",
              border: "2px solid var(--bg)",
              animation: "rv-pulse 1.8s ease-out infinite"
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--fm)",
            fontSize: 9.5,
            color: "var(--faint)",
            marginTop: 6
          }}
        >
          <span style={{ color: "var(--accent)" }}>now {nowPct}%</span>
          <span>prior {priorPct}%</span>
        </div>
      </div>
    </div>
  );
}
