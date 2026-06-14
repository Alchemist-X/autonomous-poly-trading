"use client";

// Manus-style staged flow. Exactly one stage is "active" and expanded with its
// streaming progress lines and live artifacts; completed stages collapse to a
// one-line outcome (de-emphasised, expandable); pending stages are dimmed.

import styles from "./research.module.css";
import { formatDuration, signedPoints } from "../../lib/research/format";
import type { ResearchState, ResearchStageState } from "../../lib/research/state-machine";
import type {
  PredictionEvidence,
  PredictionModelNode,
  PredictionUpdate
} from "../../lib/prediction-engine-demo";

const STANCE_CLASS: Record<PredictionEvidence["stance"], string | undefined> = {
  support: styles.stanceSupport,
  oppose: styles.stanceOppose,
  mixed: styles.stanceMixed,
  neutral: styles.stanceNeutral
};

const STANCE_LABEL: Record<PredictionEvidence["stance"], string> = {
  support: "支持",
  oppose: "反对",
  mixed: "中性",
  neutral: "边界"
};

function EvidenceRows({ items }: { items: PredictionEvidence[] }) {
  return (
    <div className={styles.liveList}>
      {items.map((item) => (
        <div key={item.id} className={styles.liveRow}>
          <span className={`${styles.stance} ${STANCE_CLASS[item.stance]}`}>{STANCE_LABEL[item.stance]}</span>
          <span className={styles.liveTitle}>{item.title}</span>
          <span className={`${styles.liveWeight} ${item.weightPct >= 0 ? styles.weightPos : styles.weightNeg}`}>
            {signedPoints(item.weightPct)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModelRows({ items }: { items: PredictionModelNode[] }) {
  return (
    <div className={styles.liveList}>
      {items.map((node) => (
        <div key={node.id} className={styles.liveRow}>
          <span className={`${styles.stance} ${styles.stanceNeutral}`}>{node.id}</span>
          <span className={styles.liveTitle}>{node.label}</span>
          <span className={styles.liveWeight}>{(node.probability * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function UpdateRows({ items }: { items: PredictionUpdate[] }) {
  return (
    <div className={styles.liveList}>
      {items.map((update) => (
        <div key={update.label} className={styles.liveRow}>
          <span className={styles.liveTitle}>{update.label}</span>
          <span className={styles.liveWeight}>
            {(update.from * 100).toFixed(0)}% → {(update.to * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// Which streamed artifacts belong in a given stage's live panel.
function liveArtifacts(stageId: string, state: ResearchState) {
  if (stageId === "evidence" || stageId === "weighting") {
    return state.evidence.length > 0 ? <EvidenceRows items={state.evidence} /> : null;
  }
  if (stageId === "model") {
    return state.model.length > 0 ? <ModelRows items={state.model} /> : null;
  }
  if (stageId === "bayes") {
    return state.updates.length > 0 ? <UpdateRows items={state.updates} /> : null;
  }
  return null;
}

function StageCard({ stage, state }: { stage: ResearchStageState; state: ResearchState }) {
  const isActive = stage.status === "active";
  const isComplete = stage.status === "complete";
  const cardClass = `${styles.stage} ${
    isActive ? styles.stageActive : stage.status === "pending" ? styles.stagePending : ""
  }`;
  const badgeClass = `${styles.stageBadge} ${
    isActive ? styles.stageBadgeActive : isComplete ? styles.stageBadgeComplete : ""
  }`;

  return (
    <div className={cardClass}>
      <div className={styles.stageHead}>
        <span className={badgeClass}>{isComplete ? "✓" : stage.order}</span>
        <div>
          <h3 className={styles.stageTitle}>{stage.title}</h3>
          {!isComplete ? <p className={styles.stageSummary}>{stage.summary}</p> : null}
        </div>
        {stage.durationMs ? <span className={styles.stageMeta}>{formatDuration(stage.durationMs)}</span> : null}
      </div>

      {isActive ? (
        <div className={styles.stageBody}>
          <div className={styles.progressLines}>
            {stage.progressLines.map((line, index) => (
              <span key={`${stage.id}-${index}`} className={styles.progressLine}>
                {line}
              </span>
            ))}
          </div>
          {liveArtifacts(stage.id, state)}
        </div>
      ) : null}

      {isComplete && stage.outcome ? (
        <div className={styles.outcomeRow}>
          <span className={styles.outcomeIcon}>✓</span>
          <span>
            {stage.outcome}
            {stage.artifactLabel ? <span className={styles.artifactTag}>{stage.artifactLabel}</span> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function StageTimeline({ state }: { state: ResearchState }) {
  if (state.stages.length === 0) {
    return null;
  }
  return (
    <div className={styles.timeline}>
      {state.stages.map((stage) => (
        <StageCard key={stage.id} stage={stage} state={state} />
      ))}
    </div>
  );
}
