import { DatabaseClient } from "../db";
import { Job, JobStatus } from "../types";
import { sendEmailHandler } from "./handlers";
import { JobHandler } from "./types";

const HANDLERS: Record<string, JobHandler> = {
    "send_email": sendEmailHandler
}

const dbClient = new DatabaseClient();

export async function processJob(job: Job) {
    /**
     * Pseudocode:
     * - Receive job, the claimNextJob() has been called, and the job passed to this function
     * - Make sure the job is eligible to be retried, with max_retries and attempt number
     * - Setup jitter (after writing the bareback logic)
     * - Call job handler, receive result
     * - Based on the result, update state. This involves:
     * - Add a new row to job_attempts, 
     * - What exactly are we using job logs to do? Does this mean the logger I will setup will write to this row basically?
     * - Update the job row on the jobs table, for attempt_retry, status (completed or failed), etc
     * - If the job is recurring, should I schedule the next run inside here?
     */

    try {
        const handler = HANDLERS[job.type];
        
        if (!handler) {
            return await dbClient.markJobDeadLetter(job.id, "No handler registered for job type", 0);
        }

        const fetchedJob = await dbClient.getJob(job.id);
        if (!fetchedJob) {
            const attempts = job.attempt_count;
            const max_retries = job.max_retries;
            if (attempts + 1 >= max_retries) {
                return await dbClient.markJobDeadLetter(job.id, "Failed to confirm job status", 0);
            } else {
                const nextRetryAt = calculateNextRetryAt(attempts);
                return await dbClient.markJobRetryable(job.id, "Failed to confirm job status", new Date(nextRetryAt), 0);
            }
        }

        const { status } = fetchedJob
        if (status === JobStatus.CANCELLED) {
            // Handle the error as a failed attempt
            // Schedule next retry if eligible
            return await dbClient.cancelJob(job.id);
        }

        const handlerResult = await handler(job);

        if (!handlerResult.success) {
            // Handle the error as a failed attempt
            // Schedule next retry if eligible
            const { attempt_count: attempts, max_retries } = job;

            if (attempts + 1 >= max_retries) {
                return await dbClient.markJobDeadLetter(job.id, handlerResult.error!, handlerResult.durationMs);
            } else {
                const nextRetryAt = calculateNextRetryAt(attempts);
                return await dbClient.markJobRetryable(job.id, handlerResult.error!, new Date(nextRetryAt), handlerResult.durationMs);
            }
        } else {
            // Handle as a successful attempt
            await dbClient.markJobCompleted(job.id, handlerResult.result!, handlerResult.durationMs);

            if (job.recur_interval !== null) {
                await dbClient.scheduleNextRecurringRun(job);
            }

            return;
        }
    } catch (err) {
        const attempts = job.attempt_count;
        const max_retries = job.max_retries;
        if (attempts + 1 >= max_retries) {
            return await dbClient.markJobDeadLetter(job.id, err instanceof Error ? err.message : String(err), 0);
        } else {
            const nextRetryAt = calculateNextRetryAt(attempts);
            return await dbClient.markJobRetryable(job.id, err instanceof Error ? err.message : String(err), new Date(nextRetryAt), 0);
        }
    }
}

const calculateNextRetryAt = (attemptCount: number): number => {
    const BASE_DELAYS = [1_000, 5_000, 25_000];
    const base = BASE_DELAYS[Math.min(attemptCount, BASE_DELAYS.length - 1)];
    const jitter = 0.8 + Math.random() * 0.4;  // 0.8x to 1.2x
    return Date.now() + Math.floor(base * jitter);

}