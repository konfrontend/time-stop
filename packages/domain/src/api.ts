import { z } from 'zod';
import { epochMs, idSchema } from './entities.js';
import type { Record } from './entities.js';

export const updateRecordNameInputSchema = z.object({
  id: idSchema,
  name: z.string().max(500),
});
export type UpdateRecordNameInput = z.infer<typeof updateRecordNameInputSchema>;

export const listRecordsInputSchema = z
  .object({
    // Inclusive.
    from: epochMs,
    // Exclusive.
    to: epochMs,
  })
  .refine((range) => range.from <= range.to, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;

export type TimerListener = (timer: Record | null) => void;

export interface TimeStopApi {
  // Stops the running Timer first, at the new one's start.
  startTimer(): Promise<Record>;
  stopTimer(): Promise<Record | null>;
  getTimer(): Promise<Record | null>;
  updateRecordName(input: UpdateRecordNameInput): Promise<Record>;
  // Newest first.
  listRecords(input: ListRecordsInput): Promise<Record[]>;
  // Fires after start, stop and Name edits of the Timer.
  subscribeTimer(listener: TimerListener): () => void;
}
