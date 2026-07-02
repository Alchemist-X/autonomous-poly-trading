"use client";

// Screen 01 · Ask — glow hero, ask bar, example chip, latest-dossier card and
// the three-step explainer. Layout + copy verbatim from the design handoff
// ("Raven Home.dc.html"); submission wired to the real forecast API.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RvShell } from "../components/chrome/rv-shell";
import { GTA6_DEMO, GTA6_DEMO_ID } from "../lib/demo/gta6";
import { cap, credWord } from "../lib/vm/format";
import type { RunListItem } from "../lib/vm/types";
import "./home.css";

const DEMO_QUESTION = GTA6_DEMO.meta.question;

interface LatestCard {
  id: string;
  prob: string;
  question: string;
  verdict: string;
  quip: string | null;
  sources: string;
  duration: string;
  confidence: "high" | "medium" | "low";
  resDate: string | null;
}

interface LiveRun {
  id: string;
  question: string;
}

const DEMO_CARD: LatestCard = {
  id: GTA6_DEMO_ID,
  prob: GTA6_DEMO.meta.prob,
  question: GTA6_DEMO.meta.question,
  verdict: GTA6_DEMO.meta.verdict,
  quip: GTA6_DEMO.meta.quip,
  sources: GTA6_DEMO.meta.sources,
  duration: GTA6_DEMO.meta.duration,
  confidence: GTA6_DEMO.meta.confidence,
  resDate: GTA6_DEMO.meta.resDate
};

const STEPS = [
  {
    kicker: "01 · FRAME",
    title: "The question is pinned down",
    body: "Normalized into something checkable — exact date, exact resolution criteria — and given an honest base-rate prior."
  },
  {
    kicker: "02 · RESEARCH",
    title: "Adversarial rounds",
    body: "Gather evidence, weigh its credibility and value, then hunt for whatever would prove the current lean wrong. You can push back mid-run."
  },
  {
    kicker: "03 · VERDICT",
    title: "A number you can audit",
    body: "One probability with its confidence band — and every source that moved it, in reading order, line by line."
  }
] as const;

// "Very unlikely" + "A third delay…" → "Very unlikely — a third delay…"
// (matches the design's joined card line, so the quip is de-capitalized).
function verdictLine(verdict: string, quip: string | null): string {
  if (!quip) return verdict;
  return `${verdict} — ${quip.charAt(0).toLowerCase()}${quip.slice(1)}`;
}

function toCard(run: RunListItem): LatestCard {
  return {
    id: run.eventId,
    prob: run.prob,
    question: run.question,
    verdict: run.verdict,
    quip: run.quip,
    sources: String(run.sources),
    duration: run.duration,
    confidence: run.confidence,
    resDate: run.resDate
  };
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latest, setLatest] = useState<LatestCard>(DEMO_CARD);
  const [liveRuns, setLiveRuns] = useState<LiveRun[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/forecasts", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { runs?: RunListItem[] };
        if (!alive || !Array.isArray(body.runs)) return;
        const sorted = [...body.runs].sort((a, b) => b.updatedAtUtc.localeCompare(a.updatedAtUtc));
        const complete = sorted.find((r) => r.status === "complete");
        if (complete) setLatest(toCard(complete));
        setLiveRuns(
          sorted
            .filter((r) => r.status === "running")
            .slice(0, 2)
            .map((r) => ({ id: r.eventId, question: r.question }))
        );
      } catch {
        /* engine unreachable — the archived demo card stays */
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    const question = q.trim();
    if (!question) {
      inputRef.current?.focus();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/forecasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      });
      const body = (await res.json().catch(() => null)) as { eventId?: string; error?: string } | null;
      if (!res.ok || !body?.eventId) {
        throw new Error(body?.error ?? `request failed (${res.status})`);
      }
      router.push(`/forecast/${body.eventId}/research`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const fillChip = () => {
    setQ(DEMO_QUESTION);
    inputRef.current?.focus();
  };

  return (
    <RvShell
      active="ask"
      headerRight={
        <span
          className="rv-hdr-meta"
          style={{ fontFamily: "var(--fm)", fontSize: 10, letterSpacing: ".08em", color: "var(--faint)" }}
        >
          RESEARCH PREVIEW
        </span>
      }
    >
      <div className="rv-home">
        <div
          style={{
            position: "absolute",
            top: -40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "radial-gradient(circle,color-mix(in srgb,var(--accent) 13%,transparent),transparent 64%)",
            pointerEvents: "none"
          }}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/raven-mascot.png"
          alt="Raven, a hooded crow holding a glowing orb"
          style={{
            position: "relative",
            width: 136,
            height: 136,
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid var(--line2)",
            boxShadow: "0 0 70px -6px color-mix(in srgb,var(--accent) 45%,transparent)"
          }}
        />
        <h1
          style={{
            position: "relative",
            margin: "24px 0 0",
            fontWeight: 500,
            fontSize: 44,
            lineHeight: 1.1,
            letterSpacing: "-.01em",
            textAlign: "center"
          }}
        >
          Raven <span style={{ color: "var(--accent)" }}>Forecasting Engine</span>
        </h1>
        <p
          style={{
            position: "relative",
            margin: "14px 0 0",
            fontSize: 16.5,
            lineHeight: 1.55,
            color: "var(--muted)",
            maxWidth: "54ch",
            textAlign: "center"
          }}
        >
          Ask a hard yes-or-no question about the future. Raven frames it precisely, researches it in adversarial
          rounds, and returns a probability — with every source that moved it laid out in reading order.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          style={{
            position: "relative",
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 36,
            width: "min(720px,92vw)",
            background: "var(--surface)",
            border: "1px solid var(--line2)",
            borderRadius: 14,
            padding: "9px 9px 9px 20px",
            boxShadow: "0 26px 70px -32px var(--shadow)"
          }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Will … happen by …?"
            aria-label="Forecast question"
            style={{
              flex: 1,
              minWidth: 0,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontFamily: "var(--fd)",
              fontSize: 18,
              padding: "9px 0"
            }}
          />
          <button
            type="submit"
            className="cta"
            disabled={submitting}
            style={{
              border: "none",
              cursor: submitting ? "default" : "pointer",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              fontFamily: "var(--fm)",
              fontWeight: 600,
              fontSize: 11.5,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              padding: "14px 22px",
              borderRadius: 9,
              whiteSpace: "nowrap",
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? "Framing…" : "Forecast it"}
          </button>
        </form>
        {submitError ? (
          <div
            role="alert"
            style={{
              position: "relative",
              width: "min(720px,92vw)",
              marginTop: 10,
              fontFamily: "var(--fm)",
              fontSize: 11,
              letterSpacing: ".03em",
              color: "var(--neg)"
            }}
          >
            {submitError}
          </div>
        ) : null}

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            flexWrap: "wrap",
            justifyContent: "center"
          }}
        >
          <span style={{ fontFamily: "var(--fm)", fontSize: 10.5, letterSpacing: ".04em", color: "var(--faint)" }}>
            Works best with a deadline and a checkable outcome — try
          </span>
          <button
            type="button"
            className="chip"
            onClick={fillChip}
            style={{
              background: "none",
              border: "1px solid var(--line2)",
              borderRadius: 20,
              color: "var(--muted)",
              fontFamily: "var(--fd)",
              fontSize: 13,
              padding: "7px 14px",
              cursor: "pointer"
            }}
          >
            Will the GTA 6 launch slip past November 19, 2026?
          </button>
        </div>

        <div style={{ position: "relative", width: "min(720px,92vw)", marginTop: 52 }}>
          <div
            style={{
              fontFamily: "var(--fm)",
              fontSize: 10,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--faint)",
              marginBottom: 10
            }}
          >
            Latest dossier
          </div>
          {liveRuns.map((r) => (
            <Link
              key={r.id}
              href={`/forecast/${r.id}/research`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                minWidth: 0,
                fontFamily: "var(--fm)",
                fontSize: 10.5,
                letterSpacing: ".04em",
                color: "var(--muted)",
                textDecoration: "none"
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  flex: "none",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  animation: "rv-blink 1.4s ease infinite"
                }}
              />
              <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                LIVE — {r.question}
              </span>
            </Link>
          ))}
          <div
            style={{
              display: "flex",
              gap: 22,
              alignItems: "center",
              background: "var(--bg2)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "20px 22px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ textAlign: "center", minWidth: 74 }}>
              <div
                style={{
                  fontFamily: "var(--fd)",
                  fontWeight: 600,
                  fontSize: 46,
                  lineHeight: 0.9,
                  color: "var(--accent)",
                  fontVariantNumeric: "tabular-nums"
                }}
              >
                {latest.prob}
              </div>
              <div
                style={{
                  fontFamily: "var(--fm)",
                  fontSize: 9,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--faint)",
                  marginTop: 6
                }}
              >
                P(YES)
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 260, borderLeft: "1px solid var(--line)", paddingLeft: 22 }}>
              <div style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 17, lineHeight: 1.32 }}>
                {latest.question}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 5, fontStyle: "italic" }}>
                {verdictLine(latest.verdict, latest.quip)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 10,
                  fontFamily: "var(--fm)",
                  fontSize: 10,
                  color: "var(--faint)",
                  flexWrap: "wrap"
                }}
              >
                <span>{latest.sources} sources</span>
                <span>{latest.duration}</span>
                <span style={{ color: `var(--cred-${credWord(latest.confidence)})` }}>
                  {cap(latest.confidence)} confidence
                </span>
                {latest.resDate ? <span>resolves {latest.resDate}</span> : null}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link
                href={`/forecast/${latest.id}`}
                className="cta"
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                  fontFamily: "var(--fm)",
                  fontWeight: 600,
                  fontSize: 10.5,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  padding: "11px 16px",
                  borderRadius: 8
                }}
              >
                Read the dossier
              </Link>
              <Link
                href={`/forecast/${latest.id}/research`}
                className="ghost"
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  border: "1px solid var(--line2)",
                  color: "var(--muted)",
                  fontFamily: "var(--fm)",
                  fontWeight: 600,
                  fontSize: 10.5,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  padding: "10px 16px",
                  borderRadius: 8
                }}
              >
                Watch the run
              </Link>
            </div>
          </div>
        </div>

        <div className="rv-home-steps">
          {STEPS.map((s) => (
            <div
              key={s.kicker}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: "18px 18px 16px",
                background: "color-mix(in srgb,var(--bg2) 60%,transparent)"
              }}
            >
              <div
                style={{
                  fontFamily: "var(--fm)",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: ".14em",
                  color: "var(--accent)"
                }}
              >
                {s.kicker}
              </div>
              <div style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 16, marginTop: 9 }}>{s.title}</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </RvShell>
  );
}
