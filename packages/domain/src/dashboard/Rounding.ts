import { z } from 'zod';

/** Applied per Record to its Duration before any total or Amount; Limits usage stays unrounded. */
export const roundingSchema = z.enum(['none', '15m', '30m']);
export type Rounding = z.infer<typeof roundingSchema>;
