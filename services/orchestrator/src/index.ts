import { Queue } from "bullmq";
import Fastify from "fastify";
import cron from "node-cron";
import { QUEUES, JOBS } from "@autopoly/contracts";
import { loadConfig } from "./config.js";
import { runAgentCycle } from "./jobs/agent-cycle.js";
import { runBacktestJob } from "./jobs/backtest.js";
import { runResolutionSweep } from "./jobs/resolution.js";
import { getOverview } from "@autopoly/db";
import { ClaudeCodeRuntime } from "./runtime/claude-code-runtime.js";
import { registerAdminRoutes } from "./routes/admin.js";

const config = loadConfig();
const connection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null
};
const executionQueue = new Queue(QUEUES.execution, { connection });
const runtime = new ClaudeCodeRuntime(config);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  overview: await getOverview()
}));

await registerAdminRoutes(app, {
  config,
  executionQueue,
  runtime
});

cron.schedule(config.agentPollCron, () => {
  void runAgentCycle({
    runtime,
    executionQueue,
    config
  }).catch((error) => {
    app.log.error({ error }, "scheduled agent cycle failed");
  });
});

cron.schedule(config.backtestCron, () => {
  void runBacktestJob().catch((error) => {
    app.log.error({ error }, "backtest job failed");
  });
});

setInterval(() => {
  void executionQueue.add(JOBS.syncPortfolio, {}, {
    jobId: "sync-portfolio",
    removeOnComplete: true,
    removeOnFail: false
  }).catch((error) => {
    app.log.error({ error }, "sync job enqueue failed");
  });
}, config.syncIntervalSeconds * 1000);

setInterval(() => {
  void runResolutionSweep(config.resolutionBaseIntervalMinutes).catch((error) => {
    app.log.error({ error }, "resolution sweep failed");
  });
}, config.resolutionBaseIntervalMinutes * 60 * 1000);

await app.listen({
  port: config.port,
  host: "0.0.0.0"
});
