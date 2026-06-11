import { Pool } from "pg";
import { config } from "dotenv";

config();

// ── job templates ─────────────────────────────────────────────────────────────
// Each template describes a realistic job type. The seeder picks from these
// using a weighted distribution so the dataset looks like real traffic rather
// than an even spread across all types.

type JobTemplate = {
  type: string;
  priority: 1 | 2 | 3;
  payloadFn: (i: number) => Record<string, unknown>;
};

const TEMPLATES: JobTemplate[] = [
  // High-volume, low-priority background work
  {
    type: "send_email",
    priority: 2,
    payloadFn: (i) => ({
      to: `user${i}@example.com`,
      subject: `Notification #${i}`,
      html: `Hello user${i}, this is an automated notification.`,
    }),
  },
  // Critical transactional emails — high priority
  {
    type: "send_email",
    priority: 1,
    payloadFn: (i) => ({
      to: `customer${i}@example.com`,
      subject: "Your order has shipped",
      html: `Order #${1000 + i} is on its way.`,
      template: "order_shipped",
    }),
  },
  // Webhook deliveries
  {
    type: "webhook_delivery",
    priority: 2,
    payloadFn: (i) => ({
      url: `https://hooks.example.com/endpoint/${i}`,
      method: "POST",
      headers: { "X-Event-Type": "job.completed" },
      body: { job_id: `job-${i}`, status: "completed" },
    }),
  },
  // Report generation — low priority, scheduled
  {
    type: "generate_report",
    priority: 3,
    payloadFn: (i) => ({
      report_type: ["daily", "weekly", "monthly"][i % 3],
      period_start: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      period_end: new Date().toISOString(),
      requested_by: `admin${i % 5}@company.com`,
    }),
  },
  // Log processing — low priority, recurring
  {
    type: "process_logs",
    priority: 3,
    payloadFn: (i) => ({
      source: ["nginx", "app", "worker"][i % 3],
      file: `/var/log/app/app-${i}.log`,
      lines: Math.floor(Math.random() * 5000) + 100,
    }),
  },
  // Data sync — medium priority
  {
    type: "sync_data",
    priority: 2,
    payloadFn: (i) => ({
      source: "postgres",
      destination: "elasticsearch",
      table: ["users", "orders", "products"][i % 3],
      batch_size: 500,
      offset: i * 500,
    }),
  },
  // Image processing — medium priority
  {
    type: "process_image",
    priority: 2,
    payloadFn: (i) => ({
      image_url: `https://cdn.example.com/uploads/img-${i}.jpg`,
      operations: ["resize", "compress", "webp"],
      width: 800,
      height: 600,
    }),
  },
];

// Weighted distribution: send_email gets ~40% of jobs, the rest share the remainder
const WEIGHTS = [20, 20, 15, 15, 10, 10, 10];

function pickTemplate(i: number): JobTemplate {
  // Build cumulative weight table
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  // Use index-based pseudo-random so results are reproducible
  const roll = (i * 37 + 13) % total;
  let cumulative = 0;
  for (let t = 0; t < TEMPLATES.length; t++) {
    cumulative += WEIGHTS[t];
    if (roll < cumulative) return TEMPLATES[t];
  }
  return TEMPLATES[0];
}

const RECUR_INTERVALS = [
  "every_1_minute",
  "every_5_minutes",
  "every_1_hour",
  null,
];

/** Future timestamp between 1 hour and 7 days from now */
function futureDateMs(): number {
  const oneHour = 60 * 60 * 1000;
  const sevenDays = 7 * 24 * oneHour;
  return (
    Date.now() + oneHour + Math.floor(Math.random() * (sevenDays - oneHour))
  );
}

// ── seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  const dbUrl = process.env.JOB_SCHEDULER_DB_URL;
  if (!dbUrl) throw new Error("JOB_SCHEDULER_DB_URL is not set");

  const pool = new Pool({ connectionString: dbUrl });
  const TOTAL = 120;

  console.log(`Seeding ${TOTAL} jobs...`);

  // Build all rows as a single multi-value INSERT for speed
  const valuePlaceholders: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  for (let i = 1; i <= TOTAL; i++) {
    const tmpl = pickTemplate(i);

    // ~25% of jobs get a future scheduled_at, the rest run immediately
    const scheduled_at = i % 4 === 0 ? new Date(futureDateMs()) : new Date();

    // ~20% of jobs are recurring, only sensible job types
    const canRecur = ["send_email", "process_logs", "sync_data"].includes(
      tmpl.type,
    );
    const recur_interval =
      canRecur && i % 5 === 0
        ? RECUR_INTERVALS[i % 3] // picks every_1_minute / every_5_minutes / every_1_hour
        : null;

    valuePlaceholders.push(
      `($${p++}, $${p++}::jsonb, $${p++}, $${p++}::timestamptz, $${p++})`,
    );

    values.push(
      tmpl.type,
      JSON.stringify(tmpl.payloadFn(i)),
      tmpl.priority,
      scheduled_at,
      recur_interval,
    );
  }

  const query = `
    INSERT INTO jobs (type, payload, priority, scheduled_at, recur_interval)
    VALUES ${valuePlaceholders.join(", ")}
  `;

  await pool.query(query, values);
  await pool.end();

  console.log(`Done. Inserted ${TOTAL} jobs.`);
}

seed().catch((err) => {
  console.error("Seeder failed:", err);
  process.exit(1);
});
