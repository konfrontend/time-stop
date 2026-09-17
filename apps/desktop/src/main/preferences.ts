import type { Preferences } from '@time-stop/db';
import { DESKTOP_PREFIX } from '../shared/desktop';
import { preferences } from '../shared/preferences';
import { registerMethods } from './ipc';

export function registerPreferencesIpc(stored: Preferences): () => void {
  return registerMethods(
    DESKTOP_PREFIX,
    { preferences },
    {
      preferences: {
        async isRecentRecordsOpen() {
          return stored.isRecentRecordsOpen();
        },
        async setRecentRecordsOpen(value) {
          stored.setRecentRecordsOpen(value);
          return value;
        },
      },
    },
  );
}
