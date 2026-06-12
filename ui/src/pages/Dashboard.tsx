import { useCallback, useState } from "react";
import { Button } from "../components/shared/Button";
import { MockBadge } from "../components/shared/MockBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { Panel } from "../components/shared/Panel";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { StatCard } from "../components/shared/StatCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useSSE } from "../hooks/useSSE";
import type { Job, SSEEvent } from "../types";

const primary = "#0ea5e9";
const secondary = "#10b981";
const error = "#ef4444";

const DUMMY_JOBS: Job[] = [
  {
    id: "job-892-v4",
    type: "ASYNC_TASK",
    payload: { task: "ImageResizeProcessor", cluster: "cdn-worker-04" },
    status: "processing",
    priority: 1,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T08:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-10T08:00:05.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T07:59:00.000Z",
    updated_at: "2025-07-10T08:00:05.000Z",
  },
  {
    id: "job-901-v2",
    type: "WEBHOOK_EVENT",
    payload: { event: "EmailNotificationSync", worker: "mail-relay-01" },
    status: "completed",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T07:50:00.000Z",
    recur_interval: null,
    last_error: null,
    result: { delivered: true },
    started_at: "2025-07-10T07:50:01.000Z",
    completed_at: "2025-07-10T07:50:04.312Z",
    cancelled_at: null,
    created_at: "2025-07-10T07:49:55.000Z",
    updated_at: "2025-07-10T07:50:04.312Z",
  },
  {
    id: "job-721-x0",
    type: "ASYNC_TASK",
    payload: { task: "DatabaseIndexClean", cluster: "db-core-02" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T07:30:00.000Z",
    recur_interval: null,
    last_error: "TimeoutError: DB connection timed out after 5000ms",
    result: null,
    started_at: "2025-07-10T07:30:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T07:29:50.000Z",
    updated_at: "2025-07-10T07:31:10.000Z",
  },
  {
    id: "job-114-u9",
    type: "WEBHOOK_EVENT",
    payload: { event: "AuditLogExport", worker: "audit-node-07" },
    status: "pending",
    priority: 3,
    attempt_count: 0,
    max_retries: 5,
    next_retry_at: "2025-07-10T08:10:00.000Z",
    scheduled_at: "2025-07-10T08:05:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T08:04:50.000Z",
    updated_at: "2025-07-10T08:04:50.000Z",
  },
]; // DUMMY DATA

const DLQ_PAYLOAD = {
  job_id: "f82-a912-88ba",
  attempt: 5,
  origin: "prod-cluster-01",
  data: {
    user_uid: "USR_84221",
    action: "billing.recurring_payment",
  },
}; // DUMMY DATA

const DLQ_STACK_TRACE = `at internal/modules/billing/worker.js:142:18
at processTicksAndRejections (node:internal/process/task_queues:95:5)
at async retryHandler (lib/retry-strategy.v2.js:12)`; // DUMMY DATA

const LOG_LEVELS = ["INFO", "WARN", "DEBUG", "ERROR"] as const; // DUMMY DATA

const INITIAL_LOGS: string[] = [
  `[2025-07-10T08:00:00.000Z] INFO  Node-04 connection established`,
  `[2025-07-10T07:59:57.312Z] WARN  Higher than normal latency on us-east-1 queue`,
  `[2025-07-10T07:59:55.881Z] DEBUG Task job-892-v4 allocated to ImageProcessor:Worker2`,
  `[2025-07-10T07:59:53.000Z] INFO  Completed sync of 42 entities in 12ms`,
  `[2025-07-10T07:59:48.002Z] ERROR Redis connectivity timeout on instance 092 — reconnecting`,
]; // DUMMY DATA

const LOG_BUFFER_SIZE = 12;

type TabValue = "ALL_TYPES" | "ASYNC_TASK" | "WEBHOOK_EVENT";

const TABS: { label: string; value: TabValue }[] = [
  { label: "ALL TYPES", value: "ALL_TYPES" },
  { label: "ASYNC_TASK", value: "ASYNC_TASK" },
  { label: "WEBHOOK_EVENT", value: "WEBHOOK_EVENT" },
];

function formatRuntime(startedAt: string | null, completedAt: string | null) {
  if (!startedAt) return "—";
  const endTime = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = endTime - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>("ALL_TYPES");
  const [filterError, setFilterError] = useState(false);
  const [logs, setLogs] = useState<string[]>(INITIAL_LOGS);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)]; // DUMMY DATA
    const ts = new Date().toISOString();
    const msg = `[${ts}] ${level.padEnd(5)} ${event.type}: job ${event.payload.id} → ${event.payload.status}`;
    setLogs((prev) => [msg, ...prev].slice(0, LOG_BUFFER_SIZE));
  }, []);

  const { connected } = useSSE({
    mockMode: true,
    intervalMs: 3000,
    onEvent: handleSSEEvent,
  });

  let filteredJobs: Job[] = DUMMY_JOBS;

  try {
    if (activeTab !== "ALL_TYPES") {
      filteredJobs = DUMMY_JOBS.filter((job) => job.type === activeTab);
    }
  } catch {
    filteredJobs = DUMMY_JOBS;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Observability"
        title="Backend Core Dashboard"
        description="High-density operational overview for the scheduler, worker activity, DLQ inspection, and live mock telemetry."
        badges={
          <>
            <MockBadge label="Dummy Data" />
            <MockBadge
              label={connected ? "Frontend SSE Mock" : "SSE Reconnecting"}
              tone={connected ? "info" : "danger"}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Jobs"
          value="1,284,092"
          badge={<MockBadge label="Mock Metrics" />}
        >
          <div className="flex h-6 items-end gap-[2px]">
            <div className="w-1 bg-primary/80" style={{ height: "35%" }}></div>
            <div className="w-1 bg-primary/80" style={{ height: "55%" }}></div>
            <div className="w-1 bg-primary/80" style={{ height: "85%" }}></div>
            <div className="w-1 bg-primary/80" style={{ height: "65%" }}></div>
            <div className="w-1 bg-primary/80" style={{ height: "95%" }}></div>
          </div>
        </StatCard>
        <StatCard
          label="Processing"
          value="429"
          accentColor={primary}
          icon="refresh"
          badge={<MockBadge label="Live Mock" tone="info" />}
        />
        <StatCard
          label="Completed (24h)"
          value="84,103"
          accentColor={secondary}
          icon="done_all"
        />
        <StatCard
          label="Failed / DLQ"
          value="12"
          accentColor={error}
          icon="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                    Active Jobs Stream
                  </h2>
                  <MockBadge label="Dummy Data" />
                </div>
                <p className="font-body text-sm text-on-surface-variant">
                  Current queue snapshot styled to match the Stitch operational
                  dashboard.
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
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline hover:text-on-surface",
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
                  {filteredJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="transition hover:bg-surface-container-highest/20"
                    >
                      <td className="px-4 py-3 font-code text-[12px] text-primary">
                        #{job.id}
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-on-surface">
                        {String(
                          job.payload.task ?? job.payload.event ?? job.type,
                        )}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <div className="space-y-3 xl:col-span-4">
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
                <MockBadge label="Dummy Data" tone="danger" />
              </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div>
                <p className="mb-2 font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                  Payload Investigation
                </p>
                <pre className="app-code-block overflow-x-auto p-4 text-[12px] leading-6 text-primary">
                  {JSON.stringify(DLQ_PAYLOAD, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-2 font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                  Error Trace
                </p>
                <pre className="rounded-lg border border-error/30 bg-error-container/20 p-4 font-code text-[11px] leading-5 text-on-error-container whitespace-pre-wrap">
                  {DLQ_STACK_TRACE}
                </pre>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button icon="delete" variant="danger" className="w-full">
                  Purge
                </Button>
                <Button
                  icon="history_toggle_off"
                  variant="secondary"
                  className="w-full border-on-surface bg-on-surface text-surface hover:bg-white/90"
                >
                  Retry Job
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <div className="space-y-1">
                <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                  Node Health
                </p>
                <div className="flex items-center gap-2 text-[11px] text-on-secondary-container">
                  <span className="h-2 w-2 rounded-full bg-secondary"></span>
                  NOMINAL
                </div>
              </div>
              <MockBadge label="Dummy Data" />
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5 font-code text-[12px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">CPU Usage</span>
                  <span className="text-primary">42.1%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-lowest">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: "42%" }}
                  ></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Memory Load</span>
                  <span className="text-secondary">18.9GB / 32GB</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-lowest">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: "68%" }}
                  ></div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

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
          <div className="flex flex-wrap gap-2">
            <MockBadge
              label={connected ? "Frontend SSE Mock" : "SSE Reconnecting"}
              tone={connected ? "info" : "danger"}
            />
            <MockBadge label="Dummy Logs" />
          </div>
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
