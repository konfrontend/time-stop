import type { SqliteDb } from '../open.js';
import { readSetting, writeSetting } from '../settings.js';

const ALWAYS_ON_TOP_KEY = 'windowAlwaysOnTop';

/** Window preferences of the Install, kept in the settings table beside its identity. */
export interface Preferences {
  isAlwaysOnTop(): boolean;
  setAlwaysOnTop(value: boolean): void;
}

export function preferencesOf(db: SqliteDb): Preferences {
  return {
    isAlwaysOnTop: () => readSetting(db, ALWAYS_ON_TOP_KEY) === 'true',
    setAlwaysOnTop: (value) => writeSetting(db, ALWAYS_ON_TOP_KEY, String(value)),
  };
}
