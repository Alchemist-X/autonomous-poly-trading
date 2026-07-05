"use client";

import { useEffect, useRef, useState } from "react";
import type { StockNewsImpactRun } from "../../lib/stock-news-impact";
import styles from "./stock-news.module.css";

export interface StockNewsConsoleCopy {
  newsLabel: string;
  newsHelp: string;
  bodyLabel: string;
  bodyHelp: string;
  sourceLabel: string;
  sourcePlaceholder: string;
  urlLabel: string;
  urlPlaceholder: string;
  watchlistLabel: string;
  watchlistHelp: string;
  emailsLabel: string;
  emailsHelp: string;
  emailPlaceholder: string;
  topicLabel: string;
  topicHelp: string;
  wsUrlLabel: string;
  wsHelp: string;
  connect: string;
  disconnect: string;
  wsIdle: string;
  wsConnecting: string;
  wsConnected: string;
  wsClosed: string;
  wsError: string;
  sample: string;
  analyze: string;
  analyzing: string;
  errorPrefix: string;
  emptyTitle: string;
  emptyCopy: string;
  reportTitle: string;
  summaryTitle: string;
  affectedTitle: string;
  stagesTitle: string;
  deliveryTitle: string;
  limitationsTitle: string;
  liveMessagesTitle: string;
  ticker: string;
  direction: string;
  action: string;
  expectedMove: string;
  confidence: string;
  thesis: string;
  risk: string;
  receipts: string;
  noMessages: string;
}

interface StockNewsConsoleDefaults {
  headline: string;
  body: string;
  watchlist: string;
  topic: string;
  wsUrl: string;
}

export function StockNewsConsole({
  copy,
  defaults,
  locale
}: {
  copy: StockNewsConsoleCopy;
  defaults: StockNewsConsoleDefaults;
  locale: "en" | "zh";
}) {
  const [headline, setHeadline] = useState(defaults.headline);
  const [body, setBody] = useState(defaults.body);
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [watchlist, setWatchlist] = useState(defaults.watchlist);
  const [emails, setEmails] = useState("");
  const [topic, setTopic] = useState(defaults.topic);
  const [wsUrl, setWsUrl] = useState(defaults.wsUrl);
  const [run, setRun] = useState<StockNewsImpactRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState<"idle" | "connecting" | "connected" | "closed" | "error">("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const wsStatusLabel = {
    idle: copy.wsIdle,
    connecting: copy.wsConnecting,
    connected: copy.wsConnected,
    closed: copy.wsClosed,
    error: copy.wsError
  }[wsStatus];

  function useSample() {
    setHeadline(defaults.headline);
    setBody(defaults.body);
    setWatchlist(defaults.watchlist);
    setTopic(defaults.topic);
    setError(null);
  }

  function connectWebSocket() {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setWsStatus("closed");
      return;
    }
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setWsStatus("connecting");
      socket.addEventListener("open", () => setWsStatus("connected"));
      socket.addEventListener("message", (event) => {
        setMessages((current) => [String(event.data), ...current].slice(0, 6));
      });
      socket.addEventListener("error", () => setWsStatus("error"));
      socket.addEventListener("close", () => {
        socketRef.current = null;
        setWsStatus((current) => (current === "error" ? "error" : "closed"));
      });
    } catch (wsError) {
      setWsStatus("error");
      setError(wsError instanceof Error ? wsError.message : String(wsError));
    }
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stock-news-impact/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          headline,
          body,
          source,
          url,
          watchlist,
          emailRecipients: emails,
          websocketTopic: topic,
          locale
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`);
      }
      setRun(payload as StockNewsImpactRun);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.consoleGrid}>
      <section className={styles.inputPanel} aria-labelledby="stock-news-input-title">
        <div className={styles.panelTop}>
          <h2 id="stock-news-input-title">{copy.reportTitle}</h2>
          <button type="button" className={styles.secondaryButton} onClick={useSample}>
            {copy.sample}
          </button>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="stock-news-headline">{copy.newsLabel}</label>
          <textarea
            id="stock-news-headline"
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            aria-describedby="stock-news-headline-help"
            rows={3}
          />
          <p id="stock-news-headline-help">{copy.newsHelp}</p>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="stock-news-body">{copy.bodyLabel}</label>
          <textarea
            id="stock-news-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-describedby="stock-news-body-help"
            rows={6}
          />
          <p id="stock-news-body-help">{copy.bodyHelp}</p>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label htmlFor="stock-news-source">{copy.sourceLabel}</label>
            <input
              id="stock-news-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={copy.sourcePlaceholder}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="stock-news-url">{copy.urlLabel}</label>
            <input
              id="stock-news-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={copy.urlPlaceholder}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="stock-news-watchlist">{copy.watchlistLabel}</label>
          <input
            id="stock-news-watchlist"
            value={watchlist}
            onChange={(event) => setWatchlist(event.target.value)}
            aria-describedby="stock-news-watchlist-help"
          />
          <p id="stock-news-watchlist-help">{copy.watchlistHelp}</p>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label htmlFor="stock-news-emails">{copy.emailsLabel}</label>
            <input
              id="stock-news-emails"
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder={copy.emailPlaceholder}
              aria-describedby="stock-news-emails-help"
            />
            <p id="stock-news-emails-help">{copy.emailsHelp}</p>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="stock-news-topic">{copy.topicLabel}</label>
            <input
              id="stock-news-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              aria-describedby="stock-news-topic-help"
            />
            <p id="stock-news-topic-help">{copy.topicHelp}</p>
          </div>
        </div>

        <div className={styles.wsBox}>
          <div className={styles.fieldGroup}>
            <label htmlFor="stock-news-ws-url">{copy.wsUrlLabel}</label>
            <input
              id="stock-news-ws-url"
              value={wsUrl}
              onChange={(event) => setWsUrl(event.target.value)}
              aria-describedby="stock-news-ws-help"
            />
            <p id="stock-news-ws-help">{copy.wsHelp}</p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={connectWebSocket}>
            {socketRef.current ? copy.disconnect : copy.connect}
          </button>
          <span className={`${styles.statusPill} ${styles[`ws_${wsStatus}`]}`}>{wsStatusLabel}</span>
        </div>

        {error ? (
          <p className={styles.errorText} role="alert">
            {copy.errorPrefix} {error}
          </p>
        ) : null}

        <button type="button" className={styles.primaryButton} onClick={submit} disabled={loading || !headline.trim()} aria-busy={loading}>
          {loading ? copy.analyzing : copy.analyze}
        </button>
      </section>

      <section className={styles.outputPanel} aria-live="polite">
        {run ? (
          <div className={styles.reportStack}>
            <div className={styles.reportHero}>
              <p className={styles.kicker}>{run.id}</p>
              <h2>{run.summary.title}</h2>
              <p>{run.summary.verdict}</p>
            </div>

            <section className={styles.reportSection}>
              <h3>{copy.summaryTitle}</h3>
              <p>{run.summary.marketMechanism}</p>
              <p>{run.summary.pushNarrative}</p>
            </section>

            <section className={styles.reportSection}>
              <h3>{copy.affectedTitle}</h3>
              <div className={styles.tableWrap}>
                <table className={styles.impactTable}>
                  <thead>
                    <tr>
                      <th>{copy.ticker}</th>
                      <th>{copy.direction}</th>
                      <th>{copy.action}</th>
                      <th>{copy.expectedMove}</th>
                      <th>{copy.confidence}</th>
                      <th>{copy.thesis}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.affectedStocks.map((stock) => (
                      <tr key={stock.ticker}>
                        <td>
                          <strong>{stock.ticker}</strong>
                          <span>{stock.company}</span>
                        </td>
                        <td>
                          <span className={`${styles.directionBadge} ${styles[stock.direction]}`}>{stock.directionLabel}</span>
                        </td>
                        <td>{stock.actionLabel}</td>
                        <td>{stock.expectedMovePct > 0 ? "+" : ""}{stock.expectedMovePct}%</td>
                        <td>{stock.confidenceLabel}</td>
                        <td>{stock.thesis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className={styles.detailGrid}>
              <section className={styles.reportSection}>
                <h3>{copy.stagesTitle}</h3>
                <ol className={styles.stageList}>
                  {run.stages.map((stage) => (
                    <li key={stage.id}>
                      <span>{String(stage.order).padStart(2, "0")}</span>
                      <div>
                        <strong>{stage.title}</strong>
                        <p>{stage.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className={styles.reportSection}>
                <h3>{copy.deliveryTitle}</h3>
                <ul className={styles.receiptList}>
                  {run.delivery.map((item) => (
                    <li key={`${item.channel}-${item.timestampUtc}`}>
                      <strong>{item.channel}</strong>
                      <span>{item.status} · {item.provider}</span>
                      <p>{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className={styles.reportSection}>
              <h3>{copy.limitationsTitle}</h3>
              <ul className={styles.limitList}>
                {run.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.kicker}>{copy.receipts}</p>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyCopy}</p>
          </div>
        )}

        <section className={styles.liveBox}>
          <div className={styles.liveHead}>
            <h3>{copy.liveMessagesTitle}</h3>
            <span>{wsStatusLabel}</span>
          </div>
          {messages.length > 0 ? (
            <ul className={styles.messageList}>
              {messages.map((message, index) => (
                <li key={`${message}-${index}`}>
                  <code>{message}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noMessages}>{copy.noMessages}</p>
          )}
        </section>
      </section>
    </div>
  );
}
