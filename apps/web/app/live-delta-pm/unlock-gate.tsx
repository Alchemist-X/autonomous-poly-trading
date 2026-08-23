// Invite-code gate shown before the Delta PM audit page. Mirrors the /invite
// look (auth-* classes from globals.css); the code is checked server-side by
// /api/live-delta-pm/unlock.
export function UnlockGate({ showError }: { showError: boolean }) {
  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <span className="auth-kicker">Private audit</span>
        <h1>Delta PM 决策链审计</h1>
        <p>这是美股影子交易系统的内部审计页。输入访问码解锁（与 /engine 门相同的口令）。</p>
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
          <button type="submit">解锁 Unlock</button>
        </form>
        {showError ? <p className="auth-error">访问码不对，再试一次。</p> : null}
      </div>
    </section>
  );
}
