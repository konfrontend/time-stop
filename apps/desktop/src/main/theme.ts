import { nativeTheme } from 'electron';
import type { Preferences } from '@app/db';
import { DESKTOP_PREFIX } from '../shared/desktop';
import { theme, type ThemeMode } from '../shared/theme';
import { broadcastEvents, registerMethods } from './ipc';

/** Applies the stored appearance and hands the renderer the resulting look plus every change to it. */
export function registerThemeIpc(preferences: Preferences): () => void {
  nativeTheme.themeSource = preferences.theme();
  const api = {
    theme: {
      async isDark() {
        return nativeTheme.shouldUseDarkColors;
      },
      onChanged(listener: (dark: boolean) => void) {
        const handler = () => listener(nativeTheme.shouldUseDarkColors);
        nativeTheme.on('updated', handler);
        return () => {
          nativeTheme.off('updated', handler);
        };
      },
      async getMode() {
        return preferences.theme();
      },
      async setMode(mode: ThemeMode) {
        preferences.setTheme(mode);
        nativeTheme.themeSource = mode;
        return mode;
      },
    },
  };
  const removeMethods = registerMethods(DESKTOP_PREFIX, { theme }, api);
  const stopEvents = broadcastEvents(DESKTOP_PREFIX, { theme }, api);
  return () => {
    stopEvents();
    removeMethods();
  };
}
