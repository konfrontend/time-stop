import { z } from 'zod';
import { timestampSchema, idSchema, rangeFields, rangeInOrder } from '../schema.js';
import { validateRecordSpan } from './rules.js';

export const countRecordsInputSchema = z.object({
  workspaceId: idSchema.optional(),
  projectId: idSchema.optional(),
});
export type CountRecordsInput = z.infer<typeof countRecordsInputSchema>;

export const updateRecordNameInputSchema = z.object({
  id: idSchema,
  name: z.string().trim().max(500),
});
export type UpdateRecordNameInput = z.infer<typeof updateRecordNameInputSchema>;

const recordFields = {
  projectId: idSchema.nullable(),
  name: z.string().trim().max(500),
  start: timestampSchema,
};

export const createRecordInputSchema = z
  .object({
    workspaceId: idSchema,
    ...recordFields,
    stop: timestampSchema,
  })
  .superRefine(validateRecordSpan);
export type CreateRecordInput = z.infer<typeof createRecordInputSchema>;

export const updateRecordInputSchema = z
  .object({ id: idSchema, ...recordFields, stop: timestampSchema.nullable() })
  .superRefine(validateRecordSpan);
export type UpdateRecordInput = z.infer<typeof updateRecordInputSchema>;

/** Absent Name is empty; absent Project is the Context's, `null` is none. */
export const startTimerInputSchema = z
  .object({
    name: z.string().trim().max(500).optional(),
    projectId: idSchema.nullable().optional(),
  })
  .optional();
export type StartTimerInput = z.infer<typeof startTimerInputSchema>;

export const listRecentNamesInputSchema = z.object({ projectId: idSchema.nullable() });
export type ListRecentNamesInput = z.infer<typeof listRecentNamesInputSchema>;

export const listRecordsInputSchema = z
  .object(rangeFields)
  .refine(rangeInOrder, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;
