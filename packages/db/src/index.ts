/** The database dialect behind each side of the system; each gets its own schema file. */
export const DIALECTS = { desktop: 'sqlite', server: 'postgres' } as const;
