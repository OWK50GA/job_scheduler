import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../components/shared/StatCard";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { StatusBadge } from "../components/shared/StatusBadge";
import { Pagination } from "../components/shared/Pagination";
import type { Job, JobStatus } from "../types";

// ---------------------------------------------------------------------------
// DUMMY DATA — metric card values
// ---------------------------------------------------------------------------
const METRIC_ACTIVE_WORKERS = 8; // DUMMY DATA
const METRIC_SUCCESS_RATE = "94.3%"; // DUMMY DATA
const METRIC_SUCCESS_RATE_DELTA = "+2.1% vs yesterday"; // DUMMY DATA
const METRIC_AVG_RUNTIME = "1 240 ms"; // DUMMY DATA
const METRIC_AVG_RUNTIME_DELTA = "-80ms vs yesterday"; // DUMMY DATA
const METRIC_FAILURES_24H = 7; // DUMMY DATA
const METRIC_FAILURES_24H_DELTA = "+3 vs yesterday"; // DUMMY DATA

// ---------------------------------------------------------------------------
// DUMMY DATA — jobs table rows
// ---------------------------------------------------------------------------
const DUMMY_WORKER_LABEL: Record<string, string> = {
  "job-001-aabbccdd": "worker-node-01", // DUMMY DATA
  "job-002-eeff0011": "worker-node-02", // DUMMY DATA
  "job-003-22334455": "worker-node-03", // DUMMY DATA
  "job-004-66778899": "worker-node-04", // DUMMY DATA
  "job-005-aabbccee": "worker-node-01", // DUMMY DATA
  "job-006-bbccddee": "worker-node-02", // DUMMY DATA
  "job-007-ccddeeff": "worker-node-03", // DUMMY DATA
  "job-008-ddeeff00": "worker-node-04", // DUMMY DATA
  "job-009-eeff0011": "worker-node-01", // DUMMY DATA
  "job-010-ff001122": "worker-node-02", // DUMMY DATA
  "job-011-00112233": "worker-node-03", // DUMMY DATA
  "job-012-11223344": "worker-node-04", // DUMMY DATA
  "job-013-22334455": "worker-node-01", // DUMMY DATA
  "job-014-33445566": "worker-node-02", // DUMMY DATA
  "job-015-44556677": "worker-node-03", // DUMMY DATA
  "job-016-55667788": "worker-node-04", // DUMMY DATA
  "job-017-66778899": "worker-node-01", // DUMMY DATA
  "job-018-778899aa": "worker-node-02", // DUMMY DATA
  "job-019-8899aabb": "worker-node-03", // DUMMY DATA
  "job-020-99aabbcc": "worker-node-04", // DUMMY DATA
  "job-021-aabbccdd": "worker-node-01", // DUMMY DATA
  "job-022-bbccddee": "worker-node-02", // DUMMY DATA
  "job-023-ccddeeff": "worker-node-03", // DUMMY DATA
  "job-024-ddeeff00": "worker-node-04", // DUMMY DATA
  "job-025-eeff0011": "worker-node-01", // DUMMY DATA
};

// DUMMY DATA
const DUMMY_JOBS: Job[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: "job-006-bbccddee",
    type: "ASYNC_TASK",
    payload: { taskName: "sync-inventory", warehouse: "WH-07" },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T10:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { synced: 1430 },
    started_at: "2025-07-01T10:30:01.000Z",
    completed_at: "2025-07-01T10:32:15.000Z",
    cancelled_at: null,
    created_at: "2025-07-01T10:29:50.000Z",
    updated_at: "2025-07-01T10:32:15.000Z",
  },
  {
    id: "job-007-ccddeeff",
    type: "WEBHOOK_EVENT",
    payload: { event: "order.shipped", orderId: "ORD-5510" },
    status: "failed",
    priority: 1,
    attempt_count: 5,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-01T11:00:00.000Z",
    recur_interval: null,
    last_error: "TimeoutError: endpoint did not respond within 5000ms",
    result: null,
    started_at: "2025-07-01T11:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T10:59:40.000Z",
    updated_at: "2025-07-01T11:05:10.000Z",
  },
  {
    id: "job-008-ddeeff00",
    type: "ASYNC_TASK",
    payload: { taskName: "compress-images", bucket: "media-prod" },
    status: "processing",
    priority: 3,
    attempt_count: 1,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-01T11:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-01T11:30:02.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T11:29:55.000Z",
    updated_at: "2025-07-01T11:30:02.000Z",
  },
  {
    id: "job-009-eeff0011",
    type: "WEBHOOK_EVENT",
    payload: { event: "user.deactivated", userId: 9182 },
    status: "pending",
    priority: 2,
    attempt_count: 0,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T12:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T11:59:00.000Z",
    updated_at: "2025-07-01T11:59:00.000Z",
  },
  {
    id: "job-010-ff001122",
    type: "ASYNC_TASK",
    payload: { taskName: "recalculate-scores", cohort: "Q2-2025" },
    status: "completed",
    priority: 1,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T07:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { updated: 5_021 },
    started_at: "2025-07-01T07:00:01.000Z",
    completed_at: "2025-07-01T07:04:38.000Z",
    cancelled_at: null,
    created_at: "2025-07-01T06:59:45.000Z",
    updated_at: "2025-07-01T07:04:38.000Z",
  },
  {
    id: "job-011-00112233",
    type: "ASYNC_TASK",
    payload: { taskName: "export-audit-log", fromDate: "2025-06-01" },
    status: "failed",
    priority: 2,
    attempt_count: 2,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-01T04:00:00.000Z",
    recur_interval: null,
    last_error: "Error: S3 PutObject failed — access denied",
    result: null,
    started_at: "2025-07-01T04:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T03:59:50.000Z",
    updated_at: "2025-07-01T04:03:22.000Z",
  },
  {
    id: "job-012-11223344",
    type: "WEBHOOK_EVENT",
    payload: { event: "refund.processed", transactionId: "TXN-334455" },
    status: "completed",
    priority: 1,
    attempt_count: 1,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-01T13:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { status: "refunded" },
    started_at: "2025-07-01T13:00:01.000Z",
    completed_at: "2025-07-01T13:00:03.110Z",
    cancelled_at: null,
    created_at: "2025-07-01T12:59:55.000Z",
    updated_at: "2025-07-01T13:00:03.110Z",
  },
  {
    id: "job-013-22334455",
    type: "ASYNC_TASK",
    payload: { taskName: "warm-cache", region: "eu-west-1" },
    status: "cancelled",
    priority: 3,
    attempt_count: 0,
    max_retries: 1,
    next_retry_at: null,
    scheduled_at: "2025-07-01T14:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: "2025-07-01T14:00:00.200Z",
    created_at: "2025-07-01T13:59:00.000Z",
    updated_at: "2025-07-01T14:00:00.200Z",
  },
  {
    id: "job-014-33445566",
    type: "WEBHOOK_EVENT",
    payload: { event: "subscription.renewed", customerId: "CUST-0042" },
    status: "processing",
    priority: 1,
    attempt_count: 1,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-01T14:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-01T14:30:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T14:29:50.000Z",
    updated_at: "2025-07-01T14:30:01.000Z",
  },
  {
    id: "job-015-44556677",
    type: "ASYNC_TASK",
    payload: { taskName: "reindex-search", index: "products-v3" },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T15:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { indexed: 88_320 },
    started_at: "2025-07-01T15:00:01.000Z",
    completed_at: "2025-07-01T15:12:44.000Z",
    cancelled_at: null,
    created_at: "2025-07-01T14:59:45.000Z",
    updated_at: "2025-07-01T15:12:44.000Z",
  },
  {
    id: "job-016-55667788",
    type: "WEBHOOK_EVENT",
    payload: { event: "invoice.created", invoiceId: "INV-7788" },
    status: "pending",
    priority: 2,
    attempt_count: 0,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T16:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T15:59:00.000Z",
    updated_at: "2025-07-01T15:59:00.000Z",
  },
  {
    id: "job-017-66778899",
    type: "ASYNC_TASK",
    payload: { taskName: "notify-inactive-users", daysInactive: 30 },
    status: "failed",
    priority: 3,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T16:30:00.000Z",
    recur_interval: null,
    last_error: "Error: SMTP relay rejected message — rate limit",
    result: null,
    started_at: "2025-07-01T16:30:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T16:29:50.000Z",
    updated_at: "2025-07-01T16:33:05.000Z",
  },
  {
    id: "job-018-778899aa",
    type: "WEBHOOK_EVENT",
    payload: { event: "account.verified", userId: 7712 },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T17:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { notified: true },
    started_at: "2025-07-01T17:00:01.000Z",
    completed_at: "2025-07-01T17:00:02.540Z",
    cancelled_at: null,
    created_at: "2025-07-01T16:59:55.000Z",
    updated_at: "2025-07-01T17:00:02.540Z",
  },
  {
    id: "job-019-8899aabb",
    type: "ASYNC_TASK",
    payload: { taskName: "rotate-api-keys", service: "billing" },
    status: "processing",
    priority: 1,
    attempt_count: 1,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-01T17:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-01T17:30:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T17:29:50.000Z",
    updated_at: "2025-07-01T17:30:01.000Z",
  },
  {
    id: "job-020-99aabbcc",
    type: "WEBHOOK_EVENT",
    payload: { event: "trial.expired", userId: 3391 },
    status: "pending",
    priority: 3,
    attempt_count: 0,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T18:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T17:59:00.000Z",
    updated_at: "2025-07-01T17:59:00.000Z",
  },
  {
    id: "job-021-aabbccdd",
    type: "ASYNC_TASK",
    payload: { taskName: "archive-old-jobs", olderThan: "2025-01-01" },
    status: "completed",
    priority: 3,
    attempt_count: 1,
    max_retries: 1,
    next_retry_at: null,
    scheduled_at: "2025-07-01T18:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { archived: 4_210 },
    started_at: "2025-07-01T18:30:01.000Z",
    completed_at: "2025-07-01T18:35:20.000Z",
    cancelled_at: null,
    created_at: "2025-07-01T18:29:45.000Z",
    updated_at: "2025-07-01T18:35:20.000Z",
  },
  {
    id: "job-022-bbccddee",
    type: "WEBHOOK_EVENT",
    payload: { event: "password.reset", userId: 5543 },
    status: "cancelled",
    priority: 2,
    attempt_count: 0,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T19:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: "2025-07-01T19:00:00.300Z",
    created_at: "2025-07-01T18:59:00.000Z",
    updated_at: "2025-07-01T19:00:00.300Z",
  },
  {
    id: "job-023-ccddeeff",
    type: "ASYNC_TASK",
    payload: { taskName: "send-weekly-report", channel: "slack" },
    status: "failed",
    priority: 2,
    attempt_count: 2,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-01T19:30:00.000Z",
    recur_interval: null,
    last_error: "Error: Slack API 429 Too Many Requests",
    result: null,
    started_at: "2025-07-01T19:30:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T19:29:50.000Z",
    updated_at: "2025-07-01T19:32:08.000Z",
  },
  {
    id: "job-024-ddeeff00",
    type: "WEBHOOK_EVENT",
    payload: { event: "plan.upgraded", customerId: "CUST-9012" },
    status: "completed",
    priority: 1,
    attempt_count: 1,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-01T20:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { activated: true },
    started_at: "2025-07-01T20:00:01.000Z",
    completed_at: "2025-07-01T20:00:02.890Z",
    cancelled_at: null,
    created_at: "2025-07-01T19:59:50.000Z",
    updated_at: "2025-07-01T20:00:02.890Z",
  },
  {
    id: "job-025-eeff0011",
    type: "ASYNC_TASK",
    payload: { taskName: "rebuild-materialized-views" },
    status: "processing",
    priority: 1,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T20:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-01T20:30:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T20:29:50.000Z",
    updated_at: "2025-07-01T20:30:01.000Z",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSubmittedAt(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

function computeRuntime(job: Job): string {
  if (!job.started_at || !job.completed_at) return "—";
  const ms =
    new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
  return `${ms} ms`;
}

function getWorkerLabel(jobId: string): string {
  return DUMMY_WORKER_LABEL[jobId] ?? "worker-node-01"; // DUMMY DATA
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const styles = {
  page: {
    padding: "1.5rem",
    color: "#f8fafc",
    fontFamily:
      "Geist, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    minHeight: "100vh",
    backgroundColor: "#051424",
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  title: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#f8fafc",
    margin: 0,
  } as React.CSSProperties,

  headerActions: {
    display: "flex",
    gap: "0.75rem",
  } as React.CSSProperties,

  btnPrimary: {
    padding: "0.5rem 1rem",
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    border: "none",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontFamily: "inherit",
  } as React.CSSProperties,

  btnSecondary: {
    padding: "0.5rem 1rem",
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontFamily: "inherit",
  } as React.CSSProperties,

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  filterBar: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap" as const,
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: "0.875rem 1rem",
    borderRadius: "0.5rem",
    marginBottom: "1rem",
    border: "1px solid #1e293b",
  } as React.CSSProperties,

  filterLabel: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  select: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    padding: "0.375rem 0.5rem",
    fontSize: "0.875rem",
    cursor: "pointer",
    fontFamily: "inherit",
    outline: "none",
  } as React.CSSProperties,

  dateInput: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    padding: "0.375rem 0.5rem",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    colorScheme: "dark" as const,
  } as React.CSSProperties,

  tableContainer: {
    backgroundColor: "#0f172a",
    borderRadius: "0.5rem",
    border: "1px solid #1e293b",
    overflow: "hidden",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.875rem",
  } as React.CSSProperties,

  th: {
    padding: "0.75rem 1rem",
    textAlign: "left" as const,
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #1e293b",
    backgroundColor: "#0f172a",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #1e293b",
    color: "#f8fafc",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,

  tdMuted: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #1e293b",
    color: "#94a3b8",
    verticalAlign: "middle" as const,
    fontVariantNumeric: "tabular-nums" as const,
  } as React.CSSProperties,

  jobId: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "0.75rem",
    color: "#0ea5e9",
  } as React.CSSProperties,

  typeLabel: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#f8fafc",
  } as React.CSSProperties,

  workerLabel: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    marginTop: "2px",
  } as React.CSSProperties,

  btnAction: {
    padding: "0.25rem 0.625rem",
    border: "none",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.025em",
  } as React.CSSProperties,

  emptyRow: {
    textAlign: "center" as const,
    padding: "3rem 1rem",
    color: "#475569",
    fontSize: "0.875rem",
  } as React.CSSProperties,

  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.875rem 1rem",
    borderTop: "1px solid #1e293b",
    backgroundColor: "#0f172a",
  } as React.CSSProperties,

  paginationInfo: {
    fontSize: "0.8rem",
    color: "#94a3b8",
  } as React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function JobsLedger() {
  const navigate = useNavigate();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<"" | JobStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "1" | "2" | "3">(
    "",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Compute filtered list
  const filteredJobs = useMemo(() => {
    return DUMMY_JOBS.filter((job) => {
      // DUMMY DATA
      if (statusFilter && job.status !== statusFilter) return false;
      if (priorityFilter && job.priority !== Number(priorityFilter))
        return false;
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (new Date(job.created_at).getTime() < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime();
        if (new Date(job.created_at).getTime() > to) return false;
      }
      return true;
    });
  }, [statusFilter, priorityFilter, dateFrom, dateTo]);

  // Reset to page 1 whenever filter changes
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageJobs = filteredJobs.slice(pageStart, pageEnd);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  // Reset page when filters change
  const handleStatusChange = (v: "" | JobStatus) => {
    setStatusFilter(v);
    setCurrentPage(1);
  };
  const handlePriorityChange = (v: "" | "1" | "2" | "3") => {
    setPriorityFilter(v);
    setCurrentPage(1);
  };
  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    setCurrentPage(1);
  };
  const handleDateToChange = (v: string) => {
    setDateTo(v);
    setCurrentPage(1);
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Jobs Ledger</h1>
        <div style={styles.headerActions}>
          <button
            style={styles.btnSecondary}
            onClick={() => {
              /* non-functional placeholder */
            }}
            aria-label="Export CSV"
          >
            <span className="material-icons" style={{ fontSize: "1rem" }}>
              download
            </span>
            Export CSV
          </button>
          <button
            style={styles.btnPrimary}
            onClick={() => navigate("/jobs/new")}
            aria-label="New Manual Job"
          >
            <span className="material-icons" style={{ fontSize: "1rem" }}>
              add
            </span>
            New Manual Job
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div style={styles.metricsGrid}>
        <StatCard
          label="Active Workers"
          value={METRIC_ACTIVE_WORKERS /* DUMMY DATA */}
          accentColor="#0ea5e9"
          icon="engineering"
        />
        <StatCard
          label="Success Rate (24h)"
          value={METRIC_SUCCESS_RATE /* DUMMY DATA */}
          accentColor="#10b981"
          delta={METRIC_SUCCESS_RATE_DELTA /* DUMMY DATA */}
          icon="trending_up"
        />
        <StatCard
          label="Avg. Runtime"
          value={METRIC_AVG_RUNTIME /* DUMMY DATA */}
          accentColor="#f59e0b"
          delta={METRIC_AVG_RUNTIME_DELTA /* DUMMY DATA */}
          icon="timer"
        />
        <StatCard
          label="Failures (24h)"
          value={METRIC_FAILURES_24H /* DUMMY DATA */}
          accentColor="#ef4444"
          delta={METRIC_FAILURES_24H_DELTA /* DUMMY DATA */}
          icon="error_outline"
        />
      </div>

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <span style={styles.filterLabel}>Filters:</span>

        {/* Status */}
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as "" | JobStatus)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
          <option value="pending">Queued / Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Priority */}
        <select
          style={styles.select}
          value={priorityFilter}
          onChange={(e) =>
            handlePriorityChange(e.target.value as "" | "1" | "2" | "3")
          }
          aria-label="Filter by priority"
        >
          <option value="">All Priorities</option>
          <option value="1">Critical / High (1)</option>
          <option value="2">Med (2)</option>
          <option value="3">Low (3)</option>
        </select>

        {/* Date range */}
        <span style={styles.filterLabel}>From:</span>
        <input
          type="datetime-local"
          style={styles.dateInput}
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
          aria-label="Date range from"
        />
        <span style={styles.filterLabel}>To:</span>
        <input
          type="datetime-local"
          style={styles.dateInput}
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
          aria-label="Date range to"
        />
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Job ID</th>
              <th style={styles.th}>Type / Worker</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Submitted At</th>
              <th style={styles.th}>Runtime</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageJobs.length === 0 ? (
              <tr>
                <td colSpan={7} style={styles.emptyRow}>
                  No jobs match the current filters.
                </td>
              </tr>
            ) : (
              pageJobs.map((job) => (
                <tr key={job.id}>
                  {/* Job ID */}
                  <td style={styles.td}>
                    <span style={styles.jobId}>{job.id}</span>
                  </td>

                  {/* Type / Worker */}
                  <td style={styles.td}>
                    <div style={styles.typeLabel}>{job.type}</div>
                    <div style={styles.workerLabel}>
                      {getWorkerLabel(job.id)}
                    </div>
                  </td>

                  {/* Priority */}
                  <td style={styles.td}>
                    <PriorityBadge priority={job.priority} />
                  </td>

                  {/* Submitted At */}
                  <td style={styles.tdMuted}>
                    {formatSubmittedAt(job.created_at)}
                  </td>

                  {/* Runtime */}
                  <td style={styles.tdMuted}>{computeRuntime(job)}</td>

                  {/* Status */}
                  <td style={styles.td}>
                    <StatusBadge status={job.status} />
                  </td>

                  {/* Actions */}
                  <td style={styles.td}>
                    {(job.status === "pending" ||
                      job.status === "processing") && (
                      <button
                        style={{
                          ...styles.btnAction,
                          backgroundColor: "#1e293b",
                          color: "#f59e0b",
                          border: "1px solid #f59e0b33",
                        }}
                        aria-label={`Cancel job ${job.id}`}
                        onClick={() => {
                          /* placeholder — no API wired */
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === "failed" && (
                      <button
                        style={{
                          ...styles.btnAction,
                          backgroundColor: "#1e293b",
                          color: "#0ea5e9",
                          border: "1px solid #0ea5e933",
                        }}
                        aria-label={`Retry job ${job.id}`}
                        onClick={() => {
                          /* placeholder — no API wired */
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination bar */}
        <div style={styles.paginationBar}>
          <span style={styles.paginationInfo}>
            Showing {filteredJobs.length === 0 ? 0 : pageStart + 1}–
            {Math.min(pageEnd, filteredJobs.length)} of {filteredJobs.length}{" "}
            jobs
          </span>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>
      </div>
    </div>
  );
}
