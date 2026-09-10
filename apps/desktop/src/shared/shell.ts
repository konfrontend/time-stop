import { z } from 'zod';
import type { MethodTable } from '@time-stop/domain';

/** The Tracker fits the compact window; the Dashboard and Settings need the expanded one. */
export const windowModeSchema = z.enum(['compact', 'expanded']);
export type WindowMode = z.infer<typeof windowModeSchema>;

export interface ShellApi {
  isAlwaysOnTop(): Promise<boolean>;
  setAlwaysOnTop(value: boolean): Promise<boolean>;
  setWindowMode(mode: WindowMode): Promise<void>;
}

export const shellMethods = {
  isAlwaysOnTop: undefined,
  setAlwaysOnTop: z.boolean(),
  setWindowMode: windowModeSchema,
} satisfies MethodTable<ShellApi>;
