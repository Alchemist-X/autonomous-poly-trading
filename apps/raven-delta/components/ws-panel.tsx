"use client";

// Live WebSocket feed. State-derived button label (never read refs in render)
// and identity-guarded close/error handlers so a stale socket can't clobber a
// fresh connection (review findings #3/#8 from the demo round).

import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

type WsStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export function WsPanel({ defaultUrl }: { defaultUrl: string }) {
  const t = useT();
  const [url, setUrl] = useState(defaultUrl);
  const [status, setStatus] = useState<WsStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const statusLabel: Record<WsStatus, string> = {
    idle: t("wsIdle"),
    connecting: t("wsConnecting"),
    connected: t("wsConnected"),
    closed: t("wsClosed"),
    error: t("wsError")
  };
  const isActive = status === "connecting" || status === "connected";

  function toggleConnection() {
    if (isActive) {
      socketRef.current?.close();
      socketRef.current = null;
      setStatus("closed");
      return;
    }
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;
      setStatus("connecting");
      socket.addEventListener("open", () => {
        if (socketRef.current === socket) setStatus("connected");
      });
      socket.addEventListener("message", (event) => {
        setMessages((current) => [String(event.data), ...current].slice(0, 8));
      });
      socket.addEventListener("error", () => {
        if (socketRef.current === socket) setStatus("error");
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          setStatus((current) => (current === "error" ? "error" : "closed"));
        }
      });
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="dl-panel dl-section" aria-labelledby="dl-ws-title">
      <h3 id="dl-ws-title">{t("wsTitle")}</h3>
      <div className="dl-ws-row">
        <div className="dl-field">
          <label htmlFor="dl-ws-url">{t("wsUrlLabel")}</label>
          <input id="dl-ws-url" value={url} onChange={(event) => setUrl(event.target.value)} />
        </div>
        <button type="button" className="dl-btn" onClick={toggleConnection}>
          {isActive ? t("wsDisconnect") : t("wsConnect")}
        </button>
        <span
          role="status"
          className={`dl-ws-status ${status === "connected" ? "dl-ws-connected" : ""} ${status === "error" ? "dl-ws-error" : ""}`}
        >
          {statusLabel[status]}
        </span>
      </div>
      <p className="dl-hint">{t("wsHelp")}</p>
      {messages.length > 0 ? (
        <ul className="dl-ws-feed">
          {messages.map((message, index) => (
            <li key={`${index}-${message.slice(0, 40)}`}>
              <code>{message}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dl-hint">{t("wsNoMessages")}</p>
      )}
    </section>
  );
}
