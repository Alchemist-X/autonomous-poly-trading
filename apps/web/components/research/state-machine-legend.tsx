"use client";

// Visualises the state machine itself: the run-phase pill plus a left-to-right
// track of the stage statuses (pending → active → complete). This is the live
// picture of where the machine in `state-machine.ts` currently sits.

import styles from "./research.module.css";
import { c, type ConsoleStringKey } from "../../lib/research/i18n";
import type { ConsoleLocale } from "../../lib/research/locale";
import type { ResearchPhase, ResearchStageState } from "../../lib/research/state-machine";

const PHASE_KEY: Record<ResearchPhase, ConsoleStringKey> = {
  idle: "phaseIdle",
  running: "phaseRunning",
  complete: "phaseComplete",
  error: "phaseError"
};

const PHASE_CLASS: Record<ResearchPhase, string | undefined> = {
  idle: styles.phaseIdle,
  running: styles.phaseRunning,
  complete: styles.phaseComplete,
  error: styles.phaseError
};

export function StateMachineLegend({
  phase,
  stages,
  locale
}: {
  phase: ResearchPhase;
  stages: ResearchStageState[];
  locale: ConsoleLocale;
}) {
  return (
    <div className={styles.machine}>
      <div className={styles.machineTop}>
        <span className={styles.machineLabel}>{c(locale, "machineLabel")}</span>
        <span className={`${styles.phasePill} ${PHASE_CLASS[phase]}`}>{c(locale, PHASE_KEY[phase])}</span>
      </div>
      <div className={styles.machineTrack}>
        {stages.map((stage, index) => {
          const dotClass =
            stage.status === "active"
              ? styles.machineDotActive
              : stage.status === "complete"
                ? styles.machineDotComplete
                : "";
          const labelClass = stage.status === "active" ? styles.machineNodeLabelActive : "";
          return (
            <div key={stage.id} className={styles.machineNode} style={{ flex: index < stages.length - 1 ? "1 1 auto" : "0 0 auto" }}>
              <span className={styles.machineNode}>
                <span className={`${styles.machineDot} ${dotClass}`} />
                <span className={`${styles.machineNodeLabel} ${labelClass}`}>{stage.title}</span>
              </span>
              {index < stages.length - 1 ? <span className={styles.machineArrow} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
