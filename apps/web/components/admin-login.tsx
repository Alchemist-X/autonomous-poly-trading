export function AdminLogin() {
  return (
    <section className="panel admin-login">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Admin</p>
          <h2>Enter spectator control mode</h2>
        </div>
      </div>
      <form action="/api/admin/session" method="post" className="admin-form">
        <label>
          Password
          <input type="password" name="password" placeholder="Admin password" required />
        </label>
        <button type="submit">Unlock</button>
      </form>
    </section>
  );
}

