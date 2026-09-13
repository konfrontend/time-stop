/** The text of a thrown value, for an inline failure line. */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
