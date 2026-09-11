import { z } from 'zod';

/** An empty URL unconfigures the Server; a null Token leaves the stored one alone. */
export const serverInputSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === '' || /^https?:\/\/.+/.test(value),
      'A Server URL starts with http:// or https://',
    )
    // One shape for every push: no trailing slash, and empty means no Server.
    .transform((value) => value.replace(/\/+$/, '') || null),
  token: z.string().trim().min(1).max(500).nullable(),
});
export type ServerInput = z.infer<typeof serverInputSchema>;
