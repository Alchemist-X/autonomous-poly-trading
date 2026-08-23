"use client";

// 页脚 — 手动注入新闻 form + service meta + Phase 0 disclaimer.

import { useState } from "react";
import type { StatusSnapshot } from "../lib/types";
import { withBasePath } from "../lib/base-path";

export function FooterSection({
  snapshot,
  ingestConfigured
}: {
  snapshot: StatusSnapshot;
  ingestConfigured: boolean;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
        setResult({ ok: true, msg: "已注入,等待分析" });
        setTitle("");
        setText("");
        setUrl("");
      } else {
        setResult({ ok: false, msg: `注入失败:${json?.error ?? `HTTP ${res.status}`}` });
      }
    } catch (err) {
      setResult({ ok: false, msg: `注入失败:${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="dpc-ftr">
      <div className="inject-form">
        <h2 className="dpc-sec-title" style={{ marginBottom: 4 }}>
          手动注入新闻
        </h2>
        <div className="fld">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题(必填)"
            disabled={!ingestConfigured || sending}
          />
        </div>
        <div className="fld">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="正文(必填)"
            disabled={!ingestConfigured || sending}
          />
        </div>
        <div className="fld">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="来源链接(可选)"
            disabled={!ingestConfigured || sending}
          />
        </div>
        <div className="form-row">
          <button
            className="btn"
            onClick={() => void submit()}
            disabled={!ingestConfigured || sending || !title.trim() || !text.trim()}
          >
            {sending ? "注入中…" : "注入并分析"}
          </button>
          {!ingestConfigured ? <span className="form-hint">未配置 DELTAPM_INGEST_TOKEN</span> : null}
          {result ? <span className={result.ok ? "msg-ok" : "msg-err"}>{result.msg}</span> : null}
        </div>
      </div>
      <div className="ftr-meta">
        <div>
          {snapshot.service.name} v{snapshot.service.version} · mode: {snapshot.service.mode}
        </div>
        <div className="disclaimer">Phase 0 影子模式:不下真实订单</div>
      </div>
    </footer>
  );
}
