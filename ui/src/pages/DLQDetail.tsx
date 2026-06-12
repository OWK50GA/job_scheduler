import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { MockBadge } from "../components/shared/MockBadge";
import { Panel } from "../components/shared/Panel";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { retryJob } from "../services/api";
import type { Job } from "../types";

const DUMMY_DLQ_JOBS: Job[] = [
  {
    id: "job_88a2-99cf-01",
    type: "ProcessPaymentBatch",
    payload: {
      job_id: "job_9921_xbf",
      context: {
        user_id: "usr_0a112",
        session_id: "sess_v881_active",
        geo: "US/NY",
        retry_policy: {
          max_retries: 3,
          backoff_factor: 2,
        },
      },
      data: {
        transactions: [
          {
            id: "tx_881",
            amount: 142,
            currency: "USD",
            gateway: "stripe_v3",
            metadata: {
              reference: "REF-2023-OCT-991",
              risk_score: 0.02,
            },
          },
        ],
      },
      timestamp: "2025-07-10T14:22:01.009Z",
      checksum: "sha256:8f3c...12a",
    },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: "2025-07-10T08:00:00.000Z",
    recur_interval: null,
    last_error:
      "TimeoutException: Upstream payment gateway failed to respond within 5000ms. Connection pool exhausted at source.",
    result: null,
    started_at: "2025-07-10T08:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T08:00:00.000Z",
    updated_at: "2025-07-10T08:04:32.123Z",
  },
]; // DUMMY DATA

const DUMMY_CPU_PERCENTAGE = "94%"; // DUMMY DATA
const DUMMY_PURGE_COUNTDOWN = "23h 14m"; // DUMMY DATA
const DUMMY_REGION = "us-east-1 (Primary)"; // DUMMY DATA

function buildRetrySequence(job: Job) {
  const base = job.started_at ? new Date(job.started_at).getTime() : Date.now();
  return Array.from({ length: job.attempt_count }, (_, index) => ({
    attempt: index + 1,
    error: job.last_error ?? "Unknown error",
    timestamp: new Date(base + index * 2 * 60 * 1000).toISOString(),
  })); // DUMMY DATA
}

export default function DLQDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const job =
    DUMMY_DLQ_JOBS.find((entry) => entry.id === id) ??
    DUMMY_DLQ_JOBS[0] ??
    null;
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [copyError, setCopyError] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!job) {
    return (
      <div className="space-y-6">
        <Link
          to="/jobs/dlq"
          className="inline-flex items-center gap-2 font-body text-sm text-primary transition hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back to DLQ List
        </Link>
        <Panel className="p-10 text-center">
          <p className="font-body text-sm text-on-surface-variant">
            Job not found in the DLQ fixture set.
          </p>
        </Panel>
      </div>
    );
  }

  const payloadString = JSON.stringify(job.payload, null, 2);
  const retrySequence = buildRetrySequence(job);

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
    setRetrying(true);
    setRetryError(null);
    try {
      await retryJob(job.id);
      navigate("/jobs/dlq");
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/jobs/dlq"
          className="inline-flex items-center gap-2 font-body text-sm text-primary transition hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back to DLQ List
        </Link>
        <MockBadge label="Dummy Data" tone="danger" />
        <MockBadge label="Live Retry Action" tone="info" />
      </div>

      <div className="rounded-xl border border-error/40 bg-error/10 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-sm border border-error/40 bg-error/10 px-2 py-1 font-body text-[10px] font-semibold uppercase tracking-technical text-error">
              <span className="material-symbols-outlined text-[16px]">
                error
              </span>
              Critical Failure
            </div>
            <h1 className="font-headline text-[28px] font-semibold text-on-surface">
              {job.type}
            </h1>
            <p className="font-body text-sm text-on-surface-variant">
              Failed after {job.attempt_count} retry attempts — inspection view
              styled after the Stitch DLQ investigation screen.
            </p>
          </div>
          <div className="space-y-2 font-code text-[12px] text-on-surface">
            <p>ID: {job.id}</p>
            <PriorityBadge priority={job.priority} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Error Summary
              </h2>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="rounded-lg border border-error/40 bg-error/10 p-4">
                <p className="font-code text-[13px] leading-6 text-on-error-container">
                  {job.last_error}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Attempted At
                  </p>
                  <p className="mt-2 font-code text-[12px] text-on-surface">
                    {job.updated_at}
                  </p>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Region
                  </p>
                  <p className="mt-2 font-code text-[12px] text-on-surface">
                    {DUMMY_REGION}
                  </p>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Worker Node
                  </p>
                  <p className="mt-2 font-code text-[12px] text-on-surface">
                    ip-10-22-1-98.ec2
                  </p>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Priority
                  </p>
                  <div className="mt-2">
                    <PriorityBadge priority={job.priority} />
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Retry Sequence
              </h2>
              <MockBadge label="Dummy Timeline" tone="warning" />
            </div>
            <div className="space-y-5 px-4 py-4 sm:px-5">
              {retrySequence.map((entry) => (
                <div
                  key={`${entry.attempt}-${entry.timestamp}`}
                  className="flex gap-3"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-error bg-error/10 font-code text-[11px] font-semibold text-error">
                      {entry.attempt}
                    </div>
                    <div className="mt-1 h-full w-px bg-outline-variant"></div>
                  </div>
                  <div className="space-y-1 pb-2">
                    <p className="font-code text-[11px] text-on-surface-variant">
                      {entry.timestamp}
                    </p>
                    <p className="font-body text-sm text-on-surface">
                      Attempt {entry.attempt}
                    </p>
                    <p className="font-code text-[12px] text-on-error-container">
                      {entry.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Node Metrics
              </h2>
              <MockBadge label="Dummy Data" />
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between font-code text-[12px]">
                <span className="text-on-surface-variant">CPU Usage</span>
                <span className="text-error">{DUMMY_CPU_PERCENTAGE}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-container-lowest">
                <div
                  className="h-full rounded-full bg-error"
                  style={{ width: DUMMY_CPU_PERCENTAGE }}
                ></div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="min-h-[420px] overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Raw Payload Content
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button icon="content_copy" variant="link" onClick={handleCopy}>
                  {copyLabel}
                </Button>
                <Button
                  icon={expanded ? "unfold_less" : "unfold_more"}
                  variant="link"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? "Collapse" : "Expand"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {copyError ? (
                <p className="mb-3 font-body text-sm text-error">
                  Copy failed.
                </p>
              ) : null}
              <div className="app-code-block overflow-auto p-4">
                <pre
                  className={`font-code text-[12px] leading-6 text-primary ${expanded ? "max-h-none" : "max-h-[260px] overflow-hidden"}`.trim()}
                >
                  {payloadString}
                </pre>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Stack Trace
              </h2>
              <MockBadge label="Dummy Stack" tone="danger" />
            </div>
            <div className="px-4 py-4 sm:px-5">
              <div className="app-code-block border-error/30 bg-error-container/20 p-4">
                <pre className="whitespace-pre-wrap font-code text-[12px] leading-6 text-on-error-container">
                  {`com.infrastream.payment.exceptions.GatewayTimeoutException: Operation timed out after 5000ms
at com.infrastream.payment.GatewayClient.execute(GatewayClient.java:142)
at com.infrastream.payment.BatchProcessor.process(BatchProcessor.java:94)
at com.infrastream.worker.JobRunner.run(JobRunner.java:312)
Caused by: java.net.SocketTimeoutException: connect timed out`}
                </pre>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                  Actions
                </h2>
                <p className="mt-1 font-body text-sm text-on-surface-variant">
                  Job will be auto-purged in {DUMMY_PURGE_COUNTDOWN}.
                </p>
              </div>
              <MockBadge label="Mixed Reality" tone="info" />
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <Button
                icon="download"
                variant="secondary"
                className="w-full justify-center"
              >
                Export Payload
              </Button>
              <Button
                icon="delete"
                variant="danger"
                className="w-full justify-center"
              >
                Purge from DLQ
              </Button>
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-technical text-on-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${retrying ? "animate-spin" : ""}`.trim()}
                >
                  {retrying ? "refresh" : "replay"}
                </span>
                {retrying ? "Retrying..." : "Retry Job"}
              </button>
              {retryError ? (
                <div className="rounded border border-error bg-error/10 px-3 py-2 font-body text-sm text-on-error-container">
                  {retryError}
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
