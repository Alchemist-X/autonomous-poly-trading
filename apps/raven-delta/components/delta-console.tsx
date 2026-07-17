"use client";

// Raven Delta console — intake form + report + live WS feed, one page.

import { useState, type FormEvent } from "react";
import type { DeltaRun } from "../lib/analyzer/schema";
import { withBasePath } from "../lib/base-path";
import { useLocale, useT } from "../lib/i18n";
import { ReportView } from "./report-view";
import { WsPanel } from "./ws-panel";

const SAMPLE = {
  en: {
    text: "OpenAI announces a $40B multi-year cloud and GPU capacity agreement with Microsoft, Nvidia, and Oracle\n\nThe agreement expands AI data-center capacity through 2028. Management says demand for Blackwell-class GPUs remains above prior internal forecasts, while power availability is the main constraint.",
    url: "https://www.reuters.com/technology/openai-40b-capacity-agreement-sample"
  },
  zh: {
    text: "OpenAI 宣布与 Microsoft、Nvidia、Oracle 签署 400 亿美元多年云与 GPU 产能协议\n\n该协议将 AI 数据中心产能扩展至 2028 年。管理层称 Blackwell 级 GPU 需求高于此前内部预测，电力供给是主要约束。",
    url: "https://www.reuters.com/technology/openai-40b-capacity-agreement-sample"
  }
} as const;

interface ConsoleProps {
  engine: string;
  universeSize: number;
  universeVersion: string;
}

export function DeltaConsole({ engine, universeSize, universeVersion }: ConsoleProps) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [emails, setEmails] = useState("");
  const [topic, setTopic] = useState("delta");
  const [run, setRun] = useState<DeltaRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function loadSample() {
    const sample = SAMPLE[locale];
    setText(sample.text);
    setUrl(sample.url);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Hand-written fetch URLs are not basePath-prefixed by Next; do it here.
      const response = await fetch(withBasePath("/api/analyze"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          url: url || undefined,
          locale,
          push: { emails, wsTopic: topic }
        })
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : `HTTP ${response.status}`;
        throw new Error(message);
      }
      setRun(payload as DeltaRun);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dl">
      <header className="dl-hdr">
        <span className="dl-brand">
          Raven<span className="dl-brand-delta">Delta</span>
          <span className="dl-brand-tag">{t("heroKicker")}</span>
        </span>
        <span className="dl-hdr-right">
          <span className="dl-engine-badge">
            {t("engineLabel")}: {engine} · {t("demoBadge")}
          </span>
          <button type="button" className="dl-lang" onClick={() => setLocale(locale === "en" ? "zh" : "en")}>
            {t("langToggle")}
          </button>
        </span>
      </header>

      <main className="dl-main">
        <section className="dl-hero">
          <div>
            <p className="dl-kicker">{t("heroKicker")}</p>
            <h1>{t("heroTitle")}</h1>
            <p className="dl-hero-sub">{t("heroSub")}</p>
          </div>
          <dl className="dl-metrics">
            <div>
              <dt>{t("metricUniverse")}</dt>
              <dd>
                {universeSize} · v{universeVersion}
              </dd>
            </div>
            <div>
              <dt>{t("metricFocus")}</dt>
              <dd>{t("metricFocusValue")}</dd>
            </div>
            <div>
              <dt>{t("metricPush")}</dt>
              <dd>{t("metricPushValue")}</dd>
            </div>
          </dl>
        </section>

        <div className="dl-console">
          <form className="dl-panel dl-form" onSubmit={submit}>
            <div className="dl-form-top">
              <h2 className="dl-panel-title">{t("formTitle")}</h2>
              <button type="button" className="dl-btn" onClick={loadSample}>
                {t("sampleButton")}
              </button>
            </div>

            <div className="dl-field">
              <label htmlFor="dl-text">{t("textLabel")}</label>
              <textarea
                id="dl-text"
                rows={7}
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-describedby="dl-text-help"
              />
              <p id="dl-text-help">{t("textHelp")}</p>
            </div>

            <div className="dl-field">
              <label htmlFor="dl-url">{t("urlLabel")}</label>
              <input id="dl-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" />
            </div>

            <div className="dl-field">
              <label htmlFor="dl-emails">{t("emailsLabel")}</label>
              <input
                id="dl-emails"
                value={emails}
                onChange={(event) => setEmails(event.target.value)}
                placeholder="pm@example.com, desk@example.com"
                aria-describedby="dl-emails-help"
              />
              <p id="dl-emails-help">{t("emailsHelp")}</p>
            </div>

            <div className="dl-field">
              <label htmlFor="dl-topic">{t("topicLabel")}</label>
              <input id="dl-topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
            </div>

            {error ? (
              <p className="dl-error" role="alert">
                {t("errorPrefix")} {error}
              </p>
            ) : null}

            <button type="submit" className="dl-btn dl-btn-primary" disabled={loading || !text.trim()} aria-busy={loading}>
              {loading ? t("analyzingButton") : t("analyzeButton")}
            </button>
            {loading ? <p className="dl-hint">{t("analyzingHint")}</p> : null}
          </form>

          <div className="dl-report">
            {run ? (
              <ReportView run={run} />
            ) : (
              <section className="dl-panel dl-empty">
                <h2>{t("emptyTitle")}</h2>
                <p>{t("emptyCopy")}</p>
              </section>
            )}
            <WsPanel topic={topic} />
          </div>
        </div>
      </main>

      <footer className="dl-ftr">{t("footerNote")}</footer>
    </div>
  );
}
