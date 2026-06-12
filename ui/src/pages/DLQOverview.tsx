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
import { useSchedulerEvent } from "../context/SchedulerEvents";
import { getJobStats, listDLQJobs } from "../services/api";
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
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"ALL" | "CRITICAL_ONLY">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch up to 50 DLQ jobs + current stats in parallel
      const [dlqRes, statsRes] = await Promise.all([
        listDLQJobs(1, 50),
        getJobStats(),
      ]);
      setAllJobs(dlqRes.data);
      setStats(statsRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── SSE ───────────────────────────────────────────────────────────────────
  // New DLQ entry → prepend to list
  useSchedulerEvent("job.dlq_entry", useCallback((e) => {
    setAllJobs((prev) => {
      // Avoid duplicates if already present
      if (prev.some((j) => j.id === e.payload.job.id)) return prev;
      return [e.payload.job, ...prev];
    });
  }, []));

  // Job re-queued from DLQ (manual retry emits job.created) → remove from list
  useSchedulerEvent("job.created", useCallback((e) => {
    setAllJobs((prev) => prev.filter((j) => j.id !== e.payload.job.id));
  }, []));

  // Stats update → refresh counters
  useSchedulerEvent("stats.updated", useCallback((e) => {
    setStats(e.payload.stats);
  }, []));

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() =>
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
          <Button
            icon="refresh"
            variant="secondary"
            onClick={load}
          >
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
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} awaiting investigation
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
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface",
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
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface",
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
                    className="transition hover:bg-surface-container-highest/20"
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
            {Math.min(pageStart + PAGE_SIZE, filteredJobs.length)} of {filteredJobs.length}
          </span>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      </Panel>
    </div>
  );
}
