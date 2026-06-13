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

  // ── Phase 1: bulk-insert the base jobs ───────────────────────────────────
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
        ? RECUR_INTERVALS[i % 3]
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

  const insertQuery = `
    INSERT INTO jobs (type, payload, priority, scheduled_at, recur_interval)
    VALUES ${valuePlaceholders.join(", ")}
    RETURNING id
  `;

  const insertResult = await pool.query<{ id: string }>(insertQuery, values);
  const jobIds = insertResult.rows.map((r) => r.id);

  console.log(`Inserted ${TOTAL} jobs.`);

  // ── Phase 2: insert dependency chains ───────────────────────────────────
  // Create ~10 dependency chains of varying depth to demonstrate DAG scheduling.
  // Each chain is a linear sequence: job[n] depends on job[n-1].
  // We use jobs from the second half of the inserted batch so the first half
  // can still run freely and the queue doesn't stall completely.

  type DepEdge = { job_id: string; depends_on_id: string };
  const depEdges: DepEdge[] = [];

  // Chain 1: jobs 80 → 81 → 82 (3-hop)
  depEdges.push({ job_id: jobIds[80], depends_on_id: jobIds[79] });
  depEdges.push({ job_id: jobIds[81], depends_on_id: jobIds[80] });

  // Chain 2: jobs 84 → 85 → 86 → 87 (4-hop)
  depEdges.push({ job_id: jobIds[84], depends_on_id: jobIds[83] });
  depEdges.push({ job_id: jobIds[85], depends_on_id: jobIds[84] });
  depEdges.push({ job_id: jobIds[86], depends_on_id: jobIds[85] });

  // Chain 3: jobs 90 → 91 (2-hop, simple pair)
  depEdges.push({ job_id: jobIds[90], depends_on_id: jobIds[89] });

  // Chain 4: jobs 93 → 94 → 95 (3-hop)
  depEdges.push({ job_id: jobIds[93], depends_on_id: jobIds[92] });
  depEdges.push({ job_id: jobIds[94], depends_on_id: jobIds[93] });

  // Chain 5: jobs 97 → 98 → 99 → 100 → 101 (5-hop, longest chain)
  depEdges.push({ job_id: jobIds[97], depends_on_id: jobIds[96] });
  depEdges.push({ job_id: jobIds[98], depends_on_id: jobIds[97] });
  depEdges.push({ job_id: jobIds[99], depends_on_id: jobIds[98] });
  depEdges.push({ job_id: jobIds[100], depends_on_id: jobIds[99] });

  if (depEdges.length > 0) {
    const depPlaceholders = depEdges.map(
      (_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`,
    );
    const depValues = depEdges.flatMap((e) => [e.job_id, e.depends_on_id]);

    await pool.query(
      `INSERT INTO job_dependencies (job_id, depends_on_id)
       VALUES ${depPlaceholders.join(", ")}`,
      depValues,
    );

    console.log(
      `Inserted ${depEdges.length} dependency edges across 5 chains.`,
    );
  }

  await pool.end();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seeder failed:", err);
  process.exit(1);
});
