import { Pool } from "pg";
import { config } from "dotenv";

config();

/**
 * Resets the database to a clean state.
 *
 * - Truncates jobs, job_attempts, and job_logs (CASCADE handles FK deps)
 * - Resets the SERIAL sequences on job_attempts and job_logs back to 1
 *
 * Does NOT drop or recreate tables. Run migrations/001_init.sql separately
 * if you need to rebuild the schema from scratch.
 */
async function resetDb() {
  const dbUrl = process.env.JOB_SCHEDULER_DB_URL;
  if (!dbUrl) throw new Error("JOB_SCHEDULER_DB_URL is not set");

  const pool = new Pool({ connectionString: dbUrl });

  console.log("Resetting database...");

  await pool.query(`
    TRUNCATE TABLE jobs CASCADE;
    ALTER SEQUENCE job_attempts_id_seq RESTART WITH 1;
    ALTER SEQUENCE job_logs_id_seq RESTART WITH 1;
  `);

  await pool.end();

  console.log("Done. All jobs, attempts, and logs cleared.");
}

resetDb().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
