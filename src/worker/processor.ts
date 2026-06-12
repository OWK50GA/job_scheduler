import { DatabaseClient } from "../db";
import { Job, JobStatus } from "../types";
import { sendEmailHandler } from "./handlers";
import { logJobEvent } from "./logger";
import { JobHandler } from "./types";

const HANDLERS: Record<string, JobHandler> = {
  send_email: sendEmailHandler,
};

const dbClient = new DatabaseClient();

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
      return await dbClient.markJobDeadLetter(
        job.id,
        "No handler registered for job type",
        0,
      );
    }

    // Re-fetch to catch cancellations that arrived after claimNextJob
    const fetchedJob = await dbClient.getJob(job.id);

    if (!fetchedJob) {
      // Job disappeared from the DB between claim and fetch — treat as failure
      const { attempt_count: attempts, max_retries } = job;
      if (attempts + 1 >= max_retries) {
        logJobEvent({
          jobId: job.id,
          event: "job_failed",
          message: "Job not found on re-fetch — sending to DLQ",
        });
        return await dbClient.markJobDeadLetter(
          job.id,
          "Failed to confirm job status",
          0,
        );
      } else {
        const nextRetryAt = calculateNextRetryAt(attempts);
        logJobEvent({
          jobId: job.id,
          event: "retry_attempted",
          message: "Job not found on re-fetch — scheduling retry",
          meta: { attempt: attempts + 1, max_retries },
        });
        return await dbClient.markJobRetryable(
          job.id,
          "Failed to confirm job status",
          new Date(nextRetryAt),
          0,
        );
      }
    }

    if (fetchedJob.status === JobStatus.CANCELLED) {
      logJobEvent({
        jobId: job.id,
        event: "job_cancelled",
        message: "Job was cancelled before execution — skipping",
      });
      return await dbClient.cancelJob(job.id);
    }

    // DAG dependency gate — re-queue if any dependency has not yet completed.
    // The job was already claimed (status = processing), so we must reset it
    // back to pending so the poll loop can pick it up again later.
    const depsMet = await dbClient.checkDependenciesMet(job.id);
    if (!depsMet) {
      logJobEvent({
        jobId: job.id,
        event: "retry_attempted",
        message: "Dependencies not yet met - releasing back to pending",
      });
      // Reset to pending with a short backoff so it is not immediately
      // re-claimed before its dependencies have a chance to complete.
      const retryAt = new Date(Date.now() + 5_000);
      return await dbClient.markJobRetryable(
        job.id,
        "Waiting for dependencies",
        retryAt,
        0,
      );
    }

    logJobEvent({
      jobId: job.id,
      event: "job_started",
      message: "Job execution started",
      meta: { jobType: job.type, attempt: job.attempt_count + 1 },
    });

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
        return await dbClient.markJobDeadLetter(
          job.id,
          handlerResult.error!,
          handlerResult.durationMs,
        );
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
        return await dbClient.markJobRetryable(
          job.id,
          handlerResult.error!,
          new Date(nextRetryAt),
          handlerResult.durationMs,
        );
      }
    } else {
      logJobEvent({
        jobId: job.id,
        event: "job_completed",
        message: "Job completed successfully",
        meta: { durationMs: handlerResult.durationMs },
      });
      await dbClient.markJobCompleted(
        job.id,
        handlerResult.result!,
        handlerResult.durationMs,
      );

      if (job.recur_interval !== null) {
        await dbClient.scheduleNextRecurringRun(job);
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
      return await dbClient.markJobDeadLetter(job.id, errorMessage, 0);
    } else {
      const nextRetryAt = calculateNextRetryAt(attempts);
      logJobEvent({
        jobId: job.id,
        event: "retry_attempted",
        message: "Unexpected exception — scheduling retry",
        meta: { error: errorMessage, attempt: attempts + 1, max_retries },
      });
      return await dbClient.markJobRetryable(
        job.id,
        errorMessage,
        new Date(nextRetryAt),
        0,
      );
    }
  }
}

const calculateNextRetryAt = (attemptCount: number): number => {
  const BASE_DELAYS = [1_000, 5_000, 25_000];
  const base = BASE_DELAYS[Math.min(attemptCount, BASE_DELAYS.length - 1)];
  const jitter = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x
  return Date.now() + Math.floor(base * jitter);
};
