CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           VARCHAR(100) NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority       SMALLINT NOT NULL DEFAULT 2,
  attempt_count  SMALLINT NOT NULL DEFAULT 0,
  max_retries    SMALLINT NOT NULL DEFAULT 3,
  next_retry_at  TIMESTAMPTZ,
  scheduled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recur_interval VARCHAR(20),
  last_error     TEXT,
  result         JSONB,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_attempts (
  id           SERIAL PRIMARY KEY,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt_num  SMALLINT NOT NULL,
  error        TEXT,
  duration_ms  INTEGER,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_logs (
  id         SERIAL PRIMARY KEY,
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event      VARCHAR(50) NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worker polling index — the most important one.
-- Partial index: only indexes rows the worker actually cares about.
-- Completed/failed/cancelled rows never appear here, keeping it lean.
CREATE INDEX idx_jobs_worker
  ON jobs(priority ASC, scheduled_at ASC, created_at ASC)
  WHERE status = 'pending';

-- Retry pickup index — for finding jobs whose backoff window has elapsed.
CREATE INDEX idx_jobs_retry
  ON jobs(next_retry_at ASC)
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Foreign key indexes — Postgres doesn't create these automatically.
-- Without them, every ON DELETE CASCADE does a full table scan.
CREATE INDEX idx_job_attempts_job_id
  ON job_attempts(job_id);

CREATE INDEX idx_job_logs_job_id
  ON job_logs(job_id);

-- Useful for the UI: fetching logs for a job ordered by time
CREATE INDEX idx_job_logs_job_created
  ON job_logs(job_id, created_at DESC);