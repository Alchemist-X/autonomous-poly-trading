"use client";

// Delta PM operator dashboard — single page, polls /api/state every 2.5s
// (paused while the tab is hidden) plus a 1s clock tick for live elapsed
// timers. First paint is a static loading shell so SSR and hydration match.

import { useEffect, useRef, useState } from "react";
import type { StateResponse } from "../lib/types";
import { StatusStrip } from "../components/StatusStrip";
import { ActiveRuns } from "../components/ActiveRuns";
import { PositionsSection } from "../components/PositionsSection";
import { SignalsSection } from "../components/SignalsSection";
import { RecentRuns } from "../components/RecentRuns";
import { FooterSection } from "../components/FooterSection";

const POLL_MS = 2500;

export default function Page() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // Poll /api/state.
  useEffect(() => {
    let disposed = false;

    const tick = async () => {
      if (document.hidden) return;
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      try {
        const res = await fetch("/api/state", { cache: "no-store", signal: ctrl.signal });
        const json = (await res.json()) as StateResponse;
        if (!disposed) setState(json);
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        // Network hiccup on the browser side: keep the last shown state but
        // mark it stale so the operator knows the numbers stopped moving.
        setState((prev) =>
          prev
            ? { ...prev, ok: false, stale: prev.snapshot !== null, error: "无法连接控制台服务 (fetch failed)" }
            : {
                ok: false,
                stale: false,
                fetchedAtUtc: null,
                error: "无法连接控制台服务 (fetch failed)",
                ingestConfigured: false,
                mock: false,
                snapshot: null
              }
        );
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      clearInterval(timer);
      ctrlRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // 1s clock for live elapsed / relative times (client-only, avoids hydration mismatch).
  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = state?.snapshot ?? null;
  const now = nowMs ?? 0;

  return (
    <div className="dpc-wrap">
      <header className="dpc-hdr">
        <span className="dpc-wordmark">Delta PM</span>
        <span className="chip shadow-mode">影子模式 SHADOW</span>
        <span className="dpc-hdr-meta">
          {snapshot ? `${snapshot.service.name} v${snapshot.service.version}` : "…"}
          {state?.mock ? " · MOCK" : ""}
        </span>
      </header>

      {state === null || nowMs === null ? (
        <div className="loading">正在连接 Delta PM 服务…</div>
      ) : snapshot === null ? (
        <div className="dpc-sec">
          <div className="dpc-banner halted">无法获取服务状态{state.error ? `:${state.error}` : ""}</div>
          <p className="empty" style={{ marginTop: 16 }}>
            尚无任何可展示的快照。确认 delta-pm 服务在 {`DELTAPM_STATUS_URL`} 上运行,或设置 DELTAPM_CONSOLE_MOCK=1
            查看演示数据。
          </p>
        </div>
      ) : (
        <>
          <StatusStrip state={state} snapshot={snapshot} nowMs={now} />
          <ActiveRuns runs={snapshot.activeRuns} nowMs={now} />
          <PositionsSection positions={snapshot.portfolio.positions} />
          <SignalsSection signals={snapshot.recentSignals} nowMs={now} ingestConfigured={state.ingestConfigured} />
          <RecentRuns runs={snapshot.recentRuns} nowMs={now} />
          <FooterSection snapshot={snapshot} ingestConfigured={state.ingestConfigured} />
        </>
      )}
    </div>
  );
}
