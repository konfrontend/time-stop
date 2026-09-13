import { nativeTheme } from 'electron';
import { DESKTOP_PREFIX } from '../shared/desktop';
import { theme } from '../shared/theme';
import { broadcastEvents, registerMethods } from './ipc';

/** Hands the renderer the OS appearance and every change to it. */
export function registerThemeIpc(): () => void {
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
    },
  };
  const removeMethods = registerMethods(DESKTOP_PREFIX, { theme }, api);
  const stopEvents = broadcastEvents(DESKTOP_PREFIX, { theme }, api);
  return () => {
    stopEvents();
    removeMethods();
  };
}
