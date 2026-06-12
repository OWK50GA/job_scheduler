import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../components/shared/Button";
import { MockBadge } from "../components/shared/MockBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { Pagination } from "../components/shared/Pagination";
import { Panel } from "../components/shared/Panel";
import { StatCard } from "../components/shared/StatCard";
import type { Job } from "../types";

const DUMMY_DLQ_JOBS: Job[] = [
  {
    id: "job_88a2-99cf-01",
    type: "ConnectionTimeout",
    payload: { upstream: "upstream_proxy:5432", service: "billing" },
    status: "failed",
    priority: 1,
    attempt_count: 5,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T08:00:00.000Z",
    recur_interval: null,
    last_error: "ConnectionTimeout: upstream_proxy:5432",
    result: null,
    started_at: "2025-07-10T08:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T08:00:00.000Z",
    updated_at: "2025-07-10T08:04:32.123Z",
  },
  {
    id: "job_12b5-44d1-92",
    type: "InvalidSchema",
    payload: { field: "user_id", source: "crm-sync" },
    status: "failed",
    priority: 2,
    attempt_count: 1,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T09:00:00.000Z",
    recur_interval: null,
    last_error: "InvalidSchema: missing_field user_id",
    result: null,
    started_at: "2025-07-10T09:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T09:00:00.000Z",
    updated_at: "2025-07-10T09:30:00.456Z",
  },
  {
    id: "job_ff01-0082-cc",
    type: "OOM_KILLED",
    payload: { worker: "worker_node_42", queue: "analytics" },
    status: "failed",
    priority: 1,
    attempt_count: 3,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T10:00:00.000Z",
    recur_interval: null,
    last_error: "OOM_KILLED: worker_node_42",
    result: null,
    started_at: "2025-07-10T10:01:00.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T10:00:00.000Z",
    updated_at: "2025-07-10T10:02:11.789Z",
  },
  {
    id: "job_9921-ac42-ea",
    type: "AuthFailure",
    payload: { token: "expired_token", service: "s3_ingest" },
    status: "failed",
    priority: 1,
    attempt_count: 0,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T06:00:00.000Z",
    recur_interval: null,
    last_error: "AuthFailure: expired_token",
    result: null,
    started_at: "2025-07-10T06:00:05.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T06:00:00.000Z",
    updated_at: "2025-07-10T06:00:59.001Z",
  },
  {
    id: "job_bb21-8841-fe",
    type: "Internal500",
    payload: { gateway: "api_gateway_v2", region: "eu-west-1" },
    status: "failed",
    priority: 2,
    attempt_count: 5,
    max_retries: 5,
    next_retry_at: null,
    scheduled_at: "2025-07-10T11:00:00.000Z",
    recur_interval: null,
    last_error: "Internal500: api_gateway_v2",
    result: null,
    started_at: "2025-07-10T11:00:01.000Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2025-07-10T11:00:00.000Z",
    updated_at: "2025-07-10T11:05:44.321Z",
  },
]; // DUMMY DATA

const DUMMY_FAILURE_DISTRIBUTION = [
  { time: "00:00", count: 4 },
  { time: "10:00", count: 7 },
  { time: "20:00", count: 10 },
  { time: "30:00", count: 12 },
  { time: "40:00", count: 8 },
  { time: "50:00", count: 6 },
  { time: "60:00", count: 9 },
]; // DUMMY DATA

const DUMMY_TOP_ERROR_TYPES = [
  { name: "ConnectionTimeout", count: 42 },
  { name: "AuthFailure", count: 28 },
  { name: "OOM_KILLED", count: 15 },
  { name: "InvalidSchema", count: 10 },
  { name: "Internal500", count: 5 },
]; // DUMMY DATA

const PAGE_SIZE = 5;

function formatFailedAt(isoString: string) {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const SSS = String(date.getMilliseconds()).padStart(3, "0");
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}.${SSS}`;
}

export default function DLQOverview() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>(DUMMY_DLQ_JOBS);
  const [activeTab, setActiveTab] = useState<"ALL_SERVICES" | "CRITICAL_ONLY">(
    "ALL_SERVICES",
  );
  const [currentPage, setCurrentPage] = useState(1);

  const filteredJobs =
    activeTab === "CRITICAL_ONLY"
      ? jobs.filter((job) => job.priority === 1)
      : jobs;

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(pageStart, pageStart + PAGE_SIZE);

  function handleRefresh() {
    setJobs([...DUMMY_DLQ_JOBS]); // DUMMY DATA
    setCurrentPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Failure Analysis"
        title="Dead Letter Queue"
        description="System-wide failed transaction investigation view based on dummy failure rows and mock telemetry distributions."
        badges={
          <>
            <MockBadge label="Dummy Data" tone="danger" />
            <MockBadge label="Mock Charts" tone="warning" />
          </>
        }
        actions={
          <>
            <Button icon="refresh" variant="secondary" onClick={handleRefresh}>
              Refresh
            </Button>
            <Button icon="download" variant="secondary">
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Total Failed"
          value="1,248"
          accentColor="#ef4444"
          icon="warning"
        />
        <StatCard
          label="Awaiting Review"
          value="482"
          accentColor="#0ea5e9"
          icon="visibility"
        />
        <StatCard
          label="Auto-Purge in 24h"
          value="156"
          accentColor="#94a3b8"
          icon="timer"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Failure Distribution
            </h2>
            <MockBadge label="Real-time Telemetry" tone="danger" />
          </div>
          <div className="h-[340px] px-4 py-4 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DUMMY_FAILURE_DISTRIBUTION}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    color: "#f8fafc",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: "#ef4444", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Top Error Types
            </h2>
            <MockBadge label="Dummy Data" />
          </div>
          <div className="h-[340px] px-4 py-4 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={DUMMY_TOP_ERROR_TYPES}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
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
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Investigation Queue
              </h2>
              <MockBadge label="Dummy Rows" tone="danger" />
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              Compact DLQ review table aligned to the Stitch overview design.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("ALL_SERVICES");
                setCurrentPage(1);
              }}
              className={[
                "rounded border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-technical transition",
                activeTab === "ALL_SERVICES"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface",
              ].join(" ")}
            >
              All Services
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
              Critical Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="app-table min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Error Type</th>
                <th className="px-4 py-3">Failed At</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {pageJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    No jobs found for this filter.
                  </td>
                </tr>
              ) : (
                pageJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="transition hover:bg-surface-container-highest/20"
                  >
                    <td className="px-4 py-3 font-code text-[12px] text-primary">
                      {job.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-sm border border-error/40 bg-error/10 px-2 py-1 font-code text-[10px] font-semibold uppercase tracking-technical text-error">
                          {job.type}
                        </span>
                        <span className="font-body text-xs text-on-surface-variant">
                          {String(
                            job.payload.upstream ??
                              job.payload.service ??
                              job.payload.field ??
                              "mock-source",
                          )}
                        </span>
                      </div>
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
            Showing {pageJobs.length > 0 ? pageStart + 1 : 0}-
            {pageStart + pageJobs.length} of {filteredJobs.length} failures
          </span>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((page) => Math.max(1, page - 1))}
            onNext={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
          />
        </div>
      </Panel>
    </div>
  );
}
