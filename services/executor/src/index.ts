import Fastify from "fastify";
import {
  createTerminalPrinter,
  createPrettyServiceLogger,
  printErrorSummary,
  shouldUsePrettyServiceLogger
} from "@autopoly/terminal-ui";
import { loadConfig } from "./config.js";
import { createQueueWorker } from "./workers/queue-worker.js";
import { getStatus } from "./lib/store.js";

const config = loadConfig();
const connection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null
};
const worker = createQueueWorker(config, connection);
const printer = createTerminalPrinter();
const app = Fastify(shouldUsePrettyServiceLogger()
  ? {
      loggerInstance: createPrettyServiceLogger({ serviceName: "executor" }) as any
    }
  : {
      logger: true
    });

worker.on("completed", (job) => {
  app.log.info({ jobId: job.id, name: job.name }, "executor job completed");
});

worker.on("failed", (job, error) => {
  const decision = job?.data?.decision as {
    market_slug?: string;
    token_id?: string;
    notional_usd?: number;
  } | undefined;
  if (printer.capabilities.isTTY) {
    printErrorSummary(printer, {
      title: "Executor Job Failed",
      stage: job?.name ?? "unknown",
      error,
      context: [
        ["Job ID", String(job?.id ?? "-")],
        ["Run ID", String(job?.data?.runId ?? "-")],
        ["Market", String(decision?.market_slug ?? "-")],
        ["Token", String(decision?.token_id ?? "-")],
        ["Requested USD", decision?.notional_usd == null ? "-" : String(decision.notional_usd)]
      ]
    });
  }
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
app.log.info({ port: config.port }, "executor listening");
