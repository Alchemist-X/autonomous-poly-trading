"use client";

// 最近信号 — card list with priced-in status chips and the 补全原文 paste seam.

import { useState } from "react";
import type { SignalRow } from "../lib/types";
import { fmtRelative } from "../lib/format";
import { t, type Lang, type MsgKey } from "../lib/i18n";
import { withBasePath } from "../lib/base-path";

const PI_CHIP: Record<string, { cls: string; labelKey: MsgKey }> = {
  none: { cls: "pi-none", labelKey: "piNone" },
  partial: { cls: "pi-partial", labelKey: "piPartial" },
  full: { cls: "pi-full", labelKey: "piFull" },
  leaked: { cls: "pi-leaked", labelKey: "piLeaked" },
  reverse: { cls: "pi-reverse", labelKey: "piReverse" },
  awaiting_market: { cls: "pi-awaiting", labelKey: "piAwaiting" }
};

function PricedInChip({ status, lang }: { status: string | null; lang: Lang }) {
  const tt = t(lang);
  if (!status) return <span className="chip pi-unknown">{tt("piPending")}</span>;
  const meta = PI_CHIP[status];
  if (!meta) return <span className="chip pi-unknown">{status}</span>;
  return <span className={`chip ${meta.cls}`}>{tt(meta.labelKey)}</span>;
}

function PasteBox({ signal, ingestConfigured, lang }: { signal: SignalRow; ingestConfigured: boolean; lang: Lang }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // Store the outcome, not a pre-rendered message, so the note re-renders in
  // the active language if the operator toggles after submitting.
  const [result, setResult] = useState<{ ok: boolean; detail?: string } | null>(null);
  const tt = t(lang);

  const submit = async () => {
    if (sending || !text.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(withBasePath("/api/paste"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "paste_full_text",
          // Upstream contract has no newsId on recentSignals yet — fall back
          // to signalId so the service can still resolve the item.
          newsId: signal.newsId ?? signal.signalId,
          fullText: text
        })
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) {
        setResult({ ok: true });
        setText("");
      } else {
        setResult({ ok: false, detail: json?.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      setResult({ ok: false, detail: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <details className="paste-box">
      <summary>{tt("pasteSummary")}</summary>
      <div className="paste-body">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tt("pastePlaceholder")}
          disabled={!ingestConfigured || sending}
        />
        <div className="form-row">
          <button className="btn" onClick={() => void submit()} disabled={!ingestConfigured || sending || !text.trim()}>
            {sending ? tt("submitting") : tt("submitText")}
          </button>
          {!ingestConfigured ? <span className="form-hint">{tt("noIngestToken")}</span> : null}
          {result ? (
            <span className={result.ok ? "msg-ok" : "msg-err"}>
              {result.ok ? tt("pasteOk") : tt("pasteFail", { detail: result.detail ?? "" })}
            </span>
          ) : null}
        </div>
      </div>
    </details>
  );
}

export function SignalsSection({
  signals,
  nowMs,
  ingestConfigured,
  lang
}: {
  signals: SignalRow[];
  nowMs: number;
  ingestConfigured: boolean;
  lang: Lang;
}) {
  const tt = t(lang);
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        {tt("signalsTitle")} <span className="cnt">{signals.length}</span>
      </h2>
      {signals.length === 0 ? (
        <div className="empty">{tt("signalsEmpty")}</div>
      ) : (
        signals.map((sig) => (
          <article className="sig-card" key={sig.signalId}>
            <div className="sig-head">
              <h3 className="sig-title" style={{ margin: 0 }}>
                {sig.title}
              </h3>
              <span className="sig-time">{fmtRelative(sig.createdAtUtc, nowMs, lang)}</span>
            </div>
            <div className="sig-chips">
              {sig.tickers.map((tk) => (
                <span key={tk} className="chip ticker">
                  {tk}
                </span>
              ))}
              <PricedInChip status={sig.pricedInStatus} lang={lang} />
              {sig.tradeable ? <span className="chip tradeable">{tt("tradeableChip")}</span> : null}
              <span className="sig-score">{tt("materiality", { n: Math.round(sig.materialityScore) })}</span>
            </div>
            <PasteBox signal={sig} ingestConfigured={ingestConfigured} lang={lang} />
          </article>
        ))
      )}
    </section>
  );
}
