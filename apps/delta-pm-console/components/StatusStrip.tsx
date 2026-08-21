"use client";

import type { StateResponse, StatusSnapshot } from "../lib/types";
import { fmtClock, fmtRelative, fmtUsd } from "../lib/format";

function pnlClass(v: number): string {
  if (v > 0) return "pnl-pos";
  if (v < 0) return "pnl-neg";
  return "pnl-flat";
}

export function StatusStrip({
  state,
  snapshot,
  nowMs
}: {
  state: StateResponse;
  snapshot: StatusSnapshot;
  nowMs: number;
}) {
  const p = snapshot.portfolio;
  return (
    <>
      {p.halted ? (
        <div className="dpc-banner halted">已触发停机保护 (HALTED){p.haltedReason ? ` · 原因:${p.haltedReason}` : ""}</div>
      ) : null}
      {state.stale ? (
        <div className="dpc-banner stale">
          数据可能过期 · 上次成功 {fmtClock(state.fetchedAtUtc)}
          {state.error ? ` · ${state.error}` : ""}
        </div>
      ) : null}

      <div className="dpc-stats">
        <div className="stat">
          <div className="lbl">账户净值 Equity</div>
          <div className="val big">{fmtUsd(p.equityUsd)}</div>
          <div className="sub">初始 {fmtUsd(p.initialCapitalUsd, { decimals: 0 })}</div>
        </div>
        <div className="stat">
          <div className="lbl">已实现盈亏</div>
          <div className={`val ${pnlClass(p.realizedPnlUsd)}`}>{fmtUsd(p.realizedPnlUsd, { sign: true })}</div>
        </div>
        <div className="stat">
          <div className="lbl">浮动盈亏</div>
          <div className={`val ${pnlClass(p.unrealizedPnlUsd)}`}>{fmtUsd(p.unrealizedPnlUsd, { sign: true })}</div>
        </div>
        <div className="stat">
          <div className="lbl">新闻源</div>
          <div className="val" style={{ fontSize: 13 }}>
            轮询 {fmtRelative(snapshot.feed.lastPollUtc, nowMs)}
          </div>
          <div className="sub">
            最新条目 {fmtRelative(snapshot.feed.lastNewItemUtc, nowMs)} · 累计 {snapshot.feed.seenCount} 条
            {snapshot.feed.lastError ? <span className="msg-err"> · {snapshot.feed.lastError}</span> : null}
          </div>
        </div>
        <div className="stat">
          <div className="lbl">行情</div>
          <div className="val" style={{ fontSize: 13 }}>
            归档 {snapshot.market.archivedCoins} 个标的
          </div>
          <div className="sub">
            上次 sweep {fmtRelative(snapshot.market.lastSweepUtc, nowMs)}
            {snapshot.market.lastError ? <span className="msg-err"> · {snapshot.market.lastError}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
