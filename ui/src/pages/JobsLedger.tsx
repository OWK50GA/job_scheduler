import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { PageHeader } from "../components/shared/PageHeader";
import { Pagination } from "../components/shared/Pagination";
import { Panel } from "../components/shared/Panel";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { StatusBadge } from "../components/shared/StatusBadge";
import { cancelJob, listJobs, retryJob } from "../services/api";
import type { Job, JobStatus } from "../types";

const PAGE_SIZE = 20;

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

const inputClassName =
  "h-9 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 font-body text-sm text-on-surface outline-none transition focus:border-primary";

export default function JobsLedger() {
  const navigate = useNavigate();

  // ── Filter state ─────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"" | JobStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "1" | "2" | "3">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Server data ───────────────────────────────────────────────────────
  // Fetch all jobs (up to 50 per page, repeated) then do client-side
  // pagination — same pattern as DLQOverview.
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Action loading states ─────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Client-side pagination ────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch up to 50 at a time (backend max). For most deployments this
      // covers the entire queue; extend to multi-page fetch if needed.
      const res = await listJobs({ limit: 50, page: 1 });
      setAllJobs(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Client-side filtering ─────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (statusFilter && job.status !== statusFilter) return false;
      if (priorityFilter && job.priority !== Number(priorityFilter)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (new Date(job.created_at).getTime() < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + "T23:59:59Z").getTime();
        if (new Date(job.created_at).getTime() > to) return false;
      }
      return true;
    });
  }, [allJobs, statusFilter, priorityFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(pageStart, pageStart + PAGE_SIZE);

  function resetFilters() {
    setStatusFilter("");
    setPriorityFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleRetry(jobId: string) {
    setActionLoading((prev) => ({ ...prev, [jobId]: true }));
    try {
      const updated = await retryJob(jobId);
      setAllJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? updated : j)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading((prev) => ({ ...prev, [jobId]: false }));
    }
  }

  async function handleCancel(jobId: string) {
    setActionLoading((prev) => ({ ...prev, [jobId]: true }));
    try {
      const updated = await cancelJob(jobId);
      setAllJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? updated : j)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading((prev) => ({ ...prev, [jobId]: false }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work Queue"
        title="Jobs Ledger"
        description="Real-time history and management of all background processing tasks."
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

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <Panel className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-end">
          <div className="xl:col-span-3">
            <label className="mb-2 block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Status
            </label>
            <select
              className={inputClassName}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "" | JobStatus);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="xl:col-span-3">
            <label className="mb-2 block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Priority
            </label>
            <select
              className={inputClassName}
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as "" | "1" | "2" | "3");
                setCurrentPage(1);
              }}
            >
              <option value="">All Priorities</option>
              <option value="1">Critical (1)</option>
              <option value="2">Medium (2)</option>
              <option value="3">Low (3)</option>
            </select>
          </div>

          <div className="xl:col-span-4">
            <label className="mb-2 block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Date Range (created_at)
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="date"
                className={inputClassName}
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <span className="font-body text-xs text-on-surface-variant">to</span>
              <input
                type="date"
                className={inputClassName}
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 xl:col-span-2">
            <Button icon="filter_alt_off" variant="link" onClick={resetFilters}>
              Reset
            </Button>
            <Button icon="refresh" variant="secondary" onClick={load}>
              Refresh
            </Button>
          </div>
        </div>
      </Panel>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Jobs Ledger
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              {loading
                ? "Loading…"
                : `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""} found`}
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant bg-error/10 px-5 py-3">
            <span className="font-body text-sm text-error">{error}</span>
            <Button icon="refresh" variant="link" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="app-table min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-highest/50">
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3">Submitted At</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    Loading…
                  </td>
                </tr>
              ) : pageJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    No jobs match the current filters.
                  </td>
                </tr>
              ) : (
                pageJobs.map((job) => {
                  const busy = actionLoading[job.id] ?? false;
                  return (
                    <tr
                      key={job.id}
                      className="transition hover:bg-surface-container-highest/20"
                    >
                      {/* Job ID */}
                      <td className="px-4 py-3 font-code text-[12px] text-primary">
                        {job.id.slice(0, 8)}…
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className="font-body text-sm font-medium text-on-surface">
                          {job.type}
                        </span>
                        {job.recur_interval && (
                          <div className="mt-0.5 font-code text-[10px] text-on-surface-variant">
                            {job.recur_interval}
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3 text-center">
                        <PriorityBadge priority={job.priority} />
                      </td>

                      {/* Submitted At */}
                      <td className="px-4 py-3 font-body text-xs text-on-surface-variant">
                        {formatSubmittedAt(job.created_at)}
                      </td>

                      {/* Runtime */}
                      <td className="px-4 py-3 font-code text-[12px] text-on-surface">
                        {computeRuntime(job)}
                      </td>

                      {/* Retries */}
                      <td className="px-4 py-3 font-body text-sm text-on-surface-variant">
                        {job.attempt_count}/{job.max_retries}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Retry — only for failed jobs that are in the DLQ
                              (attempt_count >= max_retries) */}
                          {job.status === "failed" &&
                            job.attempt_count >= job.max_retries && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRetry(job.id)}
                                className="rounded border border-primary/40 bg-primary/10 p-1.5 text-primary transition hover:bg-primary/20 disabled:opacity-40"
                                aria-label={`Retry job ${job.id}`}
                                title="Retry (DLQ)"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {busy ? "hourglass_empty" : "replay"}
                                </span>
                              </button>
                            )}

                          {/* Cancel — pending or processing */}
                          {(job.status === "pending" ||
                            job.status === "processing") && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleCancel(job.id)}
                              className="rounded border border-error/40 bg-error/10 p-1.5 text-error transition hover:bg-error/20 disabled:opacity-40"
                              aria-label={`Cancel job ${job.id}`}
                              title="Cancel"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {busy ? "hourglass_empty" : "stop_circle"}
                              </span>
                            </button>
                          )}

                          {/* Inspect — navigate to DLQ detail if failed+DLQ,
                              otherwise no detail page exists yet */}
                          {job.status === "failed" &&
                            job.attempt_count >= job.max_retries && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/jobs/dlq/${job.id}`)
                                }
                                className="rounded border border-outline-variant bg-surface-container-low p-1.5 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                                aria-label={`Inspect job ${job.id}`}
                                title="Investigate"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  terminal
                                </span>
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="font-body text-sm text-on-surface-variant">
            Showing{" "}
            {filteredJobs.length === 0 ? 0 : pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE, filteredJobs.length)} of{" "}
            {filteredJobs.length}
          </span>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      </Panel>
    </div>
  );
}
