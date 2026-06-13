import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../components/shared/Button";
import { PageHeader } from "../components/shared/PageHeader";
import { Pagination } from "../components/shared/Pagination";
import { Panel } from "../components/shared/Panel";
import { StatCard } from "../components/shared/StatCard";
import { useSchedulerEvent } from "../context/useSchedulerEvent";
import { emptyDLQ, getJobStats, listDLQJobs } from "../services/api";
import type { Job, JobStats } from "../types";

const PAGE_SIZE = 10;

function formatFailedAt(isoString: string) {
  return new Date(isoString).toLocaleString();
}

export default function DLQOverview() {
  const navigate = useNavigate();

  // All DLQ jobs fetched at once; pagination is client-side
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  // Start in loading state; the initial fetch resolves it.
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"ALL" | "CRITICAL_ONLY">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Increment to trigger a re-fetch from the Refresh button
  const [fetchTick, setFetchTick] = useState(0);

  // ── Empty DLQ ─────────────────────────────────────────────────────────────
  // Confirm-then-execute pattern: first click arms the button, second executes.
  const [emptyState, setEmptyState] = useState<
    "idle" | "confirming" | "loading" | "done" | "error"
  >("idle");
  const [emptyError, setEmptyError] = useState<string | null>(null);
  const [lastDeletedCount, setLastDeletedCount] = useState<number | null>(null);

  // Reset back to idle after showing success/error for 4 seconds
  useEffect(() => {
    if (emptyState !== "done" && emptyState !== "error") return;
    const t = setTimeout(() => setEmptyState("idle"), 4_000);
    return () => clearTimeout(t);
  }, [emptyState]);

  const handleEmptyDLQ = useCallback(async () => {
    if (emptyState === "idle") {
      // First click: arm the confirm state
      setEmptyState("confirming");
      return;
    }
    if (emptyState === "confirming") {
      // Second click: execute
      setEmptyState("loading");
      setEmptyError(null);
      try {
        const { deleted } = await emptyDLQ();
        setLastDeletedCount(deleted);
        setAllJobs([]);
        setEmptyState("done");
        // Trigger a stats refresh
        setFetchTick((t) => t + 1);
      } catch (err) {
        setEmptyError(err instanceof Error ? err.message : "Failed to empty DLQ");
        setEmptyState("error");
      }
    }
  }, [emptyState]);

  const load = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDLQJobs(1, 50), getJobStats()])
      .then(([dlqRes, statsRes]) => {
        if (cancelled) return;
        setAllJobs(dlqRes.data);
        setStats(statsRes);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchTick]);

  // ── SSE ───────────────────────────────────────────────────────────────────
  // New DLQ entry → prepend to list
  useSchedulerEvent(
    "job.dlq_entry",
    useCallback((e) => {
      setAllJobs((prev) => {
        // Avoid duplicates if already present
        if (prev.some((j) => j.id === e.payload.job.id)) return prev;
        return [e.payload.job, ...prev];
      });
    }, []),
  );

  // Job re-queued from DLQ (manual retry emits job.created) → remove from list
  useSchedulerEvent(
    "job.created",
    useCallback((e) => {
      setAllJobs((prev) => prev.filter((j) => j.id !== e.payload.job.id));
    }, []),
  );

  // Stats update → refresh counters
  useSchedulerEvent(
    "stats.updated",
    useCallback((e) => {
      setStats(e.payload.stats);
    }, []),
  );

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredJobs = useMemo(
    () =>
      activeTab === "CRITICAL_ONLY"
        ? allJobs.filter((j) => j.priority === 1)
        : allJobs,
    [allJobs, activeTab],
  );

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(pageStart, pageStart + PAGE_SIZE);

  const topErrorTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of allJobs) {
      counts[job.type] = (counts[job.type] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [allJobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Failure Analysis"
        title="Dead Letter Queue"
        description="Jobs that have exhausted all retry attempts. Investigate the error, fix the root cause, then retry or purge."
        actions={
          <Button icon="refresh" variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <StatCard
          label="Total in DLQ"
          value={stats ? stats.dlq : "—"}
          accentColor="#ef4444"
          icon="warning"
        />
        <StatCard
          label="Total Failed"
          value={stats ? stats.failed : "—"}
          accentColor="#f59e0b"
          icon="error_outline"
        />
      </div>

      {/* ── Top Error Types chart — computed from loaded jobs ─────────── */}
      {topErrorTypes.length > 0 && (
        <Panel>
          <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Error Types (current page)
            </h2>
          </div>
          <div className="h-[260px] px-4 py-4 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topErrorTypes}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(14,165,233,0.08)" }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    color: "#f8fafc",
                  }}
                />
                <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* ── Investigation Queue table ──────────────────────────────────── */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Investigation Queue
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}{" "}
              awaiting investigation
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("ALL");
                setCurrentPage(1);
              }}
              className={[
                "rounded border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-technical transition",
                activeTab === "ALL"
                  ? "border-sky-300 bg-sky-200 text-sky-900 shadow-[0_0_0_3px_rgba(186,230,253,0.35)]"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
              ].join(" ")}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("CRITICAL_ONLY");
                setCurrentPage(1);
              }}
              className={[
                "rounded border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-technical transition",
                activeTab === "CRITICAL_ONLY"
                  ? "border-sky-300 bg-sky-200 text-sky-900 shadow-[0_0_0_3px_rgba(186,230,253,0.35)]"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
              ].join(" ")}
            >
              Priority 1 Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="app-table min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Last Error</th>
                <th className="px-4 py-3">Failed At</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    Loading…
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    No jobs found.
                  </td>
                </tr>
              ) : (
                pageJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="group cursor-pointer border-l-2 border-l-transparent transition hover:border-l-primary hover:bg-slate-600"
                  >
                    <td className="px-4 py-3 font-code text-[12px] text-primary">
                      {job.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-sm border border-error/40 bg-error/10 px-2 py-1 font-code text-[10px] font-semibold uppercase tracking-technical text-error">
                        {job.type}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 font-code text-[11px] text-on-surface-variant">
                      <span className="line-clamp-2">
                        {job.last_error ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-code text-[12px] text-on-surface">
                      {formatFailedAt(job.updated_at)}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-on-surface">
                      {job.attempt_count}/{job.max_retries}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        icon="arrow_forward"
                        variant="link"
                        onClick={() => navigate(`/jobs/dlq/${job.id}`)}
                      >
                        Investigate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="font-body text-sm text-on-surface-variant">
            Showing {filteredJobs.length === 0 ? 0 : pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE, filteredJobs.length)} of{" "}
            {filteredJobs.length}
          </span>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-outline-variant bg-surface-container-low px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-1">
            {emptyState === "confirming" && (
              <p className="font-body text-xs text-amber-400">
                This will permanently delete all {allJobs.length} job
                {allJobs.length !== 1 ? "s" : ""} in the DLQ. Click again to
                confirm.
              </p>
            )}
            {emptyState === "done" && lastDeletedCount !== null && (
              <p className="font-body text-xs text-emerald-400">
                ✓ {lastDeletedCount} job
                {lastDeletedCount !== 1 ? "s" : ""} permanently removed.
              </p>
            )}
            {emptyState === "error" && emptyError && (
              <p className="font-body text-xs text-error">{emptyError}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {emptyState === "confirming" && (
              <Button
                variant="ghost"
                onClick={() => setEmptyState("idle")}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="danger"
              icon={
                emptyState === "loading"
                  ? "hourglass_top"
                  : emptyState === "confirming"
                    ? "warning"
                    : "delete_forever"
              }
              disabled={
                emptyState === "loading" ||
                emptyState === "done" ||
                allJobs.length === 0
              }
              onClick={handleEmptyDLQ}
            >
              {emptyState === "loading"
                ? "Emptying…"
                : emptyState === "confirming"
                  ? "Confirm — delete all"
                  : emptyState === "done"
                    ? "Done"
                    : "Empty Queue"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
