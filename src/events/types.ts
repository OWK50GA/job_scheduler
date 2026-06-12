import type { Job, JobStats } from "../types";

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

/** Single Redis pub/sub channel for all scheduler events. */
export const SCHEDULER_CHANNEL = "scheduler:events" as const;

// ---------------------------------------------------------------------------
// Event type literals
// ---------------------------------------------------------------------------

export type SchedulerEventType =
  | "job.created"
  | "job.started"
  | "job.completed"
  | "job.failed"       // exhausted retries → DLQ
  | "job.retry_scheduled"
  | "job.cancelled"
  | "job.dlq_entry"    // alias for job.failed, consumed by DLQ panels
  | "stats.updated";   // fires after any status transition

// ---------------------------------------------------------------------------
// Per-event payload shapes
// ---------------------------------------------------------------------------

export type JobCreatedEvent = {
  type: "job.created";
  payload: { job: Job };
};

export type JobStartedEvent = {
  type: "job.started";
  payload: { job: Job };
};

export type JobCompletedEvent = {
  type: "job.completed";
  payload: { job: Job };
};

export type JobFailedEvent = {
  type: "job.failed";
  payload: { job: Job; error: string };
};

export type JobRetryScheduledEvent = {
  type: "job.retry_scheduled";
  payload: { job: Job; error: string; attempt: number; nextRetryAt: string };
};

export type JobCancelledEvent = {
  type: "job.cancelled";
  payload: { job: Job };
};

export type JobDlqEntryEvent = {
  type: "job.dlq_entry";
  payload: { job: Job; error: string };
};

export type StatsUpdatedEvent = {
  type: "stats.updated";
  payload: { stats: JobStats };
};

// ---------------------------------------------------------------------------
// Discriminated union — everything the SSE stream can carry
// ---------------------------------------------------------------------------

export type SchedulerEvent =
  | JobCreatedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | JobRetryScheduledEvent
  | JobCancelledEvent
  | JobDlqEntryEvent
  | StatsUpdatedEvent;
