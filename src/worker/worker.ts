import { DatabaseClient } from "../db";
import { processJob } from "./processor";

const POLL_INTERVAL_MS = 1_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000;
const SHUTDOWN_TIMEOUT_MS = 30 * 1_000;

const dbClient = new DatabaseClient();

let running = false;
let shuttingDown = false;

let inflightJob: Promise<void> | null = null;

/**
 * One iteration of the poll loop.
 * Claims the next eligible job and runs it.
 * Returns true if a job was found, false if the queue was empty.
 */
async function tick(): Promise<boolean> {
  const job = await dbClient.claimNextJob();
  console.log("Job claimed: ", job);

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
        // Nothing in the queue - wait before polling again
        await sleep(POLL_INTERVAL_MS);
      }
      // If a job was found, loop immediately to drain the queue
    } catch (err) {
      // An unexpected error in the poll loop itself: Log and back off to avoid
      // a tight error loop hammering the DB.
      console.error("[worker] Unexpected error in poll loop:", err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Cleanup loop. Runs every CLEANUP_INTERVAL_MS.
 *
 * Finds jobs stuck in 'processing' longer than 10 minutes (the zombie timeout
 * defined in reapZombieJobs) and resets them to 'pending' so the poll loop
 * can retry them. attempt_count is incremented on each reap so the retry
 * budget is honestly consumed even on crashes.
 */
async function cleanupLoop(): Promise<void> {
  while (!shuttingDown) {
    await sleep(CLEANUP_INTERVAL_MS);
    if (shuttingDown) break;

    try {
      const reaped = await dbClient.reapZombieJobs();
      if (reaped > 0) {
        console.log(`[worker] Reaped ${reaped} zombie job(s).`);
      }
    } catch (err) {
      console.error("[worker] Cleanup loop error:", err);
    }
  }
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

  // Both loops run until shuttingDown is set.
  // We don't await either - caller proceeds immediately after startWorker().
  pollLoop().catch((err) => {
    console.error("[worker] Poll loop crashed:", err);
    process.exit(1);
  });

  cleanupLoop().catch((err) => {
    console.error("[worker] Cleanup loop crashed:", err);
    process.exit(1);
  });
}

/**
 * Signals the poll loop to stop and waits for any in-flight job to complete.
 *
 * Behaviour:
 * - Sets shuttingDown = true so the loop exits after the current tick.
 * - If a job is mid-execution, waits up to SHUTDOWN_TIMEOUT_MS for it.
 * - If the timeout is exceeded, logs a warning and returns anyway.
 *   The job was already claimed (status = 'processing') and will be left
 *   in that state - a future worker restart or a monitoring job can reap it
 *   through the cleanupLoop()
 */
export async function stopWorker(): Promise<void> {
  shuttingDown = true;
  running = false;

  if (inflightJob) {
    console.log("[worker] Waiting for in-flight job to finish...");

    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn(
          `[worker] In-flight job did not finish within ${SHUTDOWN_TIMEOUT_MS}ms. Proceeding with shutdown.`,
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
