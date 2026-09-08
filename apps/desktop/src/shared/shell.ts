import { z } from 'zod';

/** Tracker fits the compact window; Dashboard and Settings need the expanded one. */
export const windowModeSchema = z.enum(['compact', 'expanded']);
export type WindowMode = z.infer<typeof windowModeSchema>;

export interface ShellApi {
  isAlwaysOnTop(): Promise<boolean>;
  setAlwaysOnTop(value: boolean): Promise<boolean>;
  setWindowMode(mode: WindowMode): Promise<void>;
}
