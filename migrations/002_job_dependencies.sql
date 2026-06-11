-- Migration 002: DAG job dependencies
--
-- Each row says: job `job_id` cannot start until job `depends_on_id`
-- has status = 'completed'.
--
-- A job with no rows in this table has no dependencies and is always eligible
-- to run (subject to its own scheduled_at and next_retry_at constraints).
--
-- Design decisions:
--   - Both columns reference jobs(id) with ON DELETE CASCADE so that deleting
--     a job automatically removes all edges that point to or from it.
--   - A UNIQUE constraint on (job_id, depends_on_id) prevents duplicate edges.
--   - A CHECK constraint blocks self-dependency (job_id = depends_on_id).
--     Cyclic dependencies across multiple jobs are not enforced at the DB layer
--     (that would require a full graph traversal); cycle detection must be done
--     in application code when edges are inserted.

CREATE TABLE job_dependencies (
  id            SERIAL PRIMARY KEY,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (job_id, depends_on_id),
  CHECK  (job_id <> depends_on_id)
);

-- Index for the forward direction: "what are the dependencies of job X?"
-- Used by checkDependenciesMet — the hot path on every job claim.
CREATE INDEX idx_job_dependencies_job_id
  ON job_dependencies(job_id);

-- Index for the reverse direction: "which jobs are waiting on job X?"
-- Used when a job completes to find its dependents and potentially unlock them.
CREATE INDEX idx_job_dependencies_depends_on_id
  ON job_dependencies(depends_on_id);
