import { z } from 'zod';
import { epochMs, idSchema, type Record } from '../entities.js';
import { event, method, type } from './contract.js';
import { idInputSchema, rangeFields, rangeInOrder } from './inputs.js';

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

export function checkRecordSpan(
  record: { start: number; stop: number | null },
  ctx: z.RefinementCtx,
): void {
  if (record.stop !== null && record.stop < record.start) {
    ctx.addIssue({ code: 'custom', path: ['stop'], message: 'Stop must not precede start' });
  }
}

export const createRecordInputSchema = z
  .object({
    workspaceId: idSchema,
    ...recordFields,
    stop: epochMs,
  })
  .superRefine(checkRecordSpan);
export type CreateRecordInput = z.infer<typeof createRecordInputSchema>;

export const updateRecordInputSchema = z
  .object({ id: idSchema, ...recordFields, stop: epochMs.nullable() })
  .superRefine(checkRecordSpan);
export type UpdateRecordInput = z.infer<typeof updateRecordInputSchema>;

export const listRecentNamesInputSchema = z.object({ projectId: idSchema.nullable() });
export type ListRecentNamesInput = z.infer<typeof listRecentNamesInputSchema>;

export const listRecordsInputSchema = z
  .object(rangeFields)
  .refine(rangeInOrder, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;

export type TimerListener = (timer: Record | null) => void;

export const record = {
  // A Project must sit in the given Workspace.
  create: method({ input: createRecordInputSchema, output: type<Record>() }),
  /**
   * A new Project re-derives the Workspace; no Project keeps the Workspace. Only the Timer may
   * keep an empty stop.
   */
  update: method({ input: updateRecordInputSchema, output: type<Record>() }),
  delete: method({ input: idInputSchema, output: type<void>() }),
  // Newest first.
  list: method({ input: listRecordsInputSchema, output: type<Record[]>() }),
  // For the delete confirmation: how many Records a Workspace or Project still holds.
  count: method({ input: countRecordsInputSchema, output: type<number>() }),
  // Most recently started first.
  recentNames: method({ input: listRecentNamesInputSchema, output: type<string[]>() }),
  // Lands in the Context; stops the running Timer first, at the new one's start.
  startTimer: method({ output: type<Record>() }),
  stopTimer: method({ output: type<Record | null>() }),
  getTimer: method({ output: type<Record | null>() }),
  updateName: method({ input: updateRecordNameInputSchema, output: type<Record>() }),
  // Fires whenever a write leaves the Timer different in any field: start, stop, a Name edit…
  onTimerChanged: event<Record | null>(),
};
