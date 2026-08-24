import type { Lang } from "../../lib/live-predict-raven/i18n";
import { otherLang, t } from "../../lib/live-predict-raven/i18n";
import styles from "./report.module.css";

// Invite-code gate shown before the paper-trading review page. Mirrors the
// /invite look (auth-* classes from globals.css); the code is checked
// server-side by /api/live-predict-raven/unlock.
export function UnlockGate({ showError, lang }: { showError: boolean; lang: Lang }) {
  const tt = t(lang);
  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <div className={styles.gateTop}>
          <span className="auth-kicker">Private review</span>
          <a className={styles.langToggle} href={`/live-predict-raven/lang?to=${otherLang(lang)}`}>
            {tt("langToggle")}
          </a>
        </div>
        <h1>{tt("gateTitle")}</h1>
        <p>{tt("gateBody")}</p>
        <form action="/api/live-predict-raven/unlock" method="post" className="auth-form">
          <label htmlFor="lpr-code">Access code</label>
          <input
            id="lpr-code"
            name="code"
            type="password"
            autoComplete="one-time-code"
            maxLength={128}
            required
            autoFocus
          />
          <button type="submit">{tt("gateSubmit")}</button>
        </form>
        {showError ? <p className="auth-error">{tt("gateError")}</p> : null}
      </div>
    </section>
  );
}
