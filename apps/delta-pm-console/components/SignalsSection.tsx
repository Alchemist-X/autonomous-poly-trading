"use client";

// 最近信号 — card list with priced-in status chips and the 补全原文 paste seam.

import { useState } from "react";
import type { SignalRow } from "../lib/types";
import { fmtRelative } from "../lib/format";
import { withBasePath } from "../lib/base-path";

const PI_CHIP: Record<string, { cls: string; label: string }> = {
  none: { cls: "pi-none", label: "未定价" },
  partial: { cls: "pi-partial", label: "部分定价" },
  full: { cls: "pi-full", label: "已定价" },
  leaked: { cls: "pi-leaked", label: "疑似泄露" },
  reverse: { cls: "pi-reverse", label: "反向" },
  awaiting_market: { cls: "pi-awaiting", label: "待行情" }
};

function PricedInChip({ status }: { status: string | null }) {
  if (!status) return <span className="chip pi-unknown">待评估</span>;
  const meta = PI_CHIP[status];
  if (!meta) return <span className="chip pi-unknown">{status}</span>;
  return <span className={`chip ${meta.cls}`}>{meta.label}</span>;
}

function PasteBox({ signal, ingestConfigured }: { signal: SignalRow; ingestConfigured: boolean }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
        setResult({ ok: true, msg: "已提交,等待重新分析" });
        setText("");
      } else {
        setResult({ ok: false, msg: `提交失败:${json?.error ?? `HTTP ${res.status}`}` });
      }
    } catch (err) {
      setResult({ ok: false, msg: `提交失败:${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <details className="paste-box">
      <summary>补全原文</summary>
      <div className="paste-body">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="粘贴这条新闻的完整原文,提交后会触发重新分析"
          disabled={!ingestConfigured || sending}
        />
        <div className="form-row">
          <button className="btn" onClick={() => void submit()} disabled={!ingestConfigured || sending || !text.trim()}>
            {sending ? "提交中…" : "提交原文"}
          </button>
          {!ingestConfigured ? <span className="form-hint">未配置 DELTAPM_INGEST_TOKEN</span> : null}
          {result ? <span className={result.ok ? "msg-ok" : "msg-err"}>{result.msg}</span> : null}
        </div>
      </div>
    </details>
  );
}

export function SignalsSection({
  signals,
  nowMs,
  ingestConfigured
}: {
  signals: SignalRow[];
  nowMs: number;
  ingestConfigured: boolean;
}) {
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        最近信号 <span className="cnt">{signals.length}</span>
      </h2>
      {signals.length === 0 ? (
        <div className="empty">暂无信号</div>
      ) : (
        signals.map((sig) => (
          <article className="sig-card" key={sig.signalId}>
            <div className="sig-head">
              <h3 className="sig-title" style={{ margin: 0 }}>
                {sig.title}
              </h3>
              <span className="sig-time">{fmtRelative(sig.createdAtUtc, nowMs)}</span>
            </div>
            <div className="sig-chips">
              {sig.tickers.map((t) => (
                <span key={t} className="chip ticker">
                  {t}
                </span>
              ))}
              <PricedInChip status={sig.pricedInStatus} />
              {sig.tradeable ? <span className="chip tradeable">可交易</span> : null}
              <span className="sig-score">重要性 {Math.round(sig.materialityScore)}</span>
            </div>
            <PasteBox signal={sig} ingestConfigured={ingestConfigured} />
          </article>
        ))
      )}
    </section>
  );
}
