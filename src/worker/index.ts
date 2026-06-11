import { config } from "dotenv";
config();

import { startWorker, stopWorker } from "./worker";

let isShuttingDown = false;

async function main() {
  console.log("[worker] Starting worker process...");

  await startWorker();

  console.log("[worker] Worker is running. Polling for jobs...");
}

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[worker] Received ${signal}. Shutting down gracefully...`);

  await stopWorker();

  console.log("[worker] Shutdown complete.");
  process.exit(0);
}

// Graceful shutdown on signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// If something throws and nobody caught it, log it and exit
// An uncaught exception in a background worker is always a bug —
// we want to know about it immediately rather than silently continue
process.on("uncaughtException", (err) => {
  console.error("[worker] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[worker] Unhandled promise rejection:", reason);
  process.exit(1);
});

main().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});
