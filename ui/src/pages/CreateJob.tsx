import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createJob } from "../services/api";
import type { CreateJobInput } from "../types";

// ---------------------------------------------------------------------------
// DUMMY DATA — processor type options
// ---------------------------------------------------------------------------
const PROCESSOR_OPTIONS = [
  // DUMMY DATA
  "Standard Lambda-Node20",
  "High Memory Compute-v4",
  "GPU Accelerated Tensor-X",
  "Legacy Python-3.8",
] as const;

// ---------------------------------------------------------------------------
// DUMMY DATA — default payload JSON example
// ---------------------------------------------------------------------------
const DEFAULT_PAYLOAD_JSON = JSON.stringify(
  // DUMMY DATA
  {
    taskName: "example-task",
    userId: 42,
    options: {
      notify: true,
      retryOnFail: false,
    },
  },
  null,
  2,
);

// ---------------------------------------------------------------------------
// DUMMY DATA — engine health widget values
// ---------------------------------------------------------------------------
const ENGINE_CLUSTER_LOAD = "38%"; // DUMMY DATA
const ENGINE_IDLE_WORKERS = 12; // DUMMY DATA
const ENGINE_AVG_WAIT = "240 ms"; // DUMMY DATA

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const styles = {
  page: {
    color: "#f8fafc",
    fontFamily:
      "Geist, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    minHeight: "100vh",
    backgroundColor: "#051424",
  } as React.CSSProperties,

  header: {
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  title: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#f8fafc",
    margin: 0,
    marginBottom: "0.25rem",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    margin: 0,
  } as React.CSSProperties,

  columns: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: "1.5rem",
    alignItems: "start",
  } as React.CSSProperties,

  // Left panel — form
  formPanel: {
    backgroundColor: "#0f172a",
    borderRadius: "0.5rem",
    border: "1px solid #1e293b",
    padding: "1.5rem",
  } as React.CSSProperties,

  formTitle: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 1.25rem 0",
  } as React.CSSProperties,

  fieldGroup: {
    marginBottom: "1.25rem",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "0.375rem",
  } as React.CSSProperties,

  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
    colorScheme: "dark" as const,
  } as React.CSSProperties,

  inputFocus: {
    borderColor: "#0ea5e9",
  } as React.CSSProperties,

  select: {
    width: "100%",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  radioGroup: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.875rem",
    color: "#f8fafc",
    cursor: "pointer",
  } as React.CSSProperties,

  radio: {
    accentColor: "#0ea5e9",
    cursor: "pointer",
  } as React.CSSProperties,

  textareaWrapper: {
    position: "relative" as const,
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.8rem",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "140px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  prettifyRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "0.375rem",
  } as React.CSSProperties,

  btnPrettify: {
    padding: "0.25rem 0.75rem",
    backgroundColor: "#1e293b",
    color: "#0ea5e9",
    border: "1px solid #334155",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.04em",
  } as React.CSSProperties,

  fieldError: {
    fontSize: "0.75rem",
    color: "#ef4444",
    marginTop: "0.375rem",
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  } as React.CSSProperties,

  formActions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
    marginTop: "1.5rem",
    paddingTop: "1.25rem",
    borderTop: "1px solid #1e293b",
  } as React.CSSProperties,

  btnCancel: {
    padding: "0.5rem 1.25rem",
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties,

  btnSubmit: {
    padding: "0.5rem 1.25rem",
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    border: "none",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  } as React.CSSProperties,

  btnSubmitDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  } as React.CSSProperties,

  apiError: {
    backgroundColor: "#1e293b",
    border: "1px solid #ef4444",
    borderRadius: "0.375rem",
    padding: "0.75rem 1rem",
    fontSize: "0.8rem",
    color: "#ef4444",
    marginBottom: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  } as React.CSSProperties,

  // Right panel
  rightPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  } as React.CSSProperties,

  infoCard: {
    backgroundColor: "#0f172a",
    borderRadius: "0.5rem",
    border: "1px solid #1e293b",
    padding: "1rem",
  } as React.CSSProperties,

  infoCardTitle: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#0ea5e9",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.625rem",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  } as React.CSSProperties,

  infoCardBody: {
    fontSize: "0.8rem",
    color: "#94a3b8",
    lineHeight: 1.6,
  } as React.CSSProperties,

  engineCard: {
    backgroundColor: "#0f172a",
    borderRadius: "0.5rem",
    border: "1px solid #1e293b",
    padding: "1rem",
  } as React.CSSProperties,

  engineTitle: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#10b981",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.75rem",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  } as React.CSSProperties,

  engineRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.375rem 0",
    borderBottom: "1px solid #1e293b",
  } as React.CSSProperties,

  engineRowLast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.375rem 0",
  } as React.CSSProperties,

  engineKey: {
    fontSize: "0.75rem",
    color: "#94a3b8",
  } as React.CSSProperties,

  engineValue: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#f8fafc",
    fontVariantNumeric: "tabular-nums" as const,
  } as React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Priority options
// ---------------------------------------------------------------------------
const PRIORITY_OPTIONS: {
  label: string;
  value: 1 | 2 | 3;
  description: string;
}[] = [
  { label: "Critical", value: 1, description: "Highest queue priority" },
  { label: "Normal", value: 2, description: "Standard priority" },
  { label: "Low", value: 3, description: "Best-effort scheduling" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateJob() {
  const navigate = useNavigate();

  // Form state
  const [jobName, setJobName] = useState("");
  const [processorType, setProcessorType] = useState<string>(
    PROCESSOR_OPTIONS[0],
  );
  const [scheduledStart, setScheduledStart] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [payloadJson, setPayloadJson] = useState(DEFAULT_PAYLOAD_JSON);

  // Validation errors
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [prettifyError, setPrettifyError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Prettify handler (5.2, 5.3)
  // ---------------------------------------------------------------------------
  function handlePrettify() {
    setPrettifyError(null);
    try {
      const parsed = JSON.parse(payloadJson);
      setPayloadJson(JSON.stringify(parsed, null, 2));
    } catch {
      setPrettifyError("Invalid JSON");
    }
  }

  // ---------------------------------------------------------------------------
  // Submit handler (5.4, 5.5, 5.6)
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Reset errors
    setPayloadError(null);
    setScheduledError(null);
    setApiError(null);

    let hasError = false;

    // Validate payload JSON
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch {
      setPayloadError("Payload must be valid JSON");
      hasError = true;
      parsedPayload = {};
    }

    // Validate scheduled_at is in the future
    let scheduledAtMs: number | undefined;
    if (scheduledStart) {
      const ts = new Date(scheduledStart).getTime();
      if (ts <= Date.now()) {
        setScheduledError("Scheduled time must be in the future");
        hasError = true;
      } else {
        scheduledAtMs = ts;
      }
    }

    if (hasError) return;

    // Build payload
    const input: CreateJobInput = {
      type: jobName,
      payload: parsedPayload,
      priority,
      ...(scheduledAtMs !== undefined ? { scheduled_at: scheduledAtMs } : {}),
    };

    setSubmitting(true);
    try {
      await createJob(input);
      navigate("/jobs");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel handler (5.7)
  // ---------------------------------------------------------------------------
  function handleCancel() {
    navigate("/jobs");
  }

  return (
    <div style={styles.page}>
      {/* Page header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Create New Job</h1>
        <p style={styles.subtitle}>
          Manually dispatch a background job to the scheduler queue.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={styles.columns}>
        {/* ---------------------------------------------------------------- */}
        {/* Left panel — form                                                 */}
        {/* ---------------------------------------------------------------- */}
        <div style={styles.formPanel}>
          <p style={styles.formTitle}>Job Configuration</p>

          {/* API error banner */}
          {apiError && (
            <div style={styles.apiError} role="alert">
              <span className="material-icons" style={{ fontSize: "1rem" }}>
                error_outline
              </span>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Job Name */}
            <div style={styles.fieldGroup}>
              <label htmlFor="job-name" style={styles.label}>
                Job Name
              </label>
              <input
                id="job-name"
                type="text"
                style={styles.input}
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. ASYNC_TASK"
                required
                autoComplete="off"
                aria-label="Job Name"
              />
            </div>

            {/* Processor Type */}
            <div style={styles.fieldGroup}>
              <label htmlFor="processor-type" style={styles.label}>
                Processor Type
              </label>
              <select
                id="processor-type"
                style={styles.select}
                value={processorType}
                onChange={(e) => setProcessorType(e.target.value)}
                aria-label="Processor Type"
              >
                {PROCESSOR_OPTIONS.map(
                  (
                    opt, // DUMMY DATA
                  ) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Scheduled Start */}
            <div style={styles.fieldGroup}>
              <label htmlFor="scheduled-start" style={styles.label}>
                Scheduled Start{" "}
                <span style={{ color: "#475569", fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <input
                id="scheduled-start"
                type="datetime-local"
                style={styles.input}
                value={scheduledStart}
                onChange={(e) => {
                  setScheduledStart(e.target.value);
                  setScheduledError(null);
                }}
                aria-label="Scheduled Start"
                aria-describedby={
                  scheduledError ? "scheduled-error" : undefined
                }
              />
              {scheduledError && (
                <p id="scheduled-error" style={styles.fieldError} role="alert">
                  <span
                    className="material-icons"
                    style={{ fontSize: "0.9rem" }}
                  >
                    warning
                  </span>
                  {scheduledError}
                </p>
              )}
            </div>

            {/* Priority Level */}
            <div style={styles.fieldGroup}>
              <span style={styles.label}>Priority Level</span>
              <div
                style={styles.radioGroup}
                role="radiogroup"
                aria-label="Priority Level"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={styles.radioLabel}
                    title={opt.description}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={opt.value}
                      checked={priority === opt.value}
                      onChange={() => setPriority(opt.value)}
                      style={styles.radio}
                      aria-label={opt.label}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Payload JSON */}
            <div style={styles.fieldGroup}>
              <label htmlFor="payload-json" style={styles.label}>
                Payload JSON
              </label>
              <div style={styles.textareaWrapper}>
                <textarea
                  id="payload-json"
                  style={{
                    ...styles.textarea,
                    ...(payloadError ? { borderColor: "#ef4444" } : {}),
                  }}
                  value={payloadJson}
                  onChange={(e) => {
                    setPayloadJson(e.target.value);
                    setPayloadError(null);
                    setPrettifyError(null);
                  }}
                  aria-label="Payload JSON"
                  aria-describedby={payloadError ? "payload-error" : undefined}
                  spellCheck={false}
                />
              </div>
              <div style={styles.prettifyRow}>
                <button
                  type="button"
                  style={styles.btnPrettify}
                  onClick={handlePrettify}
                  aria-label="Prettify JSON"
                >
                  {"{ } Prettify"}
                </button>
              </div>
              {prettifyError && (
                <p style={styles.fieldError} role="alert">
                  <span
                    className="material-icons"
                    style={{ fontSize: "0.9rem" }}
                  >
                    warning
                  </span>
                  {prettifyError}
                </p>
              )}
              {payloadError && (
                <p id="payload-error" style={styles.fieldError} role="alert">
                  <span
                    className="material-icons"
                    style={{ fontSize: "0.9rem" }}
                  >
                    warning
                  </span>
                  {payloadError}
                </p>
              )}
            </div>

            {/* Form actions */}
            <div style={styles.formActions}>
              <button
                type="button"
                style={styles.btnCancel}
                onClick={handleCancel}
                disabled={submitting}
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  ...styles.btnSubmit,
                  ...(submitting ? styles.btnSubmitDisabled : {}),
                }}
                disabled={submitting}
                aria-label="Dispatch Job"
              >
                {submitting ? (
                  <>
                    <span
                      className="material-icons"
                      style={{
                        fontSize: "1rem",
                        animation: "spin 1s linear infinite",
                      }}
                    >
                      autorenew
                    </span>
                    Dispatching…
                  </>
                ) : (
                  <>
                    <span
                      className="material-icons"
                      style={{ fontSize: "1rem" }}
                    >
                      send
                    </span>
                    Dispatch Job
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right panel — Queue Logic cards + Engine Health (5.8)             */}
        {/* ---------------------------------------------------------------- */}
        <div style={styles.rightPanel}>
          {/* Queue Logic: Priority Placement */}
          <div style={styles.infoCard}>
            <div style={styles.infoCardTitle}>
              <span className="material-icons" style={{ fontSize: "1rem" }}>
                low_priority
              </span>
              Priority Placement
            </div>
            <div style={styles.infoCardBody}>
              Jobs with <strong style={{ color: "#ef4444" }}>Critical</strong>{" "}
              priority (1) are placed at the head of the queue and preempt all
              Normal and Low jobs. Use sparingly to avoid starvation of
              lower-priority work.
            </div>
          </div>

          {/* Queue Logic: Resource Allocation */}
          <div style={styles.infoCard}>
            <div style={styles.infoCardTitle}>
              <span className="material-icons" style={{ fontSize: "1rem" }}>
                memory
              </span>
              Resource Allocation
            </div>
            <div style={styles.infoCardBody}>
              The selected{" "}
              <strong style={{ color: "#0ea5e9" }}>Processor Type</strong>{" "}
              determines the worker pool your job is routed to. High Memory and
              GPU workers are limited — over-allocation will cause queueing
              delays.
            </div>
          </div>

          {/* Queue Logic: Latency Warning */}
          <div style={styles.infoCard}>
            <div style={styles.infoCardTitle}>
              <span className="material-icons" style={{ fontSize: "1rem" }}>
                timer_off
              </span>
              Latency Warning
            </div>
            <div style={styles.infoCardBody}>
              Scheduling jobs more than{" "}
              <strong style={{ color: "#f59e0b" }}>24 hours</strong> in the
              future may be subject to cluster rebalancing. Verify the Scheduled
              Start aligns with expected maintenance windows.
            </div>
          </div>

          {/* Engine Health widget */}
          <div style={styles.engineCard}>
            <div style={styles.engineTitle}>
              <span className="material-icons" style={{ fontSize: "1rem" }}>
                monitor_heart
              </span>
              Engine Health
            </div>

            <div style={styles.engineRow}>
              <span style={styles.engineKey}>Cluster Load</span>
              <span style={styles.engineValue}>
                {ENGINE_CLUSTER_LOAD /* DUMMY DATA */}
              </span>
            </div>

            <div style={styles.engineRow}>
              <span style={styles.engineKey}>Idle Workers</span>
              <span style={styles.engineValue}>
                {ENGINE_IDLE_WORKERS /* DUMMY DATA */}
              </span>
            </div>

            <div style={styles.engineRowLast}>
              <span style={styles.engineKey}>Avg Wait</span>
              <span style={styles.engineValue}>
                {ENGINE_AVG_WAIT /* DUMMY DATA */}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
