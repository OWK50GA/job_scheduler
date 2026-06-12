import { DatabaseClient } from "../db";
import { publish } from "../events/publisher";
import { Job, JobStatus } from "../types";
import { sendEmailHandler } from "./handlers";
import { logJobEvent } from "./logger";
import { JobHandler } from "./types";

const HANDLERS: Record<string, JobHandler> = {
  send_email: sendEmailHandler,
};

const dbClient = new DatabaseClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch updated stats and publish a stats.updated event.
 * Fire-and-forget — errors are logged by the publisher, never thrown.
 */
async function publishStats(): Promise<void> {
  try {
    const stats = await dbClient.getJobStats();
    publish({ type: "stats.updated", payload: { stats } });
  } catch {
    // stats fetch failure should not affect job processing
  }
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processJob(job: Job) {
  try {
    const handler = HANDLERS[job.type];

    if (!handler) {
      logJobEvent({
        jobId: job.id,
        event: "job_failed",
        message: "No handler registered for job type",
        meta: { jobType: job.type },
      });

      const dead = await dbClient.markJobDeadLetter(
        job.id,
        "No handler registered for job type",
        0,
        true,
      );
      publish({ type: "job.failed", payload: { job: dead, error: "No handler registered for job type" } });
      publish({ type: "job.dlq_entry", payload: { job: dead, error: "No handler registered for job type" } });
      void publishStats();
      return;
    }

    // Re-fetch to catch cancellations that arrived after claimNextJob
    const fetchedJob = await dbClient.getJob(job.id);

    if (!fetchedJob) {
      const { attempt_count: attempts, max_retries } = job;
      if (attempts + 1 >= max_retries) {
        logJobEvent({
          jobId: job.id,
          event: "job_failed",
          message: "Job not found on re-fetch — sending to DLQ",
        });
        const dead = await dbClient.markJobDeadLetter(job.id, "Failed to confirm job status", 0);
        publish({ type: "job.failed", payload: { job: dead, error: "Failed to confirm job status" } });
        publish({ type: "job.dlq_entry", payload: { job: dead, error: "Failed to confirm job status" } });
        void publishStats();
        return;
      } else {
        const nextRetryAt = calculateNextRetryAt(attempts);
        logJobEvent({
          jobId: job.id,
          event: "retry_attempted",
          message: "Job not found on re-fetch — scheduling retry",
          meta: { attempt: attempts + 1, max_retries },
        });
        const retried = await dbClient.markJobRetryable(
          job.id,
          "Failed to confirm job status",
          new Date(nextRetryAt),
          0,
        );
        publish({
          type: "job.retry_scheduled",
          payload: {
            job: retried,
            error: "Failed to confirm job status",
            attempt: attempts + 1,
            nextRetryAt: new Date(nextRetryAt).toISOString(),
          },
        });
        void publishStats();
        return;
      }
    }

    if (fetchedJob.status === JobStatus.CANCELLED) {
      logJobEvent({
        jobId: job.id,
        event: "job_cancelled",
        message: "Job was cancelled before execution — skipping",
      });
      const cancelled = await dbClient.cancelJob(job.id);
      if (cancelled) {
        publish({ type: "job.cancelled", payload: { job: cancelled } });
        void publishStats();
      }
      return;
    }

    // DAG dependency gate
    const depsMet = await dbClient.checkDependenciesMet(job.id);
    if (!depsMet) {
      logJobEvent({
        jobId: job.id,
        event: "retry_attempted",
        message: "Dependencies not yet met - releasing back to pending",
      });
      const retryAt = new Date(Date.now() + 5_000);
      const retried = await dbClient.markJobRetryable(
        job.id,
        "Waiting for dependencies",
        retryAt,
        0,
      );
      publish({
        type: "job.retry_scheduled",
        payload: {
          job: retried,
          error: "Waiting for dependencies",
          attempt: job.attempt_count + 1,
          nextRetryAt: retryAt.toISOString(),
        },
      });
      return;
    }

    logJobEvent({
      jobId: job.id,
      event: "job_started",
      message: "Job execution started",
      meta: { jobType: job.type, attempt: job.attempt_count + 1 },
    });
    publish({ type: "job.started", payload: { job: fetchedJob } });

    const handlerResult = await handler(job);

    if (!handlerResult.success) {
      const { attempt_count: attempts, max_retries } = job;

      if (attempts + 1 >= max_retries) {
        logJobEvent({
          jobId: job.id,
          event: "job_failed",
          message: "Job failed — retries exhausted, moving to DLQ",
          meta: {
            error: handlerResult.error,
            attempt: attempts + 1,
            max_retries,
            durationMs: handlerResult.durationMs,
          },
        });
        const dead = await dbClient.markJobDeadLetter(
          job.id,
          handlerResult.error!,
          handlerResult.durationMs,
        );
        publish({ type: "job.failed", payload: { job: dead, error: handlerResult.error! } });
        publish({ type: "job.dlq_entry", payload: { job: dead, error: handlerResult.error! } });
        void publishStats();
        return;
      } else {
        const nextRetryAt = calculateNextRetryAt(attempts);
        logJobEvent({
          jobId: job.id,
          event: "retry_attempted",
          message: "Job failed — scheduling retry",
          meta: {
            error: handlerResult.error,
            attempt: attempts + 1,
            max_retries,
            durationMs: handlerResult.durationMs,
          },
        });
        const retried = await dbClient.markJobRetryable(
          job.id,
          handlerResult.error!,
          new Date(nextRetryAt),
          handlerResult.durationMs,
        );
        publish({
          type: "job.retry_scheduled",
          payload: {
            job: retried,
            error: handlerResult.error!,
            attempt: attempts + 1,
            nextRetryAt: new Date(nextRetryAt).toISOString(),
          },
        });
        void publishStats();
        return;
      }
    } else {
      logJobEvent({
        jobId: job.id,
        event: "job_completed",
        message: "Job completed successfully",
        meta: { durationMs: handlerResult.durationMs },
      });
      const completed = await dbClient.markJobCompleted(
        job.id,
        handlerResult.result!,
        handlerResult.durationMs,
      );
      publish({ type: "job.completed", payload: { job: completed } });
      void publishStats();

      if (job.recur_interval !== null) {
        const nextJob = await dbClient.scheduleNextRecurringRun(job);
        publish({ type: "job.created", payload: { job: nextJob } });
      }

      return;
    }
  } catch (err) {
    const { attempt_count: attempts, max_retries } = job;
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (attempts + 1 >= max_retries) {
      logJobEvent({
        jobId: job.id,
        event: "job_failed",
        message: "Unexpected exception — retries exhausted, moving to DLQ",
        meta: { error: errorMessage },
      });
      const dead = await dbClient.markJobDeadLetter(job.id, errorMessage, 0);
      publish({ type: "job.failed", payload: { job: dead, error: errorMessage } });
      publish({ type: "job.dlq_entry", payload: { job: dead, error: errorMessage } });
      void publishStats();
      return;
    } else {
      const nextRetryAt = calculateNextRetryAt(attempts);
      logJobEvent({
        jobId: job.id,
        event: "retry_attempted",
        message: "Unexpected exception — scheduling retry",
        meta: { error: errorMessage, attempt: attempts + 1, max_retries },
      });
      const retried = await dbClient.markJobRetryable(
        job.id,
        errorMessage,
        new Date(nextRetryAt),
        0,
      );
      publish({
        type: "job.retry_scheduled",
        payload: {
          job: retried,
          error: errorMessage,
          attempt: attempts + 1,
          nextRetryAt: new Date(nextRetryAt).toISOString(),
        },
      });
      void publishStats();
      return;
    }
  }
}

const calculateNextRetryAt = (attemptCount: number): number => {
  const BASE_DELAYS = [1_000, 5_000, 25_000];
  const base = BASE_DELAYS[Math.min(attemptCount, BASE_DELAYS.length - 1)];
  const jitter = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x
  return Date.now() + Math.floor(base * jitter);
};
