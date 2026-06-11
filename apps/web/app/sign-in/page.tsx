import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isOidcConfigured, signIn } from "../../auth";

export const metadata: Metadata = {
  title: "Sign in — Prediction Engine",
  description: "OpenID Connect sign-in for the hosted prediction engine."
};

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = params?.next;
  const redirectTo = typeof nextParam === "string" && nextParam.startsWith("/")
    ? nextParam
    : "/prediction-engine";
  const configured = isOidcConfigured() && Boolean(process.env.AUTH_SECRET?.trim());
  if (configured) {
    const session = await auth();
    if (session?.user) {
      redirect("/prediction-engine");
    }
  }

  async function signInWithOidc() {
    "use server";
    await signIn("oidc", { redirectTo });
  }

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <span className="auth-kicker">Prediction Engine</span>
        <h1>Sign in</h1>
        <p>
          使用 OpenID Connect 登录后才能运行托管预测任务。新用户还需要邀请码激活。
        </p>
        {configured ? (
          <form action={signInWithOidc}>
            <button type="submit">Continue with OpenID</button>
          </form>
        ) : (
          <div className="auth-warning">
            <strong>OIDC is not configured</strong>
            <p>需要配置 `OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET` 和 `AUTH_SECRET`。</p>
          </div>
        )}
      </div>
    </section>
  );
}
