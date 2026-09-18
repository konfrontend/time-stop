import { event, method, type } from '../api/contract.js';
import { idInputSchema } from '../schema.js';
import type { Record } from './Record.js';
import {
  countRecordsInputSchema,
  createRecordInputSchema,
  listRecentNamesInputSchema,
  listRecordsInputSchema,
  startTimerInputSchema,
  updateRecordInputSchema,
  updateRecordNameInputSchema,
} from './inputs.js';

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
  /**
   * Stops the running Timer first, at the new one's start. Without a Project it lands in the
   * Context; with one it lands in that Project's Workspace and moves the Context there, so the
   * next plain Start repeats it.
   */
  startTimer: method({ input: startTimerInputSchema, output: type<Record>() }),
  stopTimer: method({ output: type<Record | null>() }),
  getTimer: method({ output: type<Record | null>() }),
  updateName: method({ input: updateRecordNameInputSchema, output: type<Record>() }),
  // Fires whenever a write leaves the Timer different in any field: start, stop, a Name edit…
  onTimerChanged: event<Record | null>(),
};
