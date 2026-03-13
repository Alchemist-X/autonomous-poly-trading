import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { JOBS } from "@autopoly/contracts";
import type { Queue } from "bullmq";
import type { OrchestratorConfig } from "../config.js";
import { runAgentCycle } from "../jobs/agent-cycle.js";
import { setSystemStatus } from "../lib/state.js";
import type { AgentRuntime } from "../runtime/agent-runtime.js";

function verifyToken(request: FastifyRequest, reply: FastifyReply, token: string): boolean {
  const auth = request.headers.authorization;
  if (auth !== `Bearer ${token}`) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}

export async function registerAdminRoutes(app: FastifyInstance, deps: {
  config: OrchestratorConfig;
  executionQueue: Queue;
  runtime: AgentRuntime;
}) {
  app.post("/admin/pause", async (request, reply) => {
    if (!verifyToken(request, reply, deps.config.internalToken)) {
      return;
    }
    await setSystemStatus("paused", "Admin paused autonomous trading.");
    return { ok: true, status: "paused" };
  });

  app.post("/admin/resume", async (request, reply) => {
    if (!verifyToken(request, reply, deps.config.internalToken)) {
      return;
    }
    await setSystemStatus("running", "Admin resumed autonomous trading.");
    return { ok: true, status: "running" };
  });

  app.post("/admin/run-now", async (request, reply) => {
    if (!verifyToken(request, reply, deps.config.internalToken)) {
      return;
    }
    return runAgentCycle({
      runtime: deps.runtime,
      executionQueue: deps.executionQueue,
      config: deps.config
    });
  });

  app.post("/admin/cancel-open-orders", async (request, reply) => {
    if (!verifyToken(request, reply, deps.config.internalToken)) {
      return;
    }
    await deps.executionQueue.add(JOBS.cancelOpenOrders, {}, { removeOnComplete: true });
    return { ok: true };
  });

  app.post("/admin/flatten", async (request, reply) => {
    if (!verifyToken(request, reply, deps.config.internalToken)) {
      return;
    }
    await deps.executionQueue.add(JOBS.flattenPortfolio, {}, { removeOnComplete: true });
    return { ok: true };
  });
}

