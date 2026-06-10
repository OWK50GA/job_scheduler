/**
 * Database layer tests — DatabaseClient methods.
 *
 * These tests require a running Postgres instance seeded with the migration.
 * Add tests here as db methods are completed.
 */
import { describe, it } from "vitest";

describe("DatabaseClient.insertJob", () => {
  it.todo("inserts a job and returns the full row");
  it.todo("defaults scheduled_at to now when not provided");
  it.todo("stores recur_interval as null when not provided");
});

describe("DatabaseClient.getJob", () => {
  it.todo("returns the job by id");
  it.todo("returns null for a non-existent id");
});

describe("DatabaseClient.getAllJobs", () => {
  it.todo("returns paginated results with correct total");
  it.todo("filters by status correctly");
  it.todo("respects limit cap of 50");
});

describe("DatabaseClient.getJobStats", () => {
  it.todo("returns counts for all statuses");
  it.todo("dlq count only includes failed jobs at max_retries");
});

describe("DatabaseClient.getDLQJobs", () => {
  it.todo("returns only failed jobs where attempt_count >= max_retries");
  it.todo("paginates correctly");
});
