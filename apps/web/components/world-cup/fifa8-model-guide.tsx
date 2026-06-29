"use client";

import { useState } from "react";
import type { ForecasterMeta, ForecasterFamily } from "../../lib/world-cup/fifa8-store";
import { t, type Locale, type StrKey } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// "How the models work" guide for the knockout list page. An accessible
// disclosure: a button toggles an inline panel that explains each of the nine
// forecasters — how it predicts and which market-blind FIFA stats it leans on.
// The list is driven by getForecasterMeta() (id + name + family); each plain-
// language explanation is pulled from an i18n key map keyed by forecaster id,
// so the copy stays localized and never hardcoded. No prices anywhere.

// Per-forecaster explanation, keyed by the stable forecaster id. Any id without
// an entry simply omits its description (defensive — the nine shipped ids all
// have copy below in en + zh-CN).
const MODEL_KEY: Record<string, StrKey> = {
  "dixon-coles-bayes": "kgDixonColes",
  "xg-elo": "kgXgElo",
  prodegy: "kgProdegy",
  "fatigue-elo": "kgFatigueElo",
  "tactical-melo": "kgTacticalMelo",
  "linebreak-gbm": "kgLinebreakGbm",
  "passnet-rf": "kgPassnetRf",
  "stacked-ensemble": "kgStackedEnsemble",
  multicalibrated: "kgMulticalibrated"
};

// Family chip label — names the broad approach so the list groups visually.
const FAMILY_KEY: Record<ForecasterFamily, StrKey> = {
  statistical: "kgFamilyStatistical",
  elo: "kgFamilyElo",
  ml: "kgFamilyMl",
  ensemble: "kgFamilyEnsemble"
};

export function Fifa8ModelGuide({
  meta,
  locale
}: {
  meta: readonly ForecasterMeta[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const panelId = "fifa8-model-guide-panel";

  return (
    <div className={styles.kgWrap}>
      <button
        type="button"
        className={styles.kgTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className={styles.kgTriggerIcon} aria-hidden>
          ⓘ
        </span>
        {open ? t(locale, "kgHide") : t(locale, "kgTrigger")}
      </button>

      {open ? (
        <div id={panelId} className={styles.kgPanel}>
          <p className={styles.kgIntro}>{t(locale, "kgIntro")}</p>
          <ul className={styles.kgList}>
            {meta.map((m) => {
              const descKey = MODEL_KEY[m.id];
              return (
                <li key={m.id} className={styles.kgItem}>
                  <div className={styles.kgItemHead}>
                    <span className={styles.kgName}>{m.name}</span>
                    <span className={styles.kgFamily}>{t(locale, FAMILY_KEY[m.family])}</span>
                  </div>
                  <p className={styles.kgDesc}>{descKey ? t(locale, descKey) : m.name}</p>
                </li>
              );
            })}
          </ul>
          <p className={styles.kgFooter}>{t(locale, "kgFooter")}</p>
        </div>
      ) : null}
    </div>
  );
}
