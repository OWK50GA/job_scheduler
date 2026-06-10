import { z } from "zod";
import { JobStatus } from "../types";

/**
 * Reusable unix-ms timestamp field for date range filters.
 * Query params arrive as strings, so we coerce to number first, then to Date.
 */
const unixMsDate = z
  .coerce
  .number({ error: "date filter must be a unix ms timestamp" })
  .int()
  .positive()
  .transform((ms) => new Date(ms))
  .optional();

export const GetAllJobsSchema = z.object({
  type: z
    .string()
    .min(1, "type cannot be empty")
    .optional(),

  status: z
    .enum(Object.values(JobStatus) as [string, ...string[]], {
      error: `status must be one of: ${Object.values(JobStatus).join(", ")}`,
    })
    .optional(),

  priority: z
    .coerce
    .number()
    .refine((p) => [1, 2, 3].includes(p), {
      message: "priority must be 1 (high), 2 (medium), or 3 (low)",
    })
    .transform((p) => p as 1 | 2 | 3)
    .optional(),

  limit: z
    .coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be >= 1")
    .max(50, "limit cannot exceed 50")
    .optional(),

  page: z
    .coerce
    .number()
    .int("page must be an integer")
    .min(1, "page must be >= 1")
    .optional()
    .default(1),

  min_attempt_count: z
    .coerce
    .number()
    .int("min_attempt_count must be an integer")
    .min(0, "min_attempt_count must be >= 0")
    .optional(),

  max_attempt_count: z
    .coerce
    .number()
    .int("max_attempt_count must be an integer")
    .min(0, "max_attempt_count must be >= 0")
    .optional(),

  min_max_retries: z
    .coerce
    .number()
    .int("min_max_retries must be an integer")
    .min(0, "min_max_retries must be >= 0")
    .optional(),

  max_max_retries: z
    .coerce
    .number()
    .int("max_max_retries must be an integer")
    .min(0, "max_max_retries must be >= 0")
    .optional(),

  // Date range fields — all arrive as unix ms strings from query params
  next_retry_before: unixMsDate,
  next_retry_after:  unixMsDate,
  scheduled_before:  unixMsDate,
  scheduled_after:   unixMsDate,
  started_before:    unixMsDate,
  started_after:     unixMsDate,
  completed_before:  unixMsDate,
  completed_after:   unixMsDate,
  cancelled_before:  unixMsDate,
  cancelled_after:   unixMsDate,
  created_before:    unixMsDate,
  created_after:     unixMsDate,
  updated_before:    unixMsDate,
  updated_after:     unixMsDate,

  recur_interval: z
    .enum(["every_1_minute", "every_5_minutes", "every_1_hour"], {
      error: "recur_interval must be one of: every_1_minute, every_5_minutes, every_1_hour",
    })
    .optional(),

  sort_by: z
    .enum(["attempt_count", "max_retries", "priority"], {
      error: "sort_by must be one of: attempt_count, max_retries, priority",
    })
    .optional(),

  sort_order: z
    .enum(["asc", "desc"], {
      error: "sort_order must be asc or desc",
    })
    .optional(),
});

export type GetAllJobsInput = z.infer<typeof GetAllJobsSchema>;
