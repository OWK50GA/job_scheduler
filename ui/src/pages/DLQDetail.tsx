import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { retryJob } from "../services/api";
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

const DUMMY_CPU_PERCENTAGE = "67%"; // DUMMY DATA
const DUMMY_PURGE_COUNTDOWN = "23h 14m remaining"; // DUMMY DATA
const DUMMY_REGION = "us-east-1 (Primary)"; // DUMMY DATA

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build dummy retry sequence entries spaced ~2 minutes apart from started_at */
function buildRetrySequence(
  job: Job,
): { attempt: number; error: string; timestamp: string }[] {
  // DUMMY DATA
  const base = job.started_at ? new Date(job.started_at).getTime() : Date.now();
  return Array.from({ length: job.attempt_count }, (_, i) => ({
    attempt: i + 1,
    error: job.last_error ?? "Unknown error",
    timestamp: new Date(base + i * 2 * 60 * 1000).toISOString(),
  }));
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

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  borderRadius: "0.5rem",
  padding: "1.25rem",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: "0.75rem",
  margin: "0 0 0.75rem 0",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "0.2rem",
};

const valueStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#f8fafc",
  fontFamily: "monospace",
};

const btnBase: React.CSSProperties = {
  padding: "0.45rem 1rem",
  borderRadius: "0.375rem",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.04em",
  border: "1px solid #475569",
  backgroundColor: "transparent",
  color: "#94a3b8",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  border: "1px solid #0ea5e9",
  color: "#0ea5e9",
};

const btnError: React.CSSProperties = {
  ...btnBase,
  border: "1px solid #ef4444",
  color: "#ef4444",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DLQDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Find the job from dummy data
  const job = DUMMY_DLQ_JOBS.find((j) => j.id === id) ?? null;

  // ── Payload code block state ──
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [copyError, setCopyError] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // ── Retry state ──
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // ── Not found guard ──
  if (!job) {
    return (
      <div style={pageStyle}>
        <Link
          to="/jobs/dlq"
          style={{
            color: "#0ea5e9",
            fontSize: "0.8rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            marginBottom: "1.5rem",
          }}
        >
          <span className="material-icons" style={{ fontSize: "1rem" }}>
            arrow_back
          </span>
          Back to DLQ List
        </Link>
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            color: "#94a3b8",
            padding: "3rem",
          }}
        >
          <span
            className="material-icons"
            style={{
              fontSize: "2rem",
              color: "#475569",
              display: "block",
              marginBottom: "0.75rem",
            }}
          >
            search_off
          </span>
          Job <code style={{ color: "#f8fafc" }}>{id}</code> not found in the
          Dead Letter Queue.
        </div>
      </div>
    );
  }

  const payloadString = JSON.stringify(job.payload, null, 2);
  const retrySequence = buildRetrySequence(job); // DUMMY DATA

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payloadString);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }

  async function handleRetry() {
    if (!job) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await retryJob(job.id);
      navigate("/jobs/dlq");
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div style={pageStyle}>
      {/* ── Back link ── */}
      <Link
        to="/jobs/dlq"
        style={{
          color: "#0ea5e9",
          fontSize: "0.8rem",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          marginBottom: "1.5rem",
        }}
      >
        <span className="material-icons" style={{ fontSize: "1rem" }}>
          arrow_back
        </span>
        Back to DLQ List
      </Link>

      {/* ── Critical Failure Banner ── */}
      <div
        style={{
          backgroundColor: "#1a0000",
          border: "1px solid #ef4444",
          borderRadius: "0.5rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span
          className="material-icons"
          style={{ color: "#ef4444", fontSize: "1.4rem", flexShrink: 0 }}
        >
          error
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem 1.5rem",
            flex: 1,
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.65rem",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
              }}
            >
              Job ID
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.9rem",
                color: "#f8fafc",
                fontWeight: 700,
              }}
            >
              {job.id}
            </span>
          </div>
          <div>
            <span
              style={{
                fontSize: "0.65rem",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
              }}
            >
              Type
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.9rem",
                color: "#f8fafc",
                fontWeight: 700,
              }}
            >
              {job.type}
            </span>
          </div>
          <div>
            <span
              style={{
                fontSize: "0.65rem",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
              }}
            >
              Status
            </span>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#ef4444",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {job.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: main content + sidebar ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* ── Left column ── */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Error Summary Card */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Error Summary</p>
            <div
              style={{
                backgroundColor: "#1a0000",
                border: "1px solid #7f1d1d",
                borderRadius: "0.375rem",
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  color: "#fca5a5",
                  wordBreak: "break-word",
                }}
              >
                {job.last_error ?? "No error message recorded"}
              </p>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                Attempts:
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                <span style={{ color: "#f59e0b" }}>{job.attempt_count}</span>
                <span style={{ color: "#475569" }}> / </span>
                <span style={{ color: "#94a3b8" }}>{job.max_retries}</span>
              </span>
            </div>
          </div>

          {/* Payload JSON Code Block */}
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <p style={{ ...sectionHeadingStyle, margin: 0 }}>Payload</p>
              <div
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                {copyError && (
                  <span style={{ fontSize: "0.72rem", color: "#ef4444" }}>
                    Copy failed
                  </span>
                )}
                <button
                  style={{
                    ...btnBase,
                    padding: "0.3rem 0.75rem",
                    fontSize: "0.72rem",
                  }}
                  onClick={handleCopy}
                  aria-label="Copy payload to clipboard"
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: "0.85rem",
                      verticalAlign: "middle",
                      marginRight: "0.3rem",
                    }}
                  >
                    content_copy
                  </span>
                  {copyLabel}
                </button>
                <button
                  style={{
                    ...btnBase,
                    padding: "0.3rem 0.75rem",
                    fontSize: "0.72rem",
                  }}
                  onClick={() => setExpanded((e) => !e)}
                  aria-label={expanded ? "Collapse payload" : "Expand payload"}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: "0.85rem",
                      verticalAlign: "middle",
                      marginRight: "0.3rem",
                    }}
                  >
                    {expanded ? "expand_less" : "expand_more"}
                  </span>
                  {expanded ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>
            <div
              style={{
                overflow: "hidden",
                maxHeight: expanded ? "none" : "150px",
                borderRadius: "0.375rem",
                position: "relative",
              }}
            >
              <pre
                style={{
                  backgroundColor: "#010f1f",
                  color: "#94a3b8",
                  padding: "1rem",
                  margin: 0,
                  borderRadius: "0.375rem",
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                  overflowX: "auto",
                  fontFamily: "monospace",
                }}
              >
                {payloadString}
              </pre>
              {!expanded && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "3rem",
                    background:
                      "linear-gradient(to bottom, transparent, #010f1f)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>

          {/* Stack Trace */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Stack Trace</p>
            {job.last_error && job.last_error.trim() !== "" ? (
              <pre
                style={{
                  backgroundColor: "#010f1f",
                  color: "#fca5a5",
                  padding: "1rem",
                  margin: 0,
                  borderRadius: "0.375rem",
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                  overflowX: "auto",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {job.last_error}
              </pre>
            ) : (
              <p
                style={{
                  color: "#475569",
                  fontSize: "0.82rem",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                No stack trace available
              </p>
            )}
          </div>

          {/* Retry Sequence Timeline */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Retry Sequence {/* DUMMY DATA */}</p>
            {retrySequence.length === 0 ? (
              <p style={{ color: "#475569", fontSize: "0.82rem", margin: 0 }}>
                No retry attempts recorded.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {retrySequence.map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: "1rem",
                      position: "relative",
                    }}
                  >
                    {/* Timeline spine */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: "#1e293b",
                          border: "2px solid #ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          color: "#ef4444",
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      >
                        {entry.attempt}
                      </div>
                      {idx < retrySequence.length - 1 && (
                        <div
                          style={{
                            width: "2px",
                            flex: 1,
                            minHeight: "24px",
                            backgroundColor: "#1e293b",
                          }}
                        />
                      )}
                    </div>
                    {/* Timeline content */}
                    <div
                      style={{
                        paddingBottom:
                          idx < retrySequence.length - 1 ? "1rem" : 0,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 0.2rem 0",
                          fontSize: "0.72rem",
                          color: "#94a3b8",
                          fontFamily: "monospace",
                        }}
                      >
                        {entry.timestamp}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.78rem",
                          color: "#fca5a5",
                          fontFamily: "monospace",
                          wordBreak: "break-word",
                        }}
                      >
                        {entry.error}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column (sidebar) ── */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Metadata Panel */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Metadata</p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem",
              }}
            >
              <div>
                <p style={labelStyle}>Attempted At</p>
                <p style={valueStyle}>{job.updated_at}</p>
              </div>
              <div>
                <p style={labelStyle}>Region {/* DUMMY DATA */}</p>
                <p style={valueStyle}>{DUMMY_REGION}</p>
                {/* DUMMY DATA */}
              </div>
              <div>
                <p style={labelStyle}>Worker Node</p>
                <p style={{ ...valueStyle, color: "#475569" }}>N/A</p>
              </div>
              <div>
                <p style={labelStyle}>Priority</p>
                <PriorityBadge priority={job.priority} />
              </div>
            </div>
          </div>

          {/* Node Metrics CPU Gauge */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Node Metrics {/* DUMMY DATA */}</p>
            <p style={labelStyle}>CPU Usage</p>
            {DUMMY_CPU_PERCENTAGE ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      backgroundColor: "#1e293b",
                      borderRadius: "9999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: DUMMY_CPU_PERCENTAGE, // DUMMY DATA
                        backgroundColor: "#0ea5e9",
                        borderRadius: "9999px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      color: "#f8fafc",
                      minWidth: "3rem",
                      textAlign: "right",
                    }}
                  >
                    {DUMMY_CPU_PERCENTAGE}
                    {/* DUMMY DATA */}
                  </span>
                </div>
              </>
            ) : (
              <p
                style={{
                  color: "#475569",
                  fontSize: "0.82rem",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                No data
              </p>
            )}
          </div>

          {/* Auto-purge Countdown */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Auto-Purge</p>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                className="material-icons"
                style={{ color: "#f59e0b", fontSize: "1rem" }}
              >
                timer
              </span>
              <span
                style={{
                  fontSize: "0.82rem",
                  color: "#f8fafc",
                  fontFamily: "monospace",
                }}
              >
                {DUMMY_PURGE_COUNTDOWN /* DUMMY DATA */ || "No purge scheduled"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={cardStyle}>
            <p style={sectionHeadingStyle}>Actions</p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              {/* Export Payload — no-op */}
              <button style={btnBase} aria-label="Export Payload (placeholder)">
                <span
                  className="material-icons"
                  style={{
                    fontSize: "0.9rem",
                    verticalAlign: "middle",
                    marginRight: "0.4rem",
                  }}
                >
                  download
                </span>
                Export Payload
              </button>

              {/* Purge from DLQ — no-op */}
              <button
                style={btnError}
                aria-label="Purge from DLQ (placeholder)"
              >
                <span
                  className="material-icons"
                  style={{
                    fontSize: "0.9rem",
                    verticalAlign: "middle",
                    marginRight: "0.4rem",
                  }}
                >
                  delete_forever
                </span>
                Purge from DLQ
              </button>

              {/* Retry Job — calls retryJob(id) */}
              <button
                style={{ ...btnPrimary, opacity: retrying ? 0.7 : 1 }}
                onClick={handleRetry}
                disabled={retrying}
                aria-label="Retry this job"
              >
                <span
                  className="material-icons"
                  style={{
                    fontSize: "0.9rem",
                    verticalAlign: "middle",
                    marginRight: "0.4rem",
                  }}
                >
                  replay
                </span>
                {retrying ? "Retrying…" : "Retry Job"}
              </button>

              {/* Retry error message */}
              {retryError && (
                <div
                  style={{
                    backgroundColor: "#1a0000",
                    border: "1px solid #7f1d1d",
                    borderRadius: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.75rem",
                    color: "#fca5a5",
                    wordBreak: "break-word",
                  }}
                >
                  {retryError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
