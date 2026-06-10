import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GetSingleJobSchema = z.object({
  id: z
    .string({ error: "id is required" })
    .regex(UUID_REGEX, "id must be a valid UUID"),
});

export type GetSingleJobInput = z.infer<typeof GetSingleJobSchema>;
