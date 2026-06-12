import type {
  Job,
  JobStats,
  JobStatus,
  PaginatedResponse,
  CreateJobInput,
} from "../types";

export type JobQueryOptions = {
  type?: string;
  status?: JobStatus;
  priority?: 1 | 2 | 3;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
};

// ---------------------------------------------------------------------------
// Shared dummy job fixtures
// ---------------------------------------------------------------------------

// DUMMY DATA
const DUMMY_JOB_1: Job = {
  id: "job-001-aabbccdd",
  type: "ASYNC_TASK",
  payload: { taskName: "generate-report", userId: 42 },
  status: "completed",
  priority: 2,
  attempt_count: 1,
  max_retries: 3,
  next_retry_at: null,
  scheduled_at: "2025-07-01T08:00:00.000Z",
  recur_interval: null,
  last_error: null,
  result: { reportUrl: "https://example.com/reports/42.pdf" },
  started_at: "2025-07-01T08:00:01.000Z",
  completed_at: "2025-07-01T08:00:04.523Z",
  cancelled_at: null,
  created_at: "2025-07-01T07:59:50.000Z",
  updated_at: "2025-07-01T08:00:04.523Z",
};

// DUMMY DATA
const DUMMY_JOB_2: Job = {
  id: "job-002-eeff0011",
  type: "WEBHOOK_EVENT",
  payload: { event: "user.signup", email: "alice@example.com" },
  status: "processing",
  priority: 1,
  attempt_count: 2,
  max_retries: 5,
  next_retry_at: null,
  scheduled_at: "2025-07-01T09:15:00.000Z",
  recur_interval: null,
  last_error: "Upstream timeout",
  result: null,
  started_at: "2025-07-01T09:15:02.000Z",
  completed_at: null,
  cancelled_at: null,
  created_at: "2025-07-01T09:14:55.000Z",
  updated_at: "2025-07-01T09:15:02.000Z",
};

// DUMMY DATA
const DUMMY_JOB_3: Job = {
  id: "job-003-22334455",
  type: "ASYNC_TASK",
  payload: { taskName: "send-digest", segment: "premium" },
  status: "failed",
  priority: 3,
  attempt_count: 3,
  max_retries: 3,
  next_retry_at: null,
  scheduled_at: "2025-07-01T06:00:00.000Z",
  recur_interval: "1h",
  last_error: "ConnectionRefusedError: ECONNREFUSED 127.0.0.1:5432",
  result: null,
  started_at: "2025-07-01T06:00:01.000Z",
  completed_at: null,
  cancelled_at: null,
  created_at: "2025-07-01T05:59:45.000Z",
  updated_at: "2025-07-01T06:02:30.000Z",
};

// DUMMY DATA
const DUMMY_JOB_4: Job = {
  id: "job-004-66778899",
  type: "WEBHOOK_EVENT",
  payload: { event: "payment.failed", orderId: "ORD-9981" },
  status: "pending",
  priority: 1,
  attempt_count: 0,
  max_retries: 5,
  next_retry_at: "2025-07-02T10:00:00.000Z",
  scheduled_at: "2025-07-02T10:00:00.000Z",
  recur_interval: null,
  last_error: null,
  result: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: "2025-07-01T22:00:00.000Z",
  updated_at: "2025-07-01T22:00:00.000Z",
};

// DUMMY DATA
const DUMMY_JOB_5: Job = {
  id: "job-005-aabbccee",
  type: "ASYNC_TASK",
  payload: { taskName: "cleanup-temp-files" },
  status: "cancelled",
  priority: 3,
  attempt_count: 0,
  max_retries: 1,
  next_retry_at: null,
  scheduled_at: "2025-07-01T03:00:00.000Z",
  recur_interval: null,
  last_error: null,
  result: null,
  started_at: null,
  completed_at: null,
  cancelled_at: "2025-07-01T03:00:00.100Z",
  created_at: "2025-07-01T02:59:00.000Z",
  updated_at: "2025-07-01T03:00:00.100Z",
};

// DUMMY DATA
const ALL_DUMMY_JOBS: Job[] = [
  DUMMY_JOB_1,
  DUMMY_JOB_2,
  DUMMY_JOB_3,
  DUMMY_JOB_4,
  DUMMY_JOB_5,
];

// DUMMY DATA
const DLQ_DUMMY_JOB_1: Job = {
  id: "dlq-001-ffaabbcc",
  type: "ASYNC_TASK",
  payload: { taskName: "sync-crm", accountId: "ACC-1234" },
  status: "failed",
  priority: 1,
  attempt_count: 5,
  max_retries: 5,
  next_retry_at: null,
  scheduled_at: "2025-06-30T12:00:00.000Z",
  recur_interval: null,
  last_error: "Error: CRM API rate limit exceeded after 5 attempts",
  result: null,
  started_at: "2025-06-30T12:00:01.000Z",
  completed_at: null,
  cancelled_at: null,
  created_at: "2025-06-30T11:59:50.000Z",
  updated_at: "2025-06-30T12:05:33.000Z",
};

// DUMMY DATA
const DLQ_DUMMY_JOB_2: Job = {
  id: "dlq-002-ddeeff00",
  type: "WEBHOOK_EVENT",
  payload: { event: "subscription.cancelled", customerId: "CUST-8877" },
  status: "failed",
  priority: 2,
  attempt_count: 3,
  max_retries: 3,
  next_retry_at: null,
  scheduled_at: "2025-06-30T14:30:00.000Z",
  recur_interval: null,
  last_error: "TimeoutError: Webhook endpoint did not respond within 5000ms",
  result: null,
  started_at: "2025-06-30T14:30:02.000Z",
  completed_at: null,
  cancelled_at: null,
  created_at: "2025-06-30T14:29:55.000Z",
  updated_at: "2025-06-30T14:32:18.000Z",
};

// DUMMY DATA
const ALL_DLQ_JOBS: Job[] = [DLQ_DUMMY_JOB_1, DLQ_DUMMY_JOB_2];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.json() as Promise<T>;
  }
  let message: string | undefined;
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === "string") {
      message = body.message;
    }
  } catch {
    // body was not JSON — fall through to default message
  }
  throw new Error(message ?? `Request failed with status ${res.status}`);
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listJobs(
  _params?: Partial<JobQueryOptions>,
): Promise<PaginatedResponse<Job>> {
  // DUMMY DATA
  return {
    data: ALL_DUMMY_JOBS,
    meta: { page: 1, limit: 20, total: ALL_DUMMY_JOBS.length },
  };
}

export async function listDLQJobs(
  _page?: number,
  _limit?: number,
): Promise<PaginatedResponse<Job>> {
  // DUMMY DATA
  return {
    data: ALL_DLQ_JOBS,
    meta: { page: _page ?? 1, limit: _limit ?? 10, total: ALL_DLQ_JOBS.length },
  };
}

export async function getJobStats(): Promise<JobStats> {
  // DUMMY DATA
  return {
    pending: 4,
    processing: 2,
    completed: 138,
    failed: 7,
    cancelled: 3,
    dlq: 2,
    total: 156,
  };
}

export async function getJob(_id: string): Promise<Job> {
  // DUMMY DATA
  const job =
    [...ALL_DUMMY_JOBS, ...ALL_DLQ_JOBS].find((j) => j.id === _id) ??
    ALL_DUMMY_JOBS[0];
  return job;
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<Job>(res);
}

export async function cancelJob(_id: string): Promise<Job> {
  // DUMMY DATA
  return { ...ALL_DUMMY_JOBS[0], id: _id, status: "cancelled" };
}

export async function retryJob(id: string): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse<Job>(res);
}
