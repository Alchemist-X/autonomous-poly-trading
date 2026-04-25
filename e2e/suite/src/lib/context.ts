import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ScenarioContext, EnvironmentProfile } from "../types.js";
import { ensureDir, resetDir } from "./fs.js";

function resolveRepoRoot() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../../..");
}

function resolveArtifactsRoot(repoRoot: string) {
  return path.join(repoRoot, "E2E Test Driven Development", "artifacts");
}

function parseList(value: string | undefined): string[] {
  return value
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

export async function createScenarioContext(profile: EnvironmentProfile): Promise<ScenarioContext> {
  const repoRoot = resolveRepoRoot();
  const artifactsRoot = resolveArtifactsRoot(repoRoot);
  const profileRoot = path.join(artifactsRoot, profile, new Date().toISOString().replaceAll(":", "-"));
  await ensureDir(artifactsRoot);
  await resetDir(profileRoot);

  return {
    repoRoot,
    profile,
    baseUrls: {
      web: process.env.AUTOPOLY_E2E_WEB_URL ?? "",
      orchestrator: process.env.AUTOPOLY_E2E_ORCHESTRATOR_URL,
      executor: process.env.AUTOPOLY_E2E_EXECUTOR_URL
    },
    credentials: {
      adminPassword: process.env.AUTOPOLY_E2E_ADMIN_PASSWORD ?? "autopoly-e2e-admin",
      orchestratorToken: process.env.AUTOPOLY_E2E_ORCHESTRATOR_TOKEN ?? "autopoly-e2e-token"
    },
    featureFlags: {
      allowRealTrading: process.env.ALLOW_REAL_TRADING === "1",
      allowDestructiveAdmin: process.env.AUTOPOLY_E2E_ALLOW_DESTRUCTIVE_ADMIN === "1",
      remoteEnabled: process.env.AUTOPOLY_E2E_REMOTE === "1"
    },
    artifactDir: profileRoot,
    liveTradeBudget: Number(process.env.MAX_LIVE_TRADE_USD ?? "1"),
    allowlistedMarketSlugs: parseList(process.env.AUTOPOLY_E2E_ALLOWED_MARKETS),
    timeouts: {
      startupMs: Number(process.env.AUTOPOLY_E2E_STARTUP_TIMEOUT_MS ?? "90000"),
      pollingMs: Number(process.env.AUTOPOLY_E2E_POLLING_TIMEOUT_MS ?? "15000"),
      browserMs: Number(process.env.AUTOPOLY_E2E_BROWSER_TIMEOUT_MS ?? "45000")
    }
  };
}
