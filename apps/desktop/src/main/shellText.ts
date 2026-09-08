import { formatDuration, recordDurationMs } from '@time-stop/domain';
import type { Record } from '@time-stop/domain';

export const APP_NAME = 'Time Stop';

/** The tray's status dot, reused as the Dock badge. */
export const RECORDING_DOT = '●';
const STANDBY_DOT = '○';

// Past this the menu bar starts eating the line, so the Project name is dropped instead.
const TRAY_LINE_MAX = 24;

export interface TrayLineInput {
  timer: Record | null;
  projectName: string | null;
  now: number;
}

/** The tray one-liner: a status dot, the running Timer, and the Project name when it fits. */
export function trayLine({ timer, projectName, now }: TrayLineInput): string {
  if (!timer) return `${STANDBY_DOT} Standby`;
  const elapsed = `${RECORDING_DOT} ${formatDuration(recordDurationMs(timer, now))}`;
  if (!projectName) return elapsed;
  const withProject = `${elapsed} ${projectName}`;
  return withProject.length <= TRAY_LINE_MAX ? withProject : elapsed;
}

export function windowTitle(timer: Record | null, now: number): string {
  return timer ? `${APP_NAME} — ${formatDuration(recordDurationMs(timer, now))}` : APP_NAME;
}
