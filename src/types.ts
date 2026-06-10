export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export type Job = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: 1 | 2 | 3;
  attempt_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  scheduled_at: Date;
  recur_interval: string | null;
  last_error: string | null;
  result: Record<string, unknown> | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type JobAttempt = {
  id: number;
  job_id: string;
  attempt_num: number;
  error: string;
  duration_ms: number;
  attempted_at: Date;
};

export type JobLog = {
  id: string;
  job_id: string;
  event: string;
  message: string;
  created_at: Date;
};

export type SortField = "attempt_count" | "max_retries" | "priority";
export type SortOrder = "asc" | "desc";

export type JobQueryOptions = {
  type?: string;
  status?: JobStatus;
  priority?: 1 | 2 | 3;

  limit?: number;
  page?: number;

  min_attempt_count?: number;
  max_attempt_count?: number;

  min_max_retries?: number;
  max_max_retries?: number;

  next_retry_before?: Date;
  next_retry_after?: Date;

  scheduled_before?: Date;
  scheduled_after?: Date;

  recur_interval?: string;

  started_before?: Date;
  started_after?: Date;

  completed_before?: Date;
  completed_after?: Date;

  cancelled_before?: Date;
  cancelled_after?: Date;

  created_before?: Date;
  created_after?: Date;

  updated_before?: Date;
  updated_after?: Date;

  sort_by?: SortField;
  sort_order?: SortOrder;
};
