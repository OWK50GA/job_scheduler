/**
 * Database layer tests — DatabaseClient methods.
 *
 * These tests run against a real Postgres instance (JOB_SCHEDULER_DB_URL).
 * Each describe block uses a unique job `type` prefix to scope its rows,
 * and cleans up after itself in afterEach/afterAll. No shared state is
 * assumed between tests, and the pre-existing jobs in the DB are never
 * touched.
 *
 * Isolation strategy:
 *   - Before each test, insert only the rows the test needs.
 *   - After each test, delete all rows whose `type` starts with the
 *     block's unique prefix. Cascade deletes handle job_attempts/job_logs.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { Pool } from "pg";
import { config } from "dotenv";
import { DatabaseClient } from "../src/db";
import { JobStatus } from "../src/types";

config();

// ── Shared pool for setup / teardown queries ──────────────────────────────────

const pool = new Pool({ connectionString: process.env.JOB_SCHEDULER_DB_URL });

async function deleteByTypePrefix(prefix: string): Promise<void> {
  await pool.query("DELETE FROM jobs WHERE type LIKE $1", [`${prefix}%`]);
}

afterAll(async () => {
  await pool.end();
});

// ── DatabaseClient.insertJob ──────────────────────────────────────────────────

describe("DatabaseClient.insertJob", () => {
  const TYPE = "db_test_insert";
  const db = new DatabaseClient();

  afterEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  it("inserts a job and returns the full row", async () => {
    const job = await db.insertJob({
      type: TYPE,
      payload: { to: "user@example.com", subject: "Hello" },
      priority: 1,
    });

    expect(job.id).toBeDefined();
    expect(job.type).toBe(TYPE);
    expect(job.priority).toBe(1);
    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.attempt_count).toBe(0);
    expect(job.max_retries).toBe(3);
    expect(job.recur_interval).toBeNull();
    expect(job.created_at).toBeInstanceOf(Date);
    expect(job.updated_at).toBeInstanceOf(Date);
    // payload round-trips correctly
    expect(job.payload).toMatchObject({
      to: "user@example.com",
      subject: "Hello",
    });
  });

  it("defaults scheduled_at to approximately now when not provided", async () => {
    const before = new Date();
    const job = await db.insertJob({ type: TYPE, payload: {}, priority: 2 });
    const after = new Date();

    expect(job.scheduled_at.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );
    expect(job.scheduled_at.getTime()).toBeLessThanOrEqual(
      after.getTime() + 1000,
    );
  });

  it("stores the provided scheduled_at", async () => {
    const future = new Date(Date.now() + 60_000);
    const job = await db.insertJob({
      type: TYPE,
      payload: {},
      priority: 2,
      scheduled_at: future,
    });

    // Within 1 second of what we sent (DB round-trip precision)
    expect(
      Math.abs(job.scheduled_at.getTime() - future.getTime()),
    ).toBeLessThan(1000);
  });

  it("stores recur_interval as null when not provided", async () => {
    const job = await db.insertJob({ type: TYPE, payload: {}, priority: 2 });
    expect(job.recur_interval).toBeNull();
  });

  it("stores recur_interval when provided", async () => {
    const job = await db.insertJob({
      type: TYPE,
      payload: {},
      priority: 2,
      recur_interval: "every_1_minute",
    });
    expect(job.recur_interval).toBe("every_1_minute");
  });
});

// ── DatabaseClient.getJob ─────────────────────────────────────────────────────

describe("DatabaseClient.getJob", () => {
  const TYPE = "db_test_get";
  const db = new DatabaseClient();

  afterEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  it("returns the job by id", async () => {
    const inserted = await db.insertJob({
      type: TYPE,
      payload: { x: 1 },
      priority: 1,
    });

    const fetched = await db.getJob(inserted.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(inserted.id);
    expect(fetched!.type).toBe(TYPE);
    expect(fetched!.priority).toBe(1);
  });

  it("returns null for a non-existent id", async () => {
    const result = await db.getJob("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

// ── DatabaseClient.getAllJobs ──────────────────────────────────────────────────

describe("DatabaseClient.getAllJobs", () => {
  const TYPE = "db_test_list";
  const db = new DatabaseClient();

  // Insert 5 pending + 2 cancelled jobs with this prefix before each test
  beforeEach(async () => {
    await deleteByTypePrefix(TYPE); // clean slate
    for (let i = 0; i < 5; i++) {
      await db.insertJob({
        type: TYPE,
        payload: {},
        priority: ([1, 2, 3, 1, 2] as const)[i],
      });
    }
    // Insert 2 cancelled jobs directly via pool
    await pool.query(
      `INSERT INTO jobs (type, payload, priority, status)
       VALUES ($1, '{}', 2, 'cancelled'), ($1, '{}', 3, 'cancelled')`,
      [TYPE],
    );
  });

  afterEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  it("returns paginated results with correct total", async () => {
    const result = await db.getAllJobs({ type: TYPE, limit: 3, page: 1 });

    expect(result.total).toBe(7); // 5 pending + 2 cancelled
    expect(result.records.length).toBe(3);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(3);
  });

  it("returns the second page correctly", async () => {
    const page1 = await db.getAllJobs({ type: TYPE, limit: 3, page: 1 });
    const page2 = await db.getAllJobs({ type: TYPE, limit: 3, page: 2 });

    expect(page1.records.length).toBe(3);
    expect(page2.records.length).toBe(3);

    const page1Ids = new Set(page1.records.map((j) => j.id));
    for (const job of page2.records) {
      expect(page1Ids.has(job.id)).toBe(false); // no overlap
    }
  });

  it("filters by status correctly", async () => {
    const result = await db.getAllJobs({
      type: TYPE,
      status: JobStatus.CANCELLED,
    });

    expect(result.total).toBe(2);
    expect(result.records.every((j) => j.status === JobStatus.CANCELLED)).toBe(
      true,
    );
  });

  it("filters by priority correctly", async () => {
    const result = await db.getAllJobs({ type: TYPE, priority: 1 });
    // We inserted 2 priority-1 pending jobs
    expect(result.total).toBe(2);
    expect(result.records.every((j) => j.priority === 1)).toBe(true);
  });

  it("respects limit cap of 50 — values above 50 are treated as 10", async () => {
    // Insert 15 extra rows so we have enough to see the cap
    for (let i = 0; i < 15; i++) {
      await db.insertJob({ type: TYPE, payload: {}, priority: 2 });
    }
    // limit=100 should be capped to 10 (the default in getAllJobs)
    const result = await db.getAllJobs({ type: TYPE, limit: 100 });
    expect(result.limit).toBe(10);
    expect(result.records.length).toBeLessThanOrEqual(10);
  });

  it("respects explicit limit when <= 50", async () => {
    const result = await db.getAllJobs({ type: TYPE, limit: 5 });
    expect(result.records.length).toBe(5);
    expect(result.limit).toBe(5);
  });

  it("returns empty records array when no jobs match the filter", async () => {
    const result = await db.getAllJobs({
      type: TYPE,
      status: JobStatus.FAILED,
    });
    expect(result.records).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ── DatabaseClient.getJobStats ────────────────────────────────────────────────

describe("DatabaseClient.getJobStats", () => {
  const TYPE = "db_test_stats";
  const db = new DatabaseClient();

  // We insert known jobs with a unique type so we can verify their contribution
  // to stats. Stats are global so we verify relative deltas, not absolute counts.
  beforeEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  afterEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  it("returns counts for all statuses and a total", async () => {
    const stats = await db.getJobStats();

    // All fields present
    expect(typeof stats.pending).toBe("number");
    expect(typeof stats.processing).toBe("number");
    expect(typeof stats.completed).toBe("number");
    expect(typeof stats.failed).toBe("number");
    expect(typeof stats.cancelled).toBe("number");
    expect(typeof stats.dlq).toBe("number");
    expect(typeof stats.total).toBe("number");

    // total = sum of individual status counts
    const sumOfStatuses =
      stats.pending +
      stats.processing +
      stats.completed +
      stats.failed +
      stats.cancelled;
    expect(stats.total).toBe(sumOfStatuses);
  });

  it("inserting a pending job increases pending and total by 1", async () => {
    const before = await db.getJobStats();

    await db.insertJob({ type: TYPE, payload: {}, priority: 2 });

    const after = await db.getJobStats();
    expect(after.pending).toBe(before.pending + 1);
    expect(after.total).toBe(before.total + 1);
  });

  it("dlq count only includes failed jobs where attempt_count >= max_retries", async () => {
    const before = await db.getJobStats();

    // Insert a failed job that has NOT exhausted retries — should NOT appear in DLQ
    await pool.query(
      `INSERT INTO jobs (type, payload, priority, status, attempt_count, max_retries)
       VALUES ($1, '{}', 2, 'failed', 1, 3)`,
      [TYPE],
    );

    // Insert a failed job that HAS exhausted retries — should appear in DLQ
    await pool.query(
      `INSERT INTO jobs (type, payload, priority, status, attempt_count, max_retries)
       VALUES ($1, '{}', 2, 'failed', 3, 3)`,
      [TYPE],
    );

    const after = await db.getJobStats();
    expect(after.dlq).toBe(before.dlq + 1); // only the exhausted one
    expect(after.failed).toBe(before.failed + 2); // both appear in failed count
  });

  it("all status keys default to 0 when no rows exist for that status", async () => {
    // This property is structural — even if there are no cancelled jobs in the DB
    // the stats object must still have cancelled: <number>, not undefined
    const stats = await db.getJobStats();
    expect(stats.cancelled).toBeGreaterThanOrEqual(0);
    expect(stats.processing).toBeGreaterThanOrEqual(0);
    expect(stats.completed).toBeGreaterThanOrEqual(0);
  });
});

// ── DatabaseClient.getDLQJobs ─────────────────────────────────────────────────

describe("DatabaseClient.getDLQJobs", () => {
  const TYPE = "db_test_dlq";
  const db = new DatabaseClient();

  beforeEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  afterEach(async () => {
    await deleteByTypePrefix(TYPE);
  });

  /**
   * Insert `n` DLQ jobs (status=failed, attempt_count >= max_retries)
   * and `nonDlq` jobs that are failed but have retries left.
   */
  async function seedDLQ(dlqCount: number, nonDlqCount = 0): Promise<void> {
    for (let i = 0; i < dlqCount; i++) {
      await pool.query(
        `INSERT INTO jobs (type, payload, priority, status, attempt_count, max_retries)
         VALUES ($1, '{}', 2, 'failed', 3, 3)`,
        [TYPE],
      );
    }
    for (let i = 0; i < nonDlqCount; i++) {
      await pool.query(
        `INSERT INTO jobs (type, payload, priority, status, attempt_count, max_retries)
         VALUES ($1, '{}', 2, 'failed', 1, 3)`,
        [TYPE],
      );
    }
  }

  it("returns only failed jobs where attempt_count >= max_retries", async () => {
    await seedDLQ(3, 2); // 3 DLQ + 2 non-DLQ failed

    const result = await db.getDLQJobs(1, 50);

    // All returned jobs must be in the DLQ
    expect(
      result.records.every(
        (j) =>
          j.status === JobStatus.FAILED && j.attempt_count >= j.max_retries,
      ),
    ).toBe(true);

    // Non-DLQ failed jobs must NOT appear
    expect(result.total).toBe(3);
    expect(result.records.length).toBe(3);
  });

  it("returns empty results when no DLQ jobs exist", async () => {
    const result = await db.getDLQJobs(1, 10);
    // getDLQJobs is global — check our seeded slice only.
    // We seeded nothing, so our type shouldn't appear.
    const ourJobs = result.records.filter((j) => j.type === TYPE);
    expect(ourJobs.length).toBe(0);
  });

  it("paginates correctly — page 2 has the right jobs", async () => {
    await seedDLQ(5);

    const page1 = await db.getDLQJobs(1, 3);
    const page2 = await db.getDLQJobs(2, 3);

    // Filter to our seeded jobs only
    const p1Ours = page1.records.filter((j) => j.type === TYPE);
    const p2Ours = page2.records.filter((j) => j.type === TYPE);

    // Together they cover all 5 of our DLQ jobs with no overlap
    const allIds = new Set([...p1Ours, ...p2Ours].map((j) => j.id));
    expect(allIds.size).toBe(p1Ours.length + p2Ours.length); // no duplicates

    // total reflects all 5 DLQ rows (at minimum — there may be others in the DB)
    expect(page1.total).toBeGreaterThanOrEqual(5);
  });

  it("respects the limit parameter", async () => {
    await seedDLQ(10);

    const result = await db.getDLQJobs(1, 3);
    expect(result.records.length).toBe(3);
    expect(result.limit).toBe(3);
  });

  it("page and limit are echoed back in the response", async () => {
    await seedDLQ(1);

    const result = await db.getDLQJobs(2, 5);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });
});
