// Invite-code gate shown before the paper-trading review page. Mirrors the
// /invite look (auth-* classes from globals.css); the code is checked
// server-side by /api/live-predict-raven/unlock.
export function UnlockGate({ showError }: { showError: boolean }) {
  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <span className="auth-kicker">Private review</span>
        <h1>Paper trading 复盘</h1>
        <p>这是东京 VM 模拟盘的内部复盘页。输入访问码解锁（与 /engine 门相同的口令）。</p>
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
          <button type="submit">解锁 Unlock</button>
        </form>
        {showError ? <p className="auth-error">访问码不对，再试一次。</p> : null}
      </div>
    </section>
  );
}
