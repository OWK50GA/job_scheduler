/**
 * Debug run script.
 *
 * 1. Resets the DB (truncates all jobs/attempts/logs)
 * 2. Seeds 120 jobs (same as pnpm seed:db)
 * 3. Runs the worker for WORKER_RUN_SECONDS seconds
 * 4. Prints a final status breakdown
 *
 * Usage:
 *   pnpm tsx src/scripts/debug-run.ts
 *   pnpm tsx src/scripts/debug-run.ts --seconds=60
 */
import { Pool } from "pg";
import { config } from "dotenv";
import { startWorker, stopWorker } from "../worker/worker";

config();

const args = process.argv.slice(2);
const secondsArg = args.find((a) => a.startsWith("--seconds="));
const WORKER_RUN_SECONDS = secondsArg
  ? parseInt(secondsArg.split("=")[1], 10)
  : 30;

async function resetDb(pool: Pool) {
  console.log("⟳  Resetting database...");
  await pool.query(`
    TRUNCATE TABLE jobs CASCADE;
    ALTER SEQUENCE job_attempts_id_seq RESTART WITH 1;
    ALTER SEQUENCE job_logs_id_seq RESTART WITH 1;
  `);
  console.log("✓  Database cleared.\n");
}

type JobTemplate = {
  type: string;
  priority: 1 | 2 | 3;
  payloadFn: (i: number) => Record<string, unknown>;
};

const TEMPLATES: JobTemplate[] = [
  {
    type: "send_email",
    priority: 2,
    payloadFn: (i) => ({
      to: `user${i}@example.com`,
      subject: `Notification #${i}`,
      html: `Hello user${i}, this is an automated notification.`,
    }),
  },
  {
    type: "send_email",
    priority: 1,
    payloadFn: (i) => ({
      to: `customer${i}@example.com`,
      subject: "Your order has shipped",
      html: `Order #${1000 + i} is on its way.`,
    }),
  },
  {
    type: "webhook_delivery",
    priority: 2,
    payloadFn: (i) => ({
      url: `https://hooks.example.com/endpoint/${i}`,
      method: "POST",
      body: { job_id: `job-${i}` },
    }),
  },
  {
    type: "generate_report",
    priority: 3,
    payloadFn: (i) => ({
      report_type: ["daily", "weekly", "monthly"][i % 3],
      requested_by: `admin${i % 5}@company.com`,
    }),
  },
  {
    type: "process_logs",
    priority: 3,
    payloadFn: (i) => ({
      source: ["nginx", "app", "worker"][i % 3],
      file: `/var/log/app/app-${i}.log`,
    }),
  },
];

const WEIGHTS = [25, 25, 20, 15, 15];

function pickTemplate(i: number): JobTemplate {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  const roll = (i * 37 + 13) % total;
  let cumulative = 0;
  for (let t = 0; t < TEMPLATES.length; t++) {
    cumulative += WEIGHTS[t];
    if (roll < cumulative) return TEMPLATES[t];
  }
  return TEMPLATES[0];
}

async function seed(pool: Pool, total = 120) {
  console.log(`⟳  Seeding ${total} jobs...`);

  const valuePlaceholders: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  for (let i = 1; i <= total; i++) {
    const tmpl = pickTemplate(i);
    // All jobs are immediately due so the worker can process them right away
    valuePlaceholders.push(`($${p++}, $${p++}::jsonb, $${p++}, NOW(), NULL)`);
    values.push(tmpl.type, JSON.stringify(tmpl.payloadFn(i)), tmpl.priority);
  }

  await pool.query(
    `INSERT INTO jobs (type, payload, priority, scheduled_at, recur_interval)
     VALUES ${valuePlaceholders.join(", ")}`,
    values,
  );

  console.log(`✓  Inserted ${total} jobs.\n`);
}

async function printStats(pool: Pool) {
  const { rows } = await pool.query<{ status: string; count: string }>(`
    SELECT status, COUNT(*) AS count
    FROM jobs
    GROUP BY status
    ORDER BY status
  `);

  const dlq = await pool.query<{ count: string }>(`
    SELECT COUNT(*) AS count FROM jobs
    WHERE status = 'failed' AND attempt_count >= max_retries
  `);

  console.log("\n─── Final Job Status ───────────────────────────");
  for (const row of rows) {
    console.log(`  ${row.status.padEnd(12)} ${row.count}`);
  }
  console.log(`  ${"dlq".padEnd(12)} ${dlq.rows[0].count}`);
  console.log("────────────────────────────────────────────────\n");

  // Sample a completed job to verify attempt_count
  const sample = await pool.query<{
    id: string;
    type: string;
    status: string;
    attempt_count: number;
    last_error: string | null;
  }>(`
    SELECT id, type, status, attempt_count, last_error
    FROM jobs
    ORDER BY updated_at DESC
    LIMIT 10
  `);

  console.log("─── 10 Most Recently Updated Jobs ─────────────");
  for (const row of sample.rows) {
    const err = row.last_error
      ? ` | error: ${row.last_error.slice(0, 60)}`
      : "";
    console.log(
      `  ${row.id.slice(0, 8)}  ${row.type.padEnd(18)} ${row.status.padEnd(12)} attempts=${row.attempt_count}${err}`,
    );
  }
  console.log("────────────────────────────────────────────────\n");
}

async function main() {
  const dbUrl = process.env.JOB_SCHEDULER_DB_URL;
  if (!dbUrl) throw new Error("JOB_SCHEDULER_DB_URL is not set");

  const pool = new Pool({ connectionString: dbUrl });

  await resetDb(pool);
  await seed(pool);

  console.log(`⟳  Starting worker for ${WORKER_RUN_SECONDS}s...\n`);
  await startWorker();

  await new Promise((resolve) =>
    setTimeout(resolve, WORKER_RUN_SECONDS * 1000),
  );

  console.log("\n⟳  Stopping worker...");
  await stopWorker();

  await printStats(pool);
  await pool.end();
}

main().catch((err) => {
  console.error("debug-run failed:", err);
  process.exit(1);
});
