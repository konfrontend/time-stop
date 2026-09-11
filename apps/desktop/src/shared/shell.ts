import { z } from 'zod';
import { method, type } from '@time-stop/domain';

/** The Tracker fits the compact window; the Dashboard and Settings need the expanded one. */
export const windowModeSchema = z.enum(['compact', 'expanded']);
export type WindowMode = z.infer<typeof windowModeSchema>;

export const shell = {
  isAlwaysOnTop: method({ output: type<boolean>() }),
  setAlwaysOnTop: method({ input: z.boolean(), output: type<boolean>() }),
  setWindowMode: method({ input: windowModeSchema, output: type<void>() }),
};
