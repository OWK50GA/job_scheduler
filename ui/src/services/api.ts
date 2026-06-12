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
  params?: Partial<JobQueryOptions>,
): Promise<PaginatedResponse<Job>> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.priority) query.set("priority", String(params.priority));
  if (params?.type) query.set("type", params.type);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.sort_order) query.set("sort_order", params.sort_order);

  const qs = query.toString();
  const res = await fetch(`/api/v1/jobs${qs ? `?${qs}` : ""}`);
  const body = await handleResponse<{
    status: string;
    data: Job[];
    meta: { page: number; limit: number; total: number };
  }>(res);
  return { data: body.data, meta: body.meta };
}

export async function listDLQJobs(
  _page?: number,
  _limit?: number,
): Promise<PaginatedResponse<Job>> {
  const query = new URLSearchParams();
  if (_page) query.set("page", String(_page));
  if (_limit) query.set("limit", String(_limit));
  const qs = query.toString();
  const res = await fetch(`/api/v1/jobs/dlq${qs ? `?${qs}` : ""}`);
  const body = await handleResponse<{
    status: string;
    data: Job[];
    meta: { page: number; limit: number; total: number };
  }>(res);
  return { data: body.data, meta: body.meta };
}

export async function getJobStats(): Promise<JobStats> {
  const res = await fetch("/api/v1/jobs/stats");
  const body = await handleResponse<{ status: string; data: JobStats }>(res);
  return body.data;
}

export async function getJob(_id: string): Promise<Job> {
  const res = await fetch(`/api/v1/jobs/${_id}`);
  const body = await handleResponse<{ status: string; data: Job }>(res);
  return body.data;
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const res = await fetch("/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await handleResponse<{ status: string; data: Job }>(res);
  return body.data;
}

export async function cancelJob(_id: string): Promise<Job> {
  const res = await fetch(`/api/v1/jobs/${_id}/cancel`, { method: "POST" });
  const body = await handleResponse<{ status: string; data: Job }>(res);
  return body.data;
}

export async function retryJob(id: string): Promise<Job> {
  const res = await fetch(`/api/v1/jobs/${id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await handleResponse<{ status: string; data: Job }>(res);
  return body.data;
}

export async function purgeJob(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/v1/jobs/${id}/purge`, { method: "DELETE" });
  const body = await handleResponse<{ status: string; data: { id: string } }>(res);
  return body.data;
}

export async function getJobAttempts(id: string): Promise<import("../types").JobAttempt[]> {
  const res = await fetch(`/api/v1/jobs/${id}/attempts`);
  const body = await handleResponse<{ status: string; data: import("../types").JobAttempt[] }>(res);
  return body.data;
}
