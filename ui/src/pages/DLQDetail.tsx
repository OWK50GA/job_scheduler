import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { Panel } from "../components/shared/Panel";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { useSchedulerEvent } from "../context/SchedulerEvents";
import { getJob, getJobAttempts, purgeJob, retryJob } from "../services/api";
import type { Job, JobAttempt } from "../types";

export default function DLQDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [attempts, setAttempts] = useState<JobAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [copyError, setCopyError] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getJob(id), getJobAttempts(id)])
      .then(([jobData, attemptsData]) => {
        setJob(jobData);
        setAttempts(attemptsData);
      })
      .catch((err: unknown) =>
        setFetchError(
          err instanceof Error ? err.message : "Failed to load job",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  // ── SSE — minimal: only watch this specific job ───────────────────────
  // When the job is retried (manual retry emits job.created with reset
  // attempt_count), update the displayed job state so the page reflects
  // the reset without requiring a manual reload.
  useSchedulerEvent("job.created", useCallback((e) => {
    if (e.payload.job.id !== id) return;
    setJob(e.payload.job);
    // Re-fetch attempts since they were reset on manual retry
    if (id) getJobAttempts(id).then(setAttempts).catch(() => {});
  }, [id]));

  // Also patch if the job transitions while the detail page is open
  useSchedulerEvent("job.started",   useCallback((e) => { if (e.payload.job.id === id) setJob(e.payload.job); }, [id]));
  useSchedulerEvent("job.completed", useCallback((e) => { if (e.payload.job.id === id) setJob(e.payload.job); }, [id]));
  useSchedulerEvent("job.failed",    useCallback((e) => { if (e.payload.job.id === id) setJob(e.payload.job); }, [id]));

  if (loading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Panel className="p-10 text-center">
          <p className="font-body text-sm text-on-surface-variant">Loading…</p>
        </Panel>
      </div>
    );
  }

  if (fetchError || !job) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Panel className="p-10 text-center">
          <p className="font-body text-sm text-on-surface-variant">
            {fetchError ?? "Job not found."}
          </p>
        </Panel>
      </div>
    );
  }

  const payloadString = JSON.stringify(job.payload, null, 2);

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

  function handleExport() {
    const blob = new Blob([payloadString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${job.id}-payload.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRetry() {
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

  async function handlePurge() {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    setPurging(true);
    setPurgeError(null);
    try {
      await purgeJob(job.id);
      navigate("/jobs/dlq");
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : "Purge failed");
      setConfirmPurge(false);
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-error/40 bg-error/10 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-sm border border-error/40 bg-error/10 px-2 py-1 font-body text-[10px] font-semibold uppercase tracking-technical text-error">
              <span className="material-symbols-outlined text-[16px]">
                error
              </span>
              Dead Letter Queue
            </div>
            <h1 className="font-headline text-[28px] font-semibold text-on-surface">
              {job.type}
            </h1>
            <p className="font-body text-sm text-on-surface-variant">
              Failed after {job.attempt_count} attempt
              {job.attempt_count !== 1 ? "s" : ""} — {job.max_retries} max
              retries exhausted.
            </p>
          </div>
          <div className="space-y-2 font-code text-[12px] text-on-surface">
            <p className="break-all">ID: {job.id}</p>
            <PriorityBadge priority={job.priority} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* ── Error Summary ──────────────────────────────────────────── */}
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Error Summary
              </h2>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="rounded-lg border border-error/40 bg-error/10 p-4">
                <p className="font-code text-[13px] leading-6 text-on-error-container">
                  {job.last_error ?? "No error message recorded"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Last Updated
                  </p>
                  <p className="mt-2 font-code text-[12px] text-on-surface">
                    {new Date(job.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Created At
                  </p>
                  <p className="mt-2 font-code text-[12px] text-on-surface">
                    {new Date(job.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-low p-3">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                    Attempts
                  </p>
                  <p className="mt-2 font-code text-[12px] text-on-surface">
                    {job.attempt_count} / {job.max_retries}
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

          {/* ── Retry Sequence ─────────────────────────────────────────── */}
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Retry Sequence
              </h2>
            </div>
            <div className="space-y-5 px-4 py-4 sm:px-5">
              {attempts.length === 0 ? (
                <p className="font-body text-sm text-on-surface-variant">
                  No attempt records found.
                </p>
              ) : (
                attempts.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-error bg-error/10 font-code text-[11px] font-semibold text-error">
                        {entry.attempt_num}
                      </div>
                      {idx < attempts.length - 1 && (
                        <div className="mt-1 h-full w-px bg-outline-variant"></div>
                      )}
                    </div>
                    <div className="space-y-1 pb-2">
                      <p className="font-code text-[11px] text-on-surface-variant">
                        {new Date(entry.attempted_at).toLocaleString()}
                        {entry.duration_ms != null && (
                          <span className="ml-2 text-on-surface-variant/60">
                            ({entry.duration_ms}ms)
                          </span>
                        )}
                      </p>
                      <p className="font-body text-sm text-on-surface">
                        Attempt {entry.attempt_num}
                      </p>
                      {entry.error ? (
                        <p className="font-code text-[12px] text-on-error-container">
                          {entry.error}
                        </p>
                      ) : (
                        <p className="font-code text-[12px] text-secondary">
                          No error recorded for this attempt
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {/* ── Raw Payload ────────────────────────────────────────────── */}
          <Panel className="min-h-[420px] overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Raw Payload
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button icon="content_copy" variant="link" onClick={handleCopy}>
                  {copyLabel}
                </Button>
                <Button
                  icon={expanded ? "unfold_less" : "unfold_more"}
                  variant="link"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "Collapse" : "Expand"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {copyError && (
                <p className="mb-3 font-body text-sm text-error">
                  Copy failed.
                </p>
              )}
              <div className="app-code-block overflow-auto p-4">
                <pre
                  className={`font-code text-[12px] leading-6 text-primary ${expanded ? "max-h-none" : "max-h-[260px] overflow-hidden"}`}
                >
                  {payloadString}
                </pre>
              </div>
            </div>
          </Panel>

          {/* ── Last Error ─────────────────────────────────────────────── */}
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Last Error
              </h2>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <div className="app-code-block border-error/30 bg-error-container/20 p-4">
                <pre className="whitespace-pre-wrap font-code text-[12px] leading-6 text-on-error-container">
                  {job.last_error ?? "No error message recorded for this job."}
                </pre>
              </div>
            </div>
          </Panel>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <Panel>
            <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Actions
              </h2>
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <Button
                icon="download"
                variant="secondary"
                className="w-full justify-center"
                onClick={handleExport}
              >
                Export Payload
              </Button>

              {/* Retry */}
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying || purging}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-technical text-on-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${retrying ? "animate-spin" : ""}`}
                >
                  {retrying ? "refresh" : "replay"}
                </span>
                {retrying ? "Retrying…" : "Retry Job"}
              </button>
              {retryError && (
                <div className="rounded border border-error bg-error/10 px-3 py-2 font-body text-sm text-on-error-container">
                  {retryError}
                </div>
              )}

              {/* Purge — two-step confirm */}
              {confirmPurge ? (
                <div className="space-y-2 rounded border border-error/40 bg-error/10 p-3">
                  <p className="font-body text-sm text-on-error-container">
                    This permanently deletes the job and all its attempt
                    records. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePurge}
                      disabled={purging}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-error bg-error px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-technical text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] ${purging ? "animate-spin" : ""}`}
                      >
                        {purging ? "refresh" : "delete_forever"}
                      </span>
                      {purging ? "Purging…" : "Confirm Purge"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPurge(false)}
                      disabled={purging}
                      className="rounded-md border border-outline-variant px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-technical text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  icon="delete"
                  variant="danger"
                  className="w-full justify-center"
                  onClick={() => setConfirmPurge(true)}
                  disabled={retrying}
                >
                  Purge from DLQ
                </Button>
              )}
              {purgeError && (
                <div className="rounded border border-error bg-error/10 px-3 py-2 font-body text-sm text-on-error-container">
                  {purgeError}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/jobs/dlq"
      className="inline-flex items-center gap-2 font-body text-sm text-primary transition hover:text-on-surface"
    >
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      Back to DLQ List
    </Link>
  );
}
