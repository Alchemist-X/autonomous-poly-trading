"use client";

import { useState, useTransition } from "react";

async function postAction(path: string) {
  const response = await fetch(path, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export function AdminConsole() {
  const [message, setMessage] = useState("No action executed yet.");
  const [pending, startTransition] = useTransition();

  function run(path: string) {
    startTransition(() => {
      void postAction(path)
        .then((result) => {
          setMessage(JSON.stringify(result, null, 2));
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : String(error));
        });
    });
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Admin Console</p>
          <h2>Protected internal controls</h2>
        </div>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="ghost-button">Logout</button>
        </form>
      </div>

      <div className="admin-actions">
        <button onClick={() => run("/api/admin/pause")} disabled={pending}>Pause</button>
        <button onClick={() => run("/api/admin/resume")} disabled={pending}>Resume</button>
        <button onClick={() => run("/api/admin/run-now")} disabled={pending}>Run Now</button>
        <button onClick={() => run("/api/admin/cancel-open-orders")} disabled={pending}>Cancel Open Orders</button>
        <button onClick={() => run("/api/admin/flatten")} disabled={pending}>Flatten</button>
      </div>

      <pre className="admin-result">{message}</pre>
    </section>
  );
}
