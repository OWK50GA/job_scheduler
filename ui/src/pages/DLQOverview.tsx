import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { StatCard } from "../components/shared/StatCard";
import { Pagination } from "../components/shared/Pagination";
import type { Job } from "../types";

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const DUMMY_DLQ_JOBS: Job[] = [
  // DUMMY DATA
  {
    id: "job-001",
    type: "ASYNC_TASK",
    payload: { target: "user-service", action: "sync" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T08:00:00.000Z",
    recur_interval: null,
    last_error: "ConnectionRefusedError: ECONNREFUSED 127.0.0.1:5432",
    result: null,
    started_at: "2025-07-10T08:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T08:00:00.000Z",
    updated_at: "2025-07-10T08:04:32.123Z",
  },
  {
    id: "job-002",
    type: "WEBHOOK_EVENT",
    payload: { url: "https://hooks.example.com/notify", event: "job.failed" },
    status: "failed",
    priority: 2,
    attempt_count: 5,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T09:00:00.000Z",
    recur_interval: null,
    last_error: "TimeoutError: Request timed out after 30000ms",
    result: null,
    started_at: "2025-07-10T09:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T09:00:00.000Z",
    updated_at: "2025-07-10T09:30:00.456Z",
  },
  {
    id: "job-003",
    type: "ASYNC_TASK",
    payload: { queue: "email", recipient: "ops@example.com" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T10:00:00.000Z",
    recur_interval: null,
    last_error: 'ValidationError: missing required field "to"',
    result: null,
    started_at: "2025-07-10T10:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T10:00:00.000Z",
    updated_at: "2025-07-10T10:02:11.789Z",
  },
  {
    id: "job-004",
    type: "SCHEDULED_JOB",
    payload: { cron: "0 */6 * * *", task: "cleanup" },
    status: "failed",
    priority: 3,
    attempt_count: 2,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-10T06:00:00.000Z",
    recur_interval: null,
    last_error: "DatabaseError: deadlock detected",
    result: null,
    started_at: "2025-07-10T06:00:05.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T06:00:00.000Z",
    updated_at: "2025-07-10T06:00:59.001Z",
  },
  {
    id: "job-005",
    type: "WEBHOOK_EVENT",
    payload: { url: "https://api.partner.io/webhook", event: "order.created" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T11:00:00.000Z",
    recur_interval: null,
    last_error: "NetworkError: DNS resolution failed",
    result: null,
    started_at: "2025-07-10T11:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T11:00:00.000Z",
    updated_at: "2025-07-10T11:05:44.321Z",
  },
  {
    id: "job-006",
    type: "ASYNC_TASK",
    payload: { service: "billing", action: "charge" },
    status: "failed",
    priority: 2,
    attempt_count: 4,
    max_retries: 4,
    next_retry_at: null,
    scheduled_at: "2025-07-10T12:00:00.000Z",
    recur_interval: null,
    last_error: "AuthorizationError: invalid API key",
    result: null,
    started_at: "2025-07-10T12:00:02.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T12:00:00.000Z",
    updated_at: "2025-07-10T12:20:00.654Z",
  },
  {
    id: "job-007",
    type: "SCHEDULED_JOB",
    payload: { task: "report-generation", format: "pdf" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T07:00:00.000Z",
    recur_interval: null,
    last_error: "OutOfMemoryError: heap allocation failed",
    result: null,
    started_at: "2025-07-10T07:00:10.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T07:00:00.000Z",
    updated_at: "2025-07-10T07:10:22.987Z",
  },
  {
    id: "job-008",
    type: "ASYNC_TASK",
    payload: { pipeline: "etl", stage: "transform" },
    status: "failed",
    priority: 2,
    attempt_count: 2,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T13:00:00.000Z",
    recur_interval: null,
    last_error: "ParseError: unexpected token at position 42",
    result: null,
    started_at: "2025-07-10T13:00:03.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T13:00:00.000Z",
    updated_at: "2025-07-10T13:01:55.210Z",
  },
  {
    id: "job-009",
    type: "WEBHOOK_EVENT",
    payload: { url: "https://slack.com/api/post", channel: "#alerts" },
    status: "failed",
    priority: 3,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T14:00:00.000Z",
    recur_interval: null,
    last_error: "RateLimitError: 429 Too Many Requests",
    result: null,
    started_at: "2025-07-10T14:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T14:00:00.000Z",
    updated_at: "2025-07-10T14:03:30.543Z",
  },
  {
    id: "job-010",
    type: "ASYNC_TASK",
    payload: { component: "notification", event: "password_reset" },
    status: "failed",
    priority: 1,
    attempt_count: 5,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T15:00:00.000Z",
    recur_interval: null,
    last_error: "ConnectionRefusedError: ECONNREFUSED mail.example.com:587",
    result: null,
    started_at: "2025-07-10T15:00:02.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T15:00:00.000Z",
    updated_at: "2025-07-10T15:45:01.876Z",
  },
  {
    id: "job-011",
    type: "SCHEDULED_JOB",
    payload: { task: "cache-invalidation", keys: ["user:*"] },
    status: "failed",
    priority: 2,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T16:00:00.000Z",
    recur_interval: null,
    last_error: "RedisError: connection lost",
    result: null,
    started_at: "2025-07-10T16:00:05.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T16:00:00.000Z",
    updated_at: "2025-07-10T16:00:33.099Z",
  },
  {
    id: "job-012",
    type: "ASYNC_TASK",
    payload: { service: "search", action: "reindex" },
    status: "failed",
    priority: 3,
    attempt_count: 2,
    max_retries: 2,
    next_retry_at: null,
    scheduled_at: "2025-07-10T17:00:00.000Z",
    recur_interval: null,
    last_error: "ElasticsearchError: index_not_found_exception",
    result: null,
    started_at: "2025-07-10T17:00:07.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T17:00:00.000Z",
    updated_at: "2025-07-10T17:02:14.432Z",
  },
];

const DUMMY_FAILURE_DISTRIBUTION: { time: string; count: number }[] = [
  // DUMMY DATA
  { time: "00:00", count: 2 },
  { time: "10:00", count: 5 },
  { time: "20:00", count: 3 },
  { time: "30:00", count: 8 },
  { time: "40:00", count: 6 },
  { time: "50:00", count: 4 },
  { time: "60:00", count: 7 },
];

const DUMMY_TOP_ERROR_TYPES: { name: string; count: number }[] = [
  // DUMMY DATA
  { name: "ConnectionRefusedError", count: 4 },
  { name: "TimeoutError", count: 3 },
  { name: "ValidationError", count: 2 },
  { name: "AuthorizationError", count: 2 },
  { name: "DatabaseError", count: 1 },
];

const DUMMY_STAT_TOTAL_FAILED = 12; // DUMMY DATA
const DUMMY_STAT_AWAITING_REVIEW = 9; // DUMMY DATA
const DUMMY_STAT_AUTO_PURGE_24H = 3; // DUMMY DATA

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFailedAt(isoString: string): string {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const SSS = String(d.getMilliseconds()).padStart(3, "0");
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}.${SSS}`;
}

function extractErrorType(lastError: string | null): string {
  if (!lastError) return "Unknown Error";
  const colonIdx = lastError.indexOf(":");
  return colonIdx !== -1
    ? lastError.slice(0, colonIdx).trim()
    : lastError.trim();
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  backgroundColor: "#051424",
  minHeight: "100vh",
  color: "#f8fafc",
  fontFamily:
    "'Geist', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  padding: "1.5rem",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: "0.75rem",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  borderRadius: "0.5rem",
  padding: "1.25rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.8rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  color: "#94a3b8",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid #1e293b",
};

const tdStyle: React.CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderBottom: "1px solid #0f172a",
  color: "#f8fafc",
  verticalAlign: "middle",
};

const tabBase: React.CSSProperties = {
  padding: "0.4rem 1rem",
  borderRadius: "0.375rem",
  border: "1px solid #1e293b",
  backgroundColor: "transparent",
  color: "#94a3b8",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.04em",
  transition: "all 0.15s",
};

const tabActive: React.CSSProperties = {
  ...tabBase,
  backgroundColor: "#0c4a6e",
  borderColor: "#0ea5e9",
  color: "#0ea5e9",
};

const btnPrimary: React.CSSProperties = {
  padding: "0.4rem 0.85rem",
  borderRadius: "0.375rem",
  border: "1px solid #0ea5e9",
  backgroundColor: "transparent",
  color: "#0ea5e9",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.04em",
};

const btnSecondary: React.CSSProperties = {
  padding: "0.4rem 0.85rem",
  borderRadius: "0.375rem",
  border: "1px solid #475569",
  backgroundColor: "transparent",
  color: "#94a3b8",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.04em",
};

const investigateBtn: React.CSSProperties = {
  padding: "0.3rem 0.7rem",
  borderRadius: "0.25rem",
  border: "1px solid #334155",
  backgroundColor: "#1e293b",
  color: "#0ea5e9",
  fontSize: "0.7rem",
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.06em",
};

const PAGE_SIZE = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DLQOverview() {
  const navigate = useNavigate();

  type FilterTab = "ALL_SERVICES" | "CRITICAL_ONLY";

  const [jobs, setJobs] = useState<Job[]>(DUMMY_DLQ_JOBS);
  const [fetchError, setFetchError] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL_SERVICES");
  const [currentPage, setCurrentPage] = useState(1);

  // Apply filter
  const filteredJobs =
    activeTab === "CRITICAL_ONLY" ? jobs.filter((j) => j.priority === 1) : jobs;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(pageStart, pageStart + PAGE_SIZE);

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    setCurrentPage(1);
  }

  function handleRefresh() {
    // Re-set dummy data state (simulates a re-fetch)
    setFetchError(false);
    setJobs([...DUMMY_DLQ_JOBS]); // DUMMY DATA
    setCurrentPage(1);
  }

  return (
    <div style={pageStyle}>
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#f8fafc",
              margin: 0,
            }}
          >
            Dead Letter Queue
          </h1>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              margin: "0.25rem 0 0",
            }}
          >
            Jobs that have exhausted all retries and await investigation
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            style={btnSecondary}
            onClick={handleRefresh}
            aria-label="Refresh DLQ"
          >
            <span
              className="material-icons"
              style={{
                fontSize: "0.9rem",
                verticalAlign: "middle",
                marginRight: "0.3rem",
              }}
            >
              refresh
            </span>
            Refresh
          </button>
          <button style={btnSecondary} aria-label="Export CSV (placeholder)">
            <span
              className="material-icons"
              style={{
                fontSize: "0.9rem",
                verticalAlign: "middle",
                marginRight: "0.3rem",
              }}
            >
              download
            </span>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard
          label="Total Failed"
          value={DUMMY_STAT_TOTAL_FAILED}
          accentColor="#ef4444"
          icon="error_outline"
        />
        <StatCard
          label="Awaiting Review"
          value={DUMMY_STAT_AWAITING_REVIEW}
          accentColor="#f59e0b"
          icon="hourglass_empty"
        />
        <StatCard
          label="Auto-Purge in 24h"
          value={DUMMY_STAT_AUTO_PURGE_24H}
          accentColor="#94a3b8"
          icon="delete_sweep"
        />
      </div>

      {/* ── Charts row ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Failure Distribution — Line Chart */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Failure Distribution (last 60 min)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={DUMMY_FAILURE_DISTRIBUTION}
              style={{ background: "transparent" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  color: "#f8fafc",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ fill: "#0ea5e9", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Error Types — Horizontal Bar Chart */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Top Error Types</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={DUMMY_TOP_ERROR_TYPES}>
              <XAxis
                type="number"
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                width={160}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  color: "#f8fafc",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Bar dataKey="count" fill="#ef4444" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Investigation Queue ── */}
      <div style={cardStyle}>
        {/* Table header row with filter tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <p style={{ ...sectionHeadingStyle, margin: 0 }}>
            Investigation Queue
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              style={activeTab === "ALL_SERVICES" ? tabActive : tabBase}
              onClick={() => handleTabChange("ALL_SERVICES")}
            >
              ALL SERVICES
            </button>
            <button
              style={activeTab === "CRITICAL_ONLY" ? tabActive : tabBase}
              onClick={() => handleTabChange("CRITICAL_ONLY")}
            >
              CRITICAL ONLY
            </button>
          </div>
        </div>

        {/* Error state */}
        {fetchError && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#1a0a0a",
              border: "1px solid #ef4444",
              borderRadius: "0.375rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span
              className="material-icons"
              style={{ color: "#ef4444", fontSize: "1.1rem" }}
            >
              error
            </span>
            <span
              style={{ color: "#fca5a5", fontSize: "0.85rem", flexGrow: 1 }}
            >
              Failed to load DLQ jobs
            </span>
            <button
              style={{
                ...btnPrimary,
                borderColor: "#ef4444",
                color: "#ef4444",
              }}
              onClick={handleRefresh}
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {!fetchError && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Job ID</th>
                    <th style={thStyle}>Error Type</th>
                    <th style={thStyle}>Failed At</th>
                    <th style={thStyle}>Retries</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageJobs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          color: "#94a3b8",
                          padding: "2rem",
                        }}
                      >
                        No jobs found for this filter.
                      </td>
                    </tr>
                  ) : (
                    pageJobs.map((job) => (
                      <tr
                        key={job.id}
                        style={{ transition: "background 0.1s" }}
                      >
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "monospace",
                            fontSize: "0.78rem",
                            color: "#94a3b8",
                          }}
                        >
                          {job.id}
                        </td>
                        <td style={{ ...tdStyle }}>
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: "#1a0a0a",
                              border: "1px solid #7f1d1d",
                              color: "#fca5a5",
                              borderRadius: "0.25rem",
                              padding: "0.15rem 0.5rem",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                            }}
                          >
                            {extractErrorType(job.last_error)}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "monospace",
                            fontSize: "0.78rem",
                            color: "#94a3b8",
                          }}
                        >
                          {formatFailedAt(job.updated_at)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "monospace",
                            fontSize: "0.82rem",
                          }}
                        >
                          <span style={{ color: "#f59e0b" }}>
                            {job.attempt_count}
                          </span>
                          <span style={{ color: "#475569" }}>/</span>
                          <span style={{ color: "#94a3b8" }}>
                            {job.max_retries}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <button
                            style={investigateBtn}
                            onClick={() => navigate(`/jobs/dlq/${job.id}`)}
                            aria-label={`Investigate job ${job.id}`}
                          >
                            INVESTIGATE
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "1rem",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                Showing {pageJobs.length > 0 ? pageStart + 1 : 0}–
                {pageStart + pageJobs.length} of {filteredJobs.length} jobs
              </span>
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNext={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
