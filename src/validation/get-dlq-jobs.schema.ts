import { z } from "zod";

export const GetDLQJobsSchema = z.object({
  page: z
    .coerce
    .number()
    .int("page must be an integer")
    .min(1, "page must be >= 1")
    .optional()
    .default(1),

  limit: z
    .coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be >= 1")
    .max(50, "limit cannot exceed 50")
    .optional()
    .default(10),
});

export type GetDLQJobsInput = z.infer<typeof GetDLQJobsSchema>;
