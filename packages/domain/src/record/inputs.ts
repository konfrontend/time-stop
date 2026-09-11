import { z } from 'zod';
import { epochMs, idSchema, rangeFields, rangeInOrder } from '../schema.js';
import { validateRecordSpan } from './rules.js';

export const countRecordsInputSchema = z.object({
  workspaceId: idSchema.optional(),
  projectId: idSchema.optional(),
});
export type CountRecordsInput = z.infer<typeof countRecordsInputSchema>;

export const updateRecordNameInputSchema = z.object({
  id: idSchema,
  name: z.string().max(500),
});
export type UpdateRecordNameInput = z.infer<typeof updateRecordNameInputSchema>;

const recordFields = {
  projectId: idSchema.nullable(),
  name: z.string().max(500),
  start: epochMs,
};

export const createRecordInputSchema = z
  .object({
    workspaceId: idSchema,
    ...recordFields,
    stop: epochMs,
  })
  .superRefine(validateRecordSpan);
export type CreateRecordInput = z.infer<typeof createRecordInputSchema>;

export const updateRecordInputSchema = z
  .object({ id: idSchema, ...recordFields, stop: epochMs.nullable() })
  .superRefine(validateRecordSpan);
export type UpdateRecordInput = z.infer<typeof updateRecordInputSchema>;

export const listRecentNamesInputSchema = z.object({ projectId: idSchema.nullable() });
export type ListRecentNamesInput = z.infer<typeof listRecentNamesInputSchema>;

export const listRecordsInputSchema = z
  .object(rangeFields)
  .refine(rangeInOrder, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;
