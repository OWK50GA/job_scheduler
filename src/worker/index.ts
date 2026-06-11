import { config } from "dotenv";
config();

import { logger } from "../logger";
import { startWorker, stopWorker } from "./worker";
import { closeJobLogger } from "./logger";

let isShuttingDown = false;

async function main() {
  logger.info("Worker process starting");

  await startWorker();

  logger.info("Worker running — polling for jobs");
}

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Graceful shutdown initiated");

  await stopWorker();
  await closeJobLogger();

  logger.info("Worker shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — exiting");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection — exiting");
  process.exit(1);
});

main().catch((err) => {
  logger.fatal({ err }, "Worker failed to start");
  process.exit(1);
});
