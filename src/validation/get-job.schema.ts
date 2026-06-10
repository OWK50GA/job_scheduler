import { z } from "zod";

export const GetSingleJobSchema = z.object({
  id: z.string({ error: "id is required" }).uuid("id must be a valid UUID"),
});

export type GetSingleJobInput = z.infer<typeof GetSingleJobSchema>;
