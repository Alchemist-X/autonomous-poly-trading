import type { Metadata } from "next";
import Link from "next/link";
import { PredictionEngineDemo } from "../../components/prediction-engine-demo";
import { buildPredictionDemoRun, DEFAULT_PREDICTION_EVENT } from "../../lib/prediction-engine-demo";
import { getPredictionAccessState } from "../../lib/prediction-access";

export const metadata: Metadata = {
  title: "Prediction Engine Demo",
  description: "A read-only probability research demo that exposes Pulse-style evidence, model, and market-comparison stages."
};

export const dynamic = "force-dynamic";

function AccessPanel({
  kicker,
  title,
  copy,
  href,
  actionLabel,
  details
}: {
  kicker: string;
  title: string;
  copy: string;
  href?: string;
  actionLabel?: string;
  details?: string[];
}) {
  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <span className="auth-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {details?.length ? (
          <div className="auth-warning">
            <strong>Details</strong>
            {details.map((item) => <p key={item}>{item}</p>)}
          </div>
        ) : null}
        {href && actionLabel ? <Link className="auth-link-button" href={href}>{actionLabel}</Link> : null}
      </div>
    </section>
  );
}

export default async function PredictionEnginePage() {
  const access = await getPredictionAccessState();
  if (access.mode === "setup_missing") {
    return (
      <AccessPanel
        kicker="Setup required"
        title="Auth configuration is incomplete"
        copy="Prediction auth is required for this deployment, but the environment is missing required settings."
        details={access.missing?.map((item) => `Missing ${item}`)}
      />
    );
  }
  if (access.mode === "unauthenticated") {
    return (
      <AccessPanel
        kicker="Sign in required"
        title="Run access is gated"
        copy="请先使用 OpenID 登录。登录后，如果是新用户，还需要邀请码激活。"
        href={access.signInUrl}
        actionLabel="Sign in with OpenID"
      />
    );
  }
  if (access.mode === "pending_invite") {
    return (
      <AccessPanel
        kicker="Invite required"
        title="Activate your account"
        copy="这个账号已经登录，但还没有运行预测引擎的权限。输入邀请码后会启用个人 quota。"
        href={access.inviteUrl}
        actionLabel="Enter invite code"
      />
    );
  }
  if (access.mode === "suspended") {
    return (
      <AccessPanel
        kicker="Account suspended"
        title="Access unavailable"
        copy="这个账号当前不能运行预测任务。"
      />
    );
  }

  const initialRun = buildPredictionDemoRun({
    eventText: DEFAULT_PREDICTION_EVENT,
    marketPrice: 30
  });

  return <PredictionEngineDemo initialRun={initialRun} access={access} />;
}
