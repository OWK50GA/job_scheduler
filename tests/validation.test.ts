import { describe, it, expect } from "vitest";
import { CreateJobSchema } from "../src/validation/create-job.schema";
import { GetAllJobsSchema } from "../src/validation/get-jobs.schema";
import { GetSingleJobSchema } from "../src/validation/get-job.schema";
import { GetDLQJobsSchema } from "../src/validation/get-dlq-jobs.schema";
import { AppError } from "../src/middleware/error.middleware";

// ── CreateJobSchema ──────────────────────────────────────────────────────────

describe("CreateJobSchema", () => {
  const validBody = {
    type: "send_email",
    payload: { to: "user@example.com", subject: "Hello" },
    priority: 1,
  };

  it("accepts a minimal valid body", () => {
    const result = CreateJobSchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("accepts optional scheduled_at as a future unix ms timestamp", () => {
    const result = CreateJobSchema.safeParse({
      ...validBody,
      scheduled_at: Date.now() + 60_000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional recur_interval", () => {
    const result = CreateJobSchema.safeParse({
      ...validBody,
      recur_interval: "every_5_minutes",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing type", () => {
    const { type: _, ...body } = validBody;
    const result = CreateJobSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("rejects empty type string", () => {
    const result = CreateJobSchema.safeParse({ ...validBody, type: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing payload", () => {
    const { payload: _, ...body } = validBody;
    const result = CreateJobSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = CreateJobSchema.safeParse({ ...validBody, priority: 4 });
    expect(result.success).toBe(false);
  });

  it("rejects priority 0", () => {
    const result = CreateJobSchema.safeParse({ ...validBody, priority: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects scheduled_at in the past", () => {
    const result = CreateJobSchema.safeParse({
      ...validBody,
      scheduled_at: Date.now() - 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer scheduled_at", () => {
    const result = CreateJobSchema.safeParse({
      ...validBody,
      scheduled_at: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown recur_interval", () => {
    const result = CreateJobSchema.safeParse({
      ...validBody,
      recur_interval: "every_2_days",
    });
    expect(result.success).toBe(false);
  });

  it("infers scheduled_at as number in output", () => {
    const ms = Date.now() + 60_000;
    const result = CreateJobSchema.safeParse({
      ...validBody,
      scheduled_at: ms,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scheduled_at).toBe(ms);
    }
  });
});

// ── GetAllJobsSchema ─────────────────────────────────────────────────────────

describe("GetAllJobsSchema", () => {
  it("accepts empty query — all fields optional", () => {
    const result = GetAllJobsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("defaults page to 1 when not provided", () => {
    const result = GetAllJobsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(1);
  });

  it("coerces string status to enum value", () => {
    const result = GetAllJobsSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = GetAllJobsSchema.safeParse({ status: "running" });
    expect(result.success).toBe(false);
  });

  it("coerces string priority '2' to number", () => {
    const result = GetAllJobsSchema.safeParse({ priority: "2" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe(2);
  });

  it("rejects priority 4", () => {
    const result = GetAllJobsSchema.safeParse({ priority: "4" });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 50", () => {
    const result = GetAllJobsSchema.safeParse({ limit: "100" });
    expect(result.success).toBe(false);
  });

  it("rejects limit 0", () => {
    const result = GetAllJobsSchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sort_by", () => {
    const result = GetAllJobsSchema.safeParse({ sort_by: "created_at" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sort_order", () => {
    const result = GetAllJobsSchema.safeParse({ sort_order: "ascending" });
    expect(result.success).toBe(false);
  });

  it("coerces date filter string to Date", () => {
    const ms = Date.now() - 60_000;
    const result = GetAllJobsSchema.safeParse({ created_after: String(ms) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_after).toBeInstanceOf(Date);
      expect(result.data.created_after!.getTime()).toBe(ms);
    }
  });

  it("rejects non-numeric date filter", () => {
    const result = GetAllJobsSchema.safeParse({ created_after: "yesterday" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown recur_interval", () => {
    const result = GetAllJobsSchema.safeParse({ recur_interval: "daily" });
    expect(result.success).toBe(false);
  });
});

// ── GetSingleJobSchema ───────────────────────────────────────────────────────

describe("GetSingleJobSchema", () => {
  it("accepts a valid UUID", () => {
    const result = GetSingleJobSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    const result = GetSingleJobSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = GetSingleJobSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects numeric id", () => {
    const result = GetSingleJobSchema.safeParse({ id: 12345 });
    expect(result.success).toBe(false);
  });
});

// ── GetDLQJobsSchema ─────────────────────────────────────────────────────────

describe("GetDLQJobsSchema", () => {
  it("defaults page=1 and limit=10 on empty input", () => {
    const result = GetDLQJobsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it("coerces string page to number", () => {
    const result = GetDLQJobsSchema.safeParse({ page: "3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(3);
  });

  it("rejects page 0", () => {
    const result = GetDLQJobsSchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 50", () => {
    const result = GetDLQJobsSchema.safeParse({ limit: "51" });
    expect(result.success).toBe(false);
  });
});

// ── AppError ─────────────────────────────────────────────────────────────────

describe("AppError", () => {
  it("stores statusCode and message", () => {
    const err = new AppError(404, "Not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err.name).toBe("AppError");
  });

  it("is an instance of Error", () => {
    const err = new AppError(500, "Server error");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of AppError", () => {
    const err = new AppError(409, "Conflict");
    expect(err).toBeInstanceOf(AppError);
  });
});
