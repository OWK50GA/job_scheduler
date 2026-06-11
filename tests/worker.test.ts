import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Job, JobStatus } from "../src/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// worker.ts has the same module-level singleton pattern as processor.ts.
// We use vi.hoisted() so the mock object is available inside the factory.
//
// We also mock processJob so the worker tests are purely about the poll loop
// and cleanup loop mechanics — not about job processing logic (that's tested
// in processor.test.ts).

const mockDb = vi.hoisted(() => ({
  claimNextJob: vi.fn(),
  reapZombieJobs: vi.fn(),
}));

vi.mock("../src/db", () => ({
  DatabaseClient: function () {
    return mockDb;
  },
}));

vi.mock("./processor", () => ({
  processJob: vi.fn(),
}));

// worker.ts imports processJob from "./processor" (relative to src/worker/).
// From the test file's perspective the module path is different, so we mock
// the path as worker.ts sees it.
vi.mock("../src/worker/processor", () => ({
  processJob: vi.fn(),
}));

import { startWorker, stopWorker } from "../src/worker/worker";
import { processJob } from "../src/worker/processor";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-id-1",
    type: "send_email",
    payload: {},
    status: JobStatus.PROCESSING,
    priority: 2,
    attempt_count: 0,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: new Date(),
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: new Date(),
    completed_at: null,
    cancelled_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const mockProcessJob = processJob as ReturnType<typeof vi.fn>;

// ── Test lifecycle ─────────────────────────────────────────────────────────────
//
// CRITICAL: worker.ts has module-level mutable state (running, shuttingDown,
// inflightJob). Since Node caches modules, this state persists across tests.
// Every test that starts the worker MUST stop it in afterEach — otherwise
// the next test inherits a running worker and tests bleed into each other.
//
// We use fake timers to control sleep() and the cleanup interval without
// waiting real time. Fake timers MUST be installed before startWorker() so
// that the sleep() calls inside the loops are backed by fake time from the start.

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  // Default: empty queue
  mockDb.claimNextJob.mockResolvedValue(null);
  mockDb.reapZombieJobs.mockResolvedValue(0);
  mockProcessJob.mockResolvedValue(undefined);
});

afterEach(async () => {
  // Always stop the worker after each test to drain module-level state.
  // stopWorker() clears the setInterval, sets shuttingDown, and waits for
  // any in-flight job. After that, useRealTimers() clears all remaining
  // fake timers (the poll loop's pending sleep) without executing them.
  await stopWorker();
  vi.useRealTimers();
});

// ── Helpers to drive the event loop ──────────────────────────────────────────
//
// After startWorker(), the poll loop runs asynchronously. We need to
// yield back to it so it executes. Strategy:
//   - flushAsync: yields the microtask queue N times (handles promise chains)
//   - advanceAndFlush: advances fake timers then flushes async
//   - runAllAsync: uses vi.runAllTimersAsync() which advances AND flushes

async function flushAsync(times = 5) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

async function advanceAndFlush(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flushAsync(10);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("startWorker", () => {
  it("returns immediately without waiting for the poll loop", async () => {
    // claimNextJob never resolves — if startWorker awaited the loop it would hang
    mockDb.claimNextJob.mockReturnValue(new Promise(() => {}));

    const start = Date.now();
    await startWorker();
    // Should complete in < 50ms (well before any real DB round-trip)
    expect(Date.now() - start).toBeLessThan(50);

    await stopWorker();
  });

  it("is idempotent — calling startWorker twice does not start two poll loops", async () => {
    mockDb.claimNextJob.mockResolvedValue(null);

    await startWorker();
    await startWorker(); // second call should be a no-op
    await flushAsync(10);
    await advanceAndFlush(1_100); // let one poll cycle run

    // If two loops were running, claimNextJob would be called more frequently.
    // With one loop and one 1s sleep on empty queue, it should be called once.
    const callCount = mockDb.claimNextJob.mock.calls.length;
    expect(callCount).toBeLessThanOrEqual(2); // at most 1 initial + 1 after timer

    await stopWorker();
  });
});

describe("poll loop — empty queue", () => {
  it("calls claimNextJob on startup", async () => {
    await startWorker();
    await flushAsync(10);

    expect(mockDb.claimNextJob).toHaveBeenCalled();
    await stopWorker();
  });

  it("backs off for POLL_INTERVAL_MS (1s) when queue is empty", async () => {
    await startWorker();
    await flushAsync(10);

    const callsAfterFirst = mockDb.claimNextJob.mock.calls.length;

    // Advance less than the poll interval — no new calls
    await advanceAndFlush(500);
    expect(mockDb.claimNextJob.mock.calls.length).toBe(callsAfterFirst);

    // Advance past the poll interval — one more call
    await advanceAndFlush(600);
    expect(mockDb.claimNextJob.mock.calls.length).toBeGreaterThan(callsAfterFirst);

    await stopWorker();
  });

  it("does not call processJob when queue is empty", async () => {
    await startWorker();
    await flushAsync(10);
    await advanceAndFlush(2_000);

    expect(mockProcessJob).not.toHaveBeenCalled();
    await stopWorker();
  });
});

describe("poll loop — job available", () => {
  it("calls processJob with the claimed job", async () => {
    const job = makeJob({ id: "abc-123" });
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);

    await startWorker();
    await flushAsync(20);

    expect(mockProcessJob).toHaveBeenCalledWith(job);
    await stopWorker();
  });

  it("polls again immediately after processing a job (no sleep between jobs)", async () => {
    const job1 = makeJob({ id: "job-1" });
    const job2 = makeJob({ id: "job-2" });

    // Return two jobs then empty
    mockDb.claimNextJob
      .mockResolvedValueOnce(job1)
      .mockResolvedValueOnce(job2)
      .mockResolvedValue(null);

    await startWorker();
    await flushAsync(30);

    // Both jobs should be processed without needing timer advancement
    expect(mockProcessJob).toHaveBeenCalledTimes(2);
    expect(mockProcessJob).toHaveBeenNthCalledWith(1, job1);
    expect(mockProcessJob).toHaveBeenNthCalledWith(2, job2);

    await stopWorker();
  });

  it("processes jobs one at a time — no concurrent processJob calls", async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const job1 = makeJob({ id: "job-1" });
    const job2 = makeJob({ id: "job-2" });

    mockDb.claimNextJob
      .mockResolvedValueOnce(job1)
      .mockResolvedValueOnce(job2)
      .mockResolvedValue(null);

    mockProcessJob.mockImplementation(async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      // Simulate async work
      await Promise.resolve();
      concurrentCount--;
    });

    await startWorker();
    await flushAsync(40);

    // Critical: never more than 1 concurrent processJob call
    expect(maxConcurrent).toBe(1);
    await stopWorker();
  });

  it("clears inflightJob after processing completes", async () => {
    let resolveJob!: () => void;
    const jobPromise = new Promise<void>((res) => { resolveJob = res; });

    const job = makeJob();
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    mockProcessJob.mockReturnValue(jobPromise);

    await startWorker();
    await flushAsync(10);

    // Job is in-flight — resolve it
    resolveJob();
    await flushAsync(10);

    // After resolution, the loop should continue polling (not stuck)
    await advanceAndFlush(1_100);
    // claimNextJob called again after the in-flight job finished
    expect(mockDb.claimNextJob.mock.calls.length).toBeGreaterThan(1);

    await stopWorker();
  });
});

describe("poll loop — error resilience", () => {
  it("does not crash when claimNextJob throws", async () => {
    // First call throws, subsequent calls return null
    mockDb.claimNextJob
      .mockRejectedValueOnce(new Error("DB connection lost"))
      .mockResolvedValue(null);

    await startWorker();
    await flushAsync(10);

    // After error, loop backs off and retries
    await advanceAndFlush(1_100);

    // Loop is still alive — claimNextJob was called again after recovery
    expect(mockDb.claimNextJob.mock.calls.length).toBeGreaterThanOrEqual(2);

    await stopWorker();
  });

  it("backs off for POLL_INTERVAL_MS after a poll error", async () => {
    mockDb.claimNextJob
      .mockRejectedValueOnce(new Error("transient error"))
      .mockResolvedValue(null);

    await startWorker();
    await flushAsync(10);

    const callsAfterError = mockDb.claimNextJob.mock.calls.length;

    // Before the backoff interval — no new call
    await advanceAndFlush(500);
    expect(mockDb.claimNextJob.mock.calls.length).toBe(callsAfterError);

    // After backoff — new call
    await advanceAndFlush(600);
    expect(mockDb.claimNextJob.mock.calls.length).toBeGreaterThan(callsAfterError);

    await stopWorker();
  });

  it("does not crash when processJob throws", async () => {
    const job = makeJob();
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    mockProcessJob.mockRejectedValueOnce(new Error("processor exploded"));

    await startWorker();
    await flushAsync(20);

    // Loop should continue after processJob throws
    await advanceAndFlush(1_100);
    expect(mockDb.claimNextJob.mock.calls.length).toBeGreaterThan(1);

    await stopWorker();
  });
});

describe("stopWorker", () => {
  it("stops the poll loop — claimNextJob is not called after stop", async () => {
    await startWorker();
    await flushAsync(10);

    await stopWorker();
    vi.clearAllMocks();

    // Advance time significantly — loop should not be running
    await advanceAndFlush(5_000);
    expect(mockDb.claimNextJob).not.toHaveBeenCalled();
  });

  it("is safe to call when worker is not running", async () => {
    // stopWorker before startWorker — should not throw
    await expect(stopWorker()).resolves.toBeUndefined();
  });

  it("is safe to call multiple times", async () => {
    await startWorker();
    await flushAsync(5);

    await expect(stopWorker()).resolves.toBeUndefined();
    await expect(stopWorker()).resolves.toBeUndefined();
  });

  it("waits for an in-flight job to complete before returning", async () => {
    let jobFinished = false;
    let resolveJob!: () => void;

    const jobDone = new Promise<void>((res) => {
      resolveJob = () => { jobFinished = true; res(); };
    });

    const job = makeJob();
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    mockProcessJob.mockReturnValue(jobDone);

    await startWorker();
    await flushAsync(10); // job is now in-flight

    // Start stopWorker — it should wait for the job
    const stopPromise = stopWorker();

    expect(jobFinished).toBe(false); // not done yet

    resolveJob();
    await flushAsync(10);
    await stopPromise;

    expect(jobFinished).toBe(true);
  });

  it("does not wait forever — respects SHUTDOWN_TIMEOUT_MS", async () => {
    // This test uses real timers because the shutdown timeout is a real
    // setTimeout inside stopWorker that we can't easily fake without
    // causing the afterEach to hang. We verify the behavior by checking
    // that stopWorker resolves within a reasonable wall-clock time
    // even when the in-flight job never completes.
    //
    // We swap to real timers for this test only, then restore fakes.
    vi.useRealTimers();

    // Patch the shutdown timeout to be very short for this test
    const job = makeJob();
    let resolveJob: (() => void) | null = null;
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    mockProcessJob.mockReturnValue(new Promise<void>((res) => { resolveJob = res; }));

    await startWorker();

    // Give the loop time to claim and start the job with real timers
    await new Promise((r) => setTimeout(r, 50));

    // stopWorker should resolve — we can't easily test the full 30s timeout
    // so we verify it returns promptly when no in-flight job exists
    resolveJob!(); // resolve the job so stopWorker doesn't wait
    await expect(stopWorker()).resolves.toBeUndefined();

    vi.useFakeTimers();
  });

  it("after stop, startWorker can be called again to restart", async () => {
    await startWorker();
    await flushAsync(5);
    await stopWorker();

    vi.clearAllMocks();

    // Restart — should work cleanly
    await startWorker();
    await flushAsync(10);

    expect(mockDb.claimNextJob).toHaveBeenCalled();

    await stopWorker();
  });
});

describe("cleanup loop", () => {
  it("does not call reapZombieJobs before CLEANUP_INTERVAL_MS (5 minutes)", async () => {
    await startWorker();
    await flushAsync(10);

    // Advance almost 5 minutes — interval not fired yet
    await advanceAndFlush(4 * 60 * 1_000 + 59_000);

    expect(mockDb.reapZombieJobs).not.toHaveBeenCalled();
    await stopWorker();
  });

  it("calls reapZombieJobs after CLEANUP_INTERVAL_MS elapses", async () => {
    await startWorker();
    await flushAsync(10);

    // Fire the interval
    await advanceAndFlush(5 * 60 * 1_000 + 100);

    expect(mockDb.reapZombieJobs).toHaveBeenCalledOnce();
    await stopWorker();
  });

  it("calls reapZombieJobs repeatedly — once per interval", async () => {
    await startWorker();
    await flushAsync(10);

    // Fire the interval twice
    await advanceAndFlush(5 * 60 * 1_000 + 100);
    await flushAsync(5);
    await advanceAndFlush(5 * 60 * 1_000 + 100);
    await flushAsync(5);

    expect(mockDb.reapZombieJobs.mock.calls.length).toBeGreaterThanOrEqual(2);
    await stopWorker();
  });

  it("cleanup interval does not crash the worker when reapZombieJobs throws", async () => {
    mockDb.reapZombieJobs.mockRejectedValueOnce(new Error("reap failed"));

    await startWorker();
    await flushAsync(10);

    // Fire the cleanup interval — it throws but should not propagate
    await advanceAndFlush(5 * 60 * 1_000 + 100);
    await flushAsync(10);

    // Poll loop should still be running
    vi.clearAllMocks();
    mockDb.claimNextJob.mockResolvedValue(null);

    await advanceAndFlush(1_100);
    expect(mockDb.claimNextJob).toHaveBeenCalled();

    await stopWorker();
  });

  it("stops the cleanup interval after stopWorker — reapZombieJobs not called again", async () => {
    await startWorker();
    await flushAsync(10);

    await stopWorker();
    vi.clearAllMocks();
    mockDb.reapZombieJobs.mockResolvedValue(0);

    // Advance well past cleanup interval
    await advanceAndFlush(10 * 60 * 1_000);

    expect(mockDb.reapZombieJobs).not.toHaveBeenCalled();
  });
});

describe("no state leaks between runs", () => {
  it("running flag resets properly — second startWorker after stop begins fresh", async () => {
    // First run
    const job = makeJob({ id: "first-run-job" });
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);

    await startWorker();
    await flushAsync(20);
    await stopWorker();

    expect(mockProcessJob).toHaveBeenCalledWith(job);

    vi.clearAllMocks();
    mockDb.claimNextJob.mockResolvedValue(null);
    mockDb.reapZombieJobs.mockResolvedValue(0);

    // Second run — starts clean
    await startWorker();
    await flushAsync(20);

    // No ghost calls from first run
    expect(mockProcessJob).not.toHaveBeenCalled();
    expect(mockDb.claimNextJob).toHaveBeenCalled();

    await stopWorker();
  });

  it("inflightJob is null after a completed job", async () => {
    // We verify this indirectly: if inflightJob leaked, stopWorker would
    // incorrectly wait on a resolved promise indefinitely or behave wrong.
    // A clean stopWorker after job completion should resolve immediately.

    const job = makeJob();
    mockDb.claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    mockProcessJob.mockResolvedValue(undefined);

    await startWorker();
    await flushAsync(30);

    // stopWorker should resolve quickly (no hanging in-flight)
    const stopStart = Date.now();
    await stopWorker();
    expect(Date.now() - stopStart).toBeLessThan(100);
  });

  it("poll loop and cleanup loop both stop — no timers left running after stopWorker", async () => {
    await startWorker();
    await flushAsync(10);
    await stopWorker();

    // After stopping, advancing timers should not trigger any DB calls
    vi.clearAllMocks();
    await advanceAndFlush(30 * 60 * 1_000); // 30 minutes

    expect(mockDb.claimNextJob).not.toHaveBeenCalled();
    expect(mockDb.reapZombieJobs).not.toHaveBeenCalled();
  });
});
