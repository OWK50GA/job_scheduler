/**
 * benchmark-schedulers.ts
 *
 * Measures and compares the performance of the MinHeap and SkipListScheduler
 * on synthetic job workloads.
 *
 * Run:
 *   pnpm tsx src/scripts/benchmark-schedulers.ts
 *
 * What it measures:
 *   - insert()  — time to insert N jobs into an empty scheduler
 *   - pop()     — time to drain the fully-loaded scheduler (N pop() calls)
 *
 * Sizes tested: 1_000, 5_000, 10_000
 *
 * The benchmark uses the same randomly generated job set for both schedulers
 * at each size so the comparison is apples-to-apples: the only variable is
 * the data structure.
 *
 * Output format:
 *   N=10000  insert  MinHeap  12.34ms   SkipList  18.91ms   winner: MinHeap  (+53.3%)
 *   N=10000  drain   MinHeap  15.11ms   SkipList  21.07ms   winner: MinHeap  (+39.4%)
 */

import { randomUUID } from "crypto";
import { MinHeap } from "../worker/scheduler";
import { SkipListScheduler } from "../worker/skip-list-scheduler";
import type { JobScheduler } from "../worker/scheduler-interface";
import type { Job, JobStatus } from "../types";

// ---------------------------------------------------------------------------
// Synthetic job generator
// ---------------------------------------------------------------------------

/**
 * Generates `count` synthetic Job objects with randomised priorities,
 * scheduled times, and creation times.
 *
 * scheduled_at is set to a past time so all jobs are immediately eligible.
 * created_at is varied over a ±1 hour window so aging produces varied scores.
 */
function generateJobs(count: number): Job[] {
  const now = Date.now();
  const jobs: Job[] = [];

  for (let i = 0; i < count; i++) {
    const priority = (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3;
    // Random creation time: between 2 hours ago and now, so some jobs
    // have accumulated aging bonus and some haven't.
    const ageOffsetMs = Math.floor(Math.random() * 2 * 60 * 60 * 1_000);
    const createdAt = new Date(now - ageOffsetMs);

    jobs.push({
      id: randomUUID(),
      type: "benchmark_job",
      payload: {},
      status: "pending" as JobStatus,
      priority,
      attempt_count: 0,
      max_retries: 3,
      next_retry_at: null,
      scheduled_at: new Date(now - 60_000), // always in the past → always due
      recur_interval: null,
      last_error: null,
      result: null,
      started_at: null,
      completed_at: null,
      cancelled_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

interface BenchmarkResult {
  name: string;
  n: number;
  operation: "insert" | "drain";
  durationMs: number;
}

/**
 * Times a single operation (insert or drain) on the given scheduler.
 *
 * We use `performance.now()` for sub-millisecond precision.
 * The scheduler is cleared before each run to ensure a fair start.
 */
function timeOperation(
  scheduler: JobScheduler,
  operation: "insert" | "drain",
  jobs: Job[],
): number {
  scheduler.clear();

  if (operation === "insert") {
    const start = performance.now();
    scheduler.insert(jobs);
    return performance.now() - start;
  }

  // drain: first load, then time the pop() calls
  scheduler.insert(jobs);
  const start = performance.now();
  while (scheduler.size() > 0) {
    scheduler.pop();
  }
  return performance.now() - start;
}

/**
 * Runs both schedulers against the same job set and returns results.
 *
 * Each measurement is repeated REPS times and the median is taken to
 * reduce noise from GC pauses and JIT compilation.
 */
function runBenchmark(jobs: Job[], reps = 5): BenchmarkResult[] {
  const n = jobs.length;
  const results: BenchmarkResult[] = [];

  const schedulers: [string, JobScheduler][] = [
    ["MinHeap", new MinHeap()],
    ["SkipList", new SkipListScheduler()],
  ];

  for (const operation of ["insert", "drain"] as const) {
    for (const [name, scheduler] of schedulers) {
      const times: number[] = [];
      for (let r = 0; r < reps; r++) {
        times.push(timeOperation(scheduler, operation, jobs));
      }
      // Median of reps
      times.sort((a, b) => a - b);
      const median = times[Math.floor(reps / 2)];
      results.push({ name, n, operation, durationMs: median });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

function fmt(ms: number): string {
  return ms.toFixed(2) + "ms";
}

function pctDiff(a: number, b: number): string {
  const diff = ((b - a) / a) * 100;
  return (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SIZES = [1_000, 5_000, 10_000];
const REPS = 7;

console.log("\n──────────────────────────────────────────────────────────────");
console.log("  Job Scheduler Benchmark: MinHeap vs Skip List");
console.log("──────────────────────────────────────────────────────────────");
console.log(`  Repetitions per measurement: ${REPS} (median reported)\n`);

const allResults: BenchmarkResult[] = [];

for (const size of SIZES) {
  process.stdout.write(`  Generating ${size.toLocaleString()} synthetic jobs... `);
  const jobs = generateJobs(size);
  console.log("done");

  const results = runBenchmark(jobs, REPS);
  allResults.push(...results);
}

console.log("\n──────────────────────────────────────────────────────────────");
console.log(
  pad("  N", 10) +
    pad("Op", 10) +
    pad("MinHeap", 14) +
    pad("SkipList", 14) +
    pad("Winner", 12) +
    "Delta",
);
console.log("──────────────────────────────────────────────────────────────");

for (const size of SIZES) {
  for (const operation of ["insert", "drain"] as const) {
    const heap = allResults.find(
      (r) => r.name === "MinHeap" && r.n === size && r.operation === operation,
    )!;
    const skip = allResults.find(
      (r) => r.name === "SkipList" && r.n === size && r.operation === operation,
    )!;

    const winner = heap.durationMs <= skip.durationMs ? "MinHeap" : "SkipList";
    const faster = Math.min(heap.durationMs, skip.durationMs);
    const slower = Math.max(heap.durationMs, skip.durationMs);
    const delta = pctDiff(faster, slower);

    console.log(
      pad(`  ${size.toLocaleString()}`, 10) +
        pad(operation, 10) +
        pad(fmt(heap.durationMs), 14) +
        pad(fmt(skip.durationMs), 14) +
        pad(winner, 12) +
        delta,
    );
  }
}

console.log("──────────────────────────────────────────────────────────────\n");

console.log("  Notes:");
console.log("  ─ insert: time to insert N jobs into an empty scheduler");
console.log("  ─ drain:  time to pop() all N jobs from a fully loaded scheduler");
console.log("  ─ Same job set used for both schedulers at each size");
console.log("  ─ Both use identical score function (priority + aging bonus)");
console.log("  ─ MinHeap operates on a contiguous array (better cache locality)");
console.log("  ─ SkipList uses pointer-linked nodes (worse cache, but O(1) peek");
console.log("    and supports in-order traversal without full drain)\n");
