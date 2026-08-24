"use client";

// 页脚 — 手动注入新闻 form + service meta + Phase 0 disclaimer.

import { useState } from "react";
import type { StatusSnapshot } from "../lib/types";
import { t, type Lang } from "../lib/i18n";
import { withBasePath } from "../lib/base-path";

export function FooterSection({
  snapshot,
  ingestConfigured,
  lang
}: {
  snapshot: StatusSnapshot;
  ingestConfigured: boolean;
  lang: Lang;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  // Store the outcome, not a pre-rendered message, so the note re-renders in
  // the active language if the operator toggles after submitting.
  const [result, setResult] = useState<{ ok: boolean; detail?: string } | null>(null);
  const tt = t(lang);

  const submit = async () => {
    if (sending || !title.trim() || !text.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(withBasePath("/api/paste"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "manual_news", title, text, url: url.trim() || undefined })
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) {
        setResult({ ok: true });
        setTitle("");
        setText("");
        setUrl("");
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
    <footer className="dpc-ftr">
      <div className="inject-form">
        <h2 className="dpc-sec-title" style={{ marginBottom: 4 }}>
          {tt("injectTitle")}
        </h2>
        <div className="fld">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tt("titlePlaceholder")}
            disabled={!ingestConfigured || sending}
          />
        </div>
        <div className="fld">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tt("bodyPlaceholder")}
            disabled={!ingestConfigured || sending}
          />
        </div>
        <div className="fld">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tt("urlPlaceholder")}
            disabled={!ingestConfigured || sending}
          />
        </div>
        <div className="form-row">
          <button
            className="btn"
            onClick={() => void submit()}
            disabled={!ingestConfigured || sending || !title.trim() || !text.trim()}
          >
            {sending ? tt("injecting") : tt("injectBtn")}
          </button>
          {!ingestConfigured ? <span className="form-hint">{tt("noIngestToken")}</span> : null}
          {result ? (
            <span className={result.ok ? "msg-ok" : "msg-err"}>
              {result.ok ? tt("injectOk") : tt("injectFail", { detail: result.detail ?? "" })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="ftr-meta">
        <div>
          {snapshot.service.name} v{snapshot.service.version} · mode: {snapshot.service.mode}
        </div>
        <div className="disclaimer">{tt("disclaimer")}</div>
      </div>
    </footer>
  );
}
