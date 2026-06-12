import { useState, useEffect } from "react";
import { StatCard } from "../components/shared/StatCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { useSSE } from "../hooks/useSSE";
import type { Job } from "../types";

// ─── Palette ────────────────────────────────────────────────────────────────
const surface = "#051424";
const surfaceContainer = "#0f172a";
const surfaceHigh = "#1e293b";
const onSurface = "#f8fafc";
const onSurfaceVariant = "#94a3b8";
const primary = "#0ea5e9";
const secondary = "#10b981";
const error = "#ef4444";

// ─── Dummy Data: jobs ────────────────────────────────────────────────────────
const DUMMY_JOBS: Job[] = [
  {
    id: "job-0001",
    type: "ASYNC_TASK",
    payload: { task: "send-report", recipient: "ops@example.com" },
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
    id: "job-0002",
    type: "WEBHOOK_EVENT",
    payload: { event: "order.placed", orderId: "ORD-8821" },
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
    id: "job-0003",
    type: "ASYNC_TASK",
    payload: { task: "generate-invoice", customerId: "CUST-441" },
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
    id: "job-0004",
    type: "WEBHOOK_EVENT",
    payload: { event: "payment.failed", paymentId: "PAY-9934" },
    status: "pending",
    priority: 2,
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
  {
    id: "job-0005",
    type: "ASYNC_TASK",
    payload: { task: "sync-inventory", warehouseId: "WH-12" },
    status: "completed",
    priority: 3,
    attempt_count: 1,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-10T07:45:00.000Z",
    recur_interval: "3600",
    last_error: null,
    result: { synced: 240 },
    started_at: "2025-07-10T07:45:02.000Z",
    completed_at: "2025-07-10T07:46:47.500Z",
    cancelled_at: null,
    created_at: "2025-07-10T07:44:55.000Z",
    updated_at: "2025-07-10T07:46:47.500Z",
  },
  {
    id: "job-0006",
    type: "WEBHOOK_EVENT",
    payload: { event: "user.signup", userId: "USR-5571" },
    status: "processing",
    priority: 2,
    attempt_count: 1,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T08:01:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: "2025-07-10T08:01:03.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T08:00:55.000Z",
    updated_at: "2025-07-10T08:01:03.000Z",
  },
  {
    id: "job-0007",
    type: "ASYNC_TASK",
    payload: { task: "archive-logs", date: "2025-07-09" },
    status: "cancelled",
    priority: 3,
    attempt_count: 0,
    max_retries: 1,
    next_retry_at: null,
    scheduled_at: "2025-07-10T03:00:00.000Z",
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: "2025-07-10T03:00:01.000Z",
    created_at: "2025-07-10T02:59:45.000Z",
    updated_at: "2025-07-10T03:00:01.000Z",
  },
  {
    id: "job-0008",
    type: "WEBHOOK_EVENT",
    payload: { event: "subscription.renewed", planId: "PLAN-PRO" },
    status: "failed",
    priority: 1,
    attempt_count: 5,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T06:00:00.000Z",
    recur_interval: null,
    last_error: "NetworkError: upstream webhook returned 503",
    result: null,
    started_at: "2025-07-10T06:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T05:59:50.000Z",
    updated_at: "2025-07-10T06:45:00.000Z",
  },
]; // DUMMY DATA

// ─── Dummy Data: DLQ payload ─────────────────────────────────────────────────
const DLQ_PAYLOAD = {
  id: "job-0003",
  type: "ASYNC_TASK",
  payload: { task: "generate-invoice", customerId: "CUST-441" },
  status: "failed",
  priority: 1,
  attempt_count: 3,
  max_retries: 3,
  last_error: "TimeoutError: DB connection timed out after 5000ms",
}; // DUMMY DATA

// DUMMY DATA
const DLQ_STACK_TRACE = `TimeoutError: DB connection timed out after 5000ms
    at Pool.connect (node_modules/pg/lib/pool.js:54:13)
    at InvoiceProcessor.run (src/worker/handlers/generate-invoice.handler.ts:38:18)
    at Worker.process (src/worker/processor.ts:91:22)
    at processTicksAndRejections (node:internal/process/task_queues:140:5)`;

// ─── Dummy Data: log levels cycling ─────────────────────────────────────────
const LOG_LEVELS = ["INFO", "WARN", "DEBUG", "ERROR"] as const; // DUMMY DATA

// ─── Dummy Data: initial log lines ──────────────────────────────────────────
const INITIAL_LOGS: string[] = [
  `[2025-07-10T08:00:00.000Z] INFO  Worker pool initialised — 8 nodes online`,
  `[2025-07-10T07:59:57.312Z] INFO  Job job-0001 picked up by node-04`,
  `[2025-07-10T07:59:55.881Z] WARN  Retry queue depth: 3 jobs pending`,
  `[2025-07-10T07:59:53.000Z] INFO  Job job-0002 completed in 3312ms`,
  `[2025-07-10T07:59:51.445Z] DEBUG Heartbeat OK — node-01 through node-08`,
  `[2025-07-10T07:59:48.002Z] ERROR Job job-0003 exhausted retries (3/3)`,
  `[2025-07-10T07:59:46.110Z] INFO  Scheduler tick — 12 due jobs queued`,
  `[2025-07-10T07:59:44.774Z] WARN  node-07 memory at 87% — throttling`,
  `[2025-07-10T07:59:42.330Z] DEBUG SSE broadcast sent to 2 subscribers`,
  `[2025-07-10T07:59:40.000Z] INFO  System startup complete`,
]; // DUMMY DATA

const LOG_BUFFER_SIZE = 10;

// ─── Runtime formatter ───────────────────────────────────────────────────────
function formatRuntime(
  started_at: string | null,
  completed_at: string | null,
): string {
  if (!started_at || !completed_at) return "—";
  const ms = new Date(completed_at).getTime() - new Date(started_at).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── Tab type ────────────────────────────────────────────────────────────────
type TabValue = "ALL_TYPES" | "ASYNC_TASK" | "WEBHOOK_EVENT";

const TABS: { label: string; value: TabValue }[] = [
  { label: "ALL TYPES", value: "ALL_TYPES" },
  { label: "ASYNC_TASK", value: "ASYNC_TASK" },
  { label: "WEBHOOK_EVENT", value: "WEBHOOK_EVENT" },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>("ALL_TYPES");
  const [filterError, setFilterError] = useState(false);
  const [logs, setLogs] = useState<string[]>(INITIAL_LOGS);

  const { data: sseData } = useSSE({ mockMode: true, intervalMs: 3000 });

  // Prepend new log line on each SSE event
  useEffect(() => {
    if (!sseData) return;
    const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)]; // DUMMY DATA
    const ts = new Date().toISOString();
    const msg = `[${ts}] ${level.padEnd(5)} ${sseData.type}: job ${sseData.payload.id} → ${sseData.payload.status}`;
    setLogs((prev) => [msg, ...prev].slice(0, LOG_BUFFER_SIZE));
  }, [sseData]);

  // Filter jobs with error guard
  let filteredJobs: Job[] = DUMMY_JOBS;
  try {
    if (activeTab !== "ALL_TYPES") {
      const tab = activeTab; // capture for type narrowing
      filteredJobs = DUMMY_JOBS.filter((j) => j.type === tab);
    }
  } catch {
    filteredJobs = DUMMY_JOBS;
    // filterError is managed in the tab click handler
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    backgroundColor: surface,
    color: onSurface,
    minHeight: "100vh",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    fontFamily:
      "'Geist', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  };

  const sectionStyle: React.CSSProperties = {
    backgroundColor: surfaceContainer,
    borderRadius: "0.5rem",
    padding: "1.25rem",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: onSurfaceVariant,
    marginBottom: "1rem",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.8rem",
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    color: onSurfaceVariant,
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: `1px solid ${surfaceHigh}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: "0.6rem 0.75rem",
    borderBottom: `1px solid ${surfaceHigh}`,
    color: onSurface,
    verticalAlign: "middle",
  };

  return (
    <div style={pageStyle}>
      {/* ── Page heading ── */}
      <div>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: onSurface,
            margin: 0,
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            fontSize: "0.8rem",
            color: onSurfaceVariant,
            margin: "0.25rem 0 0",
          }}
        >
          System overview — live mock mode
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
        }}
      >
        <StatCard label="Total Jobs" value={1284} /> {/* DUMMY DATA */}
        <StatCard label="Processing" value={47} accentColor={primary} />{" "}
        {/* DUMMY DATA */}
        <StatCard
          label="Completed (24h)"
          value={312}
          accentColor={secondary}
        />{" "}
        {/* DUMMY DATA */}
        <StatCard label="Failed / DLQ" value={9} accentColor={error} />{" "}
        {/* DUMMY DATA */}
      </div>

      {/* ── Active Jobs Stream ── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Active Jobs Stream</p>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setFilterError(false);
                try {
                  setActiveTab(tab.value);
                } catch {
                  setFilterError(true);
                }
              }}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontFamily: "inherit",
                backgroundColor:
                  activeTab === tab.value ? primary : surfaceHigh,
                color: activeTab === tab.value ? "#ffffff" : onSurfaceVariant,
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter error warning */}
        {filterError && (
          <div
            style={{
              backgroundColor: "#7f1d1d",
              border: `1px solid ${error}`,
              borderRadius: "0.375rem",
              padding: "0.5rem 0.75rem",
              color: "#fca5a5",
              fontSize: "0.78rem",
              marginBottom: "0.75rem",
            }}
          >
            ⚠ Filter error – showing all jobs
          </div>
        )}

        {/* Jobs table */}
        {filteredJobs.length === 0 ? (
          <div
            style={{
              color: onSurfaceVariant,
              fontSize: "0.85rem",
              padding: "1rem 0",
            }}
          >
            No jobs found for this type
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Job ID</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Runtime</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} style={{ backgroundColor: "transparent" }}>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: "inherit",
                        color: primary,
                      }}
                    >
                      {job.id}
                    </td>
                    <td style={tdStyle}>{job.type}</td>
                    <td style={tdStyle}>
                      <PriorityBadge priority={job.priority} />
                    </td>
                    <td style={{ ...tdStyle, color: onSurfaceVariant }}>
                      {formatRuntime(job.started_at, job.completed_at)}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom panels: DLQ Insight + Node Health + Live Logs ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem",
        }}
      >
        {/* DLQ Insight */}
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>DLQ Insight</p>

          {/* JSON payload */}
          <p
            style={{
              fontSize: "0.7rem",
              color: onSurfaceVariant,
              margin: "0 0 0.35rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Failed Job Payload
          </p>
          <pre
            style={{
              backgroundColor: "#010f1f",
              color: "#7dd3fc",
              borderRadius: "0.375rem",
              padding: "0.75rem",
              fontSize: "0.72rem",
              overflowX: "auto",
              margin: "0 0 1rem",
              lineHeight: 1.6,
            }}
          >
            {JSON.stringify(DLQ_PAYLOAD, null, 2) /* DUMMY DATA */}
          </pre>

          {/* Stack trace */}
          <p
            style={{
              fontSize: "0.7rem",
              color: onSurfaceVariant,
              margin: "0 0 0.35rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Stack Trace Excerpt
          </p>
          <pre
            style={{
              backgroundColor: "#1a0000",
              color: "#fca5a5",
              borderRadius: "0.375rem",
              padding: "0.75rem",
              fontSize: "0.68rem",
              overflowX: "auto",
              margin: "0 0 1rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {DLQ_STACK_TRACE /* DUMMY DATA */}
          </pre>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => {
                /* no-op */
              }}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "0.375rem",
                border: `1px solid ${error}`,
                backgroundColor: "transparent",
                color: error,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
              }}
            >
              PURGE
            </button>
            <button
              onClick={() => {
                /* no-op */
              }}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "0.375rem",
                border: `1px solid ${primary}`,
                backgroundColor: "transparent",
                color: primary,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
              }}
            >
              RETRY JOB
            </button>
          </div>
        </div>

        {/* Right column: Node Health + Live Logs stacked */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Node Health */}
          <div style={sectionStyle}>
            <p style={sectionTitleStyle}>Node Health</p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {/* CPU */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.3rem",
                  }}
                >
                  <span
                    style={{ fontSize: "0.75rem", color: onSurfaceVariant }}
                  >
                    CPU Usage
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: secondary,
                    }}
                  >
                    42.1% {/* DUMMY DATA */}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: surfaceHigh,
                    borderRadius: "9999px",
                    height: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "42.1%" /* DUMMY DATA */,
                      height: "100%",
                      backgroundColor: secondary,
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
              {/* Memory */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.3rem",
                  }}
                >
                  <span
                    style={{ fontSize: "0.75rem", color: onSurfaceVariant }}
                  >
                    Memory
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: primary,
                    }}
                  >
                    18.9GB / 32GB {/* DUMMY DATA */}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: surfaceHigh,
                    borderRadius: "9999px",
                    height: "6px",
                  }}
                >
                  <div
                    style={{
                      width: `${(18.9 / 32) * 100}%` /* DUMMY DATA */,
                      height: "100%",
                      backgroundColor: primary,
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live System Logs */}
          <div style={{ ...sectionStyle, flex: 1 }}>
            <p style={sectionTitleStyle}>Live System Logs</p>
            <div
              style={{
                backgroundColor: "#010f1f",
                borderRadius: "0.375rem",
                padding: "0.75rem",
                height: "220px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              {logs.map((line, i) => {
                const levelColor = line.includes("] ERROR")
                  ? error
                  : line.includes("] WARN")
                    ? "#f59e0b"
                    : line.includes("] DEBUG")
                      ? "#94a3b8"
                      : primary;
                return (
                  <span
                    key={i}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "0.68rem",
                      color: levelColor,
                      lineHeight: 1.6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {line}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
