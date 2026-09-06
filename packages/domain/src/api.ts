import { z } from 'zod';
import { idSchema } from './entities.js';
import type { Record } from './entities.js';

/** Inputs are zod schemas so every implementation (IPC now, HTTP in v2) validates the same way. */
export const updateRecordNameInputSchema = z.object({
  id: idSchema,
  name: z.string().max(500),
});
export type UpdateRecordNameInput = z.infer<typeof updateRecordNameInputSchema>;

export const listRecordsInputSchema = z
  .object({
    /** Inclusive lower bound on Record start, epoch ms. */
    from: z.int().nonnegative(),
    /** Exclusive upper bound on Record start, epoch ms. */
    to: z.int().nonnegative(),
  })
  .refine((range) => range.from <= range.to, 'from must not exceed to');
export type ListRecordsInput = z.infer<typeof listRecordsInputSchema>;

export type TimerListener = (timer: Record | null) => void;

/**
 * The one surface the UI talks to. Implemented by the Electron main process over IPC and, in v2,
 * by an HTTP client. Every method takes and returns plain, zod-validated data.
 */
export interface TimeStopApi {
  /** Starts a Timer for the Context; stops the running Timer first, at the new one's start. */
  startTimer(): Promise<Record>;
  /** Stops the running Timer, if any. */
  stopTimer(): Promise<Record | null>;
  /** The Actor's Record without a stop, if any. */
  getTimer(): Promise<Record | null>;
  updateRecordName(input: UpdateRecordNameInput): Promise<Record>;
  /** The Actor's Records whose start falls in the range, newest first. */
  listRecords(input: ListRecordsInput): Promise<Record[]>;
  /** Called with the Timer after every start, stop or edit. Returns an unsubscribe. */
  subscribeTimer(listener: TimerListener): () => void;
}
