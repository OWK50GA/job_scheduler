import { z } from "zod";

/**
 * Zod schema for POST /jobs request body.
 *
 * scheduled_at is accepted as a unix ms timestamp from clients.
 * The controller converts it to a Date before passing to the DB.
 */
export const CreateJobSchema = z.object({
  type: z
    .string({ error: "type is required and must be a string" })
    .min(1, "type cannot be empty"),

  payload: z
    .record(z.string(), z.unknown())
    .refine((v) => v !== null && typeof v === "object" && !Array.isArray(v), {
      message: "payload must be a JSON object",
    }),

  priority: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    error: "priority must be 1 (high), 2 (medium), or 3 (low)",
  }),

  scheduled_at: z
    .number({ error: "scheduled_at must be a unix ms timestamp" })
    .int()
    .positive()
    .refine((ms) => ms > Date.now(), {
      message: "scheduled_at cannot be in the past",
    })
    .optional(),

  recur_interval: z
    .enum(["every_1_minute", "every_5_minutes", "every_1_hour"], {
      error: "recur_interval must be one of: every_1_minute, every_5_minutes, every_1_hour",
    })
    .optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
