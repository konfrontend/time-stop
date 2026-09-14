import type { SqliteDb } from '../open.js';
import { readSetting, writeSetting } from '../settings.js';

const ALWAYS_ON_TOP_KEY = 'windowAlwaysOnTop';
const WINDOW_WIDTH_KEY = 'windowWidth';
const WINDOW_HEIGHT_KEY = 'windowHeight';
const THEME_KEY = 'theme';

export interface WindowSize {
  width: number;
  height: number;
}

/** The appearance the Owner asked for; `system` follows the OS. */
export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

/** Window and appearance preferences of the Install, kept in the settings table beside its identity. */
export interface Preferences {
  isAlwaysOnTop(): boolean;
  setAlwaysOnTop(value: boolean): void;
  /** The size the window last had; absent until the Owner resizes it once. */
  windowSize(): WindowSize | null;
  setWindowSize(size: WindowSize): void;
  theme(): ThemeMode;
  setTheme(mode: ThemeMode): void;
}

export function preferencesOf(db: SqliteDb): Preferences {
  return {
    isAlwaysOnTop: () => readSetting(db, ALWAYS_ON_TOP_KEY) === 'true',
    setAlwaysOnTop: (value) => writeSetting(db, ALWAYS_ON_TOP_KEY, String(value)),
    windowSize: () => {
      const width = Number(readSetting(db, WINDOW_WIDTH_KEY));
      const height = Number(readSetting(db, WINDOW_HEIGHT_KEY));
      return width > 0 && height > 0 ? { width, height } : null;
    },
    setWindowSize: ({ width, height }) => {
      writeSetting(db, WINDOW_WIDTH_KEY, String(Math.round(width)));
      writeSetting(db, WINDOW_HEIGHT_KEY, String(Math.round(height)));
    },
    theme: () => {
      const stored = readSetting(db, THEME_KEY);
      return THEME_MODES.find((mode) => mode === stored) ?? 'system';
    },
    setTheme: (mode) => writeSetting(db, THEME_KEY, mode === 'system' ? null : mode),
  };
}
