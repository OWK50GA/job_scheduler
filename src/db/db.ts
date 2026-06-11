import { Pool } from "pg";
import { config } from "dotenv";
import {
  InsertJobInput,
  Job,
  JobQueryOptions,
  JobStats,
  JobStatus,
} from "../types";

config();

export class DatabaseClient {
  private pool: Pool;

  constructor() {
    const dbUrl = process.env.JOB_SCHEDULER_DB_URL;

    if (!dbUrl) {
      throw new Error("JOB_SCHEDULER_DB_URL environment variable not set");
    }

    this.pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  async insertJob(input: InsertJobInput): Promise<Job> {
    const {
      type,
      payload,
      priority,
      scheduled_at,
      recur_interval,
      depends_on,
    } = input;

    const result = await this.pool.query<Job>(
      `INSERT INTO jobs (type, payload, priority, scheduled_at, recur_interval)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        type,
        JSON.stringify(payload),
        priority,
        scheduled_at ?? new Date(),
        recur_interval ?? null,
      ],
    );

    const job = result.rows[0];

    // If a dependency was declared, insert the edge in parallel with returning
    // the job. The insert is intentionally outside the main query so that the
    // job row exists before the FK reference is made.
    if (depends_on) {
      await this.pool.query(
        `INSERT INTO job_dependencies (job_id, depends_on_id)
         VALUES ($1, $2)`,
        [job.id, depends_on],
      );
    }

    return job;
  }

  async getJob(id: string): Promise<Job | null> {
    const query = `
        SELECT * FROM jobs WHERE id = $1
    `;

    const result = await this.pool.query<Job>(query, [id]);

    if (result.rowCount && result.rowCount > 0) {
      return result.rows[0];
    } else {
      return null;
    }
  }

  async getAllJobs(options: JobQueryOptions): Promise<{
    records: Job[];
    page: number;
    limit: number;
    total: number;
  }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const sortBy = options.sort_by ?? null;
    const sortOrder = options.sort_order
      ? options.sort_order.toUpperCase()
      : "ASC";

    const limit = options.limit && options.limit <= 50 ? options.limit : 10;
    const page = options.page ?? 1;
    const offset = (page - 1) * limit;

    if (options.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(options.type.toLowerCase());
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status.toLowerCase());
    }

    if (options.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      values.push(options.priority);
    }

    if (options.recur_interval) {
      conditions.push(`recur_interval = $${paramIndex++}`);
      values.push(options.recur_interval);
    }

    // attempt_count range
    if (options.min_attempt_count !== undefined) {
      conditions.push(`attempt_count >= $${paramIndex++}`);
      values.push(options.min_attempt_count);
    }
    if (options.max_attempt_count !== undefined) {
      conditions.push(`attempt_count <= $${paramIndex++}`);
      values.push(options.max_attempt_count);
    }

    // max_retries range
    if (options.min_max_retries !== undefined) {
      conditions.push(`max_retries >= $${paramIndex++}`);
      values.push(options.min_max_retries);
    }
    if (options.max_max_retries !== undefined) {
      conditions.push(`max_retries <= $${paramIndex++}`);
      values.push(options.max_max_retries);
    }

    // next_retry_at range
    if (options.next_retry_after !== undefined) {
      conditions.push(`next_retry_at >= $${paramIndex++}`);
      values.push(options.next_retry_after);
    }
    if (options.next_retry_before !== undefined) {
      conditions.push(`next_retry_at <= $${paramIndex++}`);
      values.push(options.next_retry_before);
    }

    // scheduled_at range
    if (options.scheduled_after !== undefined) {
      conditions.push(`scheduled_at >= $${paramIndex++}`);
      values.push(options.scheduled_after);
    }
    if (options.scheduled_before !== undefined) {
      conditions.push(`scheduled_at <= $${paramIndex++}`);
      values.push(options.scheduled_before);
    }

    // started_at range
    if (options.started_after !== undefined) {
      conditions.push(`started_at >= $${paramIndex++}`);
      values.push(options.started_after);
    }
    if (options.started_before !== undefined) {
      conditions.push(`started_at <= $${paramIndex++}`);
      values.push(options.started_before);
    }

    // completed_at range
    if (options.completed_after !== undefined) {
      conditions.push(`completed_at >= $${paramIndex++}`);
      values.push(options.completed_after);
    }
    if (options.completed_before !== undefined) {
      conditions.push(`completed_at <= $${paramIndex++}`);
      values.push(options.completed_before);
    }

    // cancelled_at range
    if (options.cancelled_after !== undefined) {
      conditions.push(`cancelled_at >= $${paramIndex++}`);
      values.push(options.cancelled_after);
    }
    if (options.cancelled_before !== undefined) {
      conditions.push(`cancelled_at <= $${paramIndex++}`);
      values.push(options.cancelled_before);
    }

    // created_at range
    if (options.created_after !== undefined) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(options.created_after);
    }
    if (options.created_before !== undefined) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(options.created_before);
    }

    // updated_at range
    if (options.updated_after !== undefined) {
      conditions.push(`updated_at >= $${paramIndex++}`);
      values.push(options.updated_after);
    }
    if (options.updated_before !== undefined) {
      conditions.push(`updated_at <= $${paramIndex++}`);
      values.push(options.updated_before);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Only allow known columns in ORDER BY to prevent SQL injection
    const SORTABLE_COLUMNS: Record<string, string> = {
      attempt_count: "attempt_count",
      max_retries: "max_retries",
      priority: "priority",
    };
    const sortClause =
      sortBy && SORTABLE_COLUMNS[sortBy]
        ? `ORDER BY ${SORTABLE_COLUMNS[sortBy]} ${sortOrder}`
        : `ORDER BY created_at DESC`;

    const countQuery = `SELECT COUNT(*) FROM jobs ${whereClause}`;
    const dataQuery = `
      SELECT * FROM jobs
      ${whereClause}
      ${sortClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const filterValues = [...values];
    const dataValues = [...values, limit, offset];

    const [dataResult, countResult] = await Promise.all([
      this.pool.query<Job>(dataQuery, dataValues),
      this.pool.query(countQuery, filterValues),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      records: dataResult.rows,
      page,
      limit,
      total,
    };
  }

  async getJobStats(): Promise<JobStats> {
    // One query for status counts, one for DLQ count — run in parallel
    const [statusResult, dlqResult] = await Promise.all([
      this.pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM jobs GROUP BY status`,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM jobs
         WHERE status = 'failed' AND attempt_count >= max_retries`,
      ),
    ]);

    // Seed all statuses at 0 so missing ones don't show up as undefined
    const stats: JobStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      dlq: parseInt(dlqResult.rows[0].count, 10),
      total: 0,
    };

    for (const row of statusResult.rows) {
      const count = parseInt(row.count, 10);
      if (row.status in stats) {
        stats[row.status as keyof Omit<JobStats, "dlq" | "total">] = count;
      }
      stats.total += count;
    }

    return stats;
  }

  async getDLQJobs(
    page = 1,
    limit = 10,
  ): Promise<{
    records: Job[];
    page: number;
    limit: number;
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      this.pool.query<Job>(
        `SELECT * FROM jobs
         WHERE status = 'failed' AND attempt_count >= max_retries
         ORDER BY updated_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM jobs
         WHERE status = 'failed' AND attempt_count >= max_retries`,
      ),
    ]);

    return {
      records: dataResult.rows,
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async claimNextJob(): Promise<Job | null> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query<Job>(`
        SELECT * FROM jobs
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY priority ASC, scheduled_at ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const job = result.rows[0];

      await client.query(
        `
        UPDATE jobs
        SET status = 'processing',
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
        [job.id],
      );

      await client.query("COMMIT");

      return {
        ...job,
        status: JobStatus.PROCESSING,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async markJobCompleted(
    jobId: string,
    result: Record<string, unknown>,
    durationMs: number,
  ): Promise<Job> {
    const [jobResult] = await Promise.all([
      this.pool.query<Job>(
        `UPDATE jobs
         SET status       = 'completed',
             result       = $2,
             completed_at = NOW(),
             updated_at   = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId, JSON.stringify(result)],
      ),
      this.pool.query(
        `INSERT INTO job_attempts (job_id, attempt_num, duration_ms)
         SELECT id, attempt_count, $2
         FROM   jobs
         WHERE  id = $1`,
        [jobId, durationMs],
      ),
    ]);

    return jobResult.rows[0];
  }

  /**
   * Job failed but still has retries remaining.
   * Increments attempt_count, sets next_retry_at using the caller-supplied
   * backoff date, and keeps status as 'pending' so the poll loop picks it up.
   */
  async markJobRetryable(
    jobId: string,
    error: string,
    nextRetryAt: Date,
    durationMs: number,
  ): Promise<Job> {
    const [jobResult] = await Promise.all([
      this.pool.query<Job>(
        `UPDATE jobs
         SET status        = 'pending',
             last_error    = $2,
             next_retry_at = $3,
             attempt_count = attempt_count + 1,
             updated_at    = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId, error, nextRetryAt],
      ),
      this.pool.query(
        `INSERT INTO job_attempts (job_id, attempt_num, error, duration_ms)
         SELECT id, attempt_count, $2, $3
         FROM   jobs
         WHERE  id = $1`,
        [jobId, error, durationMs],
      ),
    ]);

    return jobResult.rows[0];
  }

  /**
   * Job has exhausted all retries. Mark it failed permanently.
   * It is now in the DLQ (status=failed AND attempt_count >= max_retries).
   */
  async markJobDeadLetter(
    jobId: string,
    error: string,
    durationMs: number,
  ): Promise<Job> {
    const [jobResult] = await Promise.all([
      this.pool.query<Job>(
        `UPDATE jobs
         SET status        = 'failed',
             last_error    = $2,
             next_retry_at = NULL,
             attempt_count = attempt_count + 1,
             updated_at    = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId, error],
      ),
      this.pool.query(
        `INSERT INTO job_attempts (job_id, attempt_num, error, duration_ms)
         SELECT id, attempt_count, $2, $3
         FROM   jobs
         WHERE  id = $1`,
        [jobId, error, durationMs],
      ),
    ]);

    return jobResult.rows[0];
  }

  async cancelJob(jobId: string): Promise<Job | null> {
    const result = await this.pool.query<Job>(
      `UPDATE jobs
       SET status       = 'cancelled',
           cancelled_at = NOW(),
           updated_at   = NOW()
       WHERE id = $1
         AND status IN ('pending', 'processing')
       RETURNING *`,
      [jobId],
    );

    return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Fetches the next batch of eligible jobs for the scheduler heap.
   *
   * Eligibility rules:
   * - status = 'pending'  (not already processing/completed/failed/cancelled)
   * - scheduled_at <= NOW()  (due time has passed)
   * - next_retry_at IS NULL OR next_retry_at <= NOW()
   *   (for retried jobs: backoff window has elapsed)
   *
   * When there are more eligible jobs than the limit, the DB pre-sorts by
   * priority ASC, scheduled_at ASC, created_at ASC so we always pull the
   * most urgent candidates first. The in-memory scheduler then applies its
   * own effective-score calculation (aging, DAG weight) on top of this set.
   *
   * Recurring jobs need no special handling here — scheduleNextRecurringRun
   * already inserts the next run as a fresh pending row with the correct
   * future scheduled_at. Once that time passes this query picks it up.
   *
   * @param limit  Maximum number of jobs to return. Default 100.
   */
  /**
   * Fetches the next batch of eligible jobs for the scheduler heap.
   *
   * Eligibility rules:
   * - status = 'pending'
   * - scheduled_at <= NOW()
   * - next_retry_at IS NULL OR next_retry_at <= NOW()
   * - ALL declared dependencies have status = 'completed'
   *   (jobs with any unmet dependency are excluded entirely — they never
   *   enter the heap and are never claimed until the dependency finishes)
   *
   * The dependency filter uses a NOT EXISTS subquery rather than a JOIN so
   * that jobs with no rows in job_dependencies pass through unchanged.
   * A LEFT JOIN approach would require a HAVING clause and is harder to read.
   *
   * @param limit  Maximum number of jobs to return. Default 100.
   */
  async fetchDueJobs(limit = 100): Promise<Job[]> {
    const result = await this.pool.query<Job>(
      `SELECT j.*
       FROM   jobs j
       WHERE  j.status = 'pending'
         AND  j.scheduled_at <= NOW()
         AND  (j.next_retry_at IS NULL OR j.next_retry_at <= NOW())
         AND  NOT EXISTS (
                SELECT 1
                FROM   job_dependencies jd
                JOIN   jobs             dep ON dep.id = jd.depends_on_id
                WHERE  jd.job_id  = j.id
                  AND  dep.status <> 'completed'
              )
       ORDER BY j.priority ASC, j.scheduled_at ASC, j.created_at ASC
       LIMIT  $1`,
      [limit],
    );

    return result.rows;
  }

  /**
   * Atomically claims a specific job by ID, transitioning it from
   * 'pending' to 'processing'.
   *
   * Used by the heap-based scheduler: the heap decides which job to run
   * next (by effective score), then calls this to lock that specific row.
   * FOR UPDATE SKIP LOCKED ensures two workers can never claim the same job,
   * even if they both decided on the same ID simultaneously.
   *
   * Returns null if the job was already claimed by another worker or no
   * longer exists — the caller should skip it and pop the next heap entry.
   */
  async claimJobById(jobId: string): Promise<Job | null> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query<Job>(
        `SELECT * FROM jobs
         WHERE  id = $1
           AND  status = 'pending'
         FOR UPDATE SKIP LOCKED`,
        [jobId],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(
        `UPDATE jobs
         SET    status     = 'processing',
                started_at = NOW(),
                updated_at = NOW()
         WHERE  id = $1`,
        [jobId],
      );

      await client.query("COMMIT");

      return { ...result.rows[0], status: JobStatus.PROCESSING };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reaps zombie jobs — jobs stuck in 'processing' longer than the timeout.
   *
   * This happens when a worker crashes mid-execution without updating the job.
   * The job is reset to 'pending' so the poll loop picks it up again.
   * attempt_count is incremented because the job genuinely failed — treating it
   * as a fresh attempt would let it exceed max_retries silently.
   *
   * Timeout: 10 minutes. Any job processing longer than that is assumed dead.
   *
   * Returns the number of jobs reaped.
   */
  async reapZombieJobs(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE jobs
       SET status        = 'pending',
           started_at    = NULL,
           attempt_count = attempt_count + 1,
           last_error    = 'Worker crashed or timed out',
           updated_at    = NOW()
       WHERE status = 'processing'
         AND started_at < NOW() - INTERVAL '10 minutes'`,
    );

    return result.rowCount ?? 0;
  }

  async scheduleNextRecurringRun(job: Job): Promise<Job> {
    if (!job.recur_interval) {
      throw new Error(`Job ${job.id} has no recur_interval`);
    }

    // Import inline to avoid circular dep between db and utils
    const { recurIntervalToMilliseconds } = await import("../utils");
    const ms = recurIntervalToMilliseconds(job.recur_interval);
    const nextScheduledAt = new Date(Date.now() + ms);

    const result = await this.pool.query<Job>(
      `INSERT INTO jobs (type, payload, priority, scheduled_at, recur_interval)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        job.type,
        JSON.stringify(job.payload),
        job.priority,
        nextScheduledAt,
        job.recur_interval,
      ],
    );

    return result.rows[0];
  }

  /**
   * Checks whether all declared dependencies of a job have completed
   * successfully.
   *
   * A job is eligible to run when every row in job_dependencies where
   * job_id = jobId has a corresponding dependency job whose status is
   * 'completed'.
   *
   * Returns true in two cases:
   *   1. The job has no dependencies at all (no rows for jobId).
   *   2. Every dependency job has status = 'completed'.
   *
   * Returns false when at least one dependency is still pending, processing,
   * failed, or cancelled — i.e. the job must not be picked up yet.
   *
   * This is called in processJob (and optionally in fetchDueJobs) before
   * handing a job to a handler.
   */
  async checkDependenciesMet(jobId: string): Promise<boolean> {
    const result = await this.pool.query<{ unmet: string }>(
      `SELECT COUNT(*) AS unmet
       FROM   job_dependencies jd
       JOIN   jobs              j  ON j.id = jd.depends_on_id
       WHERE  jd.job_id = $1
         AND  j.status  <> 'completed'`,
      [jobId],
    );

    return parseInt(result.rows[0].unmet, 10) === 0;
  }

  /**
   * Re-queues a DLQ job for manual retry.
   *
   * Only operates on jobs that are in the dead-letter queue:
   *   status = 'failed' AND attempt_count >= max_retries
   *
   * Resets attempt_count to 0, clears last_error and next_retry_at,
   * and sets status back to 'pending' so the worker picks it up again.
   * scheduled_at is reset to NOW() so it is immediately eligible.
   *
   * Returns the updated job, or null if the job does not exist or is
   * not in the DLQ (caller should distinguish 404 vs 409).
   */
  async manualRetryJob(jobId: string): Promise<Job | null> {
    const result = await this.pool.query<Job>(
      `UPDATE jobs
       SET status        = 'pending',
           attempt_count = 0,
           last_error    = NULL,
           next_retry_at = NULL,
           scheduled_at  = NOW(),
           updated_at    = NOW()
       WHERE id = $1
         AND status = 'failed'
         AND attempt_count >= max_retries
       RETURNING *`,
      [jobId],
    );

    return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
  }
}
