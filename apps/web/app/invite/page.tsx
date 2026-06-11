import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPredictionAccessState } from "../../lib/prediction-access";

export const metadata: Metadata = {
  title: "Invite — Prediction Engine",
  description: "Activate hosted prediction-engine access with an invite code."
};

export default async function InvitePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getPredictionAccessState();
  if (access.mode === "unauthenticated") {
    redirect("/sign-in?next=/invite");
  }
  if (access.mode === "ready") {
    redirect("/prediction-engine");
  }

  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : null;

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <span className="auth-kicker">Invite required</span>
        <h1>Activate access</h1>
        <p>
          当前账号已登录，但还没有预测引擎运行权限。输入邀请码后会启用个人 quota。
        </p>
        <form action="/api/invite/accept" method="post" className="auth-form">
          <label htmlFor="invite-code">Invite code</label>
          <input id="invite-code" name="code" autoComplete="one-time-code" required />
          <button type="submit">Activate</button>
        </form>
        {error ? <p className="auth-error">{error}</p> : null}
        <Link href="/prediction-engine">Back to prediction engine</Link>
      </div>
    </section>
  );
}
