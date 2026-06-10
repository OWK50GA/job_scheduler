import { Pool } from "pg";
import { config } from "dotenv";
import { InsertJobInput, Job, JobQueryOptions, JobStats } from "../types";

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
    const { type, payload, priority, scheduled_at, recur_interval } = input;

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

    return result.rows[0];
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
}
