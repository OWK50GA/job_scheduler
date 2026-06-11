import { z } from "zod";

export const EmailPayloadSchema = z.object({
  from: z
    .string({ error: "from is required and must be a string" })
    .min(1, "from cannot be empty")
    .optional()
    .default("Wilfrid <wilfrid@hngi14.com>"),

  to: z
    .union([z.email(), z.array(z.email())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .pipe(
      z
        .array(z.email())
        .min(1, "email must have at least one recipient")
        .max(50, "email cannot have more than 50 recipients"),
    ),

  subject: z
    .string({ error: "subject is required and must be a string" })
    .min(1, "Subject cannot be empty"),

  html: z
    .string()
    .min(1, "html is required")
    .max(100_000, "html exceeds ~100KB limit"),
});

export type EmailPayloadType = z.infer<typeof EmailPayloadSchema>;
