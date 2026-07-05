import { WorldCupHeader } from "../world-cup/wc-header";
import { LegalFooter } from "../world-cup/legal-footer";
import { DEFAULT_STOCK_WATCHLIST } from "../../lib/stock-news-impact";
import { t, type Locale, type StrKey } from "../../lib/world-cup/i18n";
import { StockNewsConsole, type StockNewsConsoleCopy } from "./stock-news-console";
import styles from "./stock-news.module.css";

function tx(locale: Locale, key: StrKey): string {
  return t(locale, key);
}

function buildCopy(locale: Locale): StockNewsConsoleCopy {
  return {
    newsLabel: tx(locale, "sniNewsLabel"),
    newsHelp: tx(locale, "sniNewsHelp"),
    bodyLabel: tx(locale, "sniBodyLabel"),
    bodyHelp: tx(locale, "sniBodyHelp"),
    sourceLabel: tx(locale, "sniSourceLabel"),
    sourcePlaceholder: tx(locale, "sniSourcePlaceholder"),
    urlLabel: tx(locale, "sniUrlLabel"),
    urlPlaceholder: tx(locale, "sniUrlPlaceholder"),
    watchlistLabel: tx(locale, "sniWatchlistLabel"),
    watchlistHelp: tx(locale, "sniWatchlistHelp"),
    emailsLabel: tx(locale, "sniEmailsLabel"),
    emailsHelp: tx(locale, "sniEmailsHelp"),
    emailPlaceholder: tx(locale, "sniEmailPlaceholder"),
    topicLabel: tx(locale, "sniTopicLabel"),
    topicHelp: tx(locale, "sniTopicHelp"),
    wsUrlLabel: tx(locale, "sniWsUrlLabel"),
    wsHelp: tx(locale, "sniWsHelp"),
    connect: tx(locale, "sniConnect"),
    disconnect: tx(locale, "sniDisconnect"),
    wsIdle: tx(locale, "sniWsIdle"),
    wsConnecting: tx(locale, "sniWsConnecting"),
    wsConnected: tx(locale, "sniWsConnected"),
    wsClosed: tx(locale, "sniWsClosed"),
    wsError: tx(locale, "sniWsError"),
    sample: tx(locale, "sniSample"),
    analyze: tx(locale, "sniAnalyze"),
    analyzing: tx(locale, "sniAnalyzing"),
    errorPrefix: tx(locale, "sniErrorPrefix"),
    emptyTitle: tx(locale, "sniEmptyTitle"),
    emptyCopy: tx(locale, "sniEmptyCopy"),
    reportTitle: tx(locale, "sniReportTitle"),
    summaryTitle: tx(locale, "sniSummaryTitle"),
    affectedTitle: tx(locale, "sniAffectedTitle"),
    stagesTitle: tx(locale, "sniStagesTitle"),
    deliveryTitle: tx(locale, "sniDeliveryTitle"),
    limitationsTitle: tx(locale, "sniLimitationsTitle"),
    liveMessagesTitle: tx(locale, "sniLiveMessagesTitle"),
    ticker: tx(locale, "sniTicker"),
    direction: tx(locale, "sniDirection"),
    action: tx(locale, "sniAction"),
    expectedMove: tx(locale, "sniExpectedMove"),
    confidence: tx(locale, "sniConfidence"),
    thesis: tx(locale, "sniThesis"),
    risk: tx(locale, "sniRisk"),
    receipts: tx(locale, "sniReceipts"),
    noMessages: tx(locale, "sniNoMessages")
  };
}

function defaultWsUrl(): string {
  return process.env.NEXT_PUBLIC_STOCK_NEWS_WS_URL
    || `ws://127.0.0.1:${process.env.STOCK_NEWS_WS_PORT || "8791"}/ws`;
}

export function StockNewsProductPage({ locale }: { locale: Locale }) {
  const consoleLocale = locale === "en" ? "en" : "zh";
  const copy = buildCopy(locale);
  return (
    <div className={styles.pageShell}>
      <WorldCupHeader />
      <main className={styles.container}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{tx(locale, "sniKicker")}</p>
            <h1>{tx(locale, "sniTitle")}</h1>
            <p className={styles.heroCopy}>{tx(locale, "sniSub")}</p>
          </div>
          <dl className={styles.metricRail}>
            <div>
              <dt>{tx(locale, "sniMetric1")}</dt>
              <dd>{tx(locale, "sniMetric1Value")}</dd>
            </div>
            <div>
              <dt>{tx(locale, "sniMetric2")}</dt>
              <dd>{tx(locale, "sniMetric2Value")}</dd>
            </div>
            <div>
              <dt>{tx(locale, "sniMetric3")}</dt>
              <dd>{tx(locale, "sniMetric3Value")}</dd>
            </div>
          </dl>
        </section>

        <StockNewsConsole
          locale={consoleLocale}
          copy={copy}
          defaults={{
            headline: tx(locale, "sniSampleHeadline"),
            body: tx(locale, "sniSampleBody"),
            watchlist: DEFAULT_STOCK_WATCHLIST.join(", "),
            topic: tx(locale, "sniTopicDefault"),
            wsUrl: defaultWsUrl()
          }}
        />
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
