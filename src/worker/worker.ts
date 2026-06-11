import { DatabaseClient } from "../db";
import { logger } from "../logger";
import { processJob } from "./processor";

const POLL_INTERVAL_MS = 1_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes
const SHUTDOWN_TIMEOUT_MS = 30 * 1_000;

const dbClient = new DatabaseClient();

let running = false;
let shuttingDown = false;
let inflightJob: Promise<void> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * One iteration of the poll loop.
 * Claims the next eligible job and runs it.
 * Returns true if a job was found, false if the queue was empty.
 */
async function tick(): Promise<boolean> {
  const job = await dbClient.claimNextJob();

  if (!job) {
    return false;
  }

  inflightJob = processJob(job).then(() => undefined).finally(() => {
    inflightJob = null;
  });

  await inflightJob;

  return true;
}

/**
 * The main poll loop. Runs until stopWorker() is called.
 *
 * When the queue is empty, backs off for POLL_INTERVAL_MS before trying again.
 * When a job is found, it processes it immediately and then polls again without
 * waiting - there may be more jobs ready.
 */
async function pollLoop(): Promise<void> {
  while (!shuttingDown) {
    try {
      const hadJob = await tick();

      if (!hadJob) {
        await sleep(POLL_INTERVAL_MS);
      }
      // Job found? loop immediately to drain the queue
    } catch (err) {
      logger.error({ err }, "Unexpected error in poll loop — backing off");
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Starts the cleanup interval.
 *
 * Finds jobs stuck in 'processing' longer than 10 minutes (zombie jobs) and
 * resets them to 'pending'. Uses setInterval rather than a while+sleep loop
 * so it is fully controllable by fake timers in tests and does not hold the
 * event loop open with a dangling promise chain.
 *
 * Zombie timeout: 10 minutes (defined in reapZombieJobs on the DB client).
 * Cleanup interval: every 5 minutes.
 */
function startCleanupInterval(): void {
  cleanupTimer = setInterval(async () => {
    try {
      const reaped = await dbClient.reapZombieJobs();
      if (reaped > 0) {
        logger.warn({ reaped }, "Reaped zombie jobs");
      }
    } catch (err) {
      logger.error({ err }, "Cleanup interval error");
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Starts the worker. Idempotent - safe to call multiple times.
 */
export async function startWorker(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  shuttingDown = false;

  // Poll loop runs until shuttingDown is set.
  // We don't await it - caller proceeds immediately.
  pollLoop().catch((err) => {
    logger.fatal({ err }, "Poll loop crashed — exiting");
    process.exit(1);
  });

  startCleanupInterval();
}

/**
 * Signals the worker to stop and waits for any in-flight job to complete.
 *
 * - Sets shuttingDown so the poll loop exits on its next iteration.
 * - Clears the cleanup interval immediately.
 * - If a job is mid-execution, waits up to SHUTDOWN_TIMEOUT_MS for it.
 * - If the timeout is exceeded, returns anyway. The stuck job will be reaped
 *   by the cleanup loop on the next worker restart.
 */
export async function stopWorker(): Promise<void> {
  shuttingDown = true;
  running = false;

  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  if (inflightJob) {
    logger.info("Waiting for in-flight job to finish before shutdown");

    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        logger.warn(
          { timeoutMs: SHUTDOWN_TIMEOUT_MS },
          "In-flight job did not finish within shutdown timeout — proceeding",
        );
        resolve();
      }, SHUTDOWN_TIMEOUT_MS),
    );

    await Promise.race([inflightJob, timeout]);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
