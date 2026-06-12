import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { PageHeader } from "../components/shared/PageHeader";
import { Panel } from "../components/shared/Panel";
import { createJob } from "../services/api";
import type { CreateJobInput } from "../types";

type RecurInterval = "" | "every_1_minute" | "every_5_minutes" | "every_1_hour";

const DEFAULT_PAYLOAD_JSON = JSON.stringify(
  {
    to: "user@example.com",
    subject: "Welcome",
  },
  null,
  2,
);

const PRIORITY_OPTIONS: {
  label: string;
  value: 1 | 2 | 3;
  description: string;
}[] = [
  { label: "Critical", value: 1, description: "Jumps to the top of the queue" },
  { label: "Normal", value: 2, description: "Standard scheduler priority" },
  { label: "Low", value: 3, description: "Best-effort processing" },
];

const inputClassName =
  "h-11 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 font-body text-sm text-on-surface outline-none transition focus:border-primary hover:border-outline";

const textareaClassName =
  "min-h-[220px] w-full resize-none rounded-lg border border-outline-variant bg-transparent px-4 py-3 font-code text-[13px] leading-6 text-primary outline-none";

export default function CreateJob() {
  const navigate = useNavigate();

  const [jobType, setJobType] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [recurInterval, setRecurInterval] = useState<RecurInterval>("");
  const [dependsOn, setDependsOn] = useState("");
  const [payloadJson, setPayloadJson] = useState(DEFAULT_PAYLOAD_JSON);

  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  const [dependsOnError, setDependsOnError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [prettifyError, setPrettifyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePrettify() {
    setPrettifyError(null);
    try {
      const parsed = JSON.parse(payloadJson);
      setPayloadJson(JSON.stringify(parsed, null, 2));
    } catch {
      setPrettifyError("Invalid JSON");
    }
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayloadError(null);
    setScheduledError(null);
    setDependsOnError(null);
    setApiError(null);

    let hasError = false;
    let parsedPayload: Record<string, unknown> = {};

    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch {
      setPayloadError("Payload must be valid JSON");
      hasError = true;
    }

    let scheduledAtMs: number | undefined;
    if (scheduledStart) {
      const timestamp = new Date(scheduledStart).getTime();
      if (timestamp <= Date.now()) {
        setScheduledError("Scheduled time must be in the future");
        hasError = true;
      } else {
        scheduledAtMs = timestamp;
      }
    }

    if (dependsOn && !UUID_RE.test(dependsOn)) {
      setDependsOnError(
        "Must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)",
      );
      hasError = true;
    }

    if (hasError) return;

    const input: CreateJobInput = {
      type: jobType,
      payload: parsedPayload,
      priority,
      ...(scheduledAtMs !== undefined ? { scheduled_at: scheduledAtMs } : {}),
      ...(recurInterval ? { recur_interval: recurInterval } : {}),
      ...(dependsOn ? { depends_on: dependsOn } : {}),
    };

    setSubmitting(true);
    try {
      await createJob(input);
      navigate("/jobs");
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Job Dispatch"
        title="Create New Execution Job"
        description="Configure system parameters for immediate or scheduled processing."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ── Main form ─────────────────────────────────────────────── */}
        <Panel className="xl:col-span-8">
          <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Job Configuration
            </h2>
          </div>

          <div className="px-4 py-5 sm:px-5">
            {apiError && (
              <div className="mb-5 rounded border border-error bg-error/10 px-4 py-3 text-sm text-on-error-container">
                {apiError}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              {/* Job Type */}
              <div className="space-y-2">
                <label
                  htmlFor="job-type"
                  className="block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  Job Type
                </label>
                <input
                  id="job-type"
                  type="text"
                  className={inputClassName}
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                  placeholder="e.g. send_email"
                  autoComplete="off"
                  required
                />
                <p className="font-body text-xs text-on-surface-variant">
                  Must match a registered handler on the worker (e.g.{" "}
                  <code className="font-code text-primary">send_email</code>).
                </p>
              </div>

              {/* Scheduled Start + Recur Interval */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="scheduled-start"
                    className="block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Scheduled Start{" "}
                    <span className="normal-case text-on-surface-variant/60">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="scheduled-start"
                    type="datetime-local"
                    className={inputClassName}
                    value={scheduledStart}
                    onChange={(e) => {
                      setScheduledStart(e.target.value);
                      setScheduledError(null);
                    }}
                  />
                  {scheduledError && (
                    <p className="text-sm text-error">{scheduledError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="recur-interval"
                    className="block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Recurring Interval{" "}
                    <span className="normal-case text-on-surface-variant/60">
                      (optional)
                    </span>
                  </label>
                  <select
                    id="recur-interval"
                    className={inputClassName}
                    value={recurInterval}
                    onChange={(e) =>
                      setRecurInterval(e.target.value as RecurInterval)
                    }
                  >
                    <option value="">— None (one-shot) —</option>
                    <option value="every_1_minute">Every 1 minute</option>
                    <option value="every_5_minutes">Every 5 minutes</option>
                    <option value="every_1_hour">Every 1 hour</option>
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-3">
                <label className="block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Priority Level
                </label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {PRIORITY_OPTIONS.map((option) => {
                    const active = priority === option.value;
                    return (
                      <label
                        key={option.value}
                        className={[
                          "cursor-pointer rounded-lg border p-4 transition",
                          active
                            ? "border-primary bg-sky-200 text-black"
                            : "border-outline-variant bg-surface-container-low hover:border-outline hover:bg-surface-container-high",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="priority"
                          value={option.value}
                          checked={active}
                          onChange={() => setPriority(option.value)}
                          className="sr-only"
                        />
                        <div className="space-y-1 text-center">
                          <p
                            className={`font-body text-sm font-medium ${active ? "text-primary" : "text-on-surface"}`}
                          >
                            {option.label}
                          </p>
                          <p className="font-body text-xs text-on-surface-variant">
                            {option.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Depends On */}
              <div className="space-y-2">
                <label
                  htmlFor="depends-on"
                  className="block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  Depends On{" "}
                  <span className="normal-case text-on-surface-variant/60">
                    (optional - job UUID)
                  </span>
                </label>
                <input
                  id="depends-on"
                  type="text"
                  className={`${inputClassName} font-code text-[13px] ${dependsOnError ? "border-error" : ""}`}
                  value={dependsOn}
                  onChange={(e) => {
                    setDependsOn(e.target.value.trim());
                    setDependsOnError(null);
                  }}
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  autoComplete="off"
                />
                {dependsOnError && (
                  <p className="text-sm text-error">{dependsOnError}</p>
                )}
                <p className="font-body text-xs text-on-surface-variant">
                  This job will not run until the specified job has completed
                  successfully.
                </p>
              </div>

              {/* Payload JSON */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="payload-json"
                    className="block font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Payload (JSON)
                  </label>
                  <Button
                    icon="data_object"
                    variant="link"
                    onClick={handlePrettify}
                  >
                    Prettify JSON
                  </Button>
                </div>
                <div className="relative overflow-hidden rounded-lg border border-outline-variant bg-[#020617]">
                  <div className="absolute inset-y-0 left-0 flex w-8 flex-col items-center border-r border-outline-variant bg-surface-container-highest pt-3 font-code text-[10px] text-on-surface-variant">
                    {Array.from({ length: 8 }, (_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  <textarea
                    id="payload-json"
                    spellCheck={false}
                    value={payloadJson}
                    onChange={(e) => {
                      setPayloadJson(e.target.value);
                      setPayloadError(null);
                      setPrettifyError(null);
                    }}
                    className={`${textareaClassName} pl-11 ${payloadError ? "border-error" : ""}`.trim()}
                  />
                </div>
                {prettifyError && (
                  <p className="text-sm text-error">{prettifyError}</p>
                )}
                {payloadError && (
                  <p className="text-sm text-error">{payloadError}</p>
                )}
              </div>

              {/* Submit row */}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant pt-4">
                <Button
                  variant="primary"
                  onClick={() => navigate("/jobs")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={submitting || !jobType.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-primary bg-primary px-5 py-2 font-body text-[11px] font-semibold uppercase tracking-wider text-on-primary transition hover:bg-sky-200 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${submitting ? "animate-spin" : ""}`.trim()}
                  >
                    {submitting ? "refresh" : "bolt"}
                  </span>
                  {submitting ? "Processing..." : "Create Job"}
                </button>
              </div>
            </form>
          </div>
        </Panel>

        {/* ── Queue Logic sidebar (static reference — kept as-is) ──── */}
        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-primary">
                Queue Logic
              </h2>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {[
                // {
                //   title: "Priority Placement",
                //   body: "Critical priority jobs bypass the wait state and are assigned to the next available worker node immediately.",
                //   color: "bg-primary",
                // },
                // {
                //   title: "Resource Allocation",
                //   body: "Standard jobs are handled via round-robin distribution across Tier-1 clusters.",
                //   color: "bg-secondary",
                // },
                {
                  title: "Latency Warning",
                  body: "Low priority tasks may experience additional warm-up time during peak traffic windows.",
                  color: "bg-outline",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.color}`}
                  />
                  <div className="space-y-1">
                    <p className="font-body text-sm font-semibold text-on-surface">
                      {item.title}
                    </p>
                    <p className="font-body text-sm leading-6 text-on-surface-variant">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
