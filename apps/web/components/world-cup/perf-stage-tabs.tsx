"use client";

import { useState, type ReactNode } from "react";
import styles from "./world-cup.module.css";

// Stage switcher for the 预测效果 page: group stage vs knockout. Both panels are
// server-rendered (SSG) and arrive as props; this component only toggles which
// panel is visible — no data fetching, no client-side recomputation.

export interface PerfStageTab {
  readonly key: string;
  readonly label: string;
  readonly content: ReactNode;
}

export function PerfStageTabs({ ariaLabel, tabs }: { ariaLabel: string; tabs: readonly PerfStageTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "");
  return (
    <div>
      <div className={styles.perfStageTabs} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeKey}
            className={`${styles.perfStageTab} ${tab.key === activeKey ? styles.perfStageTabActive : ""}`}
            onClick={() => setActiveKey(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={tab.key !== activeKey}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
