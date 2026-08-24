"use client";

import type { StateResponse, StatusSnapshot } from "../lib/types";
import { fmtClock, fmtRelative, fmtUsd } from "../lib/format";
import { t, type Lang } from "../lib/i18n";

function pnlClass(v: number): string {
  if (v > 0) return "pnl-pos";
  if (v < 0) return "pnl-neg";
  return "pnl-flat";
}

export function StatusStrip({
  state,
  snapshot,
  nowMs,
  lang
}: {
  state: StateResponse;
  snapshot: StatusSnapshot;
  nowMs: number;
  lang: Lang;
}) {
  const p = snapshot.portfolio;
  const tt = t(lang);
  return (
    <>
      {p.halted ? (
        <div className="dpc-banner halted">
          {tt("haltedBanner")}
          {p.haltedReason ? tt("haltedReasonSuffix", { reason: p.haltedReason }) : ""}
        </div>
      ) : null}
      {state.stale ? (
        <div className="dpc-banner stale">
          {tt("staleBanner", { time: fmtClock(state.fetchedAtUtc) })}
          {state.error ? ` · ${state.error}` : ""}
        </div>
      ) : null}

      <div className="dpc-stats">
        <div className="stat">
          <div className="lbl">{tt("equityLbl")}</div>
          <div className="val big">{fmtUsd(p.equityUsd)}</div>
          <div className="sub">{tt("initialSub", { v: fmtUsd(p.initialCapitalUsd, { decimals: 0 }) })}</div>
        </div>
        <div className="stat">
          <div className="lbl">{tt("realizedLbl")}</div>
          <div className={`val ${pnlClass(p.realizedPnlUsd)}`}>{fmtUsd(p.realizedPnlUsd, { sign: true })}</div>
        </div>
        <div className="stat">
          <div className="lbl">{tt("unrealizedLbl")}</div>
          <div className={`val ${pnlClass(p.unrealizedPnlUsd)}`}>{fmtUsd(p.unrealizedPnlUsd, { sign: true })}</div>
        </div>
        <div className="stat">
          <div className="lbl">{tt("feedLbl")}</div>
          <div className="val" style={{ fontSize: 13 }}>
            {tt("feedPoll", { rel: fmtRelative(snapshot.feed.lastPollUtc, nowMs, lang) })}
          </div>
          <div className="sub">
            {tt("feedSub", { rel: fmtRelative(snapshot.feed.lastNewItemUtc, nowMs, lang), n: snapshot.feed.seenCount })}
            {snapshot.feed.lastError ? <span className="msg-err"> · {snapshot.feed.lastError}</span> : null}
          </div>
        </div>
        <div className="stat">
          <div className="lbl">{tt("marketLbl")}</div>
          <div className="val" style={{ fontSize: 13 }}>
            {tt("marketArchived", { n: snapshot.market.archivedCoins })}
          </div>
          <div className="sub">
            {tt("marketSweep", { rel: fmtRelative(snapshot.market.lastSweepUtc, nowMs, lang) })}
            {snapshot.market.lastError ? <span className="msg-err"> · {snapshot.market.lastError}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
