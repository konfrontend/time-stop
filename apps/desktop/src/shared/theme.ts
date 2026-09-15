import { z } from 'zod';
import { event, method, type } from '@time-stop/domain';

export const themeModeSchema = z.enum(['system', 'light', 'dark']);
export type ThemeMode = z.infer<typeof themeModeSchema>;

/**
 * Whether the app looks dark, and the Owner's override behind it. The main process resolves the
 * mode against the OS, so the renderer only ever mirrors `isDark` as the `dark` class.
 */
export const theme = {
  isDark: method({ output: type<boolean>() }),
  onChanged: event<boolean>(),
  getMode: method({ output: type<ThemeMode>() }),
  setMode: method({ input: themeModeSchema, output: type<ThemeMode>() }),
};
