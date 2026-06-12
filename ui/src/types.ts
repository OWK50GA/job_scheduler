// Mirrors backend src/types.ts — date fields are ISO 8601 strings (JSON serialised form)

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type Job = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: 1 | 2 | 3;
  attempt_count: number;
  max_retries: number;
  next_retry_at: string | null;
  scheduled_at: string;
  recur_interval: string | null;
  last_error: string | null;
  result: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobStats = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  dlq: number;
  total: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type SSEEvent = {
  type: string;
  payload: Job;
};

export type JobAttempt = {
  id: number;
  job_id: string;
  attempt_num: number;
  error: string | null;
  duration_ms: number | null;
  attempted_at: string; // ISO 8601
};

export type CreateJobInput = {
  type: string;
  payload: Record<string, unknown>;
  priority: 1 | 2 | 3;
  scheduled_at?: number; // Unix ms timestamp (optional)
  recur_interval?: "every_1_minute" | "every_5_minutes" | "every_1_hour";
  depends_on?: string; // UUID of a job this one depends on
};
