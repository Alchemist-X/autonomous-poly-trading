"use client";

// Beta gate for the public Deep Research console. A small button opens a
// password modal; the correct password routes to /research. This is a soft beta
// gate (client-side), not real auth — it keeps the console out of the way of
// casual visitors during the beta. All copy is passed in already-localized.

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./world-cup.module.css";

const BETA_PASSWORD = "forecast";

export interface BetaLabels {
  button: string;
  title: string;
  desc: string;
  placeholder: string;
  enter: string;
  cancel: string;
  wrong: string;
}

export function BetaAccess({ labels, target }: { labels: BetaLabels; target: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setWrong(false);
  };

  const submit = () => {
    if (password.trim() === BETA_PASSWORD) {
      router.push(target);
      return;
    }
    setWrong(true);
  };

  return (
    <>
      <button type="button" className={styles.betaBtn} onClick={() => setOpen(true)}>
        {labels.button}
      </button>

      {open ? (
        <div className={styles.betaOverlay} role="dialog" aria-modal="true" onClick={close}>
          <div className={styles.betaModal} onClick={(event) => event.stopPropagation()}>
            <h3 className={styles.betaModalTitle}>{labels.title}</h3>
            <p className={styles.betaModalDesc}>{labels.desc}</p>
            <input
              className={styles.betaInput}
              type="password"
              autoFocus
              placeholder={labels.placeholder}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setWrong(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submit();
                }
              }}
            />
            {wrong ? <p className={styles.betaError}>{labels.wrong}</p> : null}
            <div className={styles.betaActions}>
              <button type="button" className={styles.betaCancel} onClick={close}>
                {labels.cancel}
              </button>
              <button type="button" className={styles.betaEnter} onClick={submit}>
                {labels.enter}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
