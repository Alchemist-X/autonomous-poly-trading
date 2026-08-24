// Invite-code gate shown before the Delta PM audit page. Mirrors the /invite
// look (auth-* classes from globals.css); the code is checked server-side by
// /api/live-delta-pm/unlock. The EN/中文 toggle is a plain link to the lang
// route (globals.css is shared, so its style stays inline here).
import { LANG_TOGGLE_LABEL, otherLang, t, type Lang } from "../../lib/live-delta-pm/i18n";

const toggleStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(232, 236, 244, 0.64)",
  textDecoration: "underline",
  textUnderlineOffset: 3
};

export function UnlockGate({ showError, lang }: { showError: boolean; lang: Lang }) {
  const s = t(lang);
  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span className="auth-kicker">Private audit</span>
          <a href={`/live-delta-pm/lang?to=${otherLang(lang)}`} style={toggleStyle}>
            {LANG_TOGGLE_LABEL[lang]}
          </a>
        </div>
        <h1>{s("title")}</h1>
        <p>{s("gateIntro")}</p>
        <form action="/api/live-delta-pm/unlock" method="post" className="auth-form">
          <label htmlFor="ldp-code">Access code</label>
          <input
            id="ldp-code"
            name="code"
            type="password"
            autoComplete="one-time-code"
            maxLength={128}
            required
            autoFocus
          />
          <button type="submit">{s("gateUnlock")}</button>
        </form>
        {showError ? <p className="auth-error">{s("gateError")}</p> : null}
      </div>
    </section>
  );
}
