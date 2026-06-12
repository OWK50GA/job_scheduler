import { describe, it, expect, vi, beforeEach } from "vitest";
import { Job, JobStatus } from "../src/types";
import { HandlerResult } from "../src/worker/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// vi.mock factories are hoisted to the top of the file before any imports or
// variable declarations. To share the mock object between the factory and the
// test body, we use vi.hoisted() — it runs at hoist time, so the value is
// available inside the factory.

const mockDb = vi.hoisted(() => ({
  getJob: vi.fn(),
  markJobCompleted: vi.fn(),
  markJobRetryable: vi.fn(),
  markJobDeadLetter: vi.fn(),
  cancelJob: vi.fn(),
  scheduleNextRecurringRun: vi.fn(),
  checkDependenciesMet: vi.fn(),
}));

vi.mock("../src/db", () => ({
  DatabaseClient: function () {
    return mockDb;
  },
}));

vi.mock("../src/worker/handlers", () => ({
  sendEmailHandler: vi.fn(),
}));

// processor.ts now calls logJobEvent on every branch — mock it so
// tests don't need a DB connection just for logging
vi.mock("../src/worker/logger", () => ({
  logJobEvent: vi.fn(),
}));

// Import AFTER vi.mock declarations
import { processJob } from "../src/worker/processor";
import { sendEmailHandler } from "../src/worker/handlers";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "test-job-id",
    type: "send_email",
    payload: {
      to: "user@example.com",
      subject: "Hello",
      from: "noreply@example.com",
      html: "<p>Hi</p>",
    },
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

function makeHandlerResult(
  overrides: Partial<HandlerResult> = {},
): HandlerResult {
  return {
    success: true,
    result: { messageId: "msg-123" },
    durationMs: 150,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("processJob", () => {
  const handler = sendEmailHandler as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: getJob returns the job as still processing (not cancelled)
    mockDb.getJob.mockResolvedValue(makeJob());

    // Default resolved values for DB writes
    mockDb.markJobCompleted.mockResolvedValue(
      makeJob({ status: JobStatus.COMPLETED }),
    );
    mockDb.markJobRetryable.mockResolvedValue(
      makeJob({ status: JobStatus.PENDING }),
    );
    mockDb.markJobDeadLetter.mockResolvedValue(
      makeJob({ status: JobStatus.FAILED }),
    );
    mockDb.cancelJob.mockResolvedValue(
      makeJob({ status: JobStatus.CANCELLED }),
    );
    mockDb.scheduleNextRecurringRun.mockResolvedValue(makeJob());

    mockDb.checkDependenciesMet.mockResolvedValue(true);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe("successful job", () => {
    it("calls markJobCompleted with the handler result and duration", async () => {
      const result = makeHandlerResult({
        result: { messageId: "abc" },
        durationMs: 200,
      });
      handler.mockResolvedValue(result);

      const job = makeJob();
      await processJob(job);

      expect(mockDb.markJobCompleted).toHaveBeenCalledOnce();
      expect(mockDb.markJobCompleted).toHaveBeenCalledWith(
        job.id,
        { messageId: "abc" },
        200,
      );
    });

    it("does not call markJobRetryable or markJobDeadLetter on success", async () => {
      handler.mockResolvedValue(makeHandlerResult());

      await processJob(makeJob());

      expect(mockDb.markJobRetryable).not.toHaveBeenCalled();
      expect(mockDb.markJobDeadLetter).not.toHaveBeenCalled();
    });
  });

  // ── Recurring jobs ──────────────────────────────────────────────────────────

  describe("recurring jobs", () => {
    it("calls scheduleNextRecurringRun after completion when recur_interval is set", async () => {
      handler.mockResolvedValue(makeHandlerResult());
      const job = makeJob({ recur_interval: "every_1_minute" });

      await processJob(job);

      expect(mockDb.markJobCompleted).toHaveBeenCalledOnce();
      expect(mockDb.scheduleNextRecurringRun).toHaveBeenCalledOnce();
      expect(mockDb.scheduleNextRecurringRun).toHaveBeenCalledWith(job);
    });

    it("does NOT call scheduleNextRecurringRun when recur_interval is null", async () => {
      handler.mockResolvedValue(makeHandlerResult());
      const job = makeJob({ recur_interval: null });

      await processJob(job);

      expect(mockDb.scheduleNextRecurringRun).not.toHaveBeenCalled();
    });
  });

  // ── Failure with retries remaining ─────────────────────────────────────────

  describe("handler failure — retries remaining", () => {
    it("calls markJobRetryable when attempt_count + 1 < max_retries", async () => {
      handler.mockResolvedValue(
        makeHandlerResult({
          success: false,
          error: "SMTP timeout",
          durationMs: 180,
        }),
      );
      // attempt_count=0, max_retries=3 → still has 2 retries left
      const job = makeJob({ attempt_count: 0, max_retries: 3 });

      await processJob(job);

      expect(mockDb.markJobRetryable).toHaveBeenCalledOnce();
      const [jobId, error, , duration] = mockDb.markJobRetryable.mock.calls[0];
      expect(jobId).toBe(job.id);
      expect(error).toBe("SMTP timeout");
      expect(duration).toBe(180);
    });

    it("does not call markJobDeadLetter when retries remain", async () => {
      handler.mockResolvedValue(
        makeHandlerResult({ success: false, error: "fail" }),
      );
      await processJob(makeJob({ attempt_count: 0, max_retries: 3 }));

      expect(mockDb.markJobDeadLetter).not.toHaveBeenCalled();
    });

    it("passes a future Date as nextRetryAt to markJobRetryable", async () => {
      handler.mockResolvedValue(
        makeHandlerResult({ success: false, error: "fail" }),
      );
      const before = Date.now();

      await processJob(makeJob({ attempt_count: 0, max_retries: 3 }));

      const nextRetryAt: Date = mockDb.markJobRetryable.mock.calls[0][2];
      expect(nextRetryAt).toBeInstanceOf(Date);
      expect(nextRetryAt.getTime()).toBeGreaterThan(before);
    });
  });

  // ── Failure — exhausted retries → DLQ ──────────────────────────────────────

  describe("handler failure — retries exhausted", () => {
    it("calls markJobDeadLetter when attempt_count + 1 >= max_retries", async () => {
      handler.mockResolvedValue(
        makeHandlerResult({
          success: false,
          error: "Mailbox not found",
          durationMs: 90,
        }),
      );
      // attempt_count=2, max_retries=3 → this is the last attempt
      const job = makeJob({ attempt_count: 2, max_retries: 3 });

      await processJob(job);

      expect(mockDb.markJobDeadLetter).toHaveBeenCalledOnce();
      expect(mockDb.markJobDeadLetter).toHaveBeenCalledWith(
        job.id,
        "Mailbox not found",
        90,
      );
    });

    it("calls markJobDeadLetter when attempt_count already equals max_retries", async () => {
      handler.mockResolvedValue(
        makeHandlerResult({ success: false, error: "fail" }),
      );
      const job = makeJob({ attempt_count: 3, max_retries: 3 });

      await processJob(job);

      expect(mockDb.markJobDeadLetter).toHaveBeenCalledOnce();
    });

    it("does not call markJobRetryable when retries are exhausted", async () => {
      handler.mockResolvedValue(
        makeHandlerResult({ success: false, error: "fail" }),
      );
      await processJob(makeJob({ attempt_count: 2, max_retries: 3 }));

      expect(mockDb.markJobRetryable).not.toHaveBeenCalled();
    });
  });

  // ── Backoff timing ──────────────────────────────────────────────────────────

  describe("backoff calculation", () => {
    // We can't test the exact value (jitter is random), but we can assert the
    // nextRetryAt falls within the expected window for each attempt.

    it.each([
      { attempt: 0, minMs: 800, maxMs: 1200, label: "attempt 0 → ~1s" },
      { attempt: 1, minMs: 4000, maxMs: 6000, label: "attempt 1 → ~5s" },
      { attempt: 2, minMs: 20000, maxMs: 30000, label: "attempt 2 → ~25s" },
    ])("$label", async ({ attempt, minMs, maxMs }) => {
      handler.mockResolvedValue(
        makeHandlerResult({ success: false, error: "fail" }),
      );
      // Ensure retries are still available
      const job = makeJob({ attempt_count: attempt, max_retries: 10 });

      const before = Date.now();
      await processJob(job);

      const nextRetryAt: Date = mockDb.markJobRetryable.mock.calls[0][2];
      const delayMs = nextRetryAt.getTime() - before;

      expect(delayMs).toBeGreaterThanOrEqual(minMs);
      expect(delayMs).toBeLessThanOrEqual(maxMs);
    });
  });

  // ── No handler registered ───────────────────────────────────────────────────

  describe("unknown job type", () => {
    it("calls markJobDeadLetter immediately when no handler is registered", async () => {
      const job = makeJob({ type: "unknown_type" });

      await processJob(job);

      expect(handler).not.toHaveBeenCalled();
      expect(mockDb.markJobDeadLetter).toHaveBeenCalledOnce();
      expect(mockDb.markJobDeadLetter).toHaveBeenCalledWith(
        job.id,
        "No handler registered for job type",
        0,
        true,
      );
    });

    it("does not call getJob when no handler is registered", async () => {
      await processJob(makeJob({ type: "unknown_type" }));

      expect(mockDb.getJob).not.toHaveBeenCalled();
    });
  });

  // ── Cancelled job ───────────────────────────────────────────────────────────

  describe("cancelled job", () => {
    it("does not call the handler when the job status is CANCELLED on re-fetch", async () => {
      mockDb.getJob.mockResolvedValue(makeJob({ status: JobStatus.CANCELLED }));

      await processJob(makeJob());

      expect(handler).not.toHaveBeenCalled();
    });

    it("calls cancelJob to persist the cancelled state", async () => {
      mockDb.getJob.mockResolvedValue(makeJob({ status: JobStatus.CANCELLED }));
      const job = makeJob();

      await processJob(job);

      expect(mockDb.cancelJob).toHaveBeenCalledOnce();
      expect(mockDb.cancelJob).toHaveBeenCalledWith(job.id);
    });

    it("does not call markJobCompleted or markJobRetryable for a cancelled job", async () => {
      mockDb.getJob.mockResolvedValue(makeJob({ status: JobStatus.CANCELLED }));

      await processJob(makeJob());

      expect(mockDb.markJobCompleted).not.toHaveBeenCalled();
      expect(mockDb.markJobRetryable).not.toHaveBeenCalled();
      expect(mockDb.markJobDeadLetter).not.toHaveBeenCalled();
    });
  });

  // ── getJob returns null (DB inconsistency) ──────────────────────────────────

  describe("job not found on re-fetch", () => {
    it("routes to markJobDeadLetter when job is not found and retries are exhausted", async () => {
      mockDb.getJob.mockResolvedValue(null);
      const job = makeJob({ attempt_count: 2, max_retries: 3 });

      await processJob(job);

      expect(handler).not.toHaveBeenCalled();
      expect(mockDb.markJobDeadLetter).toHaveBeenCalledWith(
        job.id,
        "Failed to confirm job status",
        0,
      );
    });

    it("routes to markJobRetryable when job is not found and retries remain", async () => {
      mockDb.getJob.mockResolvedValue(null);
      const job = makeJob({ attempt_count: 0, max_retries: 3 });

      await processJob(job);

      expect(handler).not.toHaveBeenCalled();
      expect(mockDb.markJobRetryable).toHaveBeenCalledOnce();
      const [jobId, error] = mockDb.markJobRetryable.mock.calls[0];
      expect(jobId).toBe(job.id);
      expect(error).toBe("Failed to confirm job status");
    });
  });

  // ── Unexpected exception in handler ────────────────────────────────────────

  describe("handler throws unexpectedly", () => {
    it("catches the exception and routes to markJobRetryable when retries remain", async () => {
      handler.mockRejectedValue(new Error("Unexpected network failure"));
      const job = makeJob({ attempt_count: 0, max_retries: 3 });

      await processJob(job);

      expect(mockDb.markJobRetryable).toHaveBeenCalledOnce();
      expect(mockDb.markJobRetryable.mock.calls[0][1]).toBe(
        "Unexpected network failure",
      );
    });

    it("catches the exception and routes to markJobDeadLetter when retries exhausted", async () => {
      handler.mockRejectedValue(new Error("Fatal error"));
      const job = makeJob({ attempt_count: 2, max_retries: 3 });

      await processJob(job);

      expect(mockDb.markJobDeadLetter).toHaveBeenCalledOnce();
      expect(mockDb.markJobDeadLetter.mock.calls[0][1]).toBe("Fatal error");
    });

    it("converts non-Error throws to string for the error message", async () => {
      handler.mockRejectedValue("plain string error");
      const job = makeJob({ attempt_count: 2, max_retries: 3 });

      await processJob(job);

      expect(mockDb.markJobDeadLetter.mock.calls[0][1]).toBe(
        "plain string error",
      );
    });

    it("does not call markJobCompleted when an exception is thrown", async () => {
      handler.mockRejectedValue(new Error("crash"));
      await processJob(makeJob({ attempt_count: 0, max_retries: 3 }));

      expect(mockDb.markJobCompleted).not.toHaveBeenCalled();
    });
  });

  // ── getJob is called exactly once per execution (no extra round-trips) ──────

  describe("DB call efficiency", () => {
    it("calls getJob exactly once per processJob invocation (when handler exists)", async () => {
      handler.mockResolvedValue(makeHandlerResult());
      await processJob(makeJob());

      expect(mockDb.getJob).toHaveBeenCalledOnce();
    });

    it("calls getJob with the job id", async () => {
      handler.mockResolvedValue(makeHandlerResult());
      const job = makeJob({ id: "specific-id" });
      await processJob(job);

      expect(mockDb.getJob).toHaveBeenCalledWith("specific-id");
    });
  });
});
