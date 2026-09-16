import { execFile } from 'node:child_process';

// Windows keeps the taskbar's appearance apart from the one apps get, and Electron surfaces
// neither; the registry value behind the Personalization setting is the only reading of it.
const PERSONALIZE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';
const TASKBAR_THEME_VALUE = 'SystemUsesLightTheme';

/** What a fresh Windows install shows, and what an unreadable registry falls back to. */
export const DEFAULT_TASKBAR_IS_DARK = true;

const DWORD = new RegExp(`${TASKBAR_THEME_VALUE}\\s+REG_DWORD\\s+0x([0-9a-f]+)`, 'i');

/** Null when the value is missing — an upgraded Windows that has never been personalized. */
export function parseTaskbarIsDark(regOutput: string): boolean | null {
  const match = DWORD.exec(regOutput);
  return match ? Number.parseInt(match[1]!, 16) === 0 : null;
}

/** Resolves to the default rather than rejecting: a tray icon is not worth a failed launch. */
export function readTaskbarIsDark(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('reg', ['query', PERSONALIZE_KEY, '/v', TASKBAR_THEME_VALUE], (error, stdout) => {
      resolve((error ? null : parseTaskbarIsDark(stdout)) ?? DEFAULT_TASKBAR_IS_DARK);
    });
  });
}
