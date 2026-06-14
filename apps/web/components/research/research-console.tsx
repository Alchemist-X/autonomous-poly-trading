"use client";

// Top-level client orchestrator for the Deep Research page. Owns the input
// composer, kicks off the SSE stream, and lays out the live visualisation:
// state-machine legend → staged timeline → final charts. Conversational and
// progressive — nothing below the composer exists until a run starts.

import { useState } from "react";
import { DEFAULT_TIER, NORN_TIER_LIST, type NornTier } from "@autopoly/norns";
import styles from "./research.module.css";
import { useResearchStream } from "../../lib/research/use-research-stream";
import { StateMachineLegend } from "./state-machine-legend";
import { StageTimeline } from "./stage-timeline";
import { ResultCharts } from "./result-charts";
import { SAMPLE_CASES, type SampleCase } from "../../lib/research/sample-cases";

const DRIVER_LABEL: Record<string, string> = {
  mock: "MOCK",
  api: "API · Chain B",
  vps: "VPS · Chain A"
};

// tier id → display label, derived from the canonical Norns table.
const TIER_LABEL: Record<string, string> = Object.fromEntries(
  NORN_TIER_LIST.map((spec) => [spec.tier, spec.label])
);

export function ResearchConsole() {
  const { state, start, reset } = useResearchStream();
  const [eventText, setEventText] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [tier, setTier] = useState<NornTier>(DEFAULT_TIER);

  const running = state.phase === "running";
  const started = state.phase !== "idle";

  const submit = () => {
    const trimmed = eventText.trim();
    if (!trimmed || running) {
      return;
    }
    const parsedMarket = marketPrice.trim() === "" ? null : Number(marketPrice);
    void start({
      eventText: trimmed,
      marketPrice: Number.isFinite(parsedMarket as number) ? parsedMarket : null,
      tier
    });
  };

  // Cached example: populate the composer for transparency, then run it right
  // away so one click goes input → streamed steps → charts with no extra step.
  const runSample = (sample: SampleCase) => {
    if (running) {
      return;
    }
    const runTier = sample.tier ?? tier;
    setEventText(sample.eventText);
    setMarketPrice(String(sample.marketPrice));
    if (sample.tier) {
      setTier(sample.tier);
    }
    void start({ eventText: sample.eventText, marketPrice: sample.marketPrice, tier: runTier });
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <>
      <section className={styles.hero}>
        <p className={styles.heroKicker}>Forecasting Engine</p>
        <h1 className={styles.heroTitle}>把一个未来事件,变成可审计的概率。</h1>
        <p className={styles.heroSub}>
          用自然语言提出一个可被验证的二元问题。研究 agent 会分七步公开它的推理:理清定义 ·
          条件拆解 · 证据收集与权重 · 条件概率模型 · 贝叶斯更新 · 结论与置信区间。
        </p>
      </section>

      <div className={styles.composer}>
        <textarea
          className={styles.composerInput}
          placeholder="例如:某事件会在某个截止日期前发生吗?"
          value={eventText}
          onChange={(event) => setEventText(event.target.value)}
          onKeyDown={onComposerKeyDown}
          rows={2}
          disabled={running}
        />
        <div className={styles.tierRow}>
          <span className={styles.tierRowLabel}>推理深度</span>
          <div className={styles.tierGroup} role="radiogroup" aria-label="推理深度档位 (Norns)">
            {NORN_TIER_LIST.map((spec) => (
              <button
                key={spec.tier}
                type="button"
                role="radio"
                aria-checked={tier === spec.tier}
                className={`${styles.tierChip} ${tier === spec.tier ? styles.tierChipActive : ""}`}
                onClick={() => setTier(spec.tier)}
                disabled={running}
                title={spec.blurb}
              >
                {spec.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.composerRow}>
          <label className={styles.marketField}>
            市场隐含概率(可选)
            <input
              className={styles.marketInput}
              inputMode="decimal"
              placeholder="0.30"
              value={marketPrice}
              onChange={(event) => setMarketPrice(event.target.value)}
              disabled={running}
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {started && !running ? (
              <button type="button" className={styles.secondaryBtn} onClick={reset}>
                重新开始
              </button>
            ) : null}
            <button type="button" className={styles.runBtn} onClick={submit} disabled={running || !eventText.trim()}>
              {running ? "研究中…" : "开始研究"}
            </button>
          </div>
        </div>
        {!started ? (
          <div className={styles.examples}>
            <span className={styles.examplesHint}>已缓存示例 · 点击直接运行</span>
            {SAMPLE_CASES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className={styles.exampleChip}
                onClick={() => runSample(sample)}
                title={sample.eventText}
              >
                {sample.label}
                <span className={styles.exampleChipSub}>{sample.blurb}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {started ? (
        <>
          <div className={styles.questionBubble}>
            <span className={styles.questionBubbleInner}>{state.eventText}</span>
          </div>

          {state.driver ? (
            <div className={styles.runMeta}>
              {state.tier ? <span className={styles.tierPill}>{TIER_LABEL[state.tier] ?? state.tier}</span> : null}
              <span className={styles.driverPill}>{DRIVER_LABEL[state.driver] ?? state.driver}</span>
            </div>
          ) : null}

          {state.notices.map((notice, index) => (
            <div
              key={`${index}-${notice.message.slice(0, 16)}`}
              className={`${styles.notice} ${notice.level === "warn" ? styles.noticeWarn : styles.noticeInfo}`}
            >
              {notice.message}
            </div>
          ))}

          <StateMachineLegend phase={state.phase} stages={state.stages} />

          {state.error ? <div className={styles.errorBox}>研究失败:{state.error}</div> : null}

          <StageTimeline state={state} />
          <ResultCharts state={state} />
        </>
      ) : null}
    </>
  );
}
