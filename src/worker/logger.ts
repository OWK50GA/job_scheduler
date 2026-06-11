import { Pool } from "pg";
import { logger } from "../logger";

/**
 * Job event logger - worker-only.
 *
 * Every significant job lifecycle event should go through this function.
 * It does two things simultaneously:
 *   1. Writes a structured Pino log line to stdout (fast, async)
 *   2. Inserts a row into job_logs so engineers can query job history
 *      via the API or directly in Postgres
 *
 * The DB insert is fire-and-forget - we never await it in the hot path.
 * A failed insert is logged as a warning but does not affect job processing.
 *
 * Valid events (matches what the spec requires to be logged):
 *   job_created | job_started | job_completed | job_failed
 *   job_cancelled | retry_attempted | zombie_reaped
 */

export type JobEvent =
  | "job_created"
  | "job_started"
  | "job_completed"
  | "job_failed"
  | "job_cancelled"
  | "retry_attempted"
  | "zombie_reaped";

type LogJobEventOptions = {
  jobId: string;
  event: JobEvent;
  message: string;
  meta?: Record<string, unknown>;
};

// Lazy pool — only initialised the first time logJobEvent is called.
// This avoids creating a DB connection when the logger module is imported
// in test environments where no DB is available.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.JOB_SCHEDULER_DB_URL;
    if (!dbUrl) throw new Error("JOB_SCHEDULER_DB_URL is not set");
    pool = new Pool({ connectionString: dbUrl, max: 5 });
  }
  return pool;
}

export function logJobEvent({
  jobId,
  event,
  message,
  meta,
}: LogJobEventOptions): void {
  // 1. Structured stdout log — synchronous call, async I/O handled by pino
  const jobLogger = logger.child({ jobId, event, ...meta });

  switch (event) {
    case "job_failed":
    case "zombie_reaped":
      jobLogger.warn(message);
      break;
    default:
      jobLogger.info(message);
  }

  // 2. Persist to job_logs — fire and forget
  getPool()
    .query(
      `INSERT INTO job_logs (job_id, event, message)
       VALUES ($1, $2, $3)`,
      [jobId, event, message],
    )
    .catch((err: unknown) => {
      // Don't let a logging failure affect job processing
      logger.warn({ err, jobId, event }, "Failed to write to job_logs");
    });
}

/**
 * Flush and close the logger's DB pool.
 * Call this from stopWorker() during graceful shutdown.
 */
export async function closeJobLogger(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
