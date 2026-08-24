"use client";

// Delta PM operator dashboard — single page, polls /api/state every 2.5s
// (paused while the tab is hidden) plus a 1s clock tick for live elapsed
// timers. First paint is a static loading shell so SSR and hydration match.
//
// UI language: client state, default "zh" (so SSR + first client render
// agree), hydrated from localStorage after mount and persisted on toggle.
// `<html lang>` stays "zh-CN" server-side; an effect keeps
// document.documentElement.lang in sync once the user switches.

import { useEffect, useRef, useState } from "react";
import type { StateResponse } from "../lib/types";
import { LANG_STORAGE_KEY, t, type Lang } from "../lib/i18n";
import { StatusStrip } from "../components/StatusStrip";
import { ActiveRuns } from "../components/ActiveRuns";
import { PositionsSection } from "../components/PositionsSection";
import { SignalsSection } from "../components/SignalsSection";
import { RecentRuns } from "../components/RecentRuns";
import { FooterSection } from "../components/FooterSection";
import { withBasePath } from "../lib/base-path";

const POLL_MS = 2500;

export default function Page() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>("zh");
  const ctrlRef = useRef<AbortController | null>(null);
  // The poll callback runs outside render — read the current language via a
  // ref so client-generated error strings come out in the language active at
  // the time they are produced.
  const langRef = useRef<Lang>("zh");

  // Hydrate language from localStorage (client-only; SSR shell is zh).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === "en" || stored === "zh") setLang(stored);
    } catch {
      // localStorage unavailable (private mode etc.) — stay on zh.
    }
  }, []);

  // Keep the ref, <html lang> and document title in sync with the UI language.
  useEffect(() => {
    langRef.current = lang;
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title = t(lang)("docTitle");
  }, [lang]);

  const toggleLang = () => {
    const next: Lang = lang === "zh" ? "en" : "zh";
    setLang(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-session toggle still works.
    }
  };

  // Poll /api/state.
  useEffect(() => {
    let disposed = false;

    const tick = async () => {
      if (document.hidden) return;
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      try {
        const res = await fetch(withBasePath("/api/state"), { cache: "no-store", signal: ctrl.signal });
        const json = (await res.json()) as StateResponse;
        if (!disposed) setState(json);
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        // Network hiccup on the browser side: keep the last shown state but
        // mark it stale so the operator knows the numbers stopped moving.
        const fetchFailMsg = t(langRef.current)("fetchFailErr");
        setState((prev) =>
          prev
            ? { ...prev, ok: false, stale: prev.snapshot !== null, error: fetchFailMsg }
            : {
                ok: false,
                stale: false,
                fetchedAtUtc: null,
                error: fetchFailMsg,
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
  const tt = t(lang);

  return (
    <div className="dpc-wrap">
      <header className="dpc-hdr">
        <span className="dpc-wordmark">Delta PM</span>
        <span className="chip shadow-mode">{tt("shadowChip")}</span>
        <span className="dpc-hdr-meta">
          {snapshot ? `${snapshot.service.name} v${snapshot.service.version}` : "…"}
          {state?.mock ? " · MOCK" : ""}
        </span>
        <button type="button" className="lang-toggle" onClick={toggleLang} aria-label={tt("langToggleAria")}>
          {tt("langToggle")}
        </button>
      </header>

      {state === null || nowMs === null ? (
        <div className="loading">{tt("loading")}</div>
      ) : snapshot === null ? (
        <div className="dpc-sec">
          <div className="dpc-banner halted">
            {tt("noStateBanner")}
            {state.error ? tt("errSuffix", { err: state.error }) : ""}
          </div>
          <p className="empty" style={{ marginTop: 16 }}>
            {tt("noSnapshotHint")}
          </p>
        </div>
      ) : (
        <>
          <StatusStrip state={state} snapshot={snapshot} nowMs={now} lang={lang} />
          <ActiveRuns runs={snapshot.activeRuns} nowMs={now} lang={lang} />
          <PositionsSection positions={snapshot.portfolio.positions} lang={lang} />
          <SignalsSection
            signals={snapshot.recentSignals}
            nowMs={now}
            ingestConfigured={state.ingestConfigured}
            lang={lang}
          />
          <RecentRuns runs={snapshot.recentRuns} nowMs={now} lang={lang} />
          <FooterSection snapshot={snapshot} ingestConfigured={state.ingestConfigured} lang={lang} />
        </>
      )}
    </div>
  );
}
