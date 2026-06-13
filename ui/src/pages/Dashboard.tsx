import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { PageHeader } from "../components/shared/PageHeader";
import { Panel } from "../components/shared/Panel";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { StatCard } from "../components/shared/StatCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import {
  useSchedulerEvent,
  useSSEConnected,
  useSSEReconnecting,
} from "../context/useSchedulerEvent";
import { getJobStats, listDLQJobs, listJobs, retryJob } from "../services/api";
import type { Job, JobStats } from "../types";

const primary = "#0ea5e9";
const secondary = "#10b981";
const error = "#ef4444";

type TabValue = "ALL_TYPES" | string;

const TABS: { label: string; value: TabValue }[] = [
  { label: "ALL TYPES", value: "ALL_TYPES" },
  { label: "send_email", value: "send_email" },
];

function formatRuntime(startedAt: string | null, completedAt: string | null) {
  if (!startedAt) return "—";
  const endTime = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = endTime - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}ms`;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>("ALL_TYPES");
  const [filterError, setFilterError] = useState(false);
  // TODO: Update logs
  const [logs, setLogs] = useState<string[]>([]);

  const [stats, setStats] = useState<JobStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [dlqJob, setDlqJob] = useState<Job | null>(null);
  const [dlqActionLoading, setDlqActionLoading] = useState(false);
  const [dlqActionError, setDlqActionError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getJobStats()
      .then(setStats)
      .catch((err: unknown) =>
        setStatsError(
          err instanceof Error ? err.message : "Failed to load stats",
        ),
      );

    listJobs({ limit: 50 })
      .then((res) => setActiveJobs(res.data))
      .catch((err: unknown) =>
        setJobsError(
          err instanceof Error ? err.message : "Failed to load jobs",
        ),
      );

    listDLQJobs(1, 1)
      .then((res) => setDlqJob(res.data[0] ?? null))
      .catch(() => {
        // DLQ panel degrades silently — not critical
      });
  }, []);

  // ── DLQ actions ──────────────────────────────────────────────────────────
  async function handleDLQRetry() {
    if (!dlqJob) return;
    setDlqActionLoading(true);
    setDlqActionError(null);
    try {
      const updated = await retryJob(dlqJob.id);
      setDlqJob(null);
      setActiveJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? updated : j)),
      );
    } catch (err) {
      setDlqActionError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setDlqActionLoading(false);
    }
  }

  // ── SSE — real connection via SchedulerEventsProvider ────────────────────
  const connected = useSSEConnected();
  const reconnecting = useSSEReconnecting();
  const LOG_BUFFER_SIZE = 12;

  // stats.updated → refresh stat cards live
  useSchedulerEvent(
    "stats.updated",
    useCallback((e) => {
      setStats(e.payload.stats);
    }, []),
  );

  // job.created / job.started / job.completed / job.cancelled → patch active jobs table
  const patchJob = useCallback((job: Job) => {
    setActiveJobs((prev) => {
      const exists = prev.some((j) => j.id === job.id);
      if (exists) return prev.map((j) => (j.id === job.id ? job : j));
      return [job, ...prev].slice(0, 50);
    });
  }, []);

  useSchedulerEvent(
    "job.created",
    useCallback(
      (e) => {
        patchJob(e.payload.job);
      },
      [patchJob],
    ),
  );
  useSchedulerEvent(
    "job.started",
    useCallback(
      (e) => {
        patchJob(e.payload.job);
      },
      [patchJob],
    ),
  );
  useSchedulerEvent(
    "job.completed",
    useCallback(
      (e) => {
        patchJob(e.payload.job);
      },
      [patchJob],
    ),
  );
  useSchedulerEvent(
    "job.cancelled",
    useCallback(
      (e) => {
        patchJob(e.payload.job);
      },
      [patchJob],
    ),
  );
  useSchedulerEvent(
    "job.failed",
    useCallback(
      (e) => {
        patchJob(e.payload.job);
      },
      [patchJob],
    ),
  );

  // job.dlq_entry → update the DLQ insight panel
  useSchedulerEvent(
    "job.dlq_entry",
    useCallback((e) => {
      setDlqJob(e.payload.job);
    }, []),
  );

  // All lifecycle events → append a log line
  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [line, ...prev].slice(0, LOG_BUFFER_SIZE));
  }, []);

  useSchedulerEvent(
    "job.created",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] INFO  job.created: ${e.payload.job.id} (${e.payload.job.type})`,
        ),
      [appendLog],
    ),
  );
  useSchedulerEvent(
    "job.started",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] INFO  job.started: ${e.payload.job.id}`,
        ),
      [appendLog],
    ),
  );
  useSchedulerEvent(
    "job.completed",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] INFO  job.completed: ${e.payload.job.id}`,
        ),
      [appendLog],
    ),
  );
  useSchedulerEvent(
    "job.failed",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] WARN  job.failed: ${e.payload.job.id} — ${e.payload.error}`,
        ),
      [appendLog],
    ),
  );
  useSchedulerEvent(
    "job.retry_scheduled",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] INFO  job.retry: ${e.payload.job.id} attempt ${e.payload.attempt}`,
        ),
      [appendLog],
    ),
  );
  useSchedulerEvent(
    "job.cancelled",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] INFO  job.cancelled: ${e.payload.job.id}`,
        ),
      [appendLog],
    ),
  );
  useSchedulerEvent(
    "job.dlq_entry",
    useCallback(
      (e) =>
        appendLog(
          `[${new Date().toISOString()}] ERROR job.dlq_entry: ${e.payload.job.id} — ${e.payload.error}`,
        ),
      [appendLog],
    ),
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const displayJobs =
    activeTab === "ALL_TYPES"
      ? activeJobs
      : activeJobs.filter((job) => job.type === activeTab);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Observability"
        title="Job Scheduler Dashboard"
        description="High-density operational overview for the scheduler, worker activity, DLQ inspection, and live telemetry."
        badges={
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-body text-[10px] font-semibold uppercase tracking-wider",
              connected
                ? "border-secondary/40 bg-secondary/10 text-black bg-green-400"
                : reconnecting
                  ? "border-orange-200 bg-orange-400 text-black"
                  : "border-error/40 bg-red-400 text-black",
            ].join(" ")}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-secondary" : "bg-error"}`}
            />
            {connected
              ? "SSE Connected"
              : reconnecting
                ? "SSE Reconnecting"
                : "SSE Disconnected"}
          </span>
        }
      />

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      {statsError ? (
        <div className="rounded border border-error bg-error/10 px-4 py-3 font-body text-sm text-on-error-container">
          Stats unavailable: {statsError}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Jobs"
            value={stats ? stats.total.toLocaleString() : "—"}
          >
            <div className="flex h-6 items-end gap-[2px]">
              <div
                className="w-1 bg-primary/80"
                style={{ height: "35%" }}
              ></div>
              <div
                className="w-1 bg-primary/80"
                style={{ height: "55%" }}
              ></div>
              <div
                className="w-1 bg-primary/80"
                style={{ height: "85%" }}
              ></div>
              <div
                className="w-1 bg-primary/80"
                style={{ height: "65%" }}
              ></div>
              <div
                className="w-1 bg-primary/80"
                style={{ height: "95%" }}
              ></div>
            </div>
          </StatCard>
          <StatCard
            label="Processing"
            value={stats ? stats.processing.toLocaleString() : "—"}
            accentColor={primary}
            icon="refresh"
          />
          <StatCard
            label="Completed"
            value={stats ? stats.completed.toLocaleString() : "—"}
            accentColor={secondary}
            icon="done_all"
          />
          <StatCard
            label="Failed / DLQ"
            value={stats ? `${stats.failed}` : "—"}
            accentColor={error}
            icon="warning"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        {/* ── Active Jobs Stream ─────────────────────────────────────── */}
        <Panel className="xl:col-span-8">
          <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                  Active Jobs Stream
                </h2>
                <p className="font-body text-sm text-on-surface-variant">
                  Current queue snapshot — most recent jobs across all statuses.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => {
                  const active = activeTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => {
                        setFilterError(false);
                        try {
                          setActiveTab(tab.value);
                        } catch {
                          setFilterError(true);
                        }
                      }}
                      className={[
                        "rounded border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-technical transition",
                        active
                          ? "border-sky-300 bg-sky-200 text-sky-900 shadow-[0_0_0_3px_rgba(186,230,253,0.35)]"
                          : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-5">
            {filterError ? (
              <div className="mb-4 rounded border border-error bg-error/10 px-3 py-2 text-sm text-on-error-container">
                Filter error — showing all jobs.
              </div>
            ) : null}

            {jobsError ? (
              <div className="rounded border border-error bg-error/10 px-3 py-2 text-sm text-on-error-container">
                Failed to load jobs: {jobsError}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="app-table min-w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-3">Job ID</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3 text-right">Runtime</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {displayJobs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center font-body text-sm text-on-surface-variant"
                        >
                          {activeJobs.length === 0
                            ? "Loading…"
                            : "No jobs match this filter."}
                        </td>
                      </tr>
                    ) : (
                      displayJobs.map((job) => (
                        <tr
                          key={job.id}
                          className="border-l-2 border-l-transparent transition hover:border-l-primary hover:bg-slate-600"
                        >
                          <td className="px-4 py-3 font-code text-[12px] text-primary">
                            #{job.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 font-body text-sm text-on-surface">
                            {job.type}
                          </td>
                          <td className="px-4 py-3">
                            <PriorityBadge priority={job.priority} />
                          </td>
                          <td className="px-4 py-3 text-right font-code text-[12px] text-on-surface-variant">
                            {formatRuntime(job.started_at, job.completed_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <StatusBadge status={job.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-3 xl:col-span-4">
          {/* ── DLQ Insight ─────────────────────────────────────────── */}
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error">
                    error_outline
                  </span>
                  <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                    DLQ Insight
                  </h2>
                </div>
                {dlqJob == null && (
                  <span className="font-body text-xs text-on-surface-variant">
                    No DLQ jobs
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {dlqJob ? (
                <>
                  <div>
                    <p className="mb-2 font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                      Payload Investigation
                    </p>
                    <pre className="app-code-block overflow-x-auto p-4 text-[12px] leading-6 text-primary">
                      {JSON.stringify(dlqJob.payload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                      Last Error
                    </p>
                    <pre className="rounded-lg border border-error/30 bg-error-container/20 p-4 font-code text-[11px] leading-5 text-on-error-container whitespace-pre-wrap">
                      {dlqJob.last_error ?? "No error message recorded"}
                    </pre>
                  </div>
                </>
              ) : (
                <p className="font-body text-sm text-on-surface-variant">
                  Dead-letter queue is empty.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  icon="delete"
                  variant="danger"
                  className="w-full"
                  onClick={() => dlqJob && navigate(`/jobs/dlq/${dlqJob.id}`)}
                  disabled={!dlqJob}
                >
                  Purge
                </Button>
                <Button
                  icon="history_toggle_off"
                  variant="secondary"
                  className="w-full border-on-surface bg-on-surface text-surface hover:bg-white/90"
                  onClick={handleDLQRetry}
                  disabled={!dlqJob || dlqActionLoading}
                >
                  {dlqActionLoading ? "Retrying…" : "Retry Job"}
                </Button>
              </div>
              {dlqActionError && (
                <p className="font-body text-xs text-error">{dlqActionError}</p>
              )}
            </div>
          </Panel>

          {/* ── Queue health summary ─────────────────────────────────── */}
          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <div className="space-y-1">
                <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                  Queue Summary
                </p>
                <div className="flex items-center gap-2 text-[11px] text-on-secondary-container">
                  <span className="h-2 w-2 rounded-full bg-secondary"></span>
                  {stats ? "Live" : "Loading"}
                </div>
              </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5 font-code text-[12px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Pending</span>
                  <span className="text-primary">{stats?.pending ?? "—"}</span>
                </div>
                {stats ? (
                  <div className="h-1.5 rounded-full bg-surface-container-lowest">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width:
                          stats.total > 0
                            ? `${Math.round((stats.pending / stats.total) * 100)}%`
                            : "0%",
                      }}
                    ></div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Cancelled</span>
                  <span className="text-secondary">
                    {stats?.cancelled ?? "—"}
                  </span>
                </div>
                {stats ? (
                  <div className="h-1.5 rounded-full bg-surface-container-lowest">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{
                        width:
                          stats.total > 0
                            ? `${Math.round((stats.cancelled / stats.total) * 100)}%`
                            : "0%",
                      }}
                    ></div>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Live System Logs ─────────────────────────────────────────────── */}
      <Panel>
        <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant">
              terminal
            </span>
            <h2 className="font-headline text-[18px] font-semibold text-on-surface">
              Live System Logs
            </h2>
          </div>
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-body text-[10px] font-semibold uppercase tracking-wider",
              connected
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-outline-variant bg-surface-container-low text-on-surface-variant",
            ].join(" ")}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-primary" : "bg-outline"}`}
            />
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
        <div className="app-code-block m-4 h-48 overflow-y-auto p-4 sm:m-5">
          <div className="space-y-1 font-code text-[11px] leading-5">
            {logs.map((line, index) => {
              const levelClassName = line.includes(" ERROR")
                ? "text-error"
                : line.includes(" WARN")
                  ? "text-amber-300"
                  : line.includes(" DEBUG")
                    ? "text-on-surface-variant"
                    : "text-primary";

              return (
                <p key={`${line}-${index}`} className={levelClassName}>
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}
