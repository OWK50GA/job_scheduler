import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { MockBadge } from "../components/shared/MockBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { Pagination } from "../components/shared/Pagination";
import { Panel } from "../components/shared/Panel";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { StatCard } from "../components/shared/StatCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import type { Job, JobStatus } from "../types";

const METRIC_ACTIVE_WORKERS = 14; // DUMMY DATA
const METRIC_SUCCESS_RATE = "99.2%"; // DUMMY DATA
const METRIC_SUCCESS_RATE_DELTA = "+0.6% vs yesterday"; // DUMMY DATA
const METRIC_AVG_RUNTIME = "1.4s"; // DUMMY DATA
const METRIC_AVG_RUNTIME_DELTA = "-0.2s from avg"; // DUMMY DATA
const METRIC_FAILURES_24H = 12; // DUMMY DATA
const METRIC_FAILURES_24H_DELTA = "+2 since last peak"; // DUMMY DATA

const DUMMY_WORKER_LABEL: Record<string, string> = {
  "j-9f82d2a": "cdn-worker-04",
  "j-1a4e5f9": "mail-service-relay",
  "j-8b2c4x1": "search-cluster-01",
  "j-4v7n9m3": "redis-mgr-02",
  "j-0x9w2r4": "lambda-service",
  "j-3z7l1k9": "worker-sqs-prod",
  "j-7k0m1n2": "billing-router-02",
  "j-5p4q3r2": "core-engine-08",
  "j-4e3f2g1": "audit-export-01",
  "j-1b2c3d4": "etl-node-03",
}; // DUMMY DATA

const DUMMY_JOBS: Job[] = [
  {
    id: "j-9f82d2a",
    type: "ImageResize",
    payload: { taskName: "image.resize", bucket: "media-prod" },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T08:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { resized: 241 },
    started_at: "2025-07-01T08:00:01.000Z",
    completed_at: "2025-07-01T08:00:04.523Z",
    cancelled_at: null,
    created_at: "2025-07-01T07:59:50.000Z",
    updated_at: "2025-07-01T08:00:04.523Z",
  },
  {
    id: "j-1a4e5f9",
    type: "EmailDispatch",
    payload: { event: "user.signup", email: "alice@example.com" },
    status: "failed",
    priority: 1,
    attempt_count: 5,
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
    id: "j-8b2c4x1",
    type: "DataIndex",
    payload: { taskName: "search.reindex", index: "products-v3" },
    status: "processing",
    priority: 1,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T06:00:00.000Z",
    recur_interval: "1h",
    last_error: null,
    result: null,
    started_at: "2025-07-01T06:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T05:59:45.000Z",
    updated_at: "2025-07-01T06:02:30.000Z",
  },
  {
    id: "j-4v7n9m3",
    type: "CacheFlush",
    payload: { taskName: "cache.flush", region: "us-east-1" },
    status: "pending",
    priority: 3,
    attempt_count: 0,
    max_retries: 2,
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
    id: "j-0x9w2r4",
    type: "PDFExport",
    payload: { taskName: "invoice.export", userId: 18 },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T10:30:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { exported: true },
    started_at: "2025-07-01T10:30:01.000Z",
    completed_at: "2025-07-01T10:32:15.000Z",
    cancelled_at: null,
    created_at: "2025-07-01T10:29:50.000Z",
    updated_at: "2025-07-01T10:32:15.000Z",
  },
  {
    id: "j-3z7l1k9",
    type: "ReportGen",
    payload: { taskName: "report.generate", segment: "premium" },
    status: "completed",
    priority: 1,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T11:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { generated: 12 },
    started_at: "2025-07-01T11:00:01.000Z",
    completed_at: "2025-07-01T11:05:10.000Z",
    cancelled_at: null,
    created_at: "2025-07-01T10:59:40.000Z",
    updated_at: "2025-07-01T11:05:10.000Z",
  },
  {
    id: "j-7k0m1n2",
    type: "ChargeRetry",
    payload: { taskName: "billing.charge", invoiceId: "INV-882" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-01T12:00:00.000Z",
    recur_interval: null,
    last_error: "Gateway timeout",
    result: null,
    started_at: "2025-07-01T12:00:02.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T12:00:00.000Z",
    updated_at: "2025-07-01T12:20:00.654Z",
  },
  {
    id: "j-5p4q3r2",
    type: "WarmCache",
    payload: { taskName: "cache.warm", region: "eu-west-1" },
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
    id: "j-4e3f2g1",
    type: "AuditExport",
    payload: { taskName: "audit.export", fromDate: "2025-06-01" },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-01T17:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { exported: 4201 },
    started_at: "2025-07-01T17:00:07.000Z",
    completed_at: "2025-07-01T17:02:14.432Z",
    cancelled_at: null,
    created_at: "2025-07-01T17:00:00.000Z",
    updated_at: "2025-07-01T17:02:14.432Z",
  },
  {
    id: "j-1b2c3d4",
    type: "ETLTransform",
    payload: { taskName: "etl.transform", stage: "normalise" },
    status: "processing",
    priority: 2,
    attempt_count: 1,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-01T18:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-01T18:00:03.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-01T18:00:00.000Z",
    updated_at: "2025-07-01T18:01:55.210Z",
  },
]; // DUMMY DATA

function formatSubmittedAt(isoString: string) {
  const date = new Date(isoString);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function computeRuntime(job: Job) {
  if (!job.started_at || !job.completed_at) return "--";
  const ms =
    new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getWorkerLabel(jobId: string) {
  return DUMMY_WORKER_LABEL[jobId] ?? "worker-node-01"; // DUMMY DATA
}

const inputClassName =
  "h-9 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 font-body text-sm text-on-surface outline-none transition focus:border-primary";

const PAGE_SIZE = 5;

export default function JobsLedger() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"" | JobStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "1" | "2" | "3">(
    "",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredJobs = useMemo(() => {
    return DUMMY_JOBS.filter((job) => {
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
  }, [dateFrom, dateTo, priorityFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageJobs = filteredJobs.slice(pageStart, pageEnd);

  function resetFilters() {
    setStatusFilter("");
    setPriorityFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work Queue"
        title="Jobs Ledger"
        description="Real-time history and management of all background processing tasks, currently rendered from dummy data fixtures."
        badges={<MockBadge label="Dummy Data" />}
        actions={
          <>
            <Button icon="download" variant="secondary">
              Export CSV
            </Button>
            <Button
              icon="add"
              variant="primary"
              onClick={() => navigate("/jobs/new")}
            >
              New Manual Job
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Workers"
          value={METRIC_ACTIVE_WORKERS}
          accentColor="#0ea5e9"
        />
        <StatCard
          label="Success Rate (24h)"
          value={METRIC_SUCCESS_RATE}
          delta={METRIC_SUCCESS_RATE_DELTA}
          accentColor="#10b981"
          icon="trending_up"
        />
        <StatCard
          label="Avg. Runtime"
          value={METRIC_AVG_RUNTIME}
          delta={METRIC_AVG_RUNTIME_DELTA}
          accentColor="#f59e0b"
          icon="timer"
        />
        <StatCard
          label="Failures (24h)"
          value={METRIC_FAILURES_24H}
          delta={METRIC_FAILURES_24H_DELTA}
          accentColor="#ef4444"
          icon="warning"
        />
      </div>

      <Panel className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-end">
          <div className="xl:col-span-3">
            <label className="mb-2 block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
              Status
            </label>
            <select
              className={inputClassName}
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "" | JobStatus);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
              <option value="pending">Queued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="xl:col-span-3">
            <label className="mb-2 block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
              Priority
            </label>
            <select
              className={inputClassName}
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as "" | "1" | "2" | "3");
                setCurrentPage(1);
              }}
            >
              <option value="">All Priorities</option>
              <option value="1">Critical</option>
              <option value="2">Med</option>
              <option value="3">Low</option>
            </select>
          </div>
          <div className="xl:col-span-4">
            <label className="mb-2 block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
              Date Range
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="date"
                className={inputClassName}
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setCurrentPage(1);
                }}
              />
              <span className="font-body text-xs text-on-surface-variant">
                to
              </span>
              <input
                type="date"
                className={inputClassName}
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 xl:col-span-2 xl:justify-end">
            <MockBadge label="Local Filters" tone="info" />
            <Button icon="filter_alt_off" variant="link" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Jobs Ledger Table
              </h2>
              <MockBadge label="Dummy Rows" />
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              Dense tabular view aligned to the Stitch ledger layout.
            </p>
          </div>
          <MockBadge label={`${filteredJobs.length} visible`} tone="neutral" />
        </div>

        <div className="overflow-x-auto">
          <table className="app-table min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-highest/50">
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3">Submitted At</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {pageJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    No jobs match the current filters.
                  </td>
                </tr>
              ) : (
                pageJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="transition hover:bg-surface-container-highest/20"
                  >
                    <td className="px-4 py-3 font-code text-[12px] text-primary">
                      #{job.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-body text-sm font-medium text-on-surface">
                          {job.type}
                        </span>
                        <span className="font-code text-[11px] text-on-surface-variant">
                          {getWorkerLabel(job.id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PriorityBadge priority={job.priority} />
                    </td>
                    <td className="px-4 py-3 font-body text-xs text-on-surface-variant">
                      {formatSubmittedAt(job.created_at)}
                    </td>
                    <td className="px-4 py-3 font-code text-[12px] text-on-surface">
                      {computeRuntime(job)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {job.status === "failed" ? (
                          <button
                            type="button"
                            className="rounded border border-primary/40 bg-primary/10 p-1.5 text-primary transition hover:bg-primary/20"
                            aria-label={`Retry job ${job.id}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              replay
                            </span>
                          </button>
                        ) : null}
                        {job.status === "pending" ||
                        job.status === "processing" ? (
                          <button
                            type="button"
                            className="rounded border border-error/40 bg-error/10 p-1.5 text-error transition hover:bg-error/20"
                            aria-label={`Cancel job ${job.id}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              stop_circle
                            </span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded border border-outline-variant bg-surface-container-low p-1.5 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                          aria-label={`Inspect job ${job.id}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            terminal
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="font-body text-sm text-on-surface-variant">
            Showing {filteredJobs.length === 0 ? 0 : pageStart + 1} to{" "}
            {Math.min(pageEnd, filteredJobs.length)} of {filteredJobs.length}{" "}
            entries
          </span>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((page) => Math.max(1, page - 1))}
            onNext={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
          />
        </div>
      </Panel>
    </div>
  );
}
