import { z } from 'zod';
import { timestampSchema, idSchema } from '../schema.js';
import type { Period } from '../time/time.js';

export const limitPeriodSchema = z.enum(['week', 'month']) satisfies z.ZodType<Period>;
export type LimitPeriod = Period;

export const projectSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  clientId: idSchema.nullable(),
  name: z.string(),
  rate: z.number().nonnegative().nullable(),
  limitMin: z.number().nonnegative().nullable(),
  limitMax: z.number().nonnegative().nullable(),
  limitPeriod: limitPeriodSchema.nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  color: z.string(),
  archived: z.boolean(),
  updatedAt: timestampSchema,
});
export type Project = z.infer<typeof projectSchema>;
