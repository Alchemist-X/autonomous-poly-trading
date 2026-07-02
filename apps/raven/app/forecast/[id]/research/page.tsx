"use client";

// Screen 02 · Research — the live-run view where an analyst annotates evidence
// (circle to keep, strike to doubt, attach notes) and queues hypotheses for
// the next iteration. One component tree, two data sources: the frozen GTA 6
// demo snapshot ("gta6-demo") and live engine runs via useForecast polling.

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RvShell } from "../../../../components/chrome/rv-shell";
import { IconDefs } from "../../../../components/icons";
import { AnalystDesk } from "../../../../components/research/analyst-desk";
import { IterationBlock } from "../../../../components/research/iteration-block";
import {
  buildDemoBlocks,
  buildLiveBlocks,
  buildQueued,
  DEMO_NOW,
  nextRoundFor,
  readingFromJob,
  type BlockVM,
  type JobX
} from "../../../../components/research/research-vm";
import {
  CoachBar,
  CompleteCta,
  FramingBlock,
  LoadingBlock,
  NoticeCard
} from "../../../../components/research/state-cards";
import { StatusStrip, type NowLine, type QuantVM } from "../../../../components/research/status-strip";
import { useAnnotations } from "../../../../components/research/use-annotations";
import { useForecast } from "../../../../lib/client/use-forecast";
import { GTA6_DEMO, GTA6_DEMO_ID } from "../../../../lib/demo/gta6";
import type { AnalystStance } from "../../../../lib/server/analyst";
import { formatElapsed } from "../../../../lib/vm/format";
import "./research.css";

// The design's frozen demo moment starts its clock at 21m 04s and counts up.
const DEMO_ELAPSED_BASE_SEC = 1264;

function useNowTick(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function demoElapsed(now: number | null, t0: number | null): string {
  const extra = now !== null && t0 !== null ? Math.max(0, Math.floor((now - t0) / 1000)) : 0;
  const s = DEMO_ELAPSED_BASE_SEC + extra;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export default function ResearchPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? (rawId[0] ?? "") : "";
  const isDemo = id === GTA6_DEMO_ID;

  const { data, error, refresh } = useForecast(id);
  const ann = useAnnotations(id, data?.analyst, refresh);

  // Composer state (shared draft for the evidence note input, per the design).
  const [composerText, setComposerText] = useState("");
  const [stance, setStance] = useState<AnalystStance>("no");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const dossier = isDemo ? GTA6_DEMO : (data?.dossier ?? null);
  const job = (data?.job ?? null) as JobX | null;
  const running = isDemo ? true : job?.status === "running";
  const framing = !isDemo && running && dossier === null;

  const now = useNowTick(running);
  const [demoT0, setDemoT0] = useState<number | null>(null);
  useEffect(() => {
    if (isDemo) setDemoT0(Date.now());
  }, [isDemo]);

  const blocks: BlockVM[] = useMemo(() => {
    if (isDemo) return buildDemoBlocks(GTA6_DEMO);
    if (!dossier) return [];
    // Framing persisted but round 1 still running: show a round-1 placeholder
    // block so the feed reads "researching" instead of sitting empty.
    if (dossier.iterations.length === 0 && running) {
      const p = dossier.meta.prior;
      return [
        {
          n: "01",
          reasoningId: "r1",
          status: `running · ${p} → ${p} so far`,
          move: "— 0% so far",
          moveDir: "flat",
          note: `Question framed — starting from a ${p} base-rate prior. Round 1 is gathering its first evidence.`,
          evidence: [],
          reading: readingFromJob(job)
        }
      ];
    }
    return buildLiveBlocks(dossier.iterations, running, readingFromJob(job));
  }, [isDemo, dossier, running, job]);

  const maxRounds = isDemo ? 3 : Math.max(1, dossier?.maxRounds ?? job?.maxRounds ?? 3);
  const nextRound = nextRoundFor(blocks.length, maxRounds);
  const complete = !isDemo && !running && dossier?.status === "complete";
  const aborted = !isDemo && !running && (job?.status === "error" || dossier?.status === "failed");

  // --- header status (pulsing dot + mono text) ---
  const sourcesShown = blocks.reduce((acc, b) => acc + b.evidence.length, 0);
  let headerText: string | null = null;
  let headerLive = false;
  if (isDemo) {
    headerText = `LIVE · ITERATION 2 OF 3 · ${demoElapsed(now, demoT0)} · 08 SOURCES`;
    headerLive = true;
  } else if (running && job) {
    const cur = Math.min(Math.max(blocks.length, 1), maxRounds);
    const elapsed = formatElapsed(job.startedAtUtc, now ?? Date.parse(job.startedAtUtc));
    headerText = `LIVE · ITERATION ${cur} OF ${maxRounds} · ${elapsed} · ${String(sourcesShown).padStart(2, "0")} SOURCES`;
    headerLive = true;
  } else if (dossier && dossier.status === "complete") {
    headerText = `COMPLETE · ${dossier.meta.duration} · ${dossier.meta.sources.padStart(2, "0")} SOURCES`;
  } else if (aborted) {
    headerText = "RUN ABORTED";
  } else if (job?.status === "unforecastable") {
    headerText = "UNFORECASTABLE";
  }
  const headerRight = headerText ? (
    <span
      className="rv-hdr-meta"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontFamily: "var(--fm)",
        fontSize: 10,
        letterSpacing: ".05em",
        color: "var(--muted)"
      }}
    >
      {headerLive && (
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "rv-pulse 1.8s ease-out infinite",
            flex: "none"
          }}
        />
      )}
      {headerText}
    </span>
  ) : undefined;

  // --- status strip content ---
  const question = isDemo
    ? GTA6_DEMO.meta.question
    : (dossier?.meta.question ?? job?.question ?? "Framing the question…");
  const nowLine: NowLine | null = isDemo
    ? DEMO_NOW
    : running && dossier
      ? {
          bold: `research round ${Math.min(Math.max(blocks.length, 1), maxRounds)}`,
          rest: " — gathering evidence and updating the estimate."
        }
      : null;
  let quant: QuantVM | null = null;
  if (isDemo) {
    quant = { nowPct: 18, priorPct: 38, label: "P(YES) · provisional" };
  } else if (dossier && dossier.currentProb !== null && dossier.priorProb !== null) {
    quant = {
      nowPct: Math.round(dossier.currentProb * 100),
      priorPct: Math.round(dossier.priorProb * 100),
      label: complete ? "P(YES) · final" : "P(YES) · provisional"
    };
  }

  // --- analyst desk data ---
  const markSummary = `${ann.keptCount} kept · ${ann.doubtedCount} doubted · ${ann.notes.length} notes`;
  const leanYes = (dossier?.currentProb ?? dossier?.priorProb ?? 0) >= 0.5;
  const queued = useMemo(
    () => buildQueued(ann.notes, blocks, dossier?.iterations ?? [], nextRound, complete, leanYes),
    [ann.notes, blocks, dossier, nextRound, complete, leanYes]
  );

  const onToggleNote = (evidenceId: string) => {
    setNoteFor((cur) => (cur === evidenceId ? null : evidenceId));
    setNoteDraft("");
  };
  const onNoteSubmit = (evidenceId: string) => {
    if (ann.addNote({ text: noteDraft, stance, targetId: evidenceId })) {
      setNoteDraft("");
      setNoteFor(null);
    }
  };
  const onDeskSubmit = () => {
    if (ann.addNote({ text: composerText, stance, targetId: null })) setComposerText("");
  };

  const { toast, clearToast } = ann;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 4200);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  // --- terminal / empty states (live mode only) ---
  let notice: React.ReactNode = null;
  if (!isDemo && !data) {
    notice = error ? (
      /not found/i.test(error) ? (
        <NoticeCard tone="info" title="Forecast not found">
          There's no run with this id — it may have been cleared when the server restarted. Ask a new question from
          the Ask screen.
        </NoticeCard>
      ) : (
        <NoticeCard tone="error" title="Couldn't load this run">
          {error} — retrying automatically.
        </NoticeCard>
      )
    ) : (
      <LoadingBlock />
    );
  } else if (!isDemo && data && !dossier) {
    if (job?.status === "unforecastable") {
      notice = (
        <NoticeCard tone="info" title="This question is too vague to forecast" log={job.log.slice(-6)}>
          {job.question ? (
            <>
              Raven couldn't pin <i>“{job.question}”</i> down to a checkable yes-or-no outcome with a deadline.{" "}
            </>
          ) : (
            <>Raven couldn't pin the question down to a checkable yes-or-no outcome with a deadline. </>
          )}
          Rephrase it with a concrete event and date — “Will … happen by …?” — and ask again.
        </NoticeCard>
      );
    } else if (job?.status === "error") {
      notice = (
        <NoticeCard tone="error" title="The run aborted" log={job.log.slice(-8)}>
          The engine stopped before finishing this run. The last log lines may explain why.
        </NoticeCard>
      );
    } else if (!job) {
      notice = (
        <NoticeCard tone="info" title="Forecast not found">
          There's no run with this id — it may have been cleared when the server restarted. Ask a new question from
          the Ask screen.
        </NoticeCard>
      );
    }
  }

  if (notice) {
    return (
      <RvShell active="research" forecastId={id} showFooter={false} headerRight={headerRight}>
        <div className="rv-research">{notice}</div>
      </RvShell>
    );
  }

  return (
    <RvShell active="research" forecastId={id} showFooter={false} headerRight={headerRight}>
      <IconDefs />
      <div className="rv-research">
        <StatusStrip question={question} now={nowLine} quant={quant} />
        <div className="rvp-grid">
          <div>
            <CoachBar nextRound={nextRound} />
            {aborted && (
              <NoticeCard tone="error" title="The run aborted" inline log={job?.status === "error" ? job.log.slice(-6) : undefined}>
                The engine stopped before this run finished. Everything it gathered so far is shown below.
              </NoticeCard>
            )}
            {framing ? (
              <FramingBlock />
            ) : (
              blocks.map((block) => (
                <IterationBlock
                  key={block.n}
                  block={block}
                  marks={ann.marks}
                  onMark={ann.toggleMark}
                  notes={ann.notes}
                  noteFor={noteFor}
                  onToggleNote={onToggleNote}
                  noteDraft={noteDraft}
                  onNoteDraft={setNoteDraft}
                  onNoteSubmit={onNoteSubmit}
                />
              ))
            )}
            {complete && <CompleteCta id={id} />}
          </div>
          <AnalystDesk
            markSummary={markSummary}
            nextRound={nextRound}
            complete={complete}
            composerText={composerText}
            onComposerText={setComposerText}
            stance={stance}
            onStance={setStance}
            onSubmit={onDeskSubmit}
            queued={queued}
            onRemove={ann.removeNote}
          />
        </div>
      </div>
      {toast && (
        <div className="rv-research-toast" role="alert">
          {toast}
        </div>
      )}
    </RvShell>
  );
}
