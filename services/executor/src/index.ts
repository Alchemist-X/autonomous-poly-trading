import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { createQueueWorker } from "./workers/queue-worker.js";
import { getStatus } from "./lib/store.js";

const config = loadConfig();
const connection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null
};
const worker = createQueueWorker(config, connection);
const app = Fastify({ logger: true });

worker.on("completed", (job) => {
  app.log.info({ jobId: job.id, name: job.name }, "executor job completed");
});

worker.on("failed", (job, error) => {
  app.log.error({ jobId: job?.id, name: job?.name, error }, "executor job failed");
});

app.get("/health", async () => ({
  ok: true,
  status: await getStatus()
}));

await app.listen({
  port: config.port,
  host: "0.0.0.0"
});
