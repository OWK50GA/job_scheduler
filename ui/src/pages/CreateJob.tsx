import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { MockBadge } from "../components/shared/MockBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { Panel } from "../components/shared/Panel";
import { createJob } from "../services/api";
import type { CreateJobInput } from "../types";

const PROCESSOR_OPTIONS = [
  "Standard Lambda-Node20",
  "High Memory Compute-v4",
  "GPU Accelerated Tensor-X",
  "Legacy Python-3.8",
] as const; // DUMMY DATA

const DEFAULT_PAYLOAD_JSON = JSON.stringify(
  {
    action: "clear_cache",
    parameters: {
      scope: "global",
      ttl: 3600,
    },
    retry_policy: {
      attempts: 3,
      backoff: "exponential",
    },
  },
  null,
  2,
); // DUMMY DATA

const ENGINE_CLUSTER_LOAD = "42%"; // DUMMY DATA
const ENGINE_IDLE_WORKERS = 18; // DUMMY DATA
const ENGINE_AVG_WAIT = "14ms"; // DUMMY DATA

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
  "h-11 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 font-body text-sm text-on-surface outline-none transition focus:border-primary";

const textareaClassName =
  "min-h-[220px] w-full resize-none rounded-lg border border-outline-variant bg-transparent px-4 py-3 font-code text-[13px] leading-6 text-primary outline-none";

export default function CreateJob() {
  const navigate = useNavigate();
  const [jobName, setJobName] = useState("");
  const [processorType, setProcessorType] = useState<string>(
    PROCESSOR_OPTIONS[0],
  );
  const [scheduledStart, setScheduledStart] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [payloadJson, setPayloadJson] = useState(DEFAULT_PAYLOAD_JSON);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayloadError(null);
    setScheduledError(null);
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

    if (hasError) return;

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
        description="Configure a manual job request using the Stitch-inspired control surface while keeping backend integration deferred."
        badges={
          <>
            <MockBadge label="Dummy Options" />
            <MockBadge label="Live Submit Path" tone="info" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Job Configuration
              </h2>
              <MockBadge label="Dummy Data" />
            </div>
          </div>

          <div className="px-4 py-5 sm:px-5">
            {apiError ? (
              <div className="mb-5 rounded border border-error bg-error/10 px-4 py-3 text-sm text-on-error-container">
                {apiError}
              </div>
            ) : null}

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="job-name"
                  className="block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant"
                >
                  Job Name
                </label>
                <input
                  id="job-name"
                  type="text"
                  className={inputClassName}
                  value={jobName}
                  onChange={(event) => setJobName(event.target.value)}
                  placeholder="e.g. ASYNC_TASK"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="processor-type"
                      className="block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant"
                    >
                      Processor Type
                    </label>
                    <MockBadge label="Dummy Options" tone="warning" />
                  </div>
                  <select
                    id="processor-type"
                    className={inputClassName}
                    value={processorType}
                    onChange={(event) => setProcessorType(event.target.value)}
                  >
                    {PROCESSOR_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="scheduled-start"
                    className="block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant"
                  >
                    Scheduled Start
                  </label>
                  <input
                    id="scheduled-start"
                    type="datetime-local"
                    className={inputClassName}
                    value={scheduledStart}
                    onChange={(event) => {
                      setScheduledStart(event.target.value);
                      setScheduledError(null);
                    }}
                  />
                  {scheduledError ? (
                    <p className="text-sm text-error">{scheduledError}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
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
                            ? "border-primary bg-primary/10"
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

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="payload-json"
                    className="block font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant"
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
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                    <span>6</span>
                    <span>7</span>
                    <span>8</span>
                  </div>
                  <textarea
                    id="payload-json"
                    spellCheck={false}
                    value={payloadJson}
                    onChange={(event) => {
                      setPayloadJson(event.target.value);
                      setPayloadError(null);
                      setPrettifyError(null);
                    }}
                    className={`${textareaClassName} pl-11 ${payloadError ? "border-error" : ""}`.trim()}
                  />
                </div>
                {prettifyError ? (
                  <p className="text-sm text-error">{prettifyError}</p>
                ) : null}
                {payloadError ? (
                  <p className="text-sm text-error">{payloadError}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant pt-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/jobs")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-primary bg-primary px-5 py-2 font-body text-[11px] font-semibold uppercase tracking-technical text-on-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-headline text-[20px] font-semibold text-tertiary text-primary">
                  Queue Logic
                </h2>
                <MockBadge label="Reference Copy" />
              </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {[
                {
                  title: "Priority Placement",
                  body: "Critical priority jobs bypass the wait state and are assigned to the next available worker node immediately.",
                  color: "bg-primary",
                },
                {
                  title: "Resource Allocation",
                  body: "Standard jobs are handled via round-robin distribution across Tier-1 clusters.",
                  color: "bg-secondary",
                },
                {
                  title: "Latency Warning",
                  body: "Low priority tasks may experience additional warm-up time during peak traffic windows.",
                  color: "bg-outline",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${item.color}`}
                  ></span>
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

          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <div>
                <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                  Engine Health
                </p>
                <div className="mt-1 flex items-center gap-2 font-code text-[11px] text-secondary">
                  <span className="h-2 w-2 rounded-full bg-secondary"></span>
                  Operational
                </div>
              </div>
              <MockBadge label="Dummy Data" />
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div>
                <div className="mb-2 flex items-center justify-between font-code text-[12px]">
                  <span className="text-on-surface-variant">Cluster Load</span>
                  <span className="text-primary">{ENGINE_CLUSTER_LOAD}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-lowest">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: ENGINE_CLUSTER_LOAD }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-outline-variant bg-surface-container-lowest p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Idle Workers
                  </p>
                  <p className="mt-2 font-headline text-[24px] font-semibold text-on-surface">
                    {ENGINE_IDLE_WORKERS}
                  </p>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-lowest p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Avg Wait
                  </p>
                  <p className="mt-2 font-headline text-[24px] font-semibold text-on-surface">
                    {ENGINE_AVG_WAIT}
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
