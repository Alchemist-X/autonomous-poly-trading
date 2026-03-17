import path from "node:path";
import { getPublicRunDetail } from "@autopoly/db";
import { applyTradeGuards, shouldHaltForDrawdown } from "@autopoly/orchestrator/risk";
import { shouldTriggerStopLoss } from "@autopoly/executor/risk";
import { createArtifact, createScenarioArtifactDir } from "../lib/artifacts.js";
import { recordBrowserSession } from "../lib/browser.js";
import { startLocalLiteEnvironment, attachRemoteRealEnvironment } from "../lib/environment.js";
import { pathExists, readJsonFile, writeJsonFile } from "../lib/fs.js";
import { fetchJson } from "../lib/http.js";
import { appendAction, applyResume, readLocalLiteState, updateLocalLiteState } from "../lib/local-lite-state.js";
import { aggregateStatus, createAssertion, createResult } from "../lib/results.js";
import type {
  PublicPosition,
  PublicRunDetail,
  PublicRunSummary
} from "@autopoly/contracts";
import type { ScenarioContext, ScenarioModule, ScenarioResult } from "../types.js";

interface RiskCases {
  stopLossCases: Array<{
    id: string;
    avgCost: number;
    currentPrice: number;
    thresholdPct: number;
    expected: boolean;
  }>;
  drawdownCases: Array<{
    id: string;
    totalEquityUsd: number;
    highWaterMarkUsd: number;
    thresholdPct: number;
    expected: boolean;
  }>;
  tradeGuardCases: Array<{
    id: string;
    input: Parameters<typeof applyTradeGuards>[0];
    expected: number;
  }>;
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function waitForRunVisibility(context: ScenarioContext, runId: string) {
  const deadline = Date.now() + context.timeouts.pollingMs;
  while (Date.now() < deadline) {
    const runs = await fetchJson<PublicRunSummary[]>(`${context.baseUrls.web}/api/public/runs`);
    if (runs.some((run) => run.id === runId)) {
      return runs;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for run ${runId} to become visible.`);
}

async function waitForStatus(context: ScenarioContext, expectedStatus: string) {
  const deadline = Date.now() + context.timeouts.pollingMs;
  while (Date.now() < deadline) {
    const overview = await fetchJson<{ status: string }>(`${context.baseUrls.web}/api/public/overview`);
    if (overview.status === expectedStatus) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for status ${expectedStatus}.`);
}

async function waitForAdminResult(page: import("playwright").Page) {
  const currentValue = (await page.locator(".admin-result").textContent())?.trim() ?? "";
  await page.waitForFunction((previousValue) => {
    const value = document.querySelector(".admin-result")?.textContent?.trim();
    return Boolean(value) && value !== "No action executed yet." && value !== previousValue;
  }, currentValue);
}

async function waitForAdminConsole(page: import("playwright").Page) {
  await page.getByRole("heading", { name: "Protected internal controls" }).waitFor();
  await page.getByRole("button", { name: "Pause" }).waitFor();
}

async function waitForAdminLogin(page: import("playwright").Page) {
  await page.getByRole("heading", { name: "Enter spectator control mode" }).waitFor();
  await page.getByLabel("Password").waitFor();
}

async function ensureRuntime(context: ScenarioContext) {
  if (context.profile === "local-lite") {
    return startLocalLiteEnvironment(context);
  }
  return attachRemoteRealEnvironment(context);
}

export const verifyCurrentState: ScenarioModule = {
  id: "verifyCurrentState",
  phase: "trading-system",
  async run(context) {
    const riskFixturePath = path.join(context.repoRoot, "E2E Test Driven Development", "fixtures", "risk-guard-cases.json");
    const assertions = [
      createAssertion("repo root is available", Boolean(context.repoRoot), context.repoRoot),
      createAssertion("artifact directory exists", Boolean(context.artifactDir), context.artifactDir),
      createAssertion("risk fixture exists", await pathExists(riskFixturePath), riskFixturePath)
    ];

    if (context.profile === "remote-real") {
      assertions.push(
        createAssertion("remote mode explicitly enabled", context.featureFlags.remoteEnabled, "Set AUTOPOLY_E2E_REMOTE=1 to run remote-real tests."),
        createAssertion("live trade budget is capped", context.liveTradeBudget > 0 && context.liveTradeBudget <= 1, String(context.liveTradeBudget))
      );
    }

    return createResult(
      "verifyCurrentState",
      aggregateStatus(assertions),
      assertions,
      "Verified repository prerequisites and mode-specific guardrails."
    );
  }
};

export const startOrAttachEnvironment: ScenarioModule = {
  id: "startOrAttachEnvironment",
  phase: "trading-system",
  async run(context) {
    return ensureRuntime(context);
  }
};

export const triggerAgentCycle: ScenarioModule = {
  id: "triggerAgentCycle",
  phase: "trading-system",
  async run(context) {
    const response = await fetchJson<{ skipped?: boolean; runId?: string; reason?: string; decisions?: number }>(
      `${context.baseUrls.orchestrator}/admin/run-now`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${context.credentials.orchestratorToken}`
        }
      }
    );

    const dumpDir = await createScenarioArtifactDir(context.artifactDir, "triggerAgentCycle");
    const dumpPath = path.join(dumpDir, "response.json");
    await writeJsonFile(dumpPath, response);

    const assertions = [
      createAssertion("run-now did not skip", response.skipped !== true, response.reason),
      createAssertion("run id returned", Boolean(response.runId), response.runId)
    ];

    context.runtime ??= { cleanup: [], processes: [] };
    context.runtime.latestRunId = response.runId;

    return createResult(
      "triggerAgentCycle",
      aggregateStatus(assertions),
      assertions,
      response.runId ? `Triggered an agent cycle and received run id ${response.runId}.` : "Agent cycle trigger failed.",
      [
        createArtifact("http-dump", "run-now response", dumpPath)
      ],
      response as Record<string, unknown>
    );
  }
};

export const assertRunPersisted: ScenarioModule = {
  id: "assertRunPersisted",
  phase: "trading-system",
  async run(context) {
    const runId = context.runtime?.latestRunId;
    const assertions = [
      createAssertion("latest run id is available", Boolean(runId), runId)
    ];

    const artifacts = [];
    if (!runId) {
      return createResult("assertRunPersisted", "failed", assertions, "No run id was available to validate persistence.");
    }

    const runs = await waitForRunVisibility(context, runId);
    const runDetail = await fetchJson<PublicRunDetail>(`${context.baseUrls.web}/api/public/runs/${runId}`);
    const dumpDir = await createScenarioArtifactDir(context.artifactDir, "assertRunPersisted");
    const runsDumpPath = path.join(dumpDir, "runs.json");
    const detailDumpPath = path.join(dumpDir, "run-detail.json");
    await writeJsonFile(runsDumpPath, runs);
    await writeJsonFile(detailDumpPath, runDetail);
    artifacts.push(
      createArtifact("http-dump", "runs.json", runsDumpPath),
      createArtifact("http-dump", "run-detail.json", detailDumpPath)
    );

    assertions.push(
      createAssertion("run is visible in public runs", runs.some((run) => run.id === runId), runId),
      createAssertion("run detail exposes decisions", runDetail.decisions.length > 0, String(runDetail.decisions.length)),
      createAssertion("run detail exposes artifacts", runDetail.artifacts.length > 0, String(runDetail.artifacts.length))
    );

    if (context.profile === "remote-real" && process.env.DATABASE_URL) {
      const persistedRun = await getPublicRunDetail(runId);
      assertions.push(
        createAssertion("run is available through DB query", Boolean(persistedRun), runId)
      );
    } else if (context.profile === "local-lite" && context.stateFilePath) {
      const state = await readLocalLiteState(context.stateFilePath);
      assertions.push(
        createAssertion("run exists in local-lite state file", Boolean(state.runDetails[runId]), runId)
      );
    }

    return createResult(
      "assertRunPersisted",
      aggregateStatus(assertions),
      assertions,
      `Verified persistence and public visibility for run ${runId}.`,
      artifacts
    );
  }
};

export const assertPublicSiteUpdated: ScenarioModule = {
  id: "assertPublicSiteUpdated",
  phase: "trading-system",
  async run(context) {
    const pageChecks = [
      { path: "/", marker: "Live operating context" },
      { path: "/positions", marker: "Current live inventory" },
      { path: "/trades", marker: "Execution history" },
      { path: "/runs", marker: "Decision cycles" },
      { path: "/reports", marker: "每日脉冲、复盘与结算跟踪产物" },
      { path: "/backtests", marker: "每日回测与校准报告" }
    ];

    const assertions = [];
    const dumpDir = await createScenarioArtifactDir(context.artifactDir, "assertPublicSiteUpdated");
    const artifacts = [];

    for (const pageCheck of pageChecks) {
      const html = await fetchText(`${context.baseUrls.web}${pageCheck.path}`);
      const dumpPath = path.join(dumpDir, pageCheck.path === "/" ? "home.html" : `${pageCheck.path.slice(1)}.html`);
      await writeJsonFile(dumpPath, { html });
      artifacts.push(createArtifact("http-dump", pageCheck.path, dumpPath));
      assertions.push(
        createAssertion(`${pageCheck.path} renders`, html.includes(pageCheck.marker), pageCheck.marker)
      );
    }

    const overview = await fetchJson<{ open_positions: number; status: string }>(`${context.baseUrls.web}/api/public/overview`);
    const positions = await fetchJson<PublicPosition[]>(`${context.baseUrls.web}/api/public/positions`);
    assertions.push(
      createAssertion("overview and positions stay in sync", overview.open_positions === positions.length, `${overview.open_positions} vs ${positions.length}`)
    );

    return createResult(
      "assertPublicSiteUpdated",
      aggregateStatus(assertions),
      assertions,
      "Verified that the public site pages and APIs render in the selected environment.",
      artifacts
    );
  }
};

export const assertAdminAuthAndActions: ScenarioModule = {
  id: "assertAdminAuthAndActions",
  phase: "trading-system",
  async run(context) {
    const artifactDir = await createScenarioArtifactDir(context.artifactDir, "assertAdminAuthAndActions");
    const session = await recordBrowserSession({
      artifactDir,
      label: "admin-auth",
      url: `${context.baseUrls.web}/admin`,
      script: async (page) => {
        const unauthorized = await page.request.post(`${context.baseUrls.web}/api/admin/run-now`);
        const unauthorizedText = await unauthorized.text();

        await page.getByLabel("Password").fill(context.credentials.adminPassword);
        await page.getByRole("button", { name: "Unlock" }).click();
        await page.waitForLoadState("networkidle");
        await waitForAdminConsole(page);
        await page.getByRole("button", { name: "Pause" }).click();
        await waitForAdminResult(page);
        await waitForStatus(context, "paused");
        await page.getByRole("button", { name: "Resume" }).click();
        await waitForAdminResult(page);
        await waitForStatus(context, "running");
        await page.getByRole("button", { name: "Cancel Open Orders" }).click();
        await waitForAdminResult(page);
        if (context.profile === "local-lite" || context.featureFlags.allowDestructiveAdmin) {
          await page.getByRole("button", { name: "Flatten" }).click();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        await page.getByRole("button", { name: "Logout" }).click();
        await page.waitForLoadState("networkidle");
        await waitForAdminLogin(page);

        return {
          unauthorizedStatus: unauthorized.status(),
          unauthorizedText,
          finalMessage: await page.locator(".admin-result").textContent().catch(() => "")
        };
      }
    });

    const assertions = [
      createAssertion("unauthorized admin API call is rejected", session.result.unauthorizedStatus === 401, session.result.unauthorizedText),
      createAssertion("browser walkthrough produced a video", Boolean(session.videoPath), session.videoPath),
      createAssertion("browser walkthrough produced a trace", Boolean(session.tracePath), session.tracePath),
      createAssertion("browser walkthrough produced a screenshot", Boolean(session.screenshotPath), session.screenshotPath)
    ];

    if (context.profile === "local-lite" && context.stateFilePath) {
      const state = await readLocalLiteState(context.stateFilePath);
      assertions.push(
        createAssertion("fake orchestrator received pause", state.actionLog.some((entry) => entry.includes("pause"))),
        createAssertion("fake orchestrator received resume", state.actionLog.some((entry) => entry.includes("resume"))),
        createAssertion("fake orchestrator received cancel-open-orders", state.actionLog.some((entry) => entry.includes("cancel-open-orders")))
      );
    }

    return createResult(
      "assertAdminAuthAndActions",
      aggregateStatus(assertions),
      assertions,
      "Verified admin authentication, logout, and protected action proxying through the web app.",
      [
        createArtifact("video", "admin-auth video", session.videoPath),
        createArtifact("trace", "admin-auth trace", session.tracePath),
        createArtifact("screenshot", "admin-auth final screenshot", session.screenshotPath)
      ]
    );
  }
};

export const assertPortfolioSync: ScenarioModule = {
  id: "assertPortfolioSync",
  phase: "trading-system",
  async run(context) {
    const overview = await fetchJson<{ open_positions: number; status: string }>(`${context.baseUrls.web}/api/public/overview`);
    const positions = await fetchJson<PublicPosition[]>(`${context.baseUrls.web}/api/public/positions`);
    const reports = await fetchJson<Array<{ id: string }>>(`${context.baseUrls.web}/api/public/reports`);
    const assertions = [
      createAssertion("overview position count matches public positions", overview.open_positions === positions.length, `${overview.open_positions} vs ${positions.length}`),
      createAssertion("reports endpoint returns data", reports.length > 0, String(reports.length))
    ];

    if (context.profile === "remote-real" && context.baseUrls.executor) {
      const health = await fetchJson<{ ok: boolean; status: string }>(`${context.baseUrls.executor}/health`);
      assertions.push(
        createAssertion("executor health is reachable", health.ok === true, health.status)
      );
    }

    return createResult(
      "assertPortfolioSync",
      aggregateStatus(assertions),
      assertions,
      "Validated portfolio-level public synchronization invariants."
    );
  }
};

export const assertRiskGuardBehavior: ScenarioModule = {
  id: "assertRiskGuardBehavior",
  phase: "trading-system",
  async run(context) {
    const fixturePath = path.join(context.repoRoot, "E2E Test Driven Development", "fixtures", "risk-guard-cases.json");
    const riskCases = await readJsonFile<RiskCases>(fixturePath);
    const assertions = [];

    for (const testCase of riskCases.stopLossCases) {
      const actual = shouldTriggerStopLoss(testCase.avgCost, testCase.currentPrice, testCase.thresholdPct);
      assertions.push(
        createAssertion(`stop loss ${testCase.id}`, actual === testCase.expected, `${actual} vs ${testCase.expected}`)
      );
    }

    for (const testCase of riskCases.drawdownCases) {
      const actual = shouldHaltForDrawdown({
        totalEquityUsd: testCase.totalEquityUsd,
        highWaterMarkUsd: testCase.highWaterMarkUsd
      }, testCase.thresholdPct);
      assertions.push(
        createAssertion(`drawdown ${testCase.id}`, actual === testCase.expected, `${actual} vs ${testCase.expected}`)
      );
    }

    for (const testCase of riskCases.tradeGuardCases) {
      const actual = applyTradeGuards(testCase.input);
      assertions.push(
        createAssertion(`trade guard ${testCase.id}`, actual === testCase.expected, `${actual} vs ${testCase.expected}`)
      );
    }

    if (context.profile === "local-lite" && context.stateFilePath && context.baseUrls.orchestrator) {
      await updateLocalLiteState(context.stateFilePath, (state) => appendAction({
        ...state,
        overview: {
          ...state.overview,
          status: "halted",
          latest_risk_event: "Local-lite halt injected for risk verification."
        }
      }, "halted-test"));

      const haltedResponse = await fetchJson<{ skipped: boolean; reason: string }>(`${context.baseUrls.orchestrator}/admin/run-now`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${context.credentials.orchestratorToken}`
        }
      });
      assertions.push(
        createAssertion("halted mode rejects new run-now execution", haltedResponse.skipped === true, haltedResponse.reason)
      );

      await updateLocalLiteState(context.stateFilePath, (state) => applyResume(state));
    }

    return createResult(
      "assertRiskGuardBehavior",
      aggregateStatus(assertions),
      assertions,
      "Validated deterministic risk guard behavior and halted-state rejection."
    );
  }
};

export const recordBrowserWalkthrough: ScenarioModule = {
  id: "recordBrowserWalkthrough",
  phase: "trading-system",
  async run(context) {
    const artifactDir = await createScenarioArtifactDir(context.artifactDir, "recordBrowserWalkthrough");
    const session = await recordBrowserSession({
      artifactDir,
      label: "success",
      url: `${context.baseUrls.web}/admin`,
      script: async (page) => {
        await page.getByLabel("Password").fill(context.credentials.adminPassword);
        await page.getByRole("button", { name: "Unlock" }).click();
        await page.waitForLoadState("networkidle");
        await waitForAdminConsole(page);
        await page.getByRole("button", { name: "Run Now" }).click();
        await waitForAdminResult(page);
        const resultText = await page.locator(".admin-result").textContent();
        await page.goto(`${context.baseUrls.web}/runs`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Decision cycles" }).waitFor();

        let latestRunId = context.runtime?.latestRunId;
        if (!latestRunId) {
          const runs = await fetchJson<PublicRunSummary[]>(`${context.baseUrls.web}/api/public/runs`);
          latestRunId = runs[0]?.id;
        }

        if (latestRunId) {
          await page.goto(`${context.baseUrls.web}/runs/${latestRunId}`, { waitUntil: "networkidle" });
          await page.getByTestId("run-detail-prompt-summary").waitFor();
          context.runtime ??= { cleanup: [], processes: [] };
          context.runtime.latestRunId = latestRunId;
        }

        return {
          resultText,
          latestRunId
        };
      }
    });

    const assertions = [
      createAssertion("success walkthrough produced a video", Boolean(session.videoPath), session.videoPath),
      createAssertion("success walkthrough produced a trace", Boolean(session.tracePath), session.tracePath),
      createAssertion("success walkthrough produced a screenshot", Boolean(session.screenshotPath), session.screenshotPath),
      createAssertion("success walkthrough resolved a run id", Boolean(session.result.latestRunId), String(session.result.latestRunId))
    ];

    return createResult(
      "recordBrowserWalkthrough",
      aggregateStatus(assertions),
      assertions,
      "Recorded a successful browser walkthrough from admin login to public run visibility.",
      [
        createArtifact("video", "success walkthrough video", session.videoPath),
        createArtifact("trace", "success walkthrough trace", session.tracePath),
        createArtifact("screenshot", "success walkthrough screenshot", session.screenshotPath)
      ],
      session.result as Record<string, unknown>
    );
  }
};

export const recordFailureWalkthrough: ScenarioModule = {
  id: "recordFailureWalkthrough",
  phase: "trading-system",
  async run(context) {
    if (context.profile !== "local-lite") {
      return createResult(
        "recordFailureWalkthrough",
        "skipped",
        [createAssertion("failure walkthrough is only implemented for local-lite", true)],
        "Failure recording is currently only implemented for local-lite."
      );
    }

    const artifactDir = await createScenarioArtifactDir(context.artifactDir, "recordFailureWalkthrough");
    const session = await recordBrowserSession({
      artifactDir,
      label: "failure",
      url: `${context.baseUrls.web}/admin`,
      script: async (page) => {
        await page.route("**/api/admin/run-now", async (route) => {
          await route.fulfill({
            status: 401,
            contentType: "text/plain",
            body: "unauthorized"
          });
        });
        await page.getByLabel("Password").fill(context.credentials.adminPassword);
        await page.getByRole("button", { name: "Unlock" }).click();
        await page.waitForLoadState("networkidle");
        await waitForAdminConsole(page);
        await page.getByRole("button", { name: "Run Now" }).click();
        await waitForAdminResult(page);
        const message = await page.locator(".admin-result").textContent();
        await page.unroute("**/api/admin/run-now");
        return { message };
      }
    });

    const assertions = [
      createAssertion("failure walkthrough produced a video", Boolean(session.videoPath), session.videoPath),
      createAssertion("failure walkthrough surfaces unauthorized error", String(session.result.message).includes("unauthorized"), String(session.result.message))
    ];

    return createResult(
      "recordFailureWalkthrough",
      aggregateStatus(assertions),
      assertions,
      "Recorded a failure walkthrough by injecting an unauthorized admin action response.",
      [
        createArtifact("video", "failure walkthrough video", session.videoPath),
        createArtifact("trace", "failure walkthrough trace", session.tracePath),
        createArtifact("screenshot", "failure walkthrough screenshot", session.screenshotPath)
      ],
      session.result as Record<string, unknown>
    );
  }
};
