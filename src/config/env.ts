import { config } from "dotenv";

config();

export const envConfig = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001"),
  HOST:
    process.env.NODE_ENV === "production"
      ? "0.0.0.0"
      : process.env.HOST || "localhost",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  JOB_SCHEDULER_DB_URL:
    process.env.JOB_SCHEDULER_DB_URL ||
    "postgresql://classifications_user:classifications_password@localhost:5432/job_scheduler_db",
  DATABASE_SYNC: process.env.DATABASE_SYNC || false,
  DATABASE_LOGGING: process.env.DATABASE_LOGGING || false,
  DATABASE_SSL: process.env.DATABASE_SSL || false,
};
