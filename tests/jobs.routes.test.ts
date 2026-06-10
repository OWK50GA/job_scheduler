/**
 * Route integration tests — POST /jobs, GET /jobs, GET /jobs/:id, etc.
 *
 * These tests will require a running Postgres instance.
 * Use the CI postgres service defined in .github/workflows/ci.yml.
 *
 * Add tests here as routes are completed.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Placeholder — replace with real app import once routes are mounted
// import app from "../src/app";
// import supertest from "supertest";
// const request = supertest(app);

describe("POST /jobs", () => {
  it.todo("returns 201 with a valid job body");
  it.todo("returns 400 when type is missing");
  it.todo("returns 400 when priority is out of range");
  it.todo("returns 400 when scheduled_at is in the past");
  it.todo("returns 400 when recur_interval is an unknown value");
});

describe("GET /jobs", () => {
  it.todo("returns paginated results");
  it.todo("filters by status");
  it.todo("filters by priority");
  it.todo("returns 400 for invalid priority query param");
});

describe("GET /jobs/:id", () => {
  it.todo("returns the job when it exists");
  it.todo("returns 404 when the job does not exist");
});

describe("GET /jobs/stats", () => {
  it.todo("returns counts for all statuses");
});

describe("GET /jobs/dlq", () => {
  it.todo("only returns failed jobs that have exhausted retries");
});
