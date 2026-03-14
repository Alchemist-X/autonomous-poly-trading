import path from "node:path";
import { createArtifact } from "./artifacts.js";
import { waitForHttp } from "./http.js";
import { pickFreePort } from "./network.js";
import { spawnLoggedProcess } from "./process.js";
import { createLocalLiteStateFile } from "./local-lite-state.js";
import { ensureDir } from "./fs.js";
import { startFakeOrchestrator } from "./fake-orchestrator.js";
import type { ScenarioArtifact, ScenarioContext, ScenarioResult } from "../types.js";
import { aggregateStatus, createAssertion, createResult } from "./results.js";

function buildWebEnv(context: ScenarioContext, webPort: number, orchestratorBaseUrl: string, tokenOverride?: string) {
  return {
    ...process.env,
    NODE_ENV: "development",
    APP_URL: `http://127.0.0.1:${webPort}`,
    ADMIN_PASSWORD: context.credentials.adminPassword,
    ORCHESTRATOR_INTERNAL_URL: orchestratorBaseUrl,
    ORCHESTRATOR_INTERNAL_TOKEN: tokenOverride ?? context.credentials.orchestratorToken,
    AUTOPOLY_E2E_STATE_FILE: context.stateFilePath ?? "",
    DATABASE_URL: "",
    DATABASE_READONLY_URL: ""
  };
}

export async function startLocalLiteEnvironment(context: ScenarioContext, options?: {
  expectedToken?: string;
  webTokenOverride?: string;
}): Promise<ScenarioResult> {
  if (context.runtime) {
    return createResult(
      "startOrAttachEnvironment",
      "passed",
      [createAssertion("runtime already active", true)],
      "Local-lite environment was already active."
    );
  }

  const orchestratorPort = context.ports?.orchestrator ?? await pickFreePort();
  const webPort = context.ports?.web ?? await pickFreePort();
  const stateFilePath = path.join(context.artifactDir, "runtime", "local-lite-state.json");
  const processLogDir = path.join(context.artifactDir, "logs");
  await ensureDir(processLogDir);
  await createLocalLiteStateFile(stateFilePath);
  context.stateFilePath = stateFilePath;
  context.ports = {
    ...context.ports,
    orchestrator: orchestratorPort,
    web: webPort
  };

  const fakeOrchestrator = await startFakeOrchestrator({
    port: orchestratorPort,
    stateFilePath,
    expectedToken: options?.expectedToken ?? context.credentials.orchestratorToken
  });

  const webProcess = await spawnLoggedProcess({
    name: "web-local-lite",
    args: [
      "--filter",
      "@autopoly/web",
      "exec",
      "next",
      "dev",
      "-p",
      String(webPort),
      "-H",
      "127.0.0.1"
    ],
    cwd: context.repoRoot,
    env: buildWebEnv(context, webPort, fakeOrchestrator.baseUrl, options?.webTokenOverride),
    logPath: path.join(processLogDir, "web-local-lite.log")
  });

  context.baseUrls.web = `http://127.0.0.1:${webPort}`;
  context.baseUrls.orchestrator = fakeOrchestrator.baseUrl;
  context.runtime = {
    cleanup: [
      async () => {
        await webProcess.stop();
      },
      async () => {
        await fakeOrchestrator.stop();
      }
    ],
    processes: [
      webProcess
    ]
  };

  await waitForHttp(`${context.baseUrls.web}/api/public/overview`, context.timeouts.startupMs);
  await waitForHttp(`${context.baseUrls.orchestrator}/health`, context.timeouts.startupMs);

  const artifacts: ScenarioArtifact[] = [
    createArtifact("log", "web-local-lite.log", webProcess.logPath),
    createArtifact("db-snapshot", "local-lite-state.json", stateFilePath)
  ];
  const assertions = [
    createAssertion("web api is reachable", true, context.baseUrls.web),
    createAssertion("fake orchestrator is reachable", true, context.baseUrls.orchestrator)
  ];

  return createResult(
    "startOrAttachEnvironment",
    aggregateStatus(assertions),
    assertions,
    "Local-lite environment started with a fake orchestrator and dynamic mock state.",
    artifacts
  );
}

export async function attachRemoteRealEnvironment(context: ScenarioContext): Promise<ScenarioResult> {
  const assertions = [
    createAssertion("web base url configured", Boolean(context.baseUrls.web), context.baseUrls.web),
    createAssertion("orchestrator base url configured", Boolean(context.baseUrls.orchestrator), context.baseUrls.orchestrator),
    createAssertion("executor base url configured", Boolean(context.baseUrls.executor), context.baseUrls.executor)
  ];

  if (assertions.every((assertion) => assertion.passed)) {
    await waitForHttp(`${context.baseUrls.web}/api/public/overview`, context.timeouts.startupMs);
    await waitForHttp(`${context.baseUrls.orchestrator}/health`, context.timeouts.startupMs);
    await waitForHttp(`${context.baseUrls.executor}/health`, context.timeouts.startupMs);
  }

  return createResult(
    "startOrAttachEnvironment",
    aggregateStatus(assertions),
    assertions,
    "Remote-real environment attached through existing URLs."
  );
}

export async function stopEnvironment(context: ScenarioContext) {
  if (!context.runtime) {
    return;
  }
  for (const cleanup of [...context.runtime.cleanup].reverse()) {
    await cleanup();
  }
  context.runtime = undefined;
}
