import type { z } from 'zod';

/** The first message per top-level field of a failed parse. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    errors[field] ??= issue.message;
  }
  return errors;
}
