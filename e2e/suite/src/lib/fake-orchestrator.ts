import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { appendAction, applyFlatten, applyPause, applyResume, applyRunNow, readLocalLiteState, updateLocalLiteState } from "./local-lite-state.js";

export interface FakeOrchestratorHandle {
  baseUrl: string;
  stop: () => Promise<void>;
}

function unauthorized(response: import("node:http").ServerResponse) {
  response.statusCode = 401;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ ok: false, error: "unauthorized" }));
}

function sendJson(response: import("node:http").ServerResponse, body: unknown) {
  response.statusCode = 200;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

export async function startFakeOrchestrator(options: {
  port: number;
  stateFilePath: string;
  expectedToken: string;
}): Promise<FakeOrchestratorHandle> {
  const server = createServer(async (request, response) => {
    if (request.url === "/health" && request.method === "GET") {
      const state = await readLocalLiteState(options.stateFilePath);
      sendJson(response, {
        ok: true,
        status: state.overview.status,
        action_count: state.actionLog.length
      });
      return;
    }

    const auth = request.headers.authorization;
    if (auth !== `Bearer ${options.expectedToken}`) {
      unauthorized(response);
      return;
    }

    switch (`${request.method} ${request.url}`) {
      case "POST /admin/pause": {
        await updateLocalLiteState(options.stateFilePath, (state) => applyPause(state));
        sendJson(response, { ok: true, status: "paused" });
        return;
      }
      case "POST /admin/resume": {
        await updateLocalLiteState(options.stateFilePath, (state) => applyResume(state));
        sendJson(response, { ok: true, status: "running" });
        return;
      }
      case "POST /admin/run-now": {
        const state = await readLocalLiteState(options.stateFilePath);
        if (state.overview.status !== "running") {
          await updateLocalLiteState(options.stateFilePath, (current) => appendAction(current, "run-now-skipped"));
          sendJson(response, {
            skipped: true,
            reason: `system status is ${state.overview.status}`
          });
          return;
        }
        const next = await updateLocalLiteState(options.stateFilePath, (current) => {
          const result = applyRunNow(current);
          return result.state;
        });
        sendJson(response, {
          skipped: false,
          runId: next.runs[0]?.id ?? null,
          decisions: next.runDetails[next.runs[0]?.id ?? ""]?.decisions.length ?? 0
        });
        return;
      }
      case "POST /admin/cancel-open-orders": {
        await updateLocalLiteState(options.stateFilePath, (state) => appendAction(state, "cancel-open-orders"));
        sendJson(response, {
          ok: true,
          note: "No open orders expected because local-lite uses synthetic FOK responses."
        });
        return;
      }
      case "POST /admin/flatten": {
        await updateLocalLiteState(options.stateFilePath, (state) => applyFlatten(state));
        sendJson(response, { ok: true, status: "flattened" });
        return;
      }
      default:
        response.statusCode = 404;
        response.end("Not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options.port, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
